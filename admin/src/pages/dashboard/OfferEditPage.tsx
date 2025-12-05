// src/pages/dashboard/OfferEditPage.tsx
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
// --- INÍCIO DA CORREÇÃO ---
// Importamos o TIPO DE INPUT (OfferFormData) para o formulário
import { OfferForm, type OfferFormData } from "@/components/forms/OfferForm";
// --- FIM DA CORREÇÃO ---
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { CheckoutOfferSummary } from "@/components/dashboard/CheckoutOfferSummary";
import { API_URL } from "@/config/BackendUrl";
import { ChevronLeft } from "lucide-react";

// --- INÍCIO DA CORREÇÃO ---
// 1. Tipo para o produto vindo da API (preço em CENTAVOS)
interface ApiProductData {
  _id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  headline?: string;
  priceInCents: number;
  compareAtPriceInCents?: number;
  customId?: string;
}

// 2. Tipo para a Oferta vinda da API (preço em CENTAVOS)
interface ApiOfferData {
  _id: string;
  slug: string;
  name: string;
  bannerImageUrl?: string;
  secondaryBannerImageUrl?: string;
  thankYouPageUrl?: string;
  currency: string;
  language: string;
  collectAddress: boolean;
  collectPhone?: boolean;
  primaryColor: string;
  buttonColor: string;
  backgroundColor?: string;
  textColor?: string;
  paypalEnabled: boolean;
  utmfyWebhookUrl?: string;
  utmfyWebhookUrls?: string[];
  facebookPixelId?: string;
  facebookAccessToken?: string;
  facebookPixels?: Array<{ pixelId: string; accessToken: string }>;
  upsell?: {
    enabled: boolean;
    name: string;
    price: number;
    redirectUrl: string;
    customId?: string;
  };
  mainProduct: ApiProductData;
  orderBumps: ApiProductData[];
  membershipWebhook?: {
    enabled: boolean;
    url: string;
    authToken: string;
  };
}

// 3. Esta função transforma os dados da API (cents) para o formato do formulário (reais)
// O tipo de retorno é OfferFormData (Input type), onde priceInCents é 'unknown'
// O 'number' (reais) que retornamos é assignável a 'unknown'.
const transformDataForForm = (data: ApiOfferData): OfferFormData => {
  return {
    name: data.name,
    bannerImageUrl: data.bannerImageUrl,
    secondaryBannerImageUrl: data.secondaryBannerImageUrl,
    thankYouPageUrl: data.thankYouPageUrl,
    currency: data.currency,
    language: data.language,
    collectAddress: data.collectAddress,
    collectPhone: data.collectPhone ?? true,

    primaryColor: data.primaryColor,
    buttonColor: data.buttonColor,
    backgroundColor: data.backgroundColor,
    textColor: data.textColor,

    paypalEnabled: data.paypalEnabled,

    utmfyWebhookUrl: data.utmfyWebhookUrl,
    utmfyWebhookUrls: data.utmfyWebhookUrls || [],
    facebookPixelId: data.facebookPixelId || "",
    facebookAccessToken: data.facebookAccessToken || "",
    facebookPixels: data.facebookPixels || [],
    // --- NOVO: Mapear Membership Webhook ---
    membershipWebhook: data.membershipWebhook
      ? {
          enabled: data.membershipWebhook.enabled,
          url: data.membershipWebhook.url,
          authToken: data.membershipWebhook.authToken,
        }
      : {
          enabled: false,
          url: "",
          authToken: "",
        },

    // Mapear Upsell (incluindo customId)
    upsell: data.upsell
      ? {
          enabled: data.upsell.enabled,
          name: data.upsell.name,
          price: data.upsell.price ? data.upsell.price / 100 : 0,
          redirectUrl: data.upsell.redirectUrl,
          customId: data.upsell.customId, // <--- NOVO
        }
      : {
          enabled: false,
          name: "",
          price: 0,
          redirectUrl: "",
          customId: "",
        },

    // Mapear Produto Principal (incluindo customId)
    mainProduct: {
      name: data.mainProduct.name,
      description: data.mainProduct.description,
      imageUrl: data.mainProduct.imageUrl,
      priceInCents: data.mainProduct.priceInCents / 100,
      compareAtPriceInCents: data.mainProduct.compareAtPriceInCents ? data.mainProduct.compareAtPriceInCents / 100 : undefined,
      customId: data.mainProduct.customId, // <--- NOVO
    },

    // Mapear Order Bumps (incluindo customId)
    orderBumps:
      data.orderBumps?.map((bump) => ({
        name: bump.name,
        headline: bump.headline,
        description: bump.description,
        imageUrl: bump.imageUrl,
        priceInCents: bump.priceInCents / 100,
        customId: bump.customId, // <--- NOVO
      })) || [],
  };
};

export function OfferEditPage() {
  const navigate = useNavigate();
  const { id: offerId } = useParams<{ id: string }>();

  // 4. Corrigir os estados
  const [offerData, setOfferData] = useState<ApiOfferData | null>(null); // Dados brutos da API (cents)
  const [formData, setFormData] = useState<OfferFormData | null>(null); // Dados formatados para o form (reais)
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!offerId) return;

    const fetchOffer = async () => {
      setIsLoading(true);
      try {
        // 5. Tipar a resposta do Axios com o tipo da API
        const response = await axios.get<ApiOfferData>(`${API_URL}/offers/${offerId}`);
        setOfferData(response.data); // Salva os dados brutos (com slug e cents)
        setFormData(transformDataForForm(response.data)); // Salva os dados do formulário (reais)
      } catch (error) {
        toast.error("Falha ao carregar oferta.", {
          description: "Você pode não ter permissão ou a oferta não existe.",
        });
        navigate("/offers");
      } finally {
        setIsLoading(false);
      }
    };

    fetchOffer();
  }, [offerId, navigate]);

  if (isLoading) {
    // ... (código de loading)
  }

  if (!formData || !offerData) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 w-full overflow-x-hidden">
      <Link to="/offers" className="hover:underline mb-4 font-semibold flex gap-1 items-center">
        <ChevronLeft size={20} />
        Voltar para ofertas
      </Link>
      {/* 6. Passar o 'formData' (tipo Input) para o Resumo */}
      <CheckoutOfferSummary offer={formData} slug={offerData.slug} />
      <Separator />
      <Card className="w-full overflow-x-hidden">
        <CardHeader>
          <CardTitle>Editar Oferta</CardTitle>
          <CardDescription>Ajuste os campos abaixo para editar sua oferta.</CardDescription>
        </CardHeader>
        <CardContent className="w-full overflow-x-hidden">
          <OfferForm
            offerId={offerId}
            initialData={formData}
            onSuccess={() => {
              toast.success("Oferta atualizada com sucesso!");
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
