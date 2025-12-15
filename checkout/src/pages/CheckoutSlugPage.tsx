import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import CheckoutPage from "./CheckoutPage";
import { getContrast } from "polished";
import { API_URL } from "../config/BackendUrl";
import { ThemeContext, type ThemeColors } from "../context/ThemeContext";
import { I18nProvider } from "../i18n/I18nContext";
import type { Language } from "../i18n/translations";
import { SkeletonLoader } from "../components/ui/SkeletonLoader";
import { useFacebookPixel } from "../hooks/useFacebookPixel";
// import { useAutoNotifications } from "../hooks/useAutoNotifications";

export interface OfferData {
  _id: string;
  slug: string;
  name: string;
  thankYouPageUrl?: string;
  backRedirectUrl?: string;
  language?: Language;
  collectAddress?: boolean;
  collectPhone?: boolean;
  paypalEnabled?: boolean;
  bannerImageUrl?: string;
  secondaryBannerImageUrl?: string;
  currency: string;

  // CORES
  primaryColor: string;
  buttonColor: string;
  backgroundColor: string;
  textColor: string;

  facebookPixelId?: string;
  facebookPixels?: Array<{ pixelId: string; accessToken: string }>;
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
  autoNotifications?: {
    enabled: boolean;
    genderFilter: 'all' | 'male' | 'female';
    region: 'pt' | 'en' | 'es' | 'fr';
    intervalSeconds: number;
    soundEnabled: boolean;
  };
  ownerId: {
    stripeAccountId: string;
  };
}

