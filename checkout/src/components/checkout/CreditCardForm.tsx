import React from "react";
import { CardNumberElement, CardExpiryElement, CardCvcElement } from "@stripe/react-stripe-js";
import { Input } from "../ui/Input"; // Ainda usamos para o "Nome"
import type { StripeElementStyle } from "@stripe/stripe-js";
import { useTranslation } from "../../i18n/I18nContext";
import { useTheme } from "../../context/ThemeContext";

// ESTILO DOS ELEMENTOS STRIPE
// Isso é crucial para o white-label.
// Criamos um estilo que "imita" nosso Input.tsx
const ELEMENT_STYLES: StripeElementStyle = {
  base: {
    color: "#374151", // text-gray-700
    fontFamily: "inherit",
    fontSize: "14px", // sm:text-sm
    "::placeholder": {
      color: "#9CA3AF", // text-gray-400
    },
  },
  invalid: {
    color: "#EF4444", // text-red-500
    iconColor: "#EF4444",
  },
};

// Opções para passar aos elementos, aplicando o estilo
const ELEMENT_OPTIONS = {
  style: ELEMENT_STYLES,
  // O style do 'Input.tsx' é:
  // "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm ..."
  // Vamos aplicar essas classes no wrapper do Element
};

// Wrapper customizado para aplicar o estilo do Tailwind
const StripeElementWrapper: React.FC<{ children: React.ReactNode; label: string; id: string }> = ({ children, label, id }) => {
  const { primary, textColor } = useTheme();

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium" style={{ color: textColor }}>
        {label}
      </label>
      <div className="mt-1">
        <div
          // AQUI: Usamos a variável CSS definida no style para o ring e o border
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm transition-all duration-200 focus-within:ring-1 focus-within:ring-(--theme-primary) focus-within:border-(--theme-primary) hover:border-(--theme-primary)"
          style={
            {
              "--theme-primary": primary,
            } as React.CSSProperties
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export const CreditCardForm: React.FC = () => {
  const { t } = useTranslation();
  const { textColor } = useTheme();

  return (
    <div className="space-y-4 p-4 border rounded-lg" style={{ color: textColor }}>
      {/* 1. Número do Cartão (Real) */}
      <StripeElementWrapper label={t.creditCard.cardNumber} id="card-number">
        <CardNumberElement id="card-number" options={ELEMENT_OPTIONS} />
      </StripeElementWrapper>

      {/* 2. Nome (continua sendo um Input normal) */}
      {/* O Stripe não coleta nome no elemento do cartão,
          ele é passado como 'billing_details' */}
      <Input label={t.creditCard.cardholderName} id="card-name" placeholder={t.creditCard.cardholderNamePlaceholder} />

      <div className="flex space-x-4">
        {/* 3. Validade (Real) */}
        <div className="w-1/2">
          <StripeElementWrapper label={t.creditCard.expiry} id="card-expiry">
            <CardExpiryElement id="card-expiry" options={ELEMENT_OPTIONS} />
          </StripeElementWrapper>
        </div>

        {/* 4. CVV (Real) */}
        <div className="w-1/2">
          <StripeElementWrapper label={t.creditCard.cvc} id="card-cvv">
            <CardCvcElement id="card-cvv" options={ELEMENT_OPTIONS} />
          </StripeElementWrapper>
        </div>
      </div>

      {/* <div>
        <label htmlFor="installments" className="block text-sm font-medium text-gray-700">
          Parcelas
        </label>
        <select
          id="installments"
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        >
          <option>6x de R$ 9,33</option>
        </select>
      </div> */}
    </div>
  );
};
