// src/webhooks/stripe/handlers/subscription.handler.ts
import { Stripe } from "stripe";
import Sale from "../../../models/sale.model";
import Offer from "../../../models/offer.model";
import { getCountryFromIP } from "../../../helper/getCountryFromIP";
import stripe from "../../../lib/stripe";

export const handleInvoicePaymentSucceeded = async (invoice: Stripe.Invoice, _stripeAccountId?: string): Promise<void> => {
  try {
    const invoiceAny = invoice as any;

    // API >=2025-10-29: subscription e metadata ficam em invoice.parent.subscription_details
    // API antiga: subscription em invoice.subscription, metadata em invoice.subscription_details.metadata
    const subDetails = invoiceAny.parent?.subscription_details ?? invoiceAny.subscription_details;
    const subscriptionId: string | undefined =
      subDetails?.subscription
      ?? (typeof invoiceAny.subscription === "string" ? invoiceAny.subscription : invoiceAny.subscription?.id);

    if (!subscriptionId) {
      console.error("❌ [Subscription] invoice sem subscription ID");
      return;
    }

    // API antiga: invoice.payment_intent = "pi_xxx"
    // API >=2025-03-31: payment_intent removido do Invoice object.
    // Quando piId ausente, resolvemos via Stripe API usando o owner's stripeAccountId.
    let piId: string | undefined =
      typeof invoiceAny.payment_intent === "string"
        ? invoiceAny.payment_intent
        : invoiceAny.payment_intent?.id;

    // Se piId ausente (API nova), resolver via offerSlug → owner → Stripe API
    if (!piId) {
      const meta: Record<string, string> = subDetails?.metadata || {};
      const offerSlug = meta.offerSlug;

      let accountId = _stripeAccountId;

      // Tentar resolver accountId via oferta
      if (!accountId && offerSlug) {
        const offerForAccount = await Offer.findOne({ slug: offerSlug }).populate("ownerId");
        if (offerForAccount) {
          accountId = (offerForAccount.ownerId as any)?.stripeAccountId;
        }
      }

      // Para subscription_cycle sem offerSlug, buscar vendas anteriores para obter accountId
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
              { stripeAccount: accountId }
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

      // Fallback: usar chave única baseada no invoice ID
      if (!piId) {
        piId = "sub_inv_" + invoice.id;
      }
    }

    // Idempotência
    const existing = await Sale.findOne({ stripePaymentIntentId: piId });
    if (existing) {
      if (!existing.stripeSubscriptionId) {
        existing.stripeSubscriptionId = subscriptionId;
        if (!existing.subscriptionCycle) existing.subscriptionCycle = 1;
        await existing.save();
      }
      return;
    }

    // --- PAGAMENTO INICIAL DA ASSINATURA ---
    if (invoice.billing_reason === "subscription_create") {
      const meta: Record<string, string> = subDetails?.metadata || {};
      const offerSlug = meta.offerSlug;

      if (!offerSlug) {
        console.error("❌ [Subscription] offerSlug não encontrado em invoice.subscription_details.metadata");
        return;
      }

      const offer = await Offer.findOne({ slug: offerSlug });
      if (!offer) {
        console.error(`❌ [Subscription] Oferta '${offerSlug}' não encontrada`);
        return;
      }

      const customerEmail = meta.customerEmail || "email@nao.informado";
      const customerName = meta.customerName || "Cliente Não Identificado";
      const customerPhone = meta.customerPhone || "";
      const clientIp = meta.ip || "";
      const countryCode = clientIp ? getCountryFromIP(clientIp) : "BR";

      await Sale.create({
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
        platformFeeInCents: Math.round(invoice.amount_paid * 0.05),
        currency: invoice.currency || "brl",
        status: "succeeded",
        paymentMethod: "stripe",
        gateway: "stripe",
        paymentMethodType: "card",
        isUpsell: false,
        isDownsell: false,
        items: [
          {
            name: offer.mainProduct?.name || offer.name || "Assinatura",
            priceInCents: invoice.amount_paid,
            isOrderBump: false,
          },
        ],
        utm_source: meta.utm_source || "",
        utm_medium: meta.utm_medium || "",
        utm_campaign: meta.utm_campaign || "",
        utm_term: meta.utm_term || "",
        utm_content: meta.utm_content || "",
        facebookPurchaseSendAfter: new Date(Date.now() + 10 * 60 * 1000),
      });

      console.log(`✅ [Subscription] Venda inicial registrada: sub ${subscriptionId}, pi ${piId}`);
      return;
    }

    // --- RENOVAÇÃO AUTOMÁTICA (subscription_cycle) ---
    if (invoice.billing_reason !== "subscription_cycle") {
      return;
    }

    // Busca vendas anteriores dessa assinatura para obter oferta, dono e ciclo atual
    const previousSales = await Sale.find({ stripeSubscriptionId: subscriptionId })
      .populate("offerId")
      .populate("ownerId")
      .sort({ createdAt: 1 });

    if (!previousSales.length) {
      console.error(`❌ [Subscription] Nenhuma venda anterior encontrada para sub ${subscriptionId}`);
      return;
    }

    const previousSale = previousSales[previousSales.length - 1];
    const offer = previousSale.offerId as any;
    const owner = previousSale.ownerId as any;
    if (!owner?.stripeAccountId) {
      console.error("❌ [Subscription] Vendedor sem stripeAccountId");
      return;
    }

    // Calcula o ciclo: a venda inicial tem ciclo 1 (ou null), as renovações partem de 2
    const maxCycle = previousSales.reduce((max, s) => Math.max(max, s.subscriptionCycle ?? 1), 1);
    const nextCycle = maxCycle + 1;

    await Sale.create({
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
      platformFeeInCents: Math.round(invoice.amount_paid * 0.05),
      currency: invoice.currency || "brl",
      status: "succeeded",
      paymentMethod: "stripe",
      gateway: "stripe",
      paymentMethodType: "card",
      isUpsell: false,
      isDownsell: false,
      items: [
        {
          name: offer.mainProduct?.name || offer.name || "Assinatura",
          priceInCents: invoice.amount_paid,
          isOrderBump: false,
        },
      ],
      utm_source: previousSale.utm_source || "",
      utm_medium: previousSale.utm_medium || "",
      utm_campaign: previousSale.utm_campaign || "",
      utm_term: previousSale.utm_term || "",
      utm_content: previousSale.utm_content || "",
      facebookPurchaseSendAfter: new Date(Date.now() + 10 * 60 * 1000),
    });

    console.log(`✅ [Subscription] Renovação registrada: sub ${subscriptionId}, pi ${piId}`);
  } catch (error: any) {
    console.error(`❌ [Subscription] Erro ao processar invoice: ${error.message}`);
  }
};