export function CheckoutSlugPage() {
  const { slug } = useParams<{ slug: string }>();
  const [offerData, setOfferData] = useState<OfferData | null>(null);
  const [abTestId, setAbTestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // REF DE CONTROLE: Guarda o slug da última oferta rastreada para evitar duplicação
  const trackedSlugRef = useRef<string | null>(null);

  // Gera ou recupera um ID único para esta sessão de checkout
  const checkoutSessionId = useRef<string>(
    (() => {
      const storageKey = `checkout_session_${slug}`;
      const existingId = sessionStorage.getItem(storageKey);
      if (existingId) {
        return existingId;
      }
      const newId = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      sessionStorage.setItem(storageKey, newId);
      return newId;
    })()
  );

  // Carrega os Facebook Pixels se estiverem configurados
  // Coleta todos os IDs (novo array + campo antigo para retrocompatibilidade)
  const pixelIds = React.useMemo(() => {
    if (!offerData) return [];

    const pixels: string[] = [];

    // Adiciona pixels do novo array
    if (offerData.facebookPixels && offerData.facebookPixels.length > 0) {
      pixels.push(...offerData.facebookPixels.map((p) => p.pixelId));
    }

    // Adiciona pixel antigo se existir e não estiver no array novo (retrocompatibilidade)
    if (offerData.facebookPixelId && !pixels.includes(offerData.facebookPixelId)) {
      pixels.push(offerData.facebookPixelId);
    }

    return pixels;
  }, [offerData]);

  const { generateEventId } = useFacebookPixel(pixelIds);

  // Hook para notificações automáticas de prova social
  // useAutoNotifications({
  //   config: offerData?.autoNotifications,
  //   productName: offerData?.mainProduct?.name || 'produto',
  // });

  // Controle para evitar fetch duplicado (React StrictMode executa useEffect 2x)
  const fetchingRef = useRef<boolean>(false);

  useEffect(() => {
    // Evita fetch duplicado
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    const fetchOffer = async () => {
      setIsLoading(true);
      setError(null);
      setAbTestId(null);

      try {
        let data: OfferData;

        // Validação do slug
        if (!slug) {
          throw new Error("Slug não fornecido.");
        }

        // 1. Tenta buscar como teste A/B primeiro
        let response = await fetch(`${API_URL}/abtests/slug/${slug}`);

        if (response.ok) {
          const data = await response.json();
          // data contém: { offer: OfferData, abTestId: string }
          setOfferData(data.offer);
          setAbTestId(data.abTestId);

          // O tracking de view já é feito pelo backend quando randomiza
          // Apenas marca como rastreado para evitar duplicação no InitiateCheckout
          if (trackedSlugRef.current !== slug) {
            trackedSlugRef.current = slug;
          }
          return;
        }

        // 2. Se não for teste A/B (404), busca como oferta normal
        response = await fetch(`${API_URL}/offers/slug/${slug}`);

        if (!response.ok) {
          throw new Error("Oferta não encontrada ou indisponível.");
        }

        data = await response.json();
        setOfferData(data);

        console.log('data', data)

        // Só dispara o tracking se o slug atual for diferente do último rastreado
        if (trackedSlugRef.current !== slug) {
          trackedSlugRef.current = slug; // Marca como rastreado imediatamente

          // Tracking de view única (filtrada por IP no backend)
          fetch(`${API_URL}/metrics/track`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              offerId: data._id,
              type: "view",
            }),
          }).catch((err) => console.log("Track view error", err));

          // Tracking de view total (conta todas as visualizações)
          fetch(`${API_URL}/metrics/track`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              offerId: data._id,
              type: "view_total",
            }),
          }).catch((err) => console.log("Track view_total error", err));
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOffer();
  }, [slug]);

  // Dispara evento InitiateCheckout para o Facebook quando a oferta carrega
  // NOTA: Este evento é apenas para o Facebook Pixel/CAPI, não para a métrica do dashboard
  useEffect(() => {
    if (!offerData || trackedSlugRef.current !== slug) return;

    // Gera um event_id único para InitiateCheckout baseado no checkoutSessionId
    const eventId = `${checkoutSessionId.current}_initiate_checkout`;

    // Calcula o valor total do produto principal
    const totalValue = offerData.mainProduct.priceInCents / 100;

    // ID do produto principal
    const contentIds = [offerData.mainProduct._id];

    // 1. Dispara evento no Facebook Pixel (Frontend)
    if (window.fbq) {
      window.fbq(
        "track",
        "InitiateCheckout",
        {
          content_name: offerData.mainProduct.name,
          content_ids: contentIds,
          content_type: "product",
          value: totalValue,
          currency: offerData.currency.toUpperCase(),
          num_items: 1,
        },
        { eventID: eventId }
      );
    }

    // 2. Envia evento para o backend (Facebook CAPI) - NÃO salva no dashboard
    fetch(`${API_URL}/metrics/facebook-initiate-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offerId: offerData._id,
        eventId: eventId,
        totalAmount: offerData.mainProduct.priceInCents,
        contentIds: contentIds,
      }),
    }).catch((err) => console.log("Track Facebook InitiateCheckout error", err));
  }, [offerData, slug, checkoutSessionId]);

  // Configura o back redirect usando pushState quando a oferta tiver backRedirectUrl
  useEffect(() => {
    if (!offerData?.backRedirectUrl) return;

    const backUrl = offerData.backRedirectUrl.trim();
    if (!backUrl || (!backUrl.startsWith("http://") && !backUrl.startsWith("https://"))) return;

    // Técnica: replaceState + pushState
    // 1. Substitui a entrada atual do histórico com o estado de backRedirect
    // 2. Adiciona a página atual como nova entrada
    // Resultado: quando o usuário clicar em voltar, ele vai para o estado com backRedirect

    const currentUrl = window.location.href;

    // Substitui o estado atual (a entrada "anterior" agora tem o backRedirect)
    window.history.replaceState({ backRedirect: true, redirectUrl: backUrl }, "", currentUrl);

    // Adiciona a página atual como nova entrada (essa é a página que o usuário está vendo)
    window.history.pushState({ checkout: true }, "", currentUrl);

    // Listener para o evento popstate (quando o cliente clica em voltar)
    const handlePopState = (event: PopStateEvent) => {
      // Se voltou para o estado com backRedirect, redireciona para a URL externa
      if (event.state?.backRedirect && event.state?.redirectUrl) {
        window.location.href = event.state.redirectUrl;
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [offerData]);

  // ... (resto do código de renderização igual)
  const primaryColor = offerData?.primaryColor || "#000000";
  const buttonColor = offerData?.buttonColor || "#2563eb";
  const buttonTextColor = getContrast(buttonColor, "#FFF") > 2.5 ? "#FFFFFF" : "#000000";

  const themeValues: ThemeColors = {
    primary: primaryColor,
    button: buttonColor,
    buttonForeground: buttonTextColor,
    // --- NOVO ---
    backgroundColor: offerData?.backgroundColor || "#ffffff",
    textColor: offerData?.textColor || "#374151",
    // ------------
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="max-w-md text-center">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Ops! Algo deu errado</h2>
            <p className="text-gray-600 mb-4">{error}</p>
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

  if (isLoading || !offerData) {
    return <SkeletonLoader />;
  }

  return (
    <I18nProvider language={offerData.language || "pt"}>
      <ThemeContext.Provider value={themeValues}>
        <CheckoutPage offerData={offerData} checkoutSessionId={checkoutSessionId.current} generateEventId={generateEventId} abTestId={abTestId} />
      </ThemeContext.Provider>
    </I18nProvider>
  );
}
