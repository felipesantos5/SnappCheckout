// src/pages/dashboard/OffersPage.tsx
import { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
// 1. Importar os componentes da tabela shadcn
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { API_URL } from "@/config/BackendUrl";
// import { Badge } from "@/components/ui/badge";
import { Archive, ArchiveRestore, BarChart3, Copy, ImageIcon, Loader2, MoreVertical, Trash2 } from "lucide-react";
import type { product } from "@/types/product";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";

// Tipo para os dados da oferta
interface Offer {
  _id: string;
  name: string;
  slug: string;
  mainProduct: product;
  salesCount: number;
  totalRevenue: number;
  currency: string;
  archived?: boolean;
  isActive: boolean;
}

// Helper de formatação de moeda
const formatCurrency = (amountInCents: number, currency: string) => {
  const localeMap: Record<string, string> = {
    BRL: "pt-BR",
    USD: "en-US",
    EUR: "de-DE",
    GBP: "en-GB",
  };

  const locale = localeMap[currency.toUpperCase()] || "pt-BR";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountInCents / 100);
};

export function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [offerToDelete, setOfferToDelete] = useState<Offer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const navigate = useNavigate();

  // Função para buscar os dados
  const fetchOffers = async (archived: boolean = false) => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/offers?archived=${archived}`);
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
    fetchOffers(showArchived);
  }, [showArchived]);

  // Função para copiar a URL (ajuste o domínio de produção)
  const handleCopy = (slug: string) => {
    // !! IMPORTANTE !!
    // Substitua "https://checkout.seusite.com" pelo seu domínio de produção
    const checkoutBaseUrl =
      window.location.hostname === "localhost"
        ? "https://localhost:5173" // URL do app 'checkout' em dev
        : "https://pay.snappcheckout.com"; // URL do app 'checkout' em produção

    const url = `${checkoutBaseUrl}/c/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("URL do checkout copiada!");
  };

  // Função para deletar a oferta
  const handleDelete = async () => {
    if (!offerToDelete) return;

    setIsDeleting(true);
    try {
      await axios.delete(`${API_URL}/offers/${offerToDelete._id}`);
      toast.success("Oferta deletada com sucesso!");
      setOfferToDelete(null);
      fetchOffers(showArchived); // Recarrega a lista
    } catch (error) {
      toast.error("Falha ao deletar oferta.", {
        description: (error as Error).message,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Função para duplicar a oferta
  const handleDuplicate = async (offerId: string) => {
    try {
      toast.loading("Duplicando oferta...");
      await axios.post(`${API_URL}/offers/${offerId}/duplicate`);
      toast.dismiss();
      toast.success("Oferta duplicada com sucesso!");
      fetchOffers(showArchived); // Recarrega a lista
    } catch (error) {
      toast.dismiss();
      toast.error("Falha ao duplicar oferta.", {
        description: (error as Error).message,
      });
    }
  };

  // Função para arquivar a oferta
  const handleArchive = async (offerId: string) => {
    try {
      await axios.patch(`${API_URL}/offers/${offerId}/archive`);
      toast.success("Oferta arquivada com sucesso!");
      fetchOffers(showArchived); // Recarrega a lista
    } catch (error) {
      toast.error("Falha ao arquivar oferta.", {
        description: (error as Error).message,
      });
    }
  };

  // Função para desarquivar a oferta
  const handleUnarchive = async (offerId: string) => {
    try {
      await axios.patch(`${API_URL}/offers/${offerId}/unarchive`);
      toast.success("Oferta desarquivada com sucesso!");
      fetchOffers(showArchived); // Recarrega a lista
    } catch (error) {
      toast.error("Falha ao desarquivar oferta.", {
        description: (error as Error).message,
      });
    }
  };

  // Função para ativar/desativar a oferta
  const handleToggleActive = async (offerId: string, currentState: boolean) => {
    try {
      await axios.patch(`${API_URL}/offers/${offerId}/toggle-active`);
      toast.success(currentState ? "Oferta desativada!" : "Oferta ativada!");
      fetchOffers(showArchived); // Recarrega a lista
    } catch (error) {
      toast.error("Falha ao alterar status da oferta.", {
        description: (error as Error).message,
      });
    }
  };

  return (
    <div className="max-w-[1600px] m-auto">
      {/* Cabeçalho da Página (FORA do card, como no protótipo) */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{showArchived ? "Links arquivados" : "Links de pagamento"}</h1>
          <p className="text-sm text-muted-foreground">{isLoading ? "..." : `${offers.length} ${offers.length === 1 ? "registro" : "registros"}`}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? (
              <>
                <ArchiveRestore className="h-4 w-4 mr-2" />
                Ver Ativos
              </>
            ) : (
              <>
                <Archive className="h-4 w-4 mr-2" />
                Ver Arquivados
              </>
            )}
          </Button>
          <Button asChild>
            <Link to="/offers/new">+ Adicionar link</Link>
          </Button>
        </div>
      </div>

      {/* 4. Card que envolve a Tabela. 
          overflow-hidden é para os cantos arredondados funcionarem no Header da tabela */}
      <Card className="overflow-hidden p-0">
        <Table>
          {/* 5. Cabeçalho da Tabela estilizado para parecer com o protótipo */}
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-muted/50">
              <TableHead className="w-2/5 px-6 py-3 text-xs font-semibold uppercase tracking-wider">Descrição</TableHead>
              <TableHead className="w-28 px-6 py-3 text-xs font-semibold uppercase tracking-wider">Valor</TableHead>
              <TableHead className="w-36 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-center">Vendas</TableHead>
              <TableHead className="w-36 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-right">Faturamento</TableHead>
              <TableHead className="w-36 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-center">URL</TableHead>
              <TableHead className=" px-6 py-3 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>

          {/* 6. Corpo da Tabela */}
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-48 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : offers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-48 text-center text-muted-foreground">
                  Nenhum link de pagamento encontrado.
                </TableCell>
              </TableRow>
            ) : (
              offers.map((offer) => (
                <TableRow key={offer._id} className="hover:bg-muted/50">
                  {/* DESCRIÇÃO */}
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={offer.isActive}
                        onCheckedChange={() => handleToggleActive(offer._id, offer.isActive)}
                        aria-label="Ativar/Desativar oferta"
                      />
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
                  <TableCell className="px-6 py-4 text-sm font-medium text-foreground whitespace-nowrap">
                    {formatCurrency(offer.mainProduct.priceInCents, offer.currency)}
                  </TableCell>

                  {/* VENDAS */}
                  <TableCell className="px-6 py-4 text-center">
                    <span className="text-sm font-medium text-foreground">{offer.salesCount || 0}</span>
                  </TableCell>

                  {/* FATURAMENTO */}
                  <TableCell className="px-6 py-4 text-center whitespace-nowrap">
                    <span className="text-sm font-bold text-foreground">{formatCurrency(offer.totalRevenue || 0, offer.currency)}</span>
                  </TableCell>

                  {/* URL */}
                  <TableCell className="px-6 py-4 text-center">
                    <Button variant="link" size="sm" onClick={() => handleCopy(offer.slug)} className="text-xs p-0 h-auto text-primary">
                      Copiar Link
                      <Copy className="h-3 w-3 ml-1.5" />
                    </Button>
                  </TableCell>

                  {/* STATUS (Mockado como "Ativo") */}
                  {/* <TableCell className="px-6 py-4 text-right">
                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 font-medium">
                      Ativo
                    </Badge>
                  </TableCell> */}

                  {/* AÇÕES (Editar e Deletar) */}
                  <TableCell className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/offers/${offer._id}`}>Editar</Link>
                      </Button>

                      <Button variant="outline" size="icon" onClick={() => navigate(`/offers/${offer._id}/analytics`)} title="Ver Métricas">
                        <BarChart3 className="h-4 w-4" />
                      </Button>

                      {/* Dropdown Menu com 3 pontinhos */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDuplicate(offer._id)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicar
                          </DropdownMenuItem>
                          {showArchived ? (
                            <DropdownMenuItem onClick={() => handleUnarchive(offer._id)}>
                              <ArchiveRestore className="h-4 w-4 mr-2" />
                              Desarquivar
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleArchive(offer._id)}>
                              <Archive className="h-4 w-4 mr-2" />
                              Arquivar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => setOfferToDelete(offer)} className="text-destructive focus:text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Deletar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={!!offerToDelete} onOpenChange={(open) => !open && setOfferToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>Tem certeza que deseja deletar a oferta "{offerToDelete?.name}"? Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOfferToDelete(null)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deletando...
                </>
              ) : (
                "Deletar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
