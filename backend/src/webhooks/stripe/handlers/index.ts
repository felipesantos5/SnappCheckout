// src/webhooks/stripe/handlers/index.ts
import { Stripe } from "stripe";
import { handlePaymentIntentSucceeded, handlePaymentIntentFailed, handlePaymentIntentCreated, handleChargeRefunded } from "./payment-intent.handler";
import { handleAccountUpdated } from "./account.handler";

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
      await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
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

    default:
  }
};
