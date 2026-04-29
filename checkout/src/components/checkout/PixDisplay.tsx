// src/components/checkout/PixDisplay.tsx
import React, { useState, useEffect } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import { useTheme } from "../../context/ThemeContext";
import axios from "axios";
import { API_URL } from "../../config/BackendUrl";

interface PixDisplayProps {
  qrCode: string;
  qrCodeUrl: string;
  orderId: string;
  amount: number;
  currency: string;
  expiresAt: string;
  saleId: string;
  onSuccess: () => void;
}

export const PixDisplay: React.FC<PixDisplayProps> = ({
  qrCode,
  qrCodeUrl,
  // orderId, // Não utilizado atualmente
  amount,
  currency,
  expiresAt,
  saleId,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { foregroundColor, backgroundColor, primary } = useTheme();
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");

  // Formata o valor
  const formattedAmount = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);

  // Copia o código PIX
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(qrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Erro ao copiar:", error);
    }
  };

  // Contador de tempo restante
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const expires = new Date(expiresAt).getTime();
      const diff = expires - now;

      if (diff <= 0) {
        setTimeLeft(t.pix?.expired || "Expirado");
        clearInterval(interval);
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${minutes}:${seconds.toString().padStart(2, "0")}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, t.pix]);

  // Polling para verificar status do pagamento
  useEffect(() => {
    const checkPaymentStatus = async () => {
      try {
        const response = await axios.get(`${API_URL}/sales/${saleId}`);

        if (response.data.status === "succeeded" || response.data.status === "paid") {
          onSuccess();
        }
      } catch (error) {
        console.error("Erro ao verificar status:", error);
      }
    };

    // Verifica a cada 3 segundos
    const interval = setInterval(checkPaymentStatus, 3000);

    // Primeira verificação imediata
    checkPaymentStatus();

    return () => clearInterval(interval);
  }, [saleId, onSuccess]);

  return (
    <div className="w-full max-w-2xl mx-auto p-8 flex flex-col items-center justify-center" style={{ backgroundColor }}>
      {/* Título */}
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: foregroundColor }}>
          {t.pix?.title || "Pagamento via PIX"}
        </h2>
        <p className="text-4xl md:text-5xl font-black" style={{ color: primary }}>
          {formattedAmount}
        </p>
      </div>

      {/* QR Code */}
      <div className="bg-white p-6 rounded-3xl mb-8 flex justify-center shadow-2xl mx-auto w-fit border-4 border-gray-50">
        {qrCodeUrl ? (
          <img src={qrCodeUrl} alt="QR Code PIX" className="w-64 h-64 md:w-80 md:h-80 object-contain" />
        ) : (
          <div className="w-64 h-64 md:w-80 md:h-80 flex items-center justify-center bg-gray-50 rounded">
            <svg className="h-12 w-12 animate-spin text-gray-300" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )}
      </div>

      {/* Instruções Simplificadas */}
      <div className="mb-8 w-full max-w-md text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] mb-6 opacity-60" style={{ color: foregroundColor }}>
          {t.pix?.instruction || "Escaneie o QR Code abaixo"}
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col items-center gap-2">
            <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${primary}20`, color: primary }}>1</span>
            <span className="text-xs leading-tight font-medium" style={{ color: foregroundColor }}>Abra o app do seu banco</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${primary}20`, color: primary }}>2</span>
            <span className="text-xs leading-tight font-medium" style={{ color: foregroundColor }}>Pagar via PIX (QR Code)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${primary}20`, color: primary }}>3</span>
            <span className="text-xs leading-tight font-medium" style={{ color: foregroundColor }}>Pronto! Aguarde a tela</span>
          </div>
        </div>
      </div>

      {/* Código Copia e Cola */}
      <div className="mb-8 w-full max-w-md">
        <div className="relative group">
          <input
            type="text"
            value={qrCode}
            readOnly
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="w-full pl-4 pr-24 py-4 border-2 rounded-2xl text-sm font-mono bg-gray-50 focus:outline-none transition-all"
            style={{ borderColor: `${primary}20`, color: foregroundColor }}
          />
          <button
            onClick={handleCopy}
            className="absolute right-2 top-2 bottom-2 px-4 rounded-xl text-sm font-bold transition-all active:scale-95 shadow-md hover:shadow-lg"
            style={{
              backgroundColor: copied ? "#10b981" : primary,
              color: "#ffffff",
            }}
          >
            {copied ? "Copiado!" : "Copiar"}
          </button>
        </div>
      </div>

      {/* Status e Tempo Restante */}
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 p-4 rounded-2xl border-2" style={{ backgroundColor: `${primary}05`, borderColor: `${primary}15` }}>
          <svg className="h-5 w-5 animate-spin" style={{ color: primary }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-bold" style={{ color: primary }}>
            {t.pix?.waiting || "Aguardando confirmação..."}
          </span>
          <span className="text-sm font-black ml-auto bg-white/50 px-3 py-1 rounded-lg" style={{ color: primary }}>
            {timeLeft}
          </span>
        </div>
      </div>

      {/* Informação adicional */}
      <div className="mt-8">
        <p className="text-[10px] text-center opacity-40 uppercase tracking-[0.3em] font-bold" style={{ color: foregroundColor }}>
          Confirmamos seu pedido instantaneamente
        </p>
      </div>
    </div>
  );
};
