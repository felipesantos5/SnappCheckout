// src/components/checkout/PayPalPayment.tsx
// Implementação usando SDK do PayPal diretamente (sem @paypal/react-paypal-js)
// para compatibilidade com React 19
import React, { useEffect, useRef, useState } from "react";
import { API_URL } from "../../config/BackendUrl";

interface PayPalPaymentProps {
  amount: number; // Em centavos
  currency: string;
  offerId: string;
  paypalClientId: string;
  customerData: {
    name: string;
    email: string;
    phone: string;
  };
  onSuccess: () => void;
  onError: (error: string) => void;
}

declare global {
  interface Window {
    paypal?: any;
  }
}

export const PayPalPayment: React.FC<PayPalPaymentProps> = ({
  amount,
  currency,
  offerId,
  paypalClientId,
  customerData,
  onSuccess,
  onError,
}) => {
  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const buttonsRendered = useRef(false);

  // Carrega o script do PayPal SDK
  useEffect(() => {
    const scriptId = "paypal-sdk-script";

    // Se já existe o script, apenas marca como carregado
    if (document.getElementById(scriptId)) {
      if (window.paypal) {
        setScriptLoaded(true);
        setIsLoading(false);
      }
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://www.paypal.com/sdk/js?client-id=${paypalClientId}&currency=${currency.toUpperCase()}&intent=capture`;
    script.async = true;

    script.onload = () => {
      setScriptLoaded(true);
      setIsLoading(false);
    };

    script.onerror = () => {
      console.error("Failed to load PayPal SDK");
      onError("Falha ao carregar PayPal. Tente novamente.");
      setIsLoading(false);
    };

    document.body.appendChild(script);

    return () => {
      // Não remove o script ao desmontar (pode ser reutilizado)
    };
  }, [paypalClientId, currency, onError]);

  // Renderiza os botões do PayPal quando o script estiver carregado
  useEffect(() => {
    if (!scriptLoaded || !window.paypal || !paypalContainerRef.current || buttonsRendered.current) {
      return;
    }

    buttonsRendered.current = true;

    try {
      window.paypal
        .Buttons({
          style: {
            layout: "vertical",
            height: 48,
            label: "pay",
          },

          createOrder: async () => {
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
              return order.id;
            } catch (error: any) {
              console.error("PayPal createOrder error:", error);
              onError(error.message);
              throw error;
            }
          },

          onApprove: async (data: any) => {
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
              console.error("PayPal capture error:", error);
              onError(error.message);
            }
          },

          onCancel: () => {
            // Usuário cancelou - não faz nada
          },

          onError: (err: any) => {
            console.error("PayPal SDK Error:", err);
            onError("Ocorreu um erro na conexão com o PayPal.");
          },
        })
        .render(paypalContainerRef.current);
    } catch (error) {
      console.error("Failed to render PayPal buttons:", error);
      onError("Falha ao renderizar botões do PayPal.");
    }
  }, [scriptLoaded, amount, currency, offerId, customerData, onSuccess, onError]);

  return (
    <div className="w-full">
      {isLoading && (
        <div className="animate-pulse bg-gray-100 h-12 rounded-lg flex items-center justify-center">
          <span className="text-sm text-gray-500">Carregando PayPal...</span>
        </div>
      )}
      <div ref={paypalContainerRef} className={isLoading ? "hidden" : ""} />
    </div>
  );
};
