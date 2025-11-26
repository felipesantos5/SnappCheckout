import React from "react";
import { CreditCardForm } from "./CreditCardForm";
import { useTranslation } from "../../i18n/I18nContext";
import { PaymentRequestButtonElement } from "@stripe/react-stripe-js"; // Importar o elemento
import type { PaymentRequest } from "@stripe/stripe-js"; // Importar o tipo
import { AppleyPayIcon } from "../icons/appleyPay";
import { GooglePayIcon } from "../icons/googlePay";
import { useIsDesktop } from "../../helper/useIsDesktop";
// Importar o tipo

// Adicionamos "wallet" aos tipos de pagamento
export type PaymentMethodType = "creditCard" | "pix" | "wallet";

interface PaymentMethodsProps {
  method: PaymentMethodType;
  setMethod: (method: PaymentMethodType) => void;
  paymentRequest: PaymentRequest | null; // Novo prop
  walletLabel: string | null; // Novo prop (ex: "Apple Pay")
}

export const PaymentMethods: React.FC<PaymentMethodsProps> = ({ method, setMethod, paymentRequest, walletLabel }) => {
  const { t } = useTranslation();
  const isDesktop = useIsDesktop();

  const PaymentOption: React.FC<{
    value: PaymentMethodType;
    title: string;
    children?: React.ReactNode;
    icon?: React.ReactNode;
  }> = ({ value, title, children, icon }) => (
    <div
      onClick={() => setMethod(value)}
      className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 ${
        method === value ? "border-blue-500 ring-1 ring-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
      }`}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <input
            type="radio"
            name="paymentMethod"
            checked={method === value}
            onChange={() => setMethod(value)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <label className="ml-3 block text-sm font-medium text-gray-900 cursor-pointer">{title}</label>
        </div>
        <div className="flex space-x-2 items-center">{icon || children}</div>
      </div>
    </div>
  );

  return (
    <div className="w-full mt-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{t.payment.title}</h2>
      <div className="space-y-4">
        {/* Opção 1: Cartão de Crédito */}
        <PaymentOption value="creditCard" title={t.payment.creditCard}>
          <div className="flex gap-1">
            {/* Ícones simplificados para exemplo */}
            <img src="https://assets.mycartpanda.com/cartx-ecomm-ui-assets/images/payment/visa.svg" className="h-6" alt="Visa" />
            <img src="https://assets.mycartpanda.com/cartx-ecomm-ui-assets/images/payment/mastercard.svg" className="h-6" alt="Master" />
          </div>
        </PaymentOption>

        {/* Opção 2: Carteira Digital (Só aparece se disponível) */}
        {paymentRequest && walletLabel && (
          <div className="space-y-2">
            <PaymentOption
              value="wallet"
              title={walletLabel} // Ex: "Apple Pay" ou "Google Pay"
              icon={
                // Ícone dinâmico ou genérico
                <span className="">{walletLabel === "Apple Pay" ? <AppleyPayIcon /> : <GooglePayIcon />}</span>
              }
            />

            {/* Renderiza o botão OFICIAL do Stripe apenas se selecionado */}
            {method === "wallet" && (
              <div className="mt-2 animate-fade-in">
                <div className="h-12 w-full">
                  <PaymentRequestButtonElement options={{ paymentRequest }} className="w-full h-full" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Opção 3: Pix (Exemplo - mantendo sua estrutura anterior se existir) */}
        {/* <PaymentOption value="pix" title="Pix Instantâneo"> ... </PaymentOption> */}
      </div>

      {/* Formulário do Cartão (Só aparece se "creditCard" selecionado) */}
      <div className="mt-6">{method === "creditCard" && <CreditCardForm />}</div>
    </div>
  );
};
