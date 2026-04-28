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
  checkoutSessionId: string;
  generateEventId: () => string;
  abTestId: string | null;
}

const CheckoutPage: React.FC<CheckoutPageProps> = ({ offerData, checkoutSessionId, generateEventId, abTestId }) => {
  // CORREÇÃO CRÍTICA: Usar useMemo para evitar recriar o objeto Stripe a cada render
  const stripePromise = useMemo(() => {
    // Verifica se tem o ID da conta conectada para evitar erros
    const accountId = offerData.ownerId?.stripeAccountId;

    if (!accountId) {
      console.error("Stripe Account ID não encontrado na oferta.");
      return null;
    }

    return loadStripe(stripeKey, {
      stripeAccount: accountId,
    });
  }, [offerData.ownerId?.stripeAccountId]);

  const stripeLocale = offerData.language === "en" ? "en" : offerData.language === "fr" ? "fr" : "pt-BR";

  // Se não tiver stripePromise (por falta de ID), não renderiza o Elements para evitar crash
  if (!stripePromise) {
    return <div className="p-4 text-red-500">Erro de configuração: Conta Stripe não vinculada.</div>;
  }

  return (
    <Elements stripe={stripePromise} options={{ locale: stripeLocale }}>
      <CheckoutForm offerData={offerData} checkoutSessionId={checkoutSessionId} generateEventId={generateEventId} abTestId={abTestId} />
    </Elements>
  );
};

export default CheckoutPage;
