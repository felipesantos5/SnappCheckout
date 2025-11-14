// src/pages/CheckoutSlugPage.tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import CheckoutPage from "./CheckoutPage"; // O seu layout antigo
import { getContrast } from "polished";
import { API_URL } from "../config/BackendUrl";

// URL da sua AP

// Tipagem para os dados da oferta (deve bater com o backend)
export interface OfferData {
  _id: string;
  slug: string;
  name: string;
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
  };
  orderBumps: {
    _id: string;
    name: string;
    description?: string;
    imageUrl?: string;
    priceInCents: number;
  }[];
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

  useEffect(() => {
    if (offerData) {
      const root = document.documentElement; // Pega o :root

      // a. Calcula a cor de texto do botão (preto ou branco)
      const buttonTextColor =
        getContrast(offerData.buttonColor, "#FFFFFF") > 2.5
          ? "#FFFFFF" // Branco
          : "#000000"; // Preto

      // b. Aplica as variáveis (como você sugeriu!)
      root.style.setProperty("--color-primary", offerData.primaryColor);
      root.style.setProperty("--color-button", offerData.buttonColor);
      root.style.setProperty("--color-button-foreground", buttonTextColor);
    }

    // c. (Opcional) Limpa as variáveis se o usuário sair da página
    return () => {
      const root = document.documentElement;
      root.style.removeProperty("--color-primary");
      root.style.removeProperty("--color-button");
      root.style.removeProperty("--color-button-foreground");
    };
  }, [offerData]);

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
  return <CheckoutPage offerData={offerData} />;
}
