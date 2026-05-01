// src/webhooks/stripe/handlers/index.ts
import { Stripe } from "stripe";
import { handlePaymentIntentSucceeded, handlePaymentIntentFailed, handlePaymentIntentCreated, handleChargeRefunded } from "./payment-intent.handler";
import { handleAccountUpdated } from "./account.handler";
import { handleInvoicePaid, handleInvoicePaymentFailed, handleSubscriptionDeleted } from "./subscription.handler";

/**
 * Router de eventos do Stripe
 * Direciona cada tipo de evento para seu handler específico
 */
export const handleStripeEvent = async (event: Stripe.Event): Promise<void> => {
  switch (event.type) {
    case "payment_intent.created":
      await handlePaymentIntentCreated(event.data.object as Stripe.PaymentIntent);
      break;

    case "payment_intent.succeeded":
      await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent, event.account);
      break;

    case "payment_intent.payment_failed":
      await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
      break;

    case "account.updated":
      const account = event.data.object as Stripe.Account;
      await handleAccountUpdated(account);
      break;

    case "charge.refunded":
      await handleChargeRefunded(event.data.object as Stripe.Charge);
      break;

    // invoice.paid é o evento recomendado pela Stripe (2026) e deve ser habilitado no Dashboard.
    // invoice.payment_succeeded é mantido como fallback enquanto a transição não for feita.
    // A idempotência por stripeInvoiceId garante que apenas uma Sale é criada mesmo se ambos chegarem.
    case "invoice.paid":
    case "invoice.payment_succeeded":
      await handleInvoicePaid(event.data.object as Stripe.Invoice, event.account);
      break;

    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;

    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    default:
  }
};
