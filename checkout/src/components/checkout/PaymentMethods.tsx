// src/components/checkout/PaymentMethods.tsx
import React, { lazy, Suspense } from "react";
import { CreditCardForm } from "./CreditCardForm";
import { useTranslation } from "../../i18n/I18nContext";
import { useTheme } from "../../context/ThemeContext";
import { PaymentRequestButtonElement } from "@stripe/react-stripe-js";
import type { PaymentRequest } from "@stripe/stripe-js";
import { AppleyPayIcon } from "../icons/appleyPay";
import { GooglePayIcon } from "../icons/googlePay";
import { PayPalIcon } from "../icons/paypal";

// Lazy load PayPal para evitar carregar o SDK quando não necessário
const PayPalPayment = lazy(() => import("./PayPalPayment").then((module) => ({ default: module.PayPalPayment })));

// --- ALTERAÇÃO AQUI: Adicionado "paypal" ---
export type PaymentMethodType = "creditCard" | "pix" | "wallet" | "paypal";

interface PaymentMethodsProps {
  method: PaymentMethodType;
  setMethod: (method: PaymentMethodType) => void;
  paymentRequest: PaymentRequest | null;
  walletLabel: string | null;
  paypalEnabled?: boolean;
  pagarmePixEnabled?: boolean; // NOVO: Habilita PIX Pagar.me
  stripeCardEnabled?: boolean; // NOVO: Habilita Cartão de Crédito (Stripe)
  // Props para PayPal
  paypalClientId?: string | null;
  paypalAmount?: number;
  paypalCurrency?: string;
  paypalOfferId?: string;
  paypalAbTestId?: string | null;
  paypalCustomerData?: { name: string; email: string; phone: string };
  paypalPurchaseEventId?: string; // Event ID para deduplicação Facebook
  paypalSelectedOrderBumps?: string[]; // Order bumps selecionados
  onPaypalSuccess?: (saleId: string, purchaseEventId: string, redirectUrl?: string) => void;
  onPaypalError?: (msg: string) => void;
}

export const PaymentMethods: React.FC<PaymentMethodsProps> = ({
  method,
  setMethod,
  paymentRequest,
  walletLabel,
  paypalEnabled,
  pagarmePixEnabled,
  stripeCardEnabled = true, // Default: true para retrocompatibilidade
  paypalClientId,
  paypalAmount,
  paypalCurrency,
  paypalOfferId,
  paypalAbTestId,
  paypalCustomerData,
  paypalPurchaseEventId,
  paypalSelectedOrderBumps,
  onPaypalSuccess,
  onPaypalError,
}) => {
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
        className="border rounded-lg p-4 cursor-pointer transition-all duration-200 min-h-[56px] flex items-center"
        style={{
          borderColor: isSelected ? primary : `${textColor}30`,
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

        {/* Opção 3: PIX via Pagar.me (NOVO) */}
        {pagarmePixEnabled && (
          <PaymentOption
            value="pix"
            title="PIX"
            icon={
              <div className="h-8 flex items-center">
                <svg className="h-7 w-auto" viewBox="0 0 512 512" fill="currentColor">
                  <path d="M242.4 292.5C247.8 287.1 257.1 287.1 262.5 292.5L339.5 369.5C353.7 383.7 372.6 391.5 392.6 391.5H407.7L310.6 488.6C280.3 518.1 231.1 518.1 200.8 488.6L103.3 391.2H112.6C132.6 391.2 151.5 383.4 165.7 369.2L242.4 292.5zM262.5 218.9C257.1 224.3 247.8 224.3 242.4 218.9L165.7 142.2C151.5 127.1 132.6 120.2 112.6 120.2H103.3L200.7 22.8C231.1-7.6 280.3-7.6 310.6 22.8L407.7 119.9H392.6C372.6 119.9 353.7 127.7 339.5 141.9L262.5 218.9zM112.6 142.7C126.4 142.7 139.1 148.3 149.7 158.1L226.4 234.8C233.6 241.1 243 245.6 252.5 245.6C261.9 245.6 271.3 241.1 278.5 234.8L355.5 157.8C365.3 148.1 378.8 142.5 392.6 142.5H430.3L488.6 200.8C518.9 231.1 518.9 280.3 488.6 310.6L430.3 368.9H392.6C378.8 368.9 365.3 363.3 355.5 353.5L278.5 276.5C264.6 262.6 240.3 262.6 226.4 276.5L149.7 353.2C139.1 363 126.4 368.6 112.6 368.6H80.78L22.76 310.6C-7.586 280.3-7.586 231.1 22.76 200.8L80.78 142.7H112.6z" />
                </svg>
              </div>
            }
          />
        )}

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
      {/* Formulário do Cartão */}
      <div className="mt-6">{method === "creditCard" && <CreditCardForm />}</div>

      {/* Botão PayPal */}
      {method === "paypal" && paypalEnabled && paypalClientId && paypalAmount && paypalCurrency && paypalOfferId && paypalPurchaseEventId && onPaypalSuccess && onPaypalError && (
        <div className="mt-6">
          <Suspense fallback={<div className="animate-pulse bg-gray-100 h-12 rounded-lg" />}>
            <PayPalPayment
              amount={paypalAmount}
              currency={paypalCurrency}
              offerId={paypalOfferId}
              paypalClientId={paypalClientId}
              abTestId={paypalAbTestId ?? null}
              purchaseEventId={paypalPurchaseEventId}
              selectedOrderBumps={paypalSelectedOrderBumps || []}
              customerData={paypalCustomerData || { name: "", email: "", phone: "" }}
              onSuccess={onPaypalSuccess}
              onError={onPaypalError}
              onSwitchPaymentMethod={() => setMethod("creditCard")}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
};
