// src/components/checkout/PayPalPayment.tsx
import React, { useState } from "react";
import { PayPalButtons } from "@paypal/react-paypal-js";
import { API_URL } from "../../config/BackendUrl";
// import { toast } from "sonner";

interface PayPalPaymentProps {
  amount: number; // Em centavos
  currency: string;
  offerId: string;
  customerData: {
    name: string;
    email: string;
    phone: string;
  };
  onSuccess: () => void;
  onError: (error: string) => void;
}

export const PayPalPayment: React.FC<PayPalPaymentProps> = ({ amount, currency, offerId, customerData, onSuccess, onError }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  // Validação simples antes de abrir o PayPal
  const validateForm = () => {
    // if (!customerData.email || !customerData.name) {
    //   // toast.error("Por favor, preencha nome e e-mail antes de continuar.");
    //   console.log(`erro aqui`);
    //   return false;
    // }
    return true;
  };

  return (
    <div className="w-full mt-4 relative z-0">
      {isProcessing && (
        <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center">
          <span className="text-sm font-semibold">Processando...</span>
        </div>
      )}

      <PayPalButtons
        style={{ layout: "vertical", height: 48, label: "pay" }}
        disabled={isProcessing}
        forceReRender={[amount, currency]} // Recarrega se o preço mudar (ex: cupom)
        onClick={(_data, actions) => {
          if (!validateForm()) {
            return actions.reject();
          }
          return actions.resolve();
        }}
        createOrder={async (_data, _actions) => {
          setIsProcessing(true);
          try {
            const response = await fetch(`${API_URL}/paypal/create-order`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                amount: amount,
                currency: currency,
                offerId: offerId,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || "Erro ao criar pedido PayPal");
            }

            const order = await response.json();
            return order.id; // Retorna o ID da ordem para o script do PayPal
          } catch (error: any) {
            console.error(error);
            onError(error.message);
            setIsProcessing(false);
            return ""; // Retorna vazio para cancelar
          }
        }}
        onApprove={async (data, _actions) => {
          try {
            const response = await fetch(`${API_URL}/paypal/capture-order`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: data.orderID,
                offerId: offerId,
                customerData: customerData,
              }),
            });

            const result = await response.json();

            if (result.success) {
              onSuccess();
            } else {
              throw new Error(result.message || "Pagamento não aprovado.");
            }
          } catch (error: any) {
            console.error(error);
            onError(error.message);
          } finally {
            setIsProcessing(false);
          }
        }}
        onCancel={() => {
          setIsProcessing(false);
          // toast.info("Pagamento cancelado.");
        }}
        onError={(err) => {
          console.error("PayPal Error:", err);
          onError("Ocorreu um erro na conexão com o PayPal.");
          setIsProcessing(false);
        }}
      />
    </div>
  );
};
