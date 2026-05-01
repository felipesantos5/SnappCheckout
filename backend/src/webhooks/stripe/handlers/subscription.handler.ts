// src/webhooks/stripe/handlers/subscription.handler.ts
import { Stripe } from "stripe";
import Sale from "../../../models/sale.model";
import Offer from "../../../models/offer.model";
import User from "../../../models/user.model";
import { getCountryFromIP } from "../../../helper/getCountryFromIP";
import { dispatchSubscriptionSaleIntegrations } from "../../../services/subscription-sale-integration.service";

type SubscriptionSaleItem = {
  _id?: string;
  name: string;
  priceInCents: number;
  isOrderBump: boolean;
  compareAtPriceInCents?: number;
  customId?: string;
};

const parseSelectedOrderBumps = (metadata: Record<string, string>): string[] => {
  try {
    const parsed = metadata.selectedOrderBumps ? JSON.parse(metadata.selectedOrderBumps) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const buildSubscriptionSaleItems = (
  offer: any,
  metadata: Record<string, string>,
  fallbackAmountInCents: number,
): SubscriptionSaleItem[] => {
  const mainProduct = offer.mainProduct || {};
  const items: SubscriptionSaleItem[] = [
    {
      _id: mainProduct._id?.toString(),
      name: mainProduct.name || offer.name || "Assinatura",
      priceInCents: mainProduct.priceInCents || fallbackAmountInCents,
      compareAtPriceInCents: mainProduct.compareAtPriceInCents,
      isOrderBump: false,
      customId: mainProduct.customId,
    },
  ];

  const selectedOrderBumps = parseSelectedOrderBumps(metadata);
  for (const bumpId of selectedOrderBumps) {
    const bump = offer.orderBumps?.find((item: any) => item?._id?.toString() === bumpId);
    if (bump) {
      items.push({
        _id: bump._id?.toString(),
        name: bump.name,
        priceInCents: bump.priceInCents,
        compareAtPriceInCents: bump.compareAtPriceInCents,
        isOrderBump: true,
        customId: bump.customId,
      });
    }
  }

  return items;
};

const buildFakePaymentIntent = (invoice: Stripe.Invoice): Stripe.PaymentIntent => ({
  id: (invoice as any).payment_intent ?? `sub_inv_${invoice.id}`,
  object: "payment_intent",
  amount: invoice.amount_paid,
  currency: invoice.currency || "brl",
  customer: invoice.customer as any,
  created: invoice.created || Math.floor(Date.now() / 1000),
  livemode: invoice.livemode,
  metadata: {},
} as Stripe.PaymentIntent);

const shouldDispatchIntegrations = (sale: any): boolean =>
  !sale.integrationsHuskySent || !sale.integrationsUtmfySent || !sale.integrationsGenericWebhookSent;

// ---------------------------------------------------------------------------
// invoice.paid — fonte canônica para criação de Sales de assinatura
// Substitui invoice.payment_succeeded para cobrir também pagamentos manuais
// ---------------------------------------------------------------------------
export const handleInvoicePaid = async (invoice: Stripe.Invoice, _stripeAccountId?: string): Promise<void> => {
  try {
    const invoiceAny = invoice as any;

    // Suporte a ambas as versões da API da Stripe:
    // API >=2025-10-29: invoice.parent.subscription_details
    // API antiga:       invoice.subscription_details
    const subDetails = invoiceAny.parent?.subscription_details ?? invoiceAny.subscription_details;
    const subscriptionId: string | undefined =
      subDetails?.subscription
      ?? (typeof invoiceAny.subscription === "string" ? invoiceAny.subscription : invoiceAny.subscription?.id);
    const meta: Record<string, string> = subDetails?.metadata || {};

    if (!subscriptionId) {
      console.error("[Subscription] invoice.paid sem subscriptionId — ignorando");
      return;
    }

    // Idempotência por invoice ID (mais confiável que por PI, que pode ser sintético)
    const existing = await Sale.findOne({ stripeInvoiceId: invoice.id });
    if (existing) {
      // Sale já existe — retentar integrações se necessário
      if (existing.status === "succeeded" && shouldDispatchIntegrations(existing)) {
        const offer = await Offer.findById(existing.offerId).populate("ownerId");
        if (offer) {
          const items = existing.items?.length
            ? existing.items as SubscriptionSaleItem[]
            : buildSubscriptionSaleItems(offer, meta, invoice.amount_paid);
          await dispatchSubscriptionSaleIntegrations({
            offer: offer as any,
            sale: existing,
            items,
            paymentIntent: buildFakePaymentIntent(invoice),
            metadata: meta,
            customerPhone: existing.customerPhone || meta.customerPhone || "",
          });
        }
      }
      return;
    }

    // -----------------------------------------------------------------------
    // Primeira cobrança (subscription_create)
    // -----------------------------------------------------------------------
    if (invoice.billing_reason === "subscription_create") {
      const offerSlug = meta.offerSlug;
      if (!offerSlug) {
        console.error("[Subscription] offerSlug ausente no metadata da assinatura");
        return;
      }

      const offer = await Offer.findOne({ slug: offerSlug }).populate("ownerId");
      if (!offer) {
        console.error(`[Subscription] Oferta '${offerSlug}' não encontrada`);
        return;
      }

      const customerEmail = meta.customerEmail || "email@nao.informado";
      const customerName = meta.customerName || "Cliente Não Identificado";
      const customerPhone = meta.customerPhone || "";
      const clientIp = meta.ip || "";
      const countryCode = clientIp ? getCountryFromIP(clientIp) : "BR";

      const ownerUser = await User.findById(offer.ownerId).select("platformFeePercent").lean();
      const feePercent = ownerUser?.platformFeePercent ?? 3;
      const items = buildSubscriptionSaleItems(offer, meta, invoice.amount_paid);

      // Tenta preservar o PI real se disponível (para rastreamento no dashboard Stripe)
      const piId: string =
        (typeof invoiceAny.payment_intent === "string" ? invoiceAny.payment_intent : invoiceAny.payment_intent?.id)
        ?? `sub_inv_${invoice.id}`;

      const sale = await Sale.create({
        ownerId: offer.ownerId,
        offerId: offer._id,
        stripePaymentIntentId: piId,
        stripeInvoiceId: invoice.id,
        stripeSubscriptionId: subscriptionId,
        subscriptionCycle: 1,
        subscriptionStatus: "active",
        isRenewalAttempt: false,
        customerName,
        customerEmail,
        customerPhone,
        ip: clientIp,
        country: countryCode,
        totalAmountInCents: invoice.amount_paid,
        platformFeeInCents: Math.round(invoice.amount_paid * (feePercent / 100)),
        currency: invoice.currency || "brl",
        status: "succeeded",
        paymentMethod: "stripe",
        gateway: "stripe",
        paymentMethodType: "card",
        isUpsell: false,
        isDownsell: false,
        items,
        utm_source: meta.utm_source || "",
        utm_medium: meta.utm_medium || "",
        utm_campaign: meta.utm_campaign || "",
        utm_term: meta.utm_term || "",
        utm_content: meta.utm_content || "",
        facebookPurchaseSendAfter: new Date(Date.now() + 10 * 60 * 1000),
      });

      await dispatchSubscriptionSaleIntegrations({
        offer: offer as any,
        sale,
        items,
        paymentIntent: buildFakePaymentIntent(invoice),
        metadata: meta,
        customerPhone,
      });

      console.log(`[Subscription] Venda inicial registrada: sub ${subscriptionId}, invoice ${invoice.id}`);
      return;
    }

    // -----------------------------------------------------------------------
    // Renovação (subscription_cycle) e pro-ratas (subscription_update)
    // -----------------------------------------------------------------------
    if (invoice.billing_reason !== "subscription_cycle" && invoice.billing_reason !== "subscription_update") {
      return;
    }

    const previousSales = await Sale.find({ stripeSubscriptionId: subscriptionId })
      .populate("offerId")
      .populate("ownerId")
      .sort({ createdAt: 1 });

    if (!previousSales.length) {
      console.error(`[Subscription] Nenhuma venda anterior para sub ${subscriptionId} — não é possível criar renovação`);
      return;
    }

    const previousSale = previousSales[previousSales.length - 1];
    const offer = previousSale.offerId as any;
    const owner = previousSale.ownerId as any;

    if (!owner?._id) {
      console.error("[Subscription] ownerId não disponível na venda anterior");
      return;
    }

    const maxCycle = previousSales.reduce((max, s) => Math.max(max, s.subscriptionCycle ?? 1), 1);
    const nextCycle = maxCycle + 1;
    const items = previousSale.items?.length
      ? previousSale.items as SubscriptionSaleItem[]
      : buildSubscriptionSaleItems(offer, {}, invoice.amount_paid);

    const piId: string =
      (typeof invoiceAny.payment_intent === "string" ? invoiceAny.payment_intent : invoiceAny.payment_intent?.id)
      ?? `sub_inv_${invoice.id}`;

    const renewalMetadata = {
      customerPhone: previousSale.customerPhone || "",
      ip: previousSale.ip || "",
      userAgent: previousSale.userAgent || "",
      utm_source: previousSale.utm_source || "",
      utm_medium: previousSale.utm_medium || "",
      utm_campaign: previousSale.utm_campaign || "",
      utm_term: previousSale.utm_term || "",
      utm_content: previousSale.utm_content || "",
    };

    const sale = await Sale.create({
      ownerId: owner._id,
      offerId: offer._id,
      stripePaymentIntentId: piId,
      stripeInvoiceId: invoice.id,
      stripeSubscriptionId: subscriptionId,
      subscriptionCycle: nextCycle,
      subscriptionStatus: "active",
      isRenewalAttempt: true,
      customerName: previousSale.customerName,
      customerEmail: previousSale.customerEmail,
      customerPhone: previousSale.customerPhone || "",
      ip: previousSale.ip || "",
      country: previousSale.country || "BR",
      totalAmountInCents: invoice.amount_paid,
      platformFeeInCents: Math.round(invoice.amount_paid * ((owner.platformFeePercent ?? 3) / 100)),
      currency: invoice.currency || "brl",
      status: "succeeded",
      paymentMethod: "stripe",
      gateway: "stripe",
      paymentMethodType: "card",
      isUpsell: false,
      isDownsell: false,
      items,
      utm_source: previousSale.utm_source || "",
      utm_medium: previousSale.utm_medium || "",
      utm_campaign: previousSale.utm_campaign || "",
      utm_term: previousSale.utm_term || "",
      utm_content: previousSale.utm_content || "",
      facebookPurchaseSendAfter: new Date(Date.now() + 10 * 60 * 1000),
    });

    await dispatchSubscriptionSaleIntegrations({
      offer: offer as any,
      sale,
      items,
      paymentIntent: buildFakePaymentIntent(invoice),
      metadata: renewalMetadata,
      customerPhone: previousSale.customerPhone || "",
    });

    console.log(`[Subscription] Renovação registrada: sub ${subscriptionId}, ciclo ${nextCycle}, invoice ${invoice.id}`);
  } catch (error: any) {
    console.error(`[Subscription] Erro ao processar invoice.paid: ${error.message}`);
  }
};

// ---------------------------------------------------------------------------
// invoice.payment_failed — registra tentativa falhada de renovação
// ---------------------------------------------------------------------------
export const handleInvoicePaymentFailed = async (invoice: Stripe.Invoice): Promise<void> => {
  try {
    const invoiceAny = invoice as any;
    const subDetails = invoiceAny.parent?.subscription_details ?? invoiceAny.subscription_details;
    const subscriptionId: string | undefined =
      subDetails?.subscription
      ?? (typeof invoiceAny.subscription === "string" ? invoiceAny.subscription : invoiceAny.subscription?.id);

    if (!subscriptionId) {
      return;
    }

    // Idempotência — não criar duplicata se já registrado
    const existing = await Sale.findOne({ stripeInvoiceId: invoice.id, status: "failed" });
    if (existing) return;

    const previousSales = await Sale.find({ stripeSubscriptionId: subscriptionId })
      .populate("offerId")
      .populate("ownerId")
      .sort({ createdAt: 1 });

    if (!previousSales.length) {
      console.warn(`[Subscription] invoice.payment_failed sem histórico para sub ${subscriptionId}`);
      return;
    }

    const previousSale = previousSales[previousSales.length - 1];
    const offer = previousSale.offerId as any;
    const owner = previousSale.ownerId as any;

    const piId: string =
      (typeof invoiceAny.payment_intent === "string" ? invoiceAny.payment_intent : invoiceAny.payment_intent?.id)
      ?? `sub_inv_failed_${invoice.id}`;

    // Extrair motivo da falha da última tentativa de pagamento
    const lastAttemptError = invoiceAny.last_finalization_error;
    const failureReason = lastAttemptError?.code || "payment_failed";
    const failureMessage = lastAttemptError?.message || "Pagamento da renovação recusado";

    const maxCycle = previousSales
      .filter(s => s.status === "succeeded")
      .reduce((max, s) => Math.max(max, s.subscriptionCycle ?? 1), 1);

    await Sale.create({
      ownerId: owner._id,
      offerId: offer._id,
      stripePaymentIntentId: piId,
      stripeInvoiceId: invoice.id,
      stripeSubscriptionId: subscriptionId,
      subscriptionCycle: maxCycle + 1,
      subscriptionStatus: "past_due",
      isRenewalAttempt: true,
      customerName: previousSale.customerName,
      customerEmail: previousSale.customerEmail,
      customerPhone: previousSale.customerPhone || "",
      ip: previousSale.ip || "",
      country: previousSale.country || "BR",
      totalAmountInCents: invoice.amount_due,
      platformFeeInCents: 0,
      currency: invoice.currency || "brl",
      status: "failed",
      paymentMethod: "stripe",
      gateway: "stripe",
      paymentMethodType: "card",
      failureReason,
      failureMessage,
      isUpsell: false,
      isDownsell: false,
      items: previousSale.items || [],
      utm_source: previousSale.utm_source || "",
      utm_medium: previousSale.utm_medium || "",
      utm_campaign: previousSale.utm_campaign || "",
      utm_term: previousSale.utm_term || "",
      utm_content: previousSale.utm_content || "",
    });

    console.log(`[Subscription] Falha de renovação registrada: sub ${subscriptionId}, invoice ${invoice.id}`);
  } catch (error: any) {
    console.error(`[Subscription] Erro ao processar invoice.payment_failed: ${error.message}`);
  }
};

// ---------------------------------------------------------------------------
// customer.subscription.deleted — marca assinatura como cancelada
// ---------------------------------------------------------------------------
export const handleSubscriptionDeleted = async (subscription: Stripe.Subscription): Promise<void> => {
  try {
    const result = await Sale.updateMany(
      { stripeSubscriptionId: subscription.id },
      { $set: { subscriptionStatus: "canceled" } },
    );
    console.log(`[Subscription] Cancelamento: sub ${subscription.id} — ${result.modifiedCount} venda(s) marcadas como canceled`);
  } catch (error: any) {
    console.error(`[Subscription] Erro ao processar customer.subscription.deleted: ${error.message}`);
  }
};
