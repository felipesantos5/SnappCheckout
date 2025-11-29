import { useEffect, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";
import CheckoutPage from "./CheckoutPage";
import { getContrast } from "polished";
import { API_URL } from "../config/BackendUrl";
import { ThemeContext, type ThemeColors } from "../context/ThemeContext";
import { I18nProvider } from "../i18n/I18nContext";
import type { Language } from "../i18n/translations";
import { SkeletonLoader } from "../components/ui/SkeletonLoader";
import { useFacebookPixel } from "../hooks/useFacebookPixel";
// import { logger } from "../utils/logger";
import useSWR from "swr";

// ... (Interfaces OfferData mantidas iguais) ...
export interface OfferData {
  _id: string;
  slug: string;
  name: string;
  thankYouPageUrl?: string;
  language?: Language;
  collectAddress?: boolean;
  collectPhone?: boolean;
  bannerImageUrl?: string;
  currency: string;
  primaryColor: string;
  secondaryBannerImageUrl?: string;
  buttonColor: string;
  facebookPixelId?: string; // Mantido para retrocompatibilidade
  facebookPixels?: Array<{ pixelId: string; accessToken: string }>; // Novo: array de pixels
  mainProduct: {
    _id: string;
    name: string;
    description?: string;
    imageUrl?: string;
    priceInCents: number;
    originalPriceInCents?: number;
    discountPercentage?: number;
    compareAtPriceInCents?: number;
  };
  orderBumps: {
    _id: string;
    name: string;
    description?: string;
    imageUrl?: string;
    priceInCents: number;
    originalPriceInCents?: number;
    discountPercentage?: number;
  }[];
  upsell?: {
    enabled: boolean;
    name: string;
    price: number;
    redirectUrl: string;
  };
  ownerId: {
    stripeAccountId: string;
  };
}
// 1. Fetcher Otimizado: Lida com a requisição e erros
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || "Oferta não encontrada ou indisponível.");
  }
  return res.json();
};

export function CheckoutSlugPage() {
  const { slug } = useParams<{ slug: string }>();

  // REF DE CONTROLE: Evita duplicidade no tracking de métricas
  const trackedSlugRef = useRef<string | null>(null);

  // Gera um ID de sessão único e persistente para o navegador atual
  const checkoutSessionId = useRef<string>(
    (() => {
      const storageKey = `checkout_session_${slug}`;
      const existingId = sessionStorage.getItem(storageKey);
      if (existingId) return existingId;

      const newId = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      sessionStorage.setItem(storageKey, newId);
      return newId;
    })()
  ).current;

  // 2. Implementação do SWR (Substitui o useState + useEffect de fetch)
  const {
    data: offerData,
    error,
    isLoading,
  } = useSWR<OfferData>(slug ? `${API_URL}/offers/slug/${slug}` : null, fetcher, {
    revalidateOnFocus: false, // Importante: Não recarrega ao trocar de aba (estabilidade)
    revalidateOnReconnect: true, // Recarrega se a internet cair e voltar
    dedupingInterval: 60000, // Evita requests duplicados em 1 minuto
    shouldRetryOnError: false, // Não fica tentando se der 404 real
  });

  // Lógica de Pixels (Retrocompatibilidade + Múltiplos)
  const pixelIds = useMemo(() => {
    if (!offerData) return [];

    const pixels: string[] = [];

    // Adiciona pixels do novo array
    if (offerData.facebookPixels && offerData.facebookPixels.length > 0) {
      pixels.push(...offerData.facebookPixels.map((p: any) => p.pixelId));
    }

    // Adiciona pixel antigo se existir e não estiver no array novo
    if (offerData.facebookPixelId && !pixels.includes(offerData.facebookPixelId)) {
      pixels.push(offerData.facebookPixelId);
    }

    return pixels;
  }, [offerData]);

  // Hook do Facebook Pixel
  const { generateEventId } = useFacebookPixel(pixelIds);

  // 3. Efeito Lateral: Rastreamento de Métricas
  // Agora roda separadamente assim que o offerData estiver disponível
  useEffect(() => {
    if (!offerData || !slug) return;

    // Só dispara se for uma nova visualização deste slug
    if (trackedSlugRef.current !== slug) {
      trackedSlugRef.current = slug;

      // "Fire and forget" para métricas
      fetch(`${API_URL}/metrics/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: offerData._id,
          type: "view",
        }),
      }).catch((err) => console.error("Track view error", err));
    }
  }, [offerData, slug]);

  // Configuração do Tema
  const primaryColor = offerData?.primaryColor || "#000000";
  const buttonColor = offerData?.buttonColor || "#2563eb";
  const buttonTextColor = getContrast(buttonColor, "#FFF") > 2.5 ? "#FFFFFF" : "#000000";

  const themeValues: ThemeColors = {
    primary: primaryColor,
    button: buttonColor,
    buttonForeground: buttonTextColor,
  };

  // Tratamento de Erro
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="max-w-md text-center">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Ops! Algo deu errado</h2>
            {/* <p className="text-gray-600 mb-4">{error.message}</p> */}
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading State
  if (isLoading) {
    return <SkeletonLoader />;
  }

  if (!offerData) return null;

  return (
    <I18nProvider language={offerData.language || "pt"}>
      <ThemeContext.Provider value={themeValues}>
        <CheckoutPage offerData={offerData} checkoutSessionId={checkoutSessionId} generateEventId={generateEventId} />
      </ThemeContext.Provider>
    </I18nProvider>
  );
}
