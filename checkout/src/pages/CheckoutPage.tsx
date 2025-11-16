// src/pages/CheckoutPage.tsx
import React from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { CheckoutForm } from "../components/checkout/CheckoutForm";
import type { OfferData } from "./CheckoutSlugPage";

// 1. Importe 'parseToRgb' e 'getContrast' da biblioteca polished
import { parseToRgb, getContrast } from "polished";

// Leitura da Chave do .env
// const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
// if (!stripeKey) {
//   throw new Error("VITE_STRIPE_PUBLISHABLE_KEY não está definida no .env");
// }

interface CheckoutPageProps {
  offerData: OfferData;
}

const CheckoutPage: React.FC<CheckoutPageProps> = ({ offerData }) => {
  const stripePromise = loadStripe(offerData.ownerId.stripeAccountId);

  // 2. Converta as cores HEX para objetos RGB
  //    (Use cores padrão caso a oferta não tenha cor definida)
  const primaryRgb = parseToRgb(offerData.primaryColor || "#374151");
  const buttonRgb = parseToRgb(offerData.buttonColor || "#2563EB");

  // 3. Crie a string "R G B" para o CSS
  const primaryColorString = `${primaryRgb.red} ${primaryRgb.green} ${primaryRgb.blue}`;
  const buttonColorString = `${buttonRgb.red} ${buttonRgb.green} ${buttonRgb.blue}`;

  // 4. Calcule a cor do texto do botão (preto ou branco)
  const buttonTextColor =
    getContrast(offerData.buttonColor || "#2563EB", "#FFFFFF") > 2.5
      ? "255 255 255" // Branco
      : "0 0 0"; // Preto

  // 5. Defina as variáveis CSS
  const themeStyles = {
    "--color-primary": primaryColorString,
    "--color-button": buttonColorString,
    "--color-button-foreground": buttonTextColor,
  } as React.CSSProperties;

  return (
    // 6. Aplique as variáveis CSS ao contêiner principal
    <div className="min-h-screen bg-gray-100 p-4" style={themeStyles}>
      {/* (Opcional) Injeta globalmente se o style={...} acima falhar */}
      <style>
        {`
          :root {
            --color-primary: ${primaryColorString};
            --color-button: ${buttonColorString};
            --color-button-foreground: ${buttonTextColor};
          }
        `}
      </style>

      <div className="max-w-lg mx-auto bg-white rounded-xl shadow-xl p-6">
        <Elements stripe={stripePromise}>
          <CheckoutForm offerData={offerData} />
        </Elements>
      </div>
    </div>
  );
};

export default CheckoutPage;
