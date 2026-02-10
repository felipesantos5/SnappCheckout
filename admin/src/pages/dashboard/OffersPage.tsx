// src/pages/dashboard/OffersPage.tsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
// 1. Importar os componentes da tabela shadcn
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { API_URL } from "@/config/BackendUrl";
// import { Badge } from "@/components/ui/badge";
import { Archive, ArchiveRestore, BarChart3, ChevronDown, Copy, FolderInput, FolderPlus, ImageIcon, Loader2, MoreVertical, Pencil, Trash, Trash2 } from "lucide-react";
import type { product } from "@/types/product";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

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
  categoryId?: string;
}

interface Category {
  _id: string;
  name: string;
  order: number;
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
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [selectedOffers, setSelectedOffers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isMoveGroupOpen, setIsMoveGroupOpen] = useState(false);
  const [targetGroupName, setTargetGroupName] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [isNewCategoryOpen, setIsNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryToEdit, setCategoryToEdit] = useState<Category | null>(null);
  const navigate = useNavigate();

  // Função para buscar os dados
  const fetchOffers = async (archived: boolean = false) => {
    setIsLoading(true);
    try {
      const [offersRes, categoriesRes] = await Promise.all([
        axios.get(`${API_URL}/offers?archived=${archived}`),
        axios.get(`${API_URL}/categories`)
      ]);
      setOffers(offersRes.data);
      setCategories(categoriesRes.data);
    } catch (error) {
      toast.error("Falha ao carregar dados.", {
        description: (error as Error).message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMoveOfferToCategory = async (offerId: string, categoryId: string | null) => {
    try {
      const catName = categoryId ? categories.find(c => c._id === categoryId)?.name : "Sem Pasta";
      toast.loading(`Movendo oferta para "${catName}"...`);

      await axios.put(`${API_URL}/offers/${offerId}`, {
        categoryId: categoryId || null,
        group: categoryId ? categories.find(c => c._id === categoryId)?.name : ""
      });

      toast.dismiss();
      toast.success("Oferta movida!");
      fetchOffers(showArchived);
    } catch (error) {
      toast.dismiss();
      toast.error("Erro ao mover oferta.");
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await axios.post(`${API_URL}/categories`, { name: newCategoryName.trim() });
      toast.success("Pasta criada com sucesso!");
      setNewCategoryName("");
      setIsNewCategoryOpen(false);
      fetchOffers(showArchived);
    } catch (error) {
      toast.error("Erro ao criar pasta.");
    }
  };

  const handleUpdateCategory = async () => {
    if (!categoryToEdit || !newCategoryName.trim()) return;
    try {
      await axios.put(`${API_URL}/categories/${categoryToEdit._id}`, { name: newCategoryName.trim() });
      toast.success("Pasta renomeada!");
      setCategoryToEdit(null);
      setNewCategoryName("");
      fetchOffers(showArchived);
    } catch (error) {
      toast.error("Erro ao renomear pasta.");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta pasta? As ofertas nela voltarão para 'Outras Ofertas'.")) return;
    try {
      await axios.delete(`${API_URL}/categories/${id}`);
      toast.success("Pasta excluída!");
      fetchOffers(showArchived);
    } catch (error) {
      toast.error("Erro ao excluir pasta.");
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

  // Filtragem e Busca
  const filteredOffers = offers.filter(offer => {
    const matchesSearch = offer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      offer.slug.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Separar ofertas raiz (sem categoria) e ofertas em categorias
  // Se estiver na aba de arquivados, mostramos tudo sem pastas
  const rootOffers = showArchived
    ? filteredOffers
    : filteredOffers.filter(offer => !offer.categoryId);

  const categorizedOffers = showArchived
    ? {}
    : filteredOffers.reduce((acc, offer) => {
      if (offer.categoryId) {
        const cat = categories.find(c => c._id === offer.categoryId);
        const groupName = cat ? cat.name : "Pasta Desconhecida";
        if (!acc[groupName]) acc[groupName] = [];
        acc[groupName].push(offer);
      }
      return acc;
    }, {} as Record<string, Offer[]>);

  // Garantir que categorias criadas apareçam mesmo se vazias (apenas se não estiver em arquivados)
  if (!showArchived) {
    categories.forEach(cat => {
      if (!categorizedOffers[cat.name]) {
        categorizedOffers[cat.name] = [];
      }
    });
  }

  const allGroups = categories.map(c => c.name).sort();

  // Estado para controlar quais grupos estão abertos (fechados por padrão)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // As pastas virão fechadas por padrão (Estado inicial vazio {})

  const renderOfferRow = (offer: Offer) => (
    <TableRow key={offer._id} className={`hover:bg-muted/50 transition-colors ${selectedOffers.includes(offer._id) ? "bg-yellow-50/50" : ""}`}>
      <TableCell className="px-4 py-3">
        <Checkbox
          checked={selectedOffers.includes(offer._id)}
          onCheckedChange={(checked) => {
            if (checked) setSelectedOffers(prev => [...prev, offer._id]);
            else setSelectedOffers(prev => prev.filter(id => id !== offer._id));
          }}
          className="border-muted-foreground/30 data-[state=checked]:bg-yellow-500 data-[state=checked]:border-yellow-500"
        />
      </TableCell>
      <TableCell className="px-6 py-3 cursor-pointer" onClick={() => navigate(`/offers/${offer._id}`)}>
        <div className="flex items-center gap-4">
          <Switch
            checked={offer.isActive}
            onCheckedChange={() => handleToggleActive(offer._id, offer.isActive)}
            aria-label="Ativar/Desativar oferta"
            className="data-[state=checked]:bg-yellow-500"
            onClick={(e) => e.stopPropagation()}
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
            < BarChart3 className="h-4 w-4" />
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

              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2">
                  <FolderInput className="h-4 w-4" />
                  Mover para...
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="w-48">
                    <DropdownMenuItem onClick={() => handleMoveOfferToCategory(offer._id, null)}>
                      Sem Pasta (Livre)
                    </DropdownMenuItem>
                    {categories.length > 0 && <DropdownMenuSeparator />}
                    {categories.map(cat => (
                      <DropdownMenuItem
                        key={cat._id}
                        onClick={() => handleMoveOfferToCategory(offer._id, cat._id)}
                        disabled={offer.categoryId === cat._id}
                      >
                        {cat.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

              <DropdownMenuSeparator />
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
  );

  const toggleGroup = (groupName: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  const toggleSelectAllGroup = (groupOffers: Offer[]) => {
    const groupIds = groupOffers.map(o => o._id);
    const allSelected = groupIds.every(id => selectedOffers.includes(id));

    if (allSelected) {
      setSelectedOffers(prev => prev.filter(id => !groupIds.includes(id)));
    } else {
      setSelectedOffers(prev => [...new Set([...prev, ...groupIds])]);
    }
  };

  const handleBulkMoveToGroup = async () => {
    if (selectedOffers.length === 0 || !targetGroupName.trim()) return;

    try {
      toast.loading(`Movendo ${selectedOffers.length} ofertas para "${targetGroupName}"...`);

      let catId: string | undefined;
      const existingCat = categories.find(c => c.name.toLowerCase() === targetGroupName.toLowerCase());

      if (existingCat) {
        catId = existingCat._id;
      } else {
        const newCatRes = await axios.post(`${API_URL}/categories`, { name: targetGroupName.trim() });
        catId = newCatRes.data._id;
      }

      // Fazemos sequencialmente ou poderíamos ter um endpoint de bulk no backend
      await Promise.all(selectedOffers.map(id =>
        axios.put(`${API_URL}/offers/${id}`, { categoryId: catId, group: targetGroupName.trim() })
      ));

      toast.dismiss();
      toast.success("Categorias atualizadas!");
      setIsMoveGroupOpen(false);
      setTargetGroupName("");
      setSelectedOffers([]);
      fetchOffers(showArchived);
    } catch (error) {
      toast.dismiss();
      toast.error("Erro ao mover ofertas.");
    }
  };

  const handleBulkArchive = async () => {
    if (selectedOffers.length === 0) return;
    try {
      toast.loading("Arquivando ofertas selecionadas...");
      await Promise.all(selectedOffers.map(id => axios.patch(`${API_URL}/offers/${id}/archive`)));
      toast.dismiss();
      toast.success("Ofertas arquivadas!");
      setSelectedOffers([]);
      fetchOffers(showArchived);
    } catch (error) {
      toast.dismiss();
      toast.error("Erro ao arquivar.");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedOffers.length === 0) return;
    if (!confirm(`Deseja deletar ${selectedOffers.length} ofertas?`)) return;

    try {
      toast.loading("Deletando ofertas selecionadas...");
      await Promise.all(selectedOffers.map(id => axios.delete(`${API_URL}/offers/${id}`)));
      toast.dismiss();
      toast.success("Ofertas deletadas!");
      setSelectedOffers([]);
      fetchOffers(showArchived);
    } catch (error) {
      toast.dismiss();
      toast.error("Erro ao deletar.");
    }
  };

  return (
    <div className="max-w-[1600px] m-auto space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {showArchived ? "Links arquivados" : "Links de pagamento"}
          </h1>
          <p className="text-sm text-muted-foreground">{isLoading ? "..." : `${filteredOffers.length} ${filteredOffers.length === 1 ? "registro" : "registros"}`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Busca */}
          <div className="relative w-full sm:w-[250px]">
            <Input
              placeholder="Buscar por nome ou slug..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 pl-3 pr-10"
            />
            {searchTerm && (
              <X
                className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground"
                onClick={() => setSearchTerm("")}
              />
            )}
          </div>
          {/* Filtro de Categorias (oculto em arquivadas) */}
          {!showArchived && allGroups.length > 0 && (
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="w-full sm:w-[180px] h-10">
                <SelectValue placeholder="Categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                <Separator className="my-1" />
                {allGroups.map(group => (
                  <SelectItem key={group} value={group}>{group}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

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
          <Button
            onClick={() => setIsNewCategoryOpen(true)}
            variant="outline"
            className="flex-1 sm:flex-none h-10 border-dashed border-muted-foreground/50 hover:border-foreground"
          >
            <FolderPlus className="h-4 w-4 mr-2" />
            <span className="hidden xs:inline">Nova pasta</span>
            <span className="xs:hidden">Pasta</span>
          </Button>
          <Button asChild className="flex-1 sm:flex-none h-10 bg-[#fdbf08] hover:bg-[#fdd049] text-black border-none">
            <Link to="/offers/new" className="flex items-center justify-center">
              + <span className="hidden xs:inline ml-1">Adicionar link</span>
              <span className="xs:hidden ml-1">Novo</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Barra de Ações em Massa */}
      {selectedOffers.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-yellow-800">
              {selectedOffers.length} {selectedOffers.length === 1 ? "selecionado" : "selecionados"}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setSelectedOffers([])} className="h-7 text-xs text-yellow-700 hover:text-yellow-900 border-none">
              Limpar seleção
            </Button>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 sm:flex-none h-8 text-xs font-bold border-yellow-300 hover:bg-yellow-100"
              onClick={() => setIsMoveGroupOpen(true)}
            >
              MOVER PARA GRUPO
            </Button>
            {!showArchived && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 sm:flex-none h-8 text-xs font-bold border-yellow-300 hover:bg-yellow-100"
                onClick={handleBulkArchive}
              >
                ARQUIVAR
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="flex-1 sm:flex-none h-8 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleBulkDelete}
            >
              DELETAR
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Card className="p-12 flex justify-center items-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </Card>
      ) : offers.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          Nenhum link de pagamento encontrado.
        </Card>
      ) : (
        <Card className="overflow-hidden p-0 border-none shadow-sm ring-1 ring-border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/30">
                  <TableHead className="w-12 px-4 py-3"></TableHead>
                  <TableHead className="w-2/5 px-6 py-3 text-[10px] font-bold uppercase tracking-widest opacity-60">Descrição</TableHead>
                  <TableHead className="w-28 px-6 py-3 text-[10px] font-bold uppercase tracking-widest opacity-60">Valor</TableHead>
                  <TableHead className="w-36 px-6 py-3 text-[10px] font-bold uppercase tracking-widest opacity-60 text-center">Vendas</TableHead>
                  <TableHead className="w-36 px-6 py-3 text-[10px] font-bold uppercase tracking-widest opacity-60 text-right">Faturamento</TableHead>
                  <TableHead className="w-36 px-6 py-3 text-[10px] font-bold uppercase tracking-widest opacity-60 text-center">URL</TableHead>
                  <TableHead className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-widest opacity-60">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Ofertas Raiz (Sem Categoria) */}
                {selectedGroup === "all" && rootOffers.map(offer => renderOfferRow(offer))}

                {/* Ofertas em Categorias */}
                {(selectedGroup === "all" ? Object.entries(categorizedOffers) :
                  (categorizedOffers[selectedGroup] ? [[selectedGroup, categorizedOffers[selectedGroup]]] : [])
                ).map((entry) => {
                  const [groupName, groupOffers] = entry as [string, Offer[]];
                  return (
                    <React.Fragment key={groupName}>
                      {/* Linha de Agrupamento (Accordion) */}
                      <TableRow
                        className="bg-muted/10 hover:bg-muted/20 cursor-pointer border-y border-muted/50 group/cat"
                      >
                        <TableCell className="px-4 py-2 border-none">
                          <Checkbox
                            checked={groupOffers.length > 0 && groupOffers.every((o: Offer) => selectedOffers.includes(o._id))}
                            onCheckedChange={() => toggleSelectAllGroup(groupOffers)}
                            className="border-muted-foreground/30 data-[state=checked]:bg-yellow-500 data-[state=checked]:border-yellow-500"
                          />
                        </TableCell>
                        <TableCell colSpan={6} className="py-2 px-6 border-none" onClick={() => toggleGroup(groupName)}>
                          <div className="flex items-center gap-2">
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${openGroups[groupName] ? "" : "-rotate-90"}`} />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                              {groupName}
                            </span>
                            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground font-medium">
                              {groupOffers.length}
                            </span>

                            <div className="flex items-center gap-1 ml-auto opacity-0 group-hover/cat:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground border-none"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const cat = categories.find(c => c.name === groupName);
                                  if (cat) {
                                    setCategoryToEdit(cat);
                                    setNewCategoryName(cat.name);
                                  }
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive border-none"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const cat = categories.find(c => c.name === groupName);
                                  if (cat) handleDeleteCategory(cat._id);
                                }}
                              >
                                <Trash className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Ofertas do Grupo */}
                      {openGroups[groupName] && groupOffers.map((offer: Offer) => renderOfferRow(offer))}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={!!offerToDelete} onOpenChange={(open) => !open && setOfferToDelete(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader className="flex flex-col items-center text-center pt-4">
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <DialogTitle className="text-xl">Excluir Oferta</DialogTitle>
            <DialogDescription className="text-sm">
              Tem certeza que deseja deletar a oferta <span className="font-bold text-foreground">"{offerToDelete?.name}"</span>?
              <br />
              Esta ação removerá todos os dados permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setOfferToDelete(null)} disabled={isDeleting} className="flex-1">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="flex-1">
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deletando...
                </>
              ) : (
                "Sim, Deletar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Mover para Grupo (Nova Categoria) */}
      <Dialog open={isMoveGroupOpen} onOpenChange={setIsMoveGroupOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Organizar Categorias</DialogTitle>
            <DialogDescription>
              Selecione ou crie um novo grupo para as {selectedOffers.length} ofertas selecionadas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome da Categoria/Grupo</label>
              <Input
                placeholder="Ex: Cursos, Mentorias, Ofertas VIP..."
                value={targetGroupName}
                onChange={(e) => setTargetGroupName(e.target.value)}
                autoFocus
              />
              <p className="text-[10px] text-muted-foreground italic">
                Se o grupo não existir, ele será criado automaticamente.
              </p>
            </div>
            {allGroups.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Grupos Existentes</label>
                <div className="flex flex-wrap gap-2">
                  {allGroups.map(g => (
                    <Button
                      key={g}
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px]"
                      onClick={() => setTargetGroupName(g)}
                    >
                      {g}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMoveGroupOpen(false)}>Cancelar</Button>
            <Button
              className="bg-[#fdbf08] hover:bg-[#fdd049] text-black"
              onClick={handleBulkMoveToGroup}
              disabled={!targetGroupName.trim()}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Modal Nova Pasta */}
      <Dialog open={isNewCategoryOpen} onOpenChange={setIsNewCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova pasta</DialogTitle>
            <DialogDescription>Crie uma nova pasta para organizar suas ofertas.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Nome da pasta..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewCategoryOpen(false)}>Cancelar</Button>
            <Button className="bg-[#fdbf08] hover:bg-[#fdd049] text-black" onClick={handleCreateCategory} disabled={!newCategoryName.trim()}>Criar pasta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Pasta */}
      <Dialog open={!!categoryToEdit} onOpenChange={(open) => !open && setCategoryToEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar pasta</DialogTitle>
            <DialogDescription>Altere o nome da pasta.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Nome da pasta..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryToEdit(null)}>Cancelar</Button>
            <Button className="bg-[#fdbf08] hover:bg-[#fdd049] text-black" onClick={handleUpdateCategory} disabled={!newCategoryName.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
