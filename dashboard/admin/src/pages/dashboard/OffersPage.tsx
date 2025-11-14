// src/pages/dashboard/OffersPage.tsx
import { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { API_URL } from "@/config/BackendUrl";

// Tipo para os dados da oferta (simplificado para a lista)
interface Offer {
  _id: string;
  name: string;
  slug: string;
  mainProduct: { name: string; priceInCents: number };
}

export function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Função para buscar os dados
  const fetchOffers = async () => {
    setIsLoading(true);
    try {
      // (Esta rota 'GET /api/offers' precisa ser criada no seu backend
      // para listar as ofertas do usuário logado)
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

  // Buscar dados ao carregar a página
  useEffect(() => {
    fetchOffers();
  }, []);

  return (
    <Card className="max-w-6xl m-auto">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Links de Checkout (Ofertas)</CardTitle>
            <CardDescription>Crie e gerencie seus links de checkout.</CardDescription>
          </div>
          <Button asChild>
            <Link to="/offers/new">Criar Novo Link</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Carregando...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Slug (Link)</TableHead>
                <TableHead>Produto Principal</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.map((offer) => (
                <TableRow key={offer._id}>
                  <TableCell>{offer.name}</TableCell>
                  <TableCell>/{offer.slug}</TableCell>
                  <TableCell>{offer.mainProduct.name}</TableCell>
                  <TableCell>R$ {(offer.mainProduct.priceInCents / 100).toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    {/* TODO: Adicionar botão de "Editar" que abre o 
                        Dialog com o 'OfferForm' preenchido */}
                    <Button variant="outline" size="sm">
                      <Link to={`/offers/${offer._id}`}>Editar</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
