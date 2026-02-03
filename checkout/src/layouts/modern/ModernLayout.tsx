// src/layouts/modern/ModernLayout.tsx
// TODO: Implementar layout moderno
// Por enquanto, usa o mesmo layout do Classic

import React, { useMemo } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { CheckoutForm } from "../../components/checkout/CheckoutForm";
import type { LayoutProps } from "../LayoutLoader";

const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
if (!stripeKey) {
  throw new Error("VITE_STRIPE_PUBLISHABLE_KEY is not set");
}

const ModernLayout: React.FC<LayoutProps> = ({
  offerData,
  checkoutSessionId,
  generateEventId,
  abTestId,
}) => {
  const stripePromise = useMemo(() => {
    const accountId = offerData.ownerId?.stripeAccountId;

    if (!accountId) {
      console.error("Stripe Account ID not found.");
      return null;
    }

    return loadStripe(stripeKey, {
      stripeAccount: accountId,
    });
  }, [offerData.ownerId?.stripeAccountId]);

  if (!stripePromise) {
    return (
      <div className="p-4 text-red-500">
        Erro de configuracao: Conta Stripe nao vinculada.
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm
        offerData={offerData}
        checkoutSessionId={checkoutSessionId}
        generateEventId={generateEventId}
        abTestId={abTestId}
      />
    </Elements>
  );
};

export default ModernLayout;
