import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { useTranslation } from "../i18n/I18nContext";

export const SuccessPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = useState(5);

  const upsellLink = searchParams.get("upsellLink");
  const offerName = searchParams.get("offerName") || "";

  // Se houver um link de upsell, redirecionar após 5 segundos
  useEffect(() => {
    if (upsellLink && (upsellLink.startsWith("http://") || upsellLink.startsWith("https://"))) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            window.location.href = upsellLink;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [upsellLink]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Card principal */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
          {/* Ícone de sucesso animado */}
          <div className="mb-6 flex justify-center">
            <div className="relative">
              {/* Círculo animado de fundo */}
              <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-75"></div>
              {/* Círculo de fundo sólido */}
              <div className="relative bg-green-500 rounded-full p-6">
                <CheckCircle className="w-16 h-16 text-white" strokeWidth={2.5} />
              </div>
            </div>
          </div>

          {/* Título */}
          <h1 className="text-3xl font-bold text-gray-900 mb-3">{t.messages.success}</h1>

          {/* Descrição */}
          <p className="text-gray-600 mb-6 text-lg">{t.messages.successDescription}</p>

          {/* Nome da oferta se disponível */}
          {offerName && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-green-800 font-medium">
                Produto: <span className="font-bold">{offerName}</span>
              </p>
            </div>
          )}

          {/* Mensagem de redirecionamento se houver upsell */}
          {upsellLink && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">{t.messages.redirecting}</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">{countdown}s</p>
            </div>
          )}

          {/* Checkmarks informativos */}
          <div className="mt-8 space-y-3 text-left">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <p className="text-sm text-gray-600">Pagamento confirmado e processado com sucesso</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <p className="text-sm text-gray-600">Confirmação enviada para o seu e-mail</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <p className="text-sm text-gray-600">Acesso ao produto será liberado em breve</p>
            </div>
          </div>
        </div>

        {/* Informação adicional */}
        <p className="text-center text-gray-500 text-sm mt-6">Se você tiver alguma dúvida, verifique seu e-mail para mais informações.</p>
      </div>
    </div>
  );
};
