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
import { SalesHistoryTable } from "@/components/dashboard/SalesHistoryTable";
import { API_URL } from "@/config/BackendUrl";
import { ChevronLeft } from "lucide-react";

// --- INÍCIO DA CORREÇÃO ---
// 1. Tipo para o produto vindo da API (preço em CENTAVOS)
interface ApiProductData {
  _id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  priceInCents: number; // <- API envia CENTS (int)
}

// 2. Tipo para a Oferta vinda da API (preço em CENTAVOS)
interface ApiOfferData {
  _id: string;
  slug: string;
  name: string;
  bannerImageUrl?: string;
  currency: string;
  language: string;
  collectAddress: boolean;
  primaryColor: string;
  buttonColor: string;
  mainProduct: ApiProductData;
  orderBumps: ApiProductData[];
}
// --- FIM DA CORREÇÃO ---

// Helper para converter centavos (int) para reais (float)
const centsToReais = (cents: number): number => {
  return parseFloat((cents / 100).toFixed(2));
};

// 3. Esta função transforma os dados da API (cents) para o formato do formulário (reais)
// O tipo de retorno é OfferFormData (Input type), onde priceInCents é 'unknown'
// O 'number' (reais) que retornamos é assignável a 'unknown'.
const transformDataForForm = (data: ApiOfferData): OfferFormData => {
  return {
    ...data,
    mainProduct: {
      ...data.mainProduct,
      priceInCents: centsToReais(data.mainProduct.priceInCents),
    },
    orderBumps: data.orderBumps.map((bump: ApiProductData) => ({
      ...bump,
      priceInCents: centsToReais(bump.priceInCents),
    })),
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
      <Separator />
      <SalesHistoryTable offerId={offerId!} />
    </div>
  );
}
