import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { API_URL } from "@/config/BackendUrl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  Download,
  RefreshCw,
  Zap,
  ArrowUpCircle,
  ShoppingBag,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Percent,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatCurrency } from "@/helper/formatCurrency";
import { formatDate } from "@/helper/formatDate";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CountryFlag } from "@/components/CountryFlag";
import { Label } from "@/components/ui/label";

interface Sale {
  _id: string;
  offerId: {
    _id: string;
    name: string;
    slug: string;
  } | null;
  totalAmountInCents: number;
  currency: string;
  status: "succeeded" | "failed" | "pending" | "refunded";
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  paymentMethod: string;
  paymentMethodType?: string;
  walletType?: "apple_pay" | "google_pay" | "samsung_pay" | null;
  country?: string;
  failureReason?: string;
  failureMessage?: string;
  createdAt: string;
  isUpsell?: boolean;
  items?: Array<{
    name: string;
    priceInCents: number;
    isOrderBump: boolean;
  }>;
}

interface Offer {
  _id: string;
  name: string;
}

// Status com cores e descrições
const statusConfig = {
  succeeded: {
    label: "Aprovada",
    color: "bg-green-500/10 text-green-700 border-green-500/20",
    icon: "✓",
  },
  failed: {
    label: "Falhou",
    color: "bg-red-500/10 text-red-700 border-red-500/20",
    icon: "✕",
  },
  pending: {
    label: "Pendente",
    color: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
    icon: "⏱",
  },
  refunded: {
    label: "Reembolsada",
    color: "bg-blue-500/10 text-blue-700 border-blue-500/20",
    icon: "↩",
  },
};

// Taxas de conversão para BRL (atualizadas periodicamente)
const exchangeRates: Record<string, number> = {
  BRL: 1.0,
  USD: 5.0, // 1 USD = ~5 BRL
  EUR: 5.5, // 1 EUR = ~5.5 BRL
  AUD: 3.3, // 1 AUD = ~3.3 BRL
  GBP: 6.3, // 1 GBP = ~6.3 BRL
  CAD: 3.7, // 1 CAD = ~3.7 BRL
  JPY: 0.034, // 1 JPY = ~0.034 BRL
  CHF: 5.8, // 1 CHF = ~5.8 BRL
  CNY: 0.7, // 1 CNY = ~0.70 BRL
  MXN: 0.3, // 1 MXN = ~0.30 BRL
  ARS: 0.005, // 1 ARS = ~0.005 BRL
};

// Função para converter valor em centavos para BRL
const convertToBRL = (amountInCents: number, currency: string | undefined): number => {
  // Se não houver moeda definida, assume BRL
  if (!currency) {
    return amountInCents;
  }

  const normalizedCurrency = currency.toUpperCase();
  const rate = exchangeRates[normalizedCurrency] || 1.0;
  return amountInCents * rate;
};

