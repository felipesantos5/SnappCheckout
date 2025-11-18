// src/pages/dashboard/OffersPage.tsx
import { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
// 1. Importar os componentes da tabela shadcn
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { API_URL } from "@/config/BackendUrl";
import { Badge } from "@/components/ui/badge";
import { Copy, ImageIcon, Loader2 } from "lucide-react";
import type { product } from "@/types/product";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Tipo para os dados da oferta (sem alterações)
interface Offer {
  _id: string;
  name: string;
  slug: string;
  mainProduct: product;
}

// Helper de formatação de moeda
const formatCurrency = (amountInCents: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amountInCents / 100);
};

export function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Função para buscar os dados (sem alterações)
  const fetchOffers = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/offers`);
      setOffers(response.data);
    } catch (error) {
      toast.error("Falha ao carregar ofertas.", {
        description: (error as Error).message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, []);

  // Função para copiar a URL (ajuste o domínio de produção)
  const handleCopy = (slug: string) => {
    // !! IMPORTANTE !!
    // Substitua "https://checkout.seusite.com" pelo seu domínio de produção
    const checkoutBaseUrl =
      window.location.hostname === "localhost"
        ? "https://localhost:5173" // URL do app 'checkout' em dev
        : "https://snappcheckout.com"; // URL do app 'checkout' em produção

    const url = `${checkoutBaseUrl}/c/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("URL do checkout copiada!");
  };

  return (
    <div className="max-w-6xl m-auto">
      {/* Cabeçalho da Página (FORA do card, como no protótipo) */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Links de pagamento</h1>
          <p className="text-sm text-muted-foreground">{isLoading ? "..." : `${offers.length} ${offers.length === 1 ? "registro" : "registros"}`}</p>
        </div>
        <Button asChild>
          <Link to="/offers/new">+ Adicionar link</Link>
        </Button>
      </div>

      {/* 4. Card que envolve a Tabela. 
          overflow-hidden é para os cantos arredondados funcionarem no Header da tabela */}
      <Card className="overflow-hidden">
        <Table>
          {/* 5. Cabeçalho da Tabela estilizado para parecer com o protótipo */}
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-muted/50">
              <TableHead className="w-2/5 px-6 py-3 text-xs font-semibold uppercase tracking-wider">Descrição</TableHead>
              <TableHead className="w-1/5 px-6 py-3 text-xs font-semibold uppercase tracking-wider">Valor</TableHead>
              <TableHead className="w-1/5 px-6 py-3 text-xs font-semibold uppercase tracking-wider">URL</TableHead>
              <TableHead className="w-[100px] px-6 py-3 text-xs font-semibold uppercase tracking-wider text-right">Status</TableHead>
              <TableHead className="w-[100px] px-6 py-3"></TableHead>
            </TableRow>
          </TableHeader>

          {/* 6. Corpo da Tabela */}
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : offers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                  Nenhum link de pagamento encontrado.
                </TableCell>
              </TableRow>
            ) : (
              offers.map((offer) => (
                <TableRow key={offer._id} className="hover:bg-muted/50">
                  {/* DESCRIÇÃO */}
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {/* <img src={offer.mainProduct.imageUrl || "/default-product-image.png"} alt="imagem do produto" className="w-9" /> */}
                      <Avatar className="h-9 w-9 ">
                        <AvatarImage src={offer.mainProduct.imageUrl} alt={"imagem do produto"} />
                        <AvatarFallback className="rounded-md">
                          <ImageIcon />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm text-foreground">{offer.name}</div>
                        <div className="text-xs text-muted-foreground">{offer.slug}</div>
                      </div>
                    </div>
                  </TableCell>

                  {/* VALOR */}
                  <TableCell className="px-6 py-4 text-sm font-medium text-foreground">{formatCurrency(offer.mainProduct.priceInCents)}</TableCell>

                  {/* URL */}
                  <TableCell className="px-6 py-4">
                    <Button variant="link" size="sm" onClick={() => handleCopy(offer.slug)} className="text-xs p-0 h-auto text-primary">
                      Copiar Link
                      <Copy className="h-3 w-3 ml-1.5" />
                    </Button>
                  </TableCell>

                  {/* STATUS (Mockado como "Ativo") */}
                  <TableCell className="px-6 py-4 text-right">
                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 font-medium">
                      Ativo
                    </Badge>
                  </TableCell>

                  {/* AÇÕES (Editar) */}
                  <TableCell className="px-6 py-4 text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/offers/${offer._id}`}>Editar</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
