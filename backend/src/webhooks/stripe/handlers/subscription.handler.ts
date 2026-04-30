// src/webhooks/stripe/handlers/subscription.handler.ts
import { Stripe } from "stripe";
import Sale from "../../../models/sale.model";
import Offer from "../../../models/offer.model";
import User from "../../../models/user.model";
import { getCountryFromIP } from "../../../helper/getCountryFromIP";
import stripe from "../../../lib/stripe";
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

const createPaymentIntentFromInvoice = (
  invoice: Stripe.Invoice,
  paymentIntentId: string,
): Stripe.PaymentIntent => ({
  id: paymentIntentId,
  object: "payment_intent",
  amount: invoice.amount_paid,
  currency: invoice.currency || "brl",
  customer: invoice.customer as any,
  created: invoice.created || Math.floor(Date.now() / 1000),
  livemode: invoice.livemode,
  metadata: {},
} as Stripe.PaymentIntent);

const shouldDispatchSubscriptionIntegrations = (sale: any): boolean => {
  return !sale.integrationsHuskySent || !sale.integrationsUtmfySent || !sale.integrationsGenericWebhookSent;
};

export const handleInvoicePaymentSucceeded = async (invoice: Stripe.Invoice, _stripeAccountId?: string): Promise<void> => {
  try {
    const invoiceAny = invoice as any;
    const subDetails = invoiceAny.parent?.subscription_details ?? invoiceAny.subscription_details;
    const subscriptionId: string | undefined =
      subDetails?.subscription
      ?? (typeof invoiceAny.subscription === "string" ? invoiceAny.subscription : invoiceAny.subscription?.id);
    const meta: Record<string, string> = subDetails?.metadata || {};

    if (!subscriptionId) {
      console.error("[Subscription] invoice sem subscription ID");
      return;
    }

    let piId: string | undefined =
      typeof invoiceAny.payment_intent === "string"
        ? invoiceAny.payment_intent
        : invoiceAny.payment_intent?.id;

    if (!piId) {
      const offerSlug = meta.offerSlug;
      let accountId = _stripeAccountId;

      if (!accountId && offerSlug) {
        const offerForAccount = await Offer.findOne({ slug: offerSlug }).populate("ownerId");
        if (offerForAccount) {
          accountId = (offerForAccount.ownerId as any)?.stripeAccountId;
        }
      }

      if (!accountId && invoice.billing_reason === "subscription_cycle") {
        const prevSale = await Sale.findOne({ stripeSubscriptionId: subscriptionId }).populate("ownerId");
        if (prevSale) {
          accountId = (prevSale.ownerId as any)?.stripeAccountId;
        }
      }

      if (accountId) {
        try {
          const customerId = typeof invoice.customer === "string"
            ? invoice.customer
            : (invoice.customer as any)?.id;

          if (customerId) {
            const pis = await stripe.paymentIntents.list(
              { customer: customerId, limit: 5 },
              { stripeAccount: accountId },
            );
            const matchingPi = pis.data.find((pi: any) =>
              pi.payment_details?.order_reference === invoice.id
            );
            if (matchingPi) {
              piId = matchingPi.id;
            }
          }
        } catch (err: any) {
          console.warn(`[Subscription] Erro ao resolver PI via API: ${err.message}`);
        }
      }

      piId = piId || `sub_inv_${invoice.id}`;
    }

    const existing = await Sale.findOne({ stripePaymentIntentId: piId });
    if (existing) {
      if (!existing.stripeSubscriptionId) {
        existing.stripeSubscriptionId = subscriptionId;
        if (!existing.subscriptionCycle) existing.subscriptionCycle = 1;
        await existing.save();
      }

      if (existing.status === "succeeded" && shouldDispatchSubscriptionIntegrations(existing)) {
        const offer = await Offer.findById(existing.offerId).populate("ownerId");
        if (offer) {
          const items = existing.items?.length
            ? existing.items as SubscriptionSaleItem[]
            : buildSubscriptionSaleItems(offer, meta, invoice.amount_paid);

          await dispatchSubscriptionSaleIntegrations({
            offer: offer as any,
            sale: existing,
            items,
            paymentIntent: createPaymentIntentFromInvoice(invoice, piId),
            metadata: meta,
            customerPhone: existing.customerPhone || meta.customerPhone || "",
          });
        }
      }
      return;
    }

    if (invoice.billing_reason === "subscription_create") {
      const offerSlug = meta.offerSlug;
      if (!offerSlug) {
        console.error("[Subscription] offerSlug nao encontrado em invoice.subscription_details.metadata");
        return;
      }

      const offer = await Offer.findOne({ slug: offerSlug }).populate("ownerId");
      if (!offer) {
        console.error(`[Subscription] Oferta '${offerSlug}' nao encontrada`);
        return;
      }

      const customerEmail = meta.customerEmail || "email@nao.informado";
      const customerName = meta.customerName || "Cliente Nao Identificado";
      const customerPhone = meta.customerPhone || "";
      const clientIp = meta.ip || "";
      const countryCode = clientIp ? getCountryFromIP(clientIp) : "BR";

      const ownerUser = await User.findById(offer.ownerId).select("platformFeePercent").lean();
      const feePercent = ownerUser?.platformFeePercent ?? 3;
      const items = buildSubscriptionSaleItems(offer, meta, invoice.amount_paid);

      const sale = await Sale.create({
        ownerId: offer.ownerId,
        offerId: offer._id,
        stripePaymentIntentId: piId,
        stripeSubscriptionId: subscriptionId,
        subscriptionCycle: 1,
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
        paymentIntent: createPaymentIntentFromInvoice(invoice, piId),
        metadata: meta,
        customerPhone,
      });

      console.log(`[Subscription] Venda inicial registrada: sub ${subscriptionId}, pi ${piId}`);
      return;
    }

    if (invoice.billing_reason !== "subscription_cycle") {
      return;
    }

    const previousSales = await Sale.find({ stripeSubscriptionId: subscriptionId })
      .populate("offerId")
      .populate("ownerId")
      .sort({ createdAt: 1 });

    if (!previousSales.length) {
      console.error(`[Subscription] Nenhuma venda anterior encontrada para sub ${subscriptionId}`);
      return;
    }

    const previousSale = previousSales[previousSales.length - 1];
    const offer = previousSale.offerId as any;
    const owner = previousSale.ownerId as any;
    if (!owner?.stripeAccountId) {
      console.error("[Subscription] Vendedor sem stripeAccountId");
      return;
    }

    const maxCycle = previousSales.reduce((max, sale) => Math.max(max, sale.subscriptionCycle ?? 1), 1);
    const nextCycle = maxCycle + 1;
    const items = previousSale.items?.length
      ? previousSale.items as SubscriptionSaleItem[]
      : buildSubscriptionSaleItems(offer, {}, invoice.amount_paid);

    const sale = await Sale.create({
      ownerId: owner._id,
      offerId: offer._id,
      stripePaymentIntentId: piId,
      stripeSubscriptionId: subscriptionId,
      subscriptionCycle: nextCycle,
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

    await dispatchSubscriptionSaleIntegrations({
      offer: offer as any,
      sale,
      items,
      paymentIntent: createPaymentIntentFromInvoice(invoice, piId),
      metadata: renewalMetadata,
      customerPhone: previousSale.customerPhone || "",
    });

    console.log(`[Subscription] Renovacao registrada: sub ${subscriptionId}, pi ${piId}`);
  } catch (error: any) {
    console.error(`[Subscription] Erro ao processar invoice: ${error.message}`);
  }
};