// Helper para determinar o tipo de venda
const getSaleTypeIcon = (sale: Sale) => {
  if (sale.isUpsell) {
    return (
      <Badge variant="outline" className="border-purple-200 text-purple-700 bg-purple-50">
        <Zap className="w-3 h-3 mr-1" /> Upsell
      </Badge>
    );
  }

  const hasBump = sale.items?.some((i) => i.isOrderBump);
  if (hasBump) {
    return (
      <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">
        <ArrowUpCircle className="w-3 h-3 mr-1" /> + Bump
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-muted-foreground">
      <ShoppingBag className="w-3 h-3 mr-1" /> Venda
    </Badge>
  );
};

export function AllSalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [allSalesForMetrics, setAllSalesForMetrics] = useState<Sale[]>([]); // Todas as vendas do filtro para métricas
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Carrega estado do filtro do localStorage
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = localStorage.getItem("allSalesFilterOpen");
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Filtros
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [searchEmail, setSearchEmail] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(["succeeded", "failed", "pending", "refunded"]);
  const [selectedOffers, setSelectedOffers] = useState<string[]>([]);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [selectedWallets, setSelectedWallets] = useState<string[]>([]);
  const [periodFilter, setPeriodFilter] = useState<"all" | "today" | "week" | "month" | "custom">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Salva estado do filtro no localStorage
  useEffect(() => {
    localStorage.setItem("allSalesFilterOpen", JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  // Buscar ofertas
  useEffect(() => {
    const fetchOffers = async () => {
      try {
        const response = await axios.get(`${API_URL}/offers`);
        setOffers(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error("Erro ao buscar ofertas:", error);
        setOffers([]);
      }
    };
    fetchOffers();
  }, []);

  // Função auxiliar para construir parâmetros de filtro
  const buildFilterParams = () => {
    const params = new URLSearchParams();

    if (selectedStatuses.length > 0 && selectedStatuses.length < 4) {
      selectedStatuses.forEach((status) => params.append("status", status));
    }

    if (selectedOffers.length > 0) {
      selectedOffers.forEach((offerId) => params.append("offerId", offerId));
    }

    if (selectedPaymentMethods.length > 0) {
      selectedPaymentMethods.forEach((method) => params.append("paymentMethod", method));
    }

    if (selectedWallets.length > 0) {
      selectedWallets.forEach((wallet) => params.append("walletType", wallet));
    }

    if (searchEmail) params.append("email", searchEmail);

    // Calcular datas baseado no filtro de período
    if (periodFilter !== "all") {
      const now = new Date();
      let calculatedStartDate = startDate;
      let calculatedEndDate = endDate;

      if (periodFilter === "today") {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        calculatedStartDate = today.toISOString();
        calculatedEndDate = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString();
      } else if (periodFilter === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        calculatedStartDate = weekAgo.toISOString();
        calculatedEndDate = now.toISOString();
      } else if (periodFilter === "month") {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        calculatedStartDate = monthAgo.toISOString();
        calculatedEndDate = now.toISOString();
      }

      if (calculatedStartDate) params.append("startDate", calculatedStartDate);
      if (calculatedEndDate) params.append("endDate", calculatedEndDate);
    }

    return params;
  };

  // Buscar TODAS as vendas para cálculo de métricas (sem paginação)
  const fetchAllSalesForMetrics = async () => {
    try {
      const params = buildFilterParams();
      params.set("limit", "10000"); // Limite alto para pegar todas as vendas

      const response = await axios.get(`${API_URL}/sales?${params.toString()}`);
      const salesData = response.data?.data || [];
      setAllSalesForMetrics(Array.isArray(salesData) ? salesData : []);
    } catch (error) {
      console.error("Erro ao buscar vendas para métricas:", error);
    }
  };

  // Buscar vendas paginadas
  const fetchSales = async () => {
    setIsLoading(true);
    try {
      const params = buildFilterParams();
      params.set("page", page.toString());
      params.set("limit", limit.toString());

      const response = await axios.get(`${API_URL}/sales?${params.toString()}`);
      const salesData = response.data?.data || [];
      const metaData = response.data?.meta || { total: 0 };

      setSales(Array.isArray(salesData) ? salesData : []);
      setTotal(metaData.total || 0);
    } catch (error) {
      toast.error("Erro ao buscar vendas", {
        description: (error as Error).message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Buscar vendas paginadas quando mudar a página
  useEffect(() => {
    fetchSales();
  }, [page]);

  // Buscar todas as vendas para métricas quando mudar os filtros
  useEffect(() => {
    fetchAllSalesForMetrics();
    setPage(1); // Voltar para página 1 quando filtros mudarem
    fetchSales();
  }, [selectedStatuses, selectedOffers, selectedPaymentMethods, selectedWallets, periodFilter, startDate, endDate, searchEmail]);

  // Métricas calculadas (sempre em BRL) - baseadas em TODAS as vendas do filtro
  const metrics = useMemo(() => {
    const succeededSales = allSalesForMetrics.filter((s) => s.status === "succeeded");

    // Converte todas as vendas para BRL antes de somar
    const totalRevenue = succeededSales.reduce((acc, sale) => {
      const amountInBRL = convertToBRL(sale.totalAmountInCents, sale.currency);
      return acc + amountInBRL;
    }, 0);

    const totalSales = succeededSales.length;
    const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
    const approvalRate = allSalesForMetrics.length > 0 ? (succeededSales.length / allSalesForMetrics.length) * 100 : 0;

    return {
      totalSales,
      totalRevenue,
      averageTicket,
      approvalRate,
    };
  }, [allSalesForMetrics]);

  // Exportar para CSV
  const handleExport = () => {
    if (!sales || sales.length === 0) {
      toast.error("Nenhuma venda para exportar");
      return;
    }

    try {
      const csvContent = [
        ["Data", "Cliente", "Email", "Oferta", "Tipo", "Status", "Valor", "Moeda", "País", "Método"].join(","),
        ...sales.map((sale) => {
          let tipo = "Venda";
          if (sale.isUpsell) tipo = "Upsell";
          else if (sale.items?.some((i) => i.isOrderBump)) tipo = "+ Bump";

          return [
            new Date(sale.createdAt).toLocaleDateString(),
            sale.customerName || "",
            sale.customerEmail || "",
            sale.offerId?.name || "N/A",
            tipo,
            statusConfig[sale.status]?.label || sale.status,
            (sale.totalAmountInCents / 100).toFixed(2),
            (sale.currency || "BRL").toUpperCase(),
            sale.country || "N/A",
            sale.paymentMethod || "N/A",
          ].join(",");
        }),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vendas-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      toast.success("Arquivo CSV exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar CSV:", error);
      toast.error("Erro ao exportar arquivo CSV");
    }
  };

  const clearAllFilters = () => {
    setSearchEmail("");
    setSelectedStatuses(["succeeded", "failed", "pending", "refunded"]);
    setSelectedOffers([]);
    setSelectedPaymentMethods([]);
    setSelectedWallets([]);
    setPeriodFilter("all");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const totalPages = total > 0 ? Math.ceil(total / limit) : 1;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Botão Toggle Sidebar - Fixed para ficar sempre visível */}
      <Button
        variant="outline"
        size="icon"
        className={`fixed z-50 transition-all duration-300 ease-in-out shadow-md hover:shadow-lg ${
          isSidebarOpen
            ? "top-[60px] left-[272px]" // 288px (w-72) - 16px = 272px
            : "top-1/2 -translate-y-1/2 left-[208px]"
        }`}
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>

      {/* Sidebar de Filtros */}
      <aside
        className={`relative border-r bg-card py-4 overflow-y-auto shrink-0 transition-all duration-300 ease-in-out ${
          isSidebarOpen ? "w-72 px-4 pl-0" : "w-0 px-0 border-r-0"
        }`}
      >
        <div className={`space-y-4 ${isSidebarOpen ? "opacity-100" : "opacity-0"} transition-opacity duration-200`}>
          <div className="flex items-center justify-between ml-14">
            <h2 className="text-lg font-semibold">Filtros</h2>
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              <X className="h-4 w-4 mr-1" />
              Limpar
            </Button>
          </div>

          {/* Período */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Período</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={periodFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setPeriodFilter("all");
                  setStartDate("");
                  setEndDate("");
                  setPage(1);
                }}
                className={periodFilter === "all" ? "bg-[#fdbf08] hover:bg-[#fdd049] text-black" : ""}
              >
                Todas
              </Button>
              <Button
                variant={periodFilter === "today" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setPeriodFilter("today");
                  setStartDate("");
                  setEndDate("");
                  setPage(1);
                }}
                className={periodFilter === "today" ? "bg-[#fdbf08] hover:bg-[#fdd049] text-black" : ""}
              >
                Hoje
              </Button>
              {/* <Button
                variant={periodFilter === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setPeriodFilter("week");
                  setStartDate("");
                  setEndDate("");
                  setPage(1);
                }}
                className={periodFilter === "week" ? "bg-[#fdbf08] hover:bg-[#fdd049] text-black" : ""}
              >
                7 dias
              </Button> */}
              <Button
                variant={periodFilter === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setPeriodFilter("month");
                  setStartDate("");
                  setEndDate("");
                  setPage(1);
                }}
                className={periodFilter === "month" ? "bg-[#fdbf08] hover:bg-[#fdd049] text-black" : ""}
              >
                30 dias
              </Button>
              <Button
                variant={periodFilter === "custom" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriodFilter("custom")}
                className={periodFilter === "custom" ? "bg-[#fdbf08] hover:bg-[#fdd049] text-black" : ""}
              >
                Personalizado
              </Button>
            </div>
            {periodFilter === "custom" && (
              <div className="space-y-2 pt-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Data inicial"
                />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Data final"
                />
              </div>
            )}
          </div>

          {/* Buscar por Email */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Email do Cliente</Label>
            <Input
              placeholder="Buscar por email..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  fetchSales();
                }
              }}
            />
          </div>

          {/* Status */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Status</Label>
            <div className="space-y-2">
              {Object.entries(statusConfig).map(([key, config]) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`status-${key}`}
                    checked={selectedStatuses.includes(key)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedStatuses([...selectedStatuses, key]);
                      } else {
                        setSelectedStatuses(selectedStatuses.filter((s) => s !== key));
                      }
                      setPage(1);
                    }}
                  />
                  <label htmlFor={`status-${key}`} className="text-sm cursor-pointer">
                    {config.icon} {config.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Ofertas */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Ofertas</Label>
            <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
              {offers.map((offer) => (
                <div key={offer._id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`offer-${offer._id}`}
                    checked={selectedOffers.includes(offer._id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedOffers([...selectedOffers, offer._id]);
                      } else {
                        setSelectedOffers(selectedOffers.filter((o) => o !== offer._id));
                      }
                      setPage(1);
                    }}
                  />
                  <label htmlFor={`offer-${offer._id}`} className="text-sm cursor-pointer truncate">
                    {offer.name}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Métodos de Pagamento */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Método de Pagamento</Label>
            <div className="space-y-2">
              {[
                { key: "credit_card", label: "Cartão de Crédito" },
                { key: "paypal", label: "PayPal" },
                { key: "pix", label: "PIX" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`payment-${key}`}
                    checked={selectedPaymentMethods.includes(key)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedPaymentMethods([...selectedPaymentMethods, key]);
                      } else {
                        setSelectedPaymentMethods(selectedPaymentMethods.filter((m) => m !== key));
                      }
                      setPage(1);
                    }}
                  />
                  <label htmlFor={`payment-${key}`} className="text-sm cursor-pointer">
                    {label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Wallets Digitais */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Wallets Digitais</Label>
            <div className="space-y-2">
              {[
                { key: "apple_pay", label: " Apple Pay" },
                { key: "google_pay", label: "🅖 Google Pay" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`wallet-${key}`}
                    checked={selectedWallets.includes(key)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedWallets([...selectedWallets, key]);
                      } else {
                        setSelectedWallets(selectedWallets.filter((w) => w !== key));
                      }
                      setPage(1);
                    }}
                  />
                  <label htmlFor={`wallet-${key}`} className="text-sm cursor-pointer">
                    {label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Botão Aplicar */}
          <Button className="w-full bg-[#fdbf08] hover:bg-[#fdd049] text-black" onClick={() => fetchSales()}>
            Aplicar Filtros
          </Button>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1">
        <div className="p-4 px-6 space-y-4">
          {/* Cabeçalho */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Todas as Vendas</h1>
              <p className="text-muted-foreground">{isLoading ? "Carregando..." : `${total} ${total === 1 ? "venda" : "vendas"} encontradas`}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => fetchSales()} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
              <Button variant="outline" onClick={handleExport} disabled={sales.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          </div>

          {/* Cards de Métricas */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-[#fdbf08]/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
                <ShoppingCart className="h-4 w-4 text-[#fdbf08]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalSales}</div>
                <p className="text-xs text-muted-foreground">Vendas aprovadas</p>
              </CardContent>
            </Card>

            <Card className="border-[#fdbf08]/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
                <DollarSign className="h-4 w-4 text-[#fdbf08]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(metrics.totalRevenue)}</div>
                <p className="text-xs text-muted-foreground">Receita total aprovada</p>
              </CardContent>
            </Card>

            <Card className="border-[#fdbf08]/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                <TrendingUp className="h-4 w-4 text-[#fdbf08]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(metrics.averageTicket)}</div>
                <p className="text-xs text-muted-foreground">Por venda aprovada</p>
              </CardContent>
            </Card>

            <Card className="border-[#fdbf08]/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Aprovação</CardTitle>
                <Percent className="h-4 w-4 text-[#fdbf08]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.approvalRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">Vendas aprovadas / total</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabela */}
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[120px]">Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Oferta</TableHead>
                  <TableHead className="w-[120px]">Tipo</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-[80px] text-center">País</TableHead>
                  <TableHead className="w-[120px]">Método</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-48 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : !sales || sales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-48 text-center text-muted-foreground">
                      Nenhuma venda encontrada com os filtros aplicados.
                    </TableCell>
                  </TableRow>
                ) : (
                  sales.map((sale) => (
                    <TableRow key={sale._id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="text-sm">{sale.createdAt ? formatDate(sale.createdAt) : "N/A"}</div>
                      </TableCell>

                      <TableCell>
                        <div>
                          <div className="font-medium text-sm">{sale.customerName}</div>
                          <div className="text-xs text-muted-foreground">{sale.customerEmail}</div>
                        </div>
                      </TableCell>

                      <TableCell>
                        {sale.offerId ? (
                          <div>
                            <Link
                              to={`/offers/${sale.offerId._id}`}
                              className="font-medium text-sm hover:text-[#fdbf08] hover:underline transition-colors"
                            >
                              {sale.offerId.name}
                            </Link>
                            <div className="text-xs text-muted-foreground">{sale.offerId.slug}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Oferta removida</span>
                        )}
                      </TableCell>

                      <TableCell>{getSaleTypeIcon(sale)}</TableCell>

                      <TableCell className="text-center">
                        {sale.status === "failed" && sale.failureMessage ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="outline" className={statusConfig[sale.status]?.color || ""}>
                                  {statusConfig[sale.status]?.icon || ""} {statusConfig[sale.status]?.label || sale.status}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs bg-destructive text-destructive-foreground border-destructive">
                                <p className="font-semibold">Motivo: {sale.failureReason}</p>
                                <p className="text-xs mt-1">{sale.failureMessage}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <Badge variant="outline" className={statusConfig[sale.status]?.color || ""}>
                            {statusConfig[sale.status]?.icon || ""} {statusConfig[sale.status]?.label || sale.status}
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="font-semibold">
                          {sale.totalAmountInCents && sale.currency ? formatCurrency(sale.totalAmountInCents, sale.currency) : "N/A"}
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <CountryFlag countryCode={sale.country} />
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {sale.walletType === "apple_pay" && (
                            <Badge variant="default" className="text-xs bg-black text-white hover:bg-black/90">
                              Apple Pay
                            </Badge>
                          )}
                          {sale.walletType === "google_pay" && (
                            <Badge variant="default" className="text-xs bg-blue-600 text-white hover:bg-blue-700">
                              Google Pay
                            </Badge>
                          )}

                          {!sale.walletType && (
                            <Badge variant="secondary" className="text-xs">
                              {sale.paymentMethod === "credit_card" && "Cartão"}
                              {sale.paymentMethod === "paypal" && "PayPal"}
                              {sale.paymentMethod === "pix" && "PIX"}
                              {sale.paymentMethodType === "card" && "Cartão"}
                              {!["credit_card", "paypal", "pix", "card"].includes(sale.paymentMethod) &&
                                !["credit_card", "paypal", "pix", "card"].includes(sale.paymentMethodType || "") &&
                                (sale.paymentMethodType || sale.paymentMethod)}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Paginação */}
          {!isLoading && sales && sales.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Página {page} de {totalPages} ({total} {total === 1 ? "venda" : "vendas"})
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPage(page - 1)} disabled={page === 1}>
                  Anterior
                </Button>
                <Button variant="outline" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
