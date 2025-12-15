// src/components/checkout/PayPalPayment.tsx
// Implementação usando SDK do PayPal diretamente (sem @paypal/react-paypal-js)
// para compatibilidade com React 19
import React, { useEffect, useRef, useState, useCallback } from "react";
import { API_URL } from "../../config/BackendUrl";
import { AlertTriangle, RefreshCw, X, ExternalLink, HelpCircle } from "lucide-react";

interface PayPalPaymentProps {
  amount: number; // Em centavos
  currency: string;
  offerId: string;
  paypalClientId: string;
  abTestId?: string | null;
  purchaseEventId: string; // Event ID para deduplicação Facebook Pixel/CAPI
  selectedOrderBumps: string[]; // IDs dos order bumps selecionados
  customerData: {
    name: string;
    email: string;
    phone: string;
  };
  onSuccess: (saleId: string, purchaseEventId: string) => void;
  onError: (error: string) => void;
  onSwitchPaymentMethod?: () => void; // Callback opcional para trocar método de pagamento
}

declare global {
  interface Window {
    paypal?: any;
  }
}

// Componente de Modal de Ajuda para Erro do PayPal
const PayPalErrorHelpModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
  onSwitchMethod?: () => void;
}> = ({ isOpen, onClose, onRetry, onSwitchMethod }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-gray-900">Problema ao conectar com PayPal</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-gray-600 text-sm">
            Isso geralmente acontece quando há dados de navegação acumulados. Siga os passos abaixo para resolver:
          </p>

          {/* Steps */}
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
              <span className="shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                1
              </span>
              <div>
                <p className="text-sm font-medium text-gray-900">Tente em aba anônima</p>
                <p className="text-xs text-gray-600 mt-1">
                  Pressione <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">Ctrl+Shift+N</kbd> (Chrome) ou <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">Ctrl+Shift+P</kbd> (Firefox)
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg">
              <span className="shrink-0 w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                2
              </span>
              <div>
                <p className="text-sm font-medium text-gray-900">Ou limpe os cookies do PayPal</p>
                <ol className="text-xs text-gray-600 mt-1 space-y-1 list-decimal list-inside">
                  <li>Vá para Configurações do navegador</li>
                  <li>Acesse Privacidade → Cookies</li>
                  <li>Busque por "paypal" e delete todos</li>
                  <li>Recarregue esta página</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Quick link for Chrome */}
          <a
            href="chrome://settings/siteData?searchSubpage=paypal"
            onClick={(e) => {
              e.preventDefault();
              // Não podemos abrir chrome:// URLs diretamente, mostrar instrução alternativa
              navigator.clipboard.writeText("chrome://settings/siteData?searchSubpage=paypal");
              alert("Link copiado! Cole na barra de endereço do Chrome.");
            }}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline"
          >
            <ExternalLink className="w-4 h-4" />
            Copiar link para configurações do Chrome
          </a>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 space-y-2">
          <button
            onClick={onRetry}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </button>

          {onSwitchMethod && (
            <button
              onClick={onSwitchMethod}
              className="w-full px-4 py-2.5 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Usar cartão de crédito
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const PayPalPayment: React.FC<PayPalPaymentProps> = ({
  amount,
  currency,
  offerId,
  paypalClientId,
  abTestId,
  purchaseEventId,
  selectedOrderBumps,
  customerData,
  onSuccess,
  onError,
  onSwitchPaymentMethod,
}) => {
  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [hasError, setHasError] = useState(false);
  const buttonsRendered = useRef(false);
  const retryCount = useRef(0);

  // Função para lidar com erros do PayPal
  const handlePayPalError = useCallback((error: any) => {
    console.error("PayPal Error:", error);
    setHasError(true);

    // Se for primeiro erro, mostrar modal de ajuda
    if (retryCount.current < 2) {
      setShowHelpModal(true);
    } else {
      onError("Não foi possível conectar com o PayPal. Por favor, tente usar outro método de pagamento.");
    }
  }, [onError]);

  // Função para tentar novamente
  const handleRetry = useCallback(() => {
    retryCount.current += 1;
    setShowHelpModal(false);
    setHasError(false);
    setIsLoading(true);
    buttonsRendered.current = false;

    // Remove o script antigo para forçar recarregamento
    const oldScript = document.getElementById("paypal-sdk-script");
    if (oldScript) {
      oldScript.remove();
    }

    // Remove o objeto paypal global
    if (window.paypal) {
      delete window.paypal;
    }

    // Limpar o container
    if (paypalContainerRef.current) {
      paypalContainerRef.current.innerHTML = "";
    }

    setScriptLoaded(false);

    // Recarrega após um pequeno delay
    setTimeout(() => {
      // O useEffect vai recarregar o script
      setScriptLoaded(false);
    }, 500);
  }, []);

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
    script.src = `https://www.paypal.com/sdk/js?client-id=${paypalClientId}&currency=${currency.toUpperCase()}&intent=capture&disable-funding=card`;
    script.async = true;

    script.onload = () => {
      setScriptLoaded(true);
      setIsLoading(false);
    };

    script.onerror = () => {
      console.error("Failed to load PayPal SDK");
      handlePayPalError(new Error("Falha ao carregar PayPal SDK"));
      setIsLoading(false);
    };

    document.body.appendChild(script);

    return () => {
      // Não remove o script ao desmontar (pode ser reutilizado)
    };
  }, [paypalClientId, currency, handlePayPalError, scriptLoaded]);

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
              handlePayPalError(error);
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
                  abTestId: abTestId ?? null,
                  purchaseEventId: purchaseEventId, // Event ID para deduplicação Facebook
                  selectedOrderBumps: selectedOrderBumps, // Order bumps selecionados
                }),
              });

              const result = await response.json();

              if (result.success) {
                onSuccess(result.saleId, purchaseEventId);
              } else {
                throw new Error(result.message || "Pagamento não aprovado.");
              }
            } catch (error: any) {
              console.error("PayPal capture error:", error);
              handlePayPalError(error);
            }
          },

          onCancel: () => {
            // Usuário cancelou - não faz nada
          },

          onError: (err: any) => {
            handlePayPalError(err);
          },
        })
        .render(paypalContainerRef.current);
    } catch (error) {
      console.error("Failed to render PayPal buttons:", error);
      handlePayPalError(error);
    }
  }, [scriptLoaded, amount, currency, offerId, customerData, onSuccess, handlePayPalError, abTestId, purchaseEventId, selectedOrderBumps]);

  return (
    <>
      <div className="w-full">
        {isLoading && (
          <div className="animate-pulse bg-gray-100 h-12 rounded-lg flex items-center justify-center">
            <span className="text-sm text-gray-500">Carregando PayPal...</span>
          </div>
        )}

        {hasError && !showHelpModal && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-700 font-medium">
                  Erro ao carregar PayPal
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Por favor, tente novamente ou use outro método de pagamento.
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setShowHelpModal(true)}
                    className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 underline"
                  >
                    <HelpCircle className="w-3 h-3" />
                    Ver ajuda
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={paypalContainerRef} className={isLoading || hasError ? "hidden" : ""} />
      </div>

      {/* Modal de Ajuda */}
      <PayPalErrorHelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        onRetry={handleRetry}
        onSwitchMethod={onSwitchPaymentMethod}
      />
    </>
  );
};
