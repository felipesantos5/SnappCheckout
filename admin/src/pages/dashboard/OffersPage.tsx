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
import { Archive, ArchiveRestore, BarChart3, ChevronDown, Copy, ImageIcon, Loader2, MoreVertical, Trash2 } from "lucide-react";
import type { product } from "@/types/product";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

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
  group?: string;
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

  // Agrupar ofertas por grupo
  const groupedOffers = offers.reduce((acc, offer) => {
    const groupName = offer.group || "Outras Ofertas";
    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(offer);
    return acc;
  }, {} as Record<string, Offer[]>);

  // Estado para controlar quais grupos estão abertos (todos abertos por padrão)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Inicializa todos os grupos como abertos quando as ofertas são carregadas
    if (offers.length > 0) {
      const initialOpen: Record<string, boolean> = {};
      Object.keys(groupedOffers).forEach((group) => {
        initialOpen[group] = true;
      });
      setOpenGroups(initialOpen);
    }
  }, [offers.length]);

  const toggleGroup = (groupName: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  return (
    <div className="max-w-[1600px] m-auto space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {showArchived ? "Links arquivados" : "Links de pagamento"}
          </h1>
          <p className="text-sm text-muted-foreground">{isLoading ? "..." : `${offers.length} ${offers.length === 1 ? "registro" : "registros"}`}</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => setShowArchived(!showArchived)}
            className="flex-1 sm:flex-none h-10"
          >
            {showArchived ? (
              <>
                <ArchiveRestore className="h-4 w-4 mr-2" />
                <span className="hidden xs:inline">Ver Ativos</span>
                <span className="xs:hidden">Ativos</span>
              </>
            ) : (
              <>
                <Archive className="h-4 w-4 mr-2" />
                <span className="hidden xs:inline">Ver Arquivados</span>
                <span className="xs:hidden">Arquivados</span>
              </>
            )}
          </Button>
          <Button asChild className="flex-1 sm:flex-none h-10 bg-[#fdbf08] hover:bg-[#fdd049] text-black border-none">
            <Link to="/offers/new" className="flex items-center justify-center">
              + <span className="hidden xs:inline ml-1">Adicionar link</span>
              <span className="xs:hidden ml-1">Novo</span>
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-12 flex justify-center items-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </Card>
      ) : offers.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          Nenhum link de pagamento encontrado.
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedOffers).map(([groupName, groupOffers]) => (
            <div key={groupName} className="space-y-2">
              <div
                className="flex items-center gap-2 cursor-pointer group"
                onClick={() => toggleGroup(groupName)}
              >
                <div className={`transition-transform duration-200 ${openGroups[groupName] ? "rotate-180" : ""}`}>
                  <ChevronDown className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
                </div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground">
                  {groupName}
                </h3>
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                  {groupOffers.length}
                </span>
                <div className="h-[1px] bg-muted flex-1 ml-2"></div>
              </div>

              {openGroups[groupName] && (
                <Card className="overflow-hidden p-0 border-none shadow-sm ring-1 ring-border">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent bg-muted/30">
                          <TableHead className="w-2/5 px-6 py-3 text-[10px] font-bold uppercase tracking-widest opacity-60">Descrição</TableHead>
                          <TableHead className="w-28 px-6 py-3 text-[10px] font-bold uppercase tracking-widest opacity-60">Valor</TableHead>
                          <TableHead className="w-36 px-6 py-3 text-[10px] font-bold uppercase tracking-widest opacity-60 text-center">Vendas</TableHead>
                          <TableHead className="w-36 px-6 py-3 text-[10px] font-bold uppercase tracking-widest opacity-60 text-right">Faturamento</TableHead>
                          <TableHead className="w-36 px-6 py-3 text-[10px] font-bold uppercase tracking-widest opacity-60 text-center">URL</TableHead>
                          <TableHead className=" px-6 py-3 text-right text-[10px] font-bold uppercase tracking-widest opacity-60">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupOffers.map((offer) => (
                          <TableRow key={offer._id} className="hover:bg-muted/50 transition-colors">
                            <TableCell className="px-6 py-3">
                              <div className="flex items-center gap-4">
                                <Switch
                                  checked={offer.isActive}
                                  onCheckedChange={() => handleToggleActive(offer._id, offer.isActive)}
                                  aria-label="Ativar/Desativar oferta"
                                  className="data-[state=checked]:bg-yellow-500"
                                />
                                <Avatar className="h-10 w-10 border border-muted shadow-sm">
                                  <AvatarImage src={offer.mainProduct.imageUrl} alt={offer.name} />
                                  <AvatarFallback className="rounded-md bg-muted">
                                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-semibold text-sm text-foreground">{offer.name}</div>
                                  <div className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded w-fit mt-1">{offer.slug}</div>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell className="px-6 py-3 text-sm font-semibold text-foreground whitespace-nowrap">
                              {formatCurrency(offer.mainProduct.priceInCents, offer.currency)}
                            </TableCell>

                            <TableCell className="px-6 py-3 text-center">
                              <span className="text-sm font-medium text-foreground">{offer.salesCount || 0}</span>
                            </TableCell>

                            <TableCell className="px-6 py-3 text-right whitespace-nowrap">
                              <span className="text-sm font-bold text-foreground">{formatCurrency(offer.totalRevenue || 0, offer.currency)}</span>
                            </TableCell>

                            <TableCell className="px-6 py-3 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopy(offer.slug)}
                                className="text-[10px] font-bold h-7 gap-1.5 hover:bg-yellow-50 hover:text-yellow-700 transition-colors"
                              >
                                COPIAR LINK
                                <Copy className="h-3 w-3" />
                              </Button>
                            </TableCell>

                            <TableCell className="px-6 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button variant="outline" size="sm" className="h-8 text-xs font-semibold" asChild>
                                  <Link to={`/offers/${offer._id}`}>Editar</Link>
                                </Button>

                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => navigate(`/offers/${offer._id}/analytics`)}
                                  title="Ver Métricas"
                                >
                                  <BarChart3 className="h-4 w-4" />
                                </Button>

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon" className="h-8 w-8">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem onClick={() => handleDuplicate(offer._id)} className="gap-2">
                                      <Copy className="h-4 w-4" />
                                      Duplicar
                                    </DropdownMenuItem>
                                    {showArchived ? (
                                      <DropdownMenuItem onClick={() => handleUnarchive(offer._id)} className="gap-2">
                                        <ArchiveRestore className="h-4 w-4" />
                                        Desarquivar
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem onClick={() => handleArchive(offer._id)} className="gap-2">
                                        <Archive className="h-4 w-4" />
                                        Arquivar
                                      </DropdownMenuItem>
                                    )}
                                    <Separator className="my-1" />
                                    <DropdownMenuItem
                                      onClick={() => setOfferToDelete(offer)}
                                      className="text-destructive focus:text-destructive gap-2"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Deletar
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )}
            </div>
          ))}
        </div>
      )
      }

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
