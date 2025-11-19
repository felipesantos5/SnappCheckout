import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import CheckoutPage from "./CheckoutPage";
import { getContrast } from "polished";
import { API_URL } from "../config/BackendUrl";
import { ThemeContext, type ThemeColors } from "../context/ThemeContext";
import { I18nProvider } from "../i18n/I18nContext";
import type { Language } from "../i18n/translations";

export interface OfferData {
  _id: string;
  slug: string;
  name: string;
  language?: Language; // Idioma do checkout (pt, en, fr)
  collectAddress?: boolean; // Se deve coletar endereço
  collectPhone?: boolean; // Se deve coletar telefone
  bannerImageUrl?: string;
  currency: string;
  primaryColor: string;
  buttonColor: string;
  mainProduct: {
    _id: string;
    name: string;
    description?: string;
    imageUrl?: string;
    priceInCents: number;
    originalPriceInCents?: number; // Preço original antes do desconto
    discountPercentage?: number; // Porcentagem de desconto
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

export function CheckoutSlugPage() {
  const { slug } = useParams<{ slug: string }>();
  const [offerData, setOfferData] = useState<OfferData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;

    const fetchOffer = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/offers/slug/${slug}`);
        if (!response.ok) {
          throw new Error("Oferta não encontrada ou indisponível.");
        }
        const data: OfferData = await response.json();
        setOfferData(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOffer();
  }, [slug]);

  const primaryColor = offerData?.primaryColor || "#000000";
  const buttonColor = offerData?.buttonColor || "#2563eb";

  // Calcular a cor do texto do botão (branco ou preto)
  const buttonTextColor = getContrast(buttonColor, "#FFF") > 2.5 ? "#FFFFFF" : "#000000";

  const themeValues: ThemeColors = {
    primary: primaryColor,
    button: buttonColor,
    buttonForeground: buttonTextColor,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 flex items-center justify-center">
        <p>Carregando oferta...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 flex items-center justify-center">
        <p className="text-red-500">Erro: {error}</p>
      </div>
    );
  }

  if (!offerData) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 flex items-center justify-center">
        <p>Nenhuma oferta encontrada.</p>
      </div>
    );
  }

  // Se tudo deu certo, renderiza o CheckoutPage com os dados
  return (
    <I18nProvider language={offerData.language || "pt"}>
      <ThemeContext.Provider value={themeValues}>
        <CheckoutPage offerData={offerData} />
      </ThemeContext.Provider>
    </I18nProvider>
  );
}
