import React from "react";
import { CreditCardForm } from "./CreditCardForm";
import { useTranslation } from "../../i18n/I18nContext";
import { useTheme } from "../../context/ThemeContext";
import { PaymentRequestButtonElement } from "@stripe/react-stripe-js";
import type { PaymentRequest } from "@stripe/stripe-js";
import { AppleyPayIcon } from "../icons/appleyPay";
import { GooglePayIcon } from "../icons/googlePay";

export type PaymentMethodType = "creditCard" | "pix" | "wallet";

interface PaymentMethodsProps {
  method: PaymentMethodType;
  setMethod: (method: PaymentMethodType) => void;
  paymentRequest: PaymentRequest | null;
  walletLabel: string | null;
}

export const PaymentMethods: React.FC<PaymentMethodsProps> = ({ method, setMethod, paymentRequest, walletLabel }) => {
  const { t } = useTranslation();
  const { textColor, backgroundColor, primary } = useTheme();

  const PaymentOption: React.FC<{
    value: PaymentMethodType;
    title: string;
    children?: React.ReactNode;
    icon?: React.ReactNode;
  }> = ({ value, title, children, icon }) => {
    const isSelected = method === value;

    return (
      <div
        onClick={() => setMethod(value)}
        className="border rounded-lg p-4 cursor-pointer transition-all duration-200"
        style={{
          // Se selecionado, usa uma borda da cor primária e um fundo sutil (primary com 5% de opacidade)
          // Se não, usa borda baseada na cor do texto (20% opacidade) e fundo transparente/base
          borderColor: isSelected ? primary : `${textColor}30`,
          backgroundColor: isSelected ? `${primary}10` : backgroundColor, // Fundo sutil colorido se selecionado
          borderWidth: isSelected ? "2px" : "1px",
        }}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <input
              type="radio"
              name="paymentMethod"
              checked={isSelected}
              onChange={() => setMethod(value)}
              className="h-4 w-4 cursor-pointer"
              // O input radio nativo é difícil de estilizar cor via style inline,
              // mas o 'accent-color' css property funciona bem
              style={{ accentColor: primary }}
            />
            <label className="ml-3 block text-sm font-medium cursor-pointer" style={{ color: textColor }}>
              {title}
            </label>
          </div>
          <div className="flex space-x-2 items-center">{icon || children}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full mt-6">
      <h2 className="text-lg font-semibold mb-4" style={{ color: textColor }}>
        {t.payment.title}
      </h2>
      <div className="space-y-4">
        {/* Opção 1: Cartão de Crédito */}
        <PaymentOption value="creditCard" title={t.payment.creditCard}>
          <div className="flex gap-1">
            <img src="https://assets.mycartpanda.com/cartx-ecomm-ui-assets/images/payment/visa.svg" className="h-6" alt="Visa" />
            <img src="https://assets.mycartpanda.com/cartx-ecomm-ui-assets/images/payment/mastercard.svg" className="h-6" alt="Master" />
          </div>
        </PaymentOption>

        {/* Opção 2: Carteira Digital (Só aparece se disponível) */}
        {paymentRequest && walletLabel && (
          <div className="space-y-2">
            <PaymentOption
              value="wallet"
              title={walletLabel}
              icon={<span className="">{walletLabel === "Apple Pay" ? <AppleyPayIcon /> : <GooglePayIcon />}</span>}
            />
            {method === "wallet" && (
              <div className="mt-2 animate-fade-in">
                <div className="h-12 w-full">
                  <PaymentRequestButtonElement options={{ paymentRequest }} className="w-full h-full" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Formulário do Cartão (Só aparece se "creditCard" selecionado) */}
      <div className="mt-6">{method === "creditCard" && <CreditCardForm />}</div>
    </div>
  );
};
