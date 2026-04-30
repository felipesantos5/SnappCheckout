// src/components/checkout/PaymentMethods.tsx
import React from "react";
import { CreditCardForm } from "./CreditCardForm";
import { useTranslation } from "../../i18n/I18nContext";
import { useTheme } from "../../context/ThemeContext";
import { PaymentRequestButtonElement } from "@stripe/react-stripe-js";
import type { PaymentRequest } from "@stripe/stripe-js";
import { AppleyPayIcon } from "../icons/appleyPay";
import { GooglePayIcon } from "../icons/googlePay";
import { PayPalIcon } from "../icons/paypal";

export type PaymentMethodType = "creditCard" | "pix" | "wallet" | "paypal";

interface PaymentMethodsProps {
  method: PaymentMethodType;
  setMethod: (method: PaymentMethodType) => void;
  paymentRequest: PaymentRequest | null;
  walletLabel: string | null;
  paypalEnabled?: boolean;
  pagarmePixEnabled?: boolean;
  stripeCardEnabled?: boolean;
  stripeLinkEnabled?: boolean;
  showValidationErrors?: boolean;
}

export const PaymentMethods: React.FC<PaymentMethodsProps> = ({
  method,
  setMethod,
  paymentRequest,
  walletLabel,
  paypalEnabled,
  pagarmePixEnabled,
  stripeCardEnabled = true,
  stripeLinkEnabled = true,
  showValidationErrors = false,
}) => {
  const { t } = useTranslation();
  const { foregroundColor, backgroundColor, primary } = useTheme();

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
        className="border rounded-lg p-4 cursor-pointer transition-all duration-200 min-h-[56px] flex items-center"
        style={{
          borderColor: isSelected ? primary : `${foregroundColor}30`,
          backgroundColor: isSelected ? `${primary}10` : backgroundColor,
          borderWidth: isSelected ? "2px" : "1px",
        }}
      >
        <div className="flex justify-between items-center relative w-full">
          <div className="flex items-center">
            <input
              type="radio"
              name="paymentMethod"
              checked={isSelected}
              onChange={() => setMethod(value)}
              className="h-4 w-4 cursor-pointer"
              style={{ accentColor: primary }}
            />
            <label className="ml-3 block text-sm font-medium cursor-pointer" style={{ color: foregroundColor }}>
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
      <h2 className="text-lg font-semibold mb-4" style={{ color: foregroundColor }}>
        {t.payment.title}
      </h2>
      <div className="space-y-3">
        {/* Opção 1: Cartão de Crédito (Stripe) - Só aparece se habilitado */}
        {stripeCardEnabled !== false && (
          <PaymentOption value="creditCard" title={t.payment.creditCard}>
            <div className="flex gap-1 items-center h-8">
              <img src="https://assets.mycartpanda.com/cartx-ecomm-ui-assets/images/payment/visa.svg" className="h-7" alt="Visa" />
              <img src="https://assets.mycartpanda.com/cartx-ecomm-ui-assets/images/payment/mastercard.svg" className="h-7" alt="Master" />
            </div>
          </PaymentOption>
        )}

        {/* Opção 2: PayPal (NOVO) */}
        {paypalEnabled && (
          <PaymentOption
            value="paypal"
            title="PayPal"
            icon={
              <div className="h-8 flex items-center">
                <PayPalIcon className="h-7 w-auto" />
              </div>
            }
          />
        )}

        {/* Opção 3: PIX via Pagar.me — OCULTO TEMPORARIAMENTE */}

        {/* Opção 4: Carteira Digital (Só aparece se disponível) */}
        {paymentRequest && walletLabel && (
          <div className="space-y-2">
            <PaymentOption
              value="wallet"
              title={walletLabel}
              icon={
                <div className="h-8 flex items-center">
                  {walletLabel === "Apple Pay" ? (
                    <AppleyPayIcon className="h-10 w-auto" />
                  ) : (
                    <GooglePayIcon className="h-10 w-auto" />
                  )}
                </div>
              }
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

      {/* Formulário do Cartão */}
      <div className="mt-6">
        {method === "creditCard" && <CreditCardForm stripeLinkEnabled={stripeLinkEnabled} showValidationErrors={showValidationErrors} />}
      </div>
    </div>
  );
};
