// src/pages/CheckoutPage.tsx
import React, { useMemo } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { CheckoutForm } from "../components/checkout/CheckoutForm";
import type { OfferData } from "./CheckoutSlugPage";

const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
if (!stripeKey) {
  throw new Error("VITE_STRIPE_PUBLISHABLE_KEY não está definida no .env");
}

interface CheckoutPageProps {
  offerData: OfferData;
}

const CheckoutPage: React.FC<CheckoutPageProps> = ({ offerData }) => {
  const stripePromise = useMemo(() => {
    return loadStripe(stripeKey, {
      stripeAccount: offerData.ownerId.stripeAccountId,
    });
  }, [offerData.ownerId.stripeAccountId]);

  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm offerData={offerData} />
    </Elements>
  );
};

export default CheckoutPage;
