// src/webhooks/stripe/handlers/subscription.handler.ts
import { Stripe } from "stripe";
import Sale from "../../../models/sale.model";
import Offer from "../../../models/offer.model";
import stripe from "../../../lib/stripe";

/**
 * Handler para invoice.payment_succeeded em renovações de assinatura.
 * O pagamento inicial já é coberto pelo payment_intent.succeeded (com metadata do PI).
 * Este handler cuida apenas das cobranças recorrentes (subscription_cycle).
 */
export const handleInvoicePaymentSucceeded = async (invoice: Stripe.Invoice): Promise<void> => {
  try {
    // Processa apenas renovações automáticas — o pagamento inicial é coberto pelo payment_intent.succeeded
    if (invoice.billing_reason !== "subscription_cycle") {
      return;
    }

    const invoiceAny = invoice as any;
    const subscriptionId = typeof invoiceAny.subscription === "string" ? invoiceAny.subscription : invoiceAny.subscription?.id;
    if (!subscriptionId) {
      console.error("❌ [Subscription] invoice sem subscription ID");
      return;
    }

    const piId = typeof invoiceAny.payment_intent === "string" ? invoiceAny.payment_intent : invoiceAny.payment_intent?.id;
    if (!piId) {
      console.error("❌ [Subscription] invoice sem payment_intent ID");
      return;
    }

    // Idempotência
    const existing = await Sale.findOne({ stripePaymentIntentId: piId });
    if (existing) return;

    // Busca todas as vendas anteriores dessa assinatura para obter oferta, dono e ciclo atual
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
    console.error(`❌ [Subscription] Erro ao processar renovação: ${error.message}`);
  }
};
