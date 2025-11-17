import React from "react";
import { CardNumberElement, CardExpiryElement, CardCvcElement } from "@stripe/react-stripe-js";
import { Input } from "../ui/Input"; // Ainda usamos para o "Nome"
import type { StripeElementStyle } from "@stripe/stripe-js";

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
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="mt-1">
        <div className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus-within:ring-blue-500 focus-within:border-blue-500">
          {children}
        </div>
      </div>
    </div>
  );
};

export const CreditCardForm: React.FC = () => {
  return (
    <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
      {/* 1. Número do Cartão (Real) */}
      <StripeElementWrapper label="Número do cartão" id="card-number">
        <CardNumberElement id="card-number" options={ELEMENT_OPTIONS} />
      </StripeElementWrapper>

      {/* 2. Nome (continua sendo um Input normal) */}
      {/* O Stripe não coleta nome no elemento do cartão, 
          ele é passado como 'billing_details' */}
      <Input label="Nome impresso no cartão" id="card-name" placeholder="Como está no cartão" />

      <div className="flex space-x-4">
        {/* 3. Validade (Real) */}
        <div className="w-1/2">
          <StripeElementWrapper label="MM/AA" id="card-expiry">
            <CardExpiryElement id="card-expiry" options={ELEMENT_OPTIONS} />
          </StripeElementWrapper>
        </div>

        {/* 4. CVV (Real) */}
        <div className="w-1/2">
          <StripeElementWrapper label="CVV" id="card-cvv">
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
