import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { API_URL } from "@/config/BackendUrl";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { SaleTypeBadge } from "@/components/sales/SaleTypeBadge";

interface Sale {
  _id: string;
  offerId: {
    _id: string;
    name: string;
    slug: string;
    bannerImageUrl?: string;
    mainProduct?: {
      imageUrl?: string;
    };
    paymentType?: "one_time" | "subscription" | string;
    subscriptionInterval?: "day" | "week" | "month" | "year" | string;
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
  stripeSubscriptionId?: string;
  stripeInvoiceId?: string;
  subscriptionCycle?: number;
  subscriptionStatus?: "active" | "past_due" | "canceled" | "unpaid";
  isRenewalAttempt?: boolean;
  items?: Array<{
    name: string;
    priceInCents: number;
    isOrderBump: boolean;
  }>;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
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
  // Renovação de assinatura (ciclo 2+)
  if ((sale.stripeSubscriptionId || sale.offerId?.paymentType === "subscription") && sale.subscriptionCycle && sale.subscriptionCycle > 1) {
    return <SaleTypeBadge sale={sale} />;
  }

  // Venda inicial de assinatura (ciclo 1)
  if ((sale.stripeSubscriptionId || sale.offerId?.paymentType === "subscription") && (!sale.subscriptionCycle || sale.subscriptionCycle === 1)) {
    return <SaleTypeBadge sale={sale} />;
  }

  if (sale.isUpsell) {
    const upsellItems = sale.items?.filter((i) => !i.isOrderBump) || [];
    const badge = (
      <Badge variant="outline" className={`border-purple-200 text-purple-700 bg-purple-50 ${upsellItems.length > 0 ? "cursor-help" : ""}`}>
        <Zap className="w-3 h-3 mr-1" /> Upsell
      </Badge>
    );

    if (upsellItems.length === 0) return badge;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent className="p-3 w-56 bg-card border shadow-lg text-card-foreground">
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground pb-1 border-b">Upsell</div>
              {upsellItems.map((item, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span className="text-xs truncate">{item.name}</span>
                  <span className="text-xs font-medium shrink-0">{formatCurrency(item.priceInCents, sale.currency)}</span>
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const bumpItems = sale.items?.filter((i) => i.isOrderBump) || [];
  if (bumpItems.length > 0) {
    return (
      <div className="inline-flex items-center gap-1">
        <SaleTypeBadge sale={sale} />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="cursor-help border-blue-200 text-blue-700 bg-blue-50">
                <ArrowUpCircle className="w-3 h-3 mr-1" /> + Bump
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="p-3 w-56 bg-card border shadow-lg text-card-foreground">
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground pb-1 border-b">Order Bumps</div>
                {bumpItems.map((item, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <span className="text-xs truncate">{item.name}</span>
                    <span className="text-xs font-medium shrink-0">{formatCurrency(item.priceInCents, sale.currency)}</span>
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return <SaleTypeBadge sale={sale} />;
};

export function AllSalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [allSalesForMetrics, setAllSalesForMetrics] = useState<Sale[]>([]); // Todas as vendas do filtro para métricas
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [serverTotalRevenue, setServerTotalRevenue] = useState<number | null>(null);

  // Carrega estado do filtro do localStorage
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = localStorage.getItem("allSalesFilterOpen");
    return saved !== null ? JSON.parse(saved) : false;
  });

  // Filtros
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchName, setSearchName] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(["succeeded", "failed", "pending", "refunded"]);
  const [selectedOffers, setSelectedOffers] = useState<string[]>([]);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [selectedWallets, setSelectedWallets] = useState<string[]>([]);
  const [periodFilter, setPeriodFilter] = useState<"all" | "today" | "yesterday" | "week" | "month" | "year" | "custom">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [chargeType, setChargeType] = useState<"all" | "unique" | "initial" | "renewal" | "failed_renewal">("all");

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
    if (searchName) params.append("name", searchName);

    if (chargeType !== "all") params.append("chargeType", chargeType);

    // Calcular datas baseado no filtro de período
    if (periodFilter !== "all") {
      const now = new Date();
      let calculatedStartDate = startDate;
      let calculatedEndDate = endDate;

      if (periodFilter === "today") {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        calculatedStartDate = today.toISOString();
        calculatedEndDate = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString();
      } else if (periodFilter === "yesterday") {
        const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        calculatedStartDate = yesterday.toISOString();
        calculatedEndDate = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000).toISOString();
      } else if (periodFilter === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        calculatedStartDate = weekAgo.toISOString();
        calculatedEndDate = now.toISOString();
      } else if (periodFilter === "month") {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        calculatedStartDate = monthAgo.toISOString();
        calculatedEndDate = now.toISOString();
      } else if (periodFilter === "year") {
        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        calculatedStartDate = yearAgo.toISOString();
        calculatedEndDate = now.toISOString();
      }

      if (calculatedStartDate) params.append("startDate", calculatedStartDate);
      if (calculatedEndDate) params.append("endDate", calculatedEndDate);
    }

    return params;
  };

  // Buscar TODAS as vendas para cálculo de métricas de contagem/aprovação (sem paginação)
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
  const fetchSales = async (resetRevenue = false) => {
    setIsLoading(true);
    if (resetRevenue) setServerTotalRevenue(null);
    try {
      const params = buildFilterParams();
      params.set("page", page.toString());
      params.set("limit", limit.toString());

      const response = await axios.get(`${API_URL}/sales?${params.toString()}`);
      const salesData = response.data?.data || [];
      const metaData = response.data?.meta || { total: 0 };

      setSales(Array.isArray(salesData) ? salesData : []);
      setTotal(metaData.total || 0);
      if (metaData.totalRevenue !== undefined) {
        setServerTotalRevenue(metaData.totalRevenue);
      }
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
    fetchSales(true); // true = reset serverTotalRevenue para evitar valor desatualizado
  }, [selectedStatuses, selectedOffers, selectedPaymentMethods, selectedWallets, periodFilter, startDate, endDate, searchEmail, searchName, chargeType]);

  // Métricas calculadas (sempre em BRL) - baseadas em TODAS as vendas do filtro
  const metrics = useMemo(() => {
    const succeededSales = allSalesForMetrics.filter((s) => s.status === "succeeded");

    // Usa o totalRevenue do servidor (mesmas taxas do dashboard) se disponível,
    // caso contrário faz o cálculo local como fallback
    const totalRevenue =
      serverTotalRevenue !== null
        ? serverTotalRevenue
        : succeededSales.reduce((acc, sale) => {
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
  }, [allSalesForMetrics, serverTotalRevenue]);

  // Exportar para CSV
  const handleExport = () => {
    if (!sales || sales.length === 0) {
      toast.error("Nenhuma venda para exportar");
      return;
    }

    try {
      const csvContent = [
        ["Data", "Cliente", "Email", "Oferta", "Tipo", "Status", "Valor", "Moeda", "País", "Método", "UTM Source", "UTM Medium", "UTM Campaign"].join(
          ",",
        ),
        ...sales.map((sale) => {
          let tipo = "Venda";
          if (sale.stripeSubscriptionId || sale.offerId?.paymentType === "subscription") tipo = "Plano";
          else if (sale.isUpsell) tipo = "Upsell";
          else if (sale.items?.some((i) => i.isOrderBump)) tipo = "+ Bump";

          return [
            new Date(sale.createdAt).toLocaleDateString(),
            `"${sale.customerName || ""}"`,
            `"${sale.customerEmail || ""}"`,
            `"${sale.offerId?.name || "N/A"}"`,
            tipo,
            statusConfig[sale.status]?.label || sale.status,
            (sale.totalAmountInCents / 100).toFixed(2),
            (sale.currency || "BRL").toUpperCase(),
            sale.country || "N/A",
            sale.paymentMethod || "N/A",
            `"${sale.utm_source || ""}"`,
            `"${sale.utm_medium || ""}"`,
            `"${sale.utm_campaign || ""}"`,
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
    setSearchName("");
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
  const periodOptions: Array<{ value: typeof periodFilter; label: string }> = [
    { value: "today", label: "Dia" },
    { value: "week", label: "Semana" },
    { value: "month", label: "Mês" },
    { value: "year", label: "Ano" },
  ];

  const setQuickPeriod = (value: typeof periodFilter) => {
    setPeriodFilter(value);
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  return (
    <div className="flex min-h-screen bg-[#eceaec] text-[#20211f]">
      {/* Botão Toggle Sidebar - Fora do aside quando fechado */}
      {!isSidebarOpen && (
        <Button
          variant="outline"
          size="icon"
          className="fixed left-3 top-[68px] z-50 h-9 w-9 border-white/70 bg-white/90 shadow-sm backdrop-blur hover:bg-white"
          onClick={() => setIsSidebarOpen(true)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}

      {/* Overlay para mobile quando o filtro está aberto */}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}

      {/* Sidebar de Filtros */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full border-r border-white/60 bg-white/95 shadow-2xl backdrop-blur transition-all duration-300 ease-in-out ${
          isSidebarOpen ? "w-[280px] sm:w-72 px-4 opacity-100 translate-x-0" : "w-0 px-0 opacity-0 -translate-x-full"
        }`}
      >
        <div className="py-4 overflow-y-auto h-full lg:h-auto">
          {/* Botão Toggle Sidebar - Dentro do aside quando aberto */}
          {isSidebarOpen && (
            <Button
              variant="outline"
              size="icon"
              className="absolute left-3 top-3 z-10 h-8 w-8 bg-white shadow-sm"
              onClick={() => setIsSidebarOpen(false)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}

          <div
            className={`space-y-4 ${isSidebarOpen ? "opacity-100 mt-0" : "opacity-0 pointer-events-none h-0 overflow-hidden"} transition-opacity duration-200`}
          >
            <div className="flex items-center justify-between pl-14">
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
                <Button
                  variant={periodFilter === "yesterday" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setPeriodFilter("yesterday");
                    setStartDate("");
                    setEndDate("");
                    setPage(1);
                  }}
                  className={periodFilter === "yesterday" ? "bg-[#fdbf08] hover:bg-[#fdd049] text-black" : ""}
                >
                  Ontem
                </Button>
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
                  variant={periodFilter === "custom" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPeriodFilter("custom")}
                  className={`col-span-2 ${periodFilter === "custom" ? "bg-[#fdbf08] hover:bg-[#fdd049] text-black" : ""}`}
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

            {/* Buscar por Nome */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Nome do Cliente</Label>
              <Input
                placeholder="Buscar por nome..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    setPage(1);
                    fetchSales();
                  }
                }}
              />
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
                  { key: "credit_card", label: "Cartão de Crédito", type: "payment" },
                  { key: "apple_pay", label: "Apple Pay", type: "wallet" },
                  { key: "google_pay", label: "Google Pay", type: "wallet" },
                  { key: "paypal", label: "PayPal", type: "payment" },
                  { key: "pix", label: "PIX", type: "payment" },
                ].map(({ key, label, type }) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`payment-${key}`}
                      checked={type === "wallet" ? selectedWallets.includes(key) : selectedPaymentMethods.includes(key)}
                      onCheckedChange={(checked) => {
                        if (type === "wallet") {
                          if (checked) {
                            setSelectedWallets([...selectedWallets, key]);
                          } else {
                            setSelectedWallets(selectedWallets.filter((w) => w !== key));
                          }
                        } else {
                          if (checked) {
                            setSelectedPaymentMethods([...selectedPaymentMethods, key]);
                          } else {
                            setSelectedPaymentMethods(selectedPaymentMethods.filter((m) => m !== key));
                          }
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

            {/* Tipo de Cobrança */}
            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold">Tipo de Cobrança</h3>
              <div className="space-y-2">
                {(
                  [
                    { value: "all", label: "Todas" },
                    { value: "unique", label: "Venda única" },
                    { value: "initial", label: "Cobrança inicial (plano)" },
                    { value: "renewal", label: "Renovação (ciclo 2+)" },
                    { value: "failed_renewal", label: "Falha de renovação" },
                  ] as const
                ).map(({ value, label }) => (
                  <div key={value} className="flex items-center gap-2">
                    <input
                      type="radio"
                      id={`charge-type-${value}`}
                      name="chargeType"
                      value={value}
                      checked={chargeType === value}
                      onChange={() => {
                        setChargeType(value);
                        setPage(1);
                      }}
                      className="h-3.5 w-3.5 accent-[#fdbf08]"
                    />
                    <label htmlFor={`charge-type-${value}`} className="text-sm cursor-pointer">
                      {label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1500px] space-y-4 p-3 sm:space-y-5 sm:p-6 bg-white">
          {/* Cabeçalho */}
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Todas as Vendas</h1>
              <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
                {isLoading ? "Carregando..." : `${total} ${total === 1 ? "venda" : "vendas"} encontradas`}
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center xl:w-auto">
              <div className="flex h-10 items-center gap-1 rounded-full bg-white p-1 shadow-sm">
                {periodOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant="ghost"
                    size="sm"
                    onClick={() => setQuickPeriod(option.value)}
                    className={`h-8 rounded-full px-4 text-xs font-semibold transition-all ${
                      periodFilter === option.value
                        ? "bg-[#5d5d5d] text-white shadow-sm hover:bg-[#4f4f4f] hover:text-white"
                        : "text-neutral-500 hover:bg-[#fdbf08]/15 hover:text-neutral-900"
                    }`}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="h-10 rounded-full border-white bg-white px-4 shadow-sm hover:bg-white"
                onClick={() => setIsSidebarOpen(true)}
              >
                <ChevronRight className="h-4 w-4 mr-2" />
                Filtros
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-10 flex-1 rounded-full border-white bg-white shadow-sm hover:bg-white sm:flex-none"
                onClick={() => fetchSales()}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Atualizar</span>
                <span className="sm:hidden">Atualizar</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 flex-1 rounded-full border-white bg-white shadow-sm hover:bg-white sm:flex-none"
                onClick={handleExport}
                disabled={sales.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Exportar CSV</span>
                <span className="sm:hidden">Exportar</span>
              </Button>
            </div>
          </div>

          {/* Cards de Métricas */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="relative overflow-hidden border-0 bg-[#20211f] py-0 text-white shadow-sm">
              <div className="pointer-events-none absolute inset-0 opacity-30 [background:linear-gradient(135deg,transparent_0%,transparent_35%,#fdbf08_36%,transparent_37%,transparent_62%,#fdbf08_63%,transparent_64%)]" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
                <CardTitle className="text-[10px] sm:text-sm font-medium uppercase tracking-wider text-white/75">Total de Vendas</CardTitle>
                <ShoppingCart className="h-4 w-4 text-[#fdbf08] hidden sm:block" />
              </CardHeader>
              <CardContent className="relative p-3 sm:p-4 pt-0 sm:pt-0">
                <div className="text-lg sm:text-2xl font-bold">{metrics.totalSales}</div>
                <p className="text-[10px] sm:text-xs text-emerald-300">↗ vendas aprovadas</p>
              </CardContent>
            </Card>

            <Card className="border-0 bg-white py-0 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
                <CardTitle className="text-[10px] sm:text-sm font-medium text-neutral-500 uppercase tracking-wider">Valor Total</CardTitle>
                <DollarSign className="h-4 w-4 text-[#fdbf08] hidden sm:block" />
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0 pb-0">
                <div className="text-lg sm:text-2xl font-bold">{formatCurrency(metrics.totalRevenue)}</div>
                <p className="text-[10px] sm:text-xs text-emerald-600 whitespace-nowrap overflow-hidden text-ellipsis">↗ receita aprovada</p>
              </CardContent>
            </Card>

            <Card className="border-0 bg-white py-0 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
                <CardTitle className="text-[10px] sm:text-sm font-medium text-neutral-500 uppercase tracking-wider">Ticket Médio</CardTitle>
                <TrendingUp className="h-4 w-4 text-[#fdbf08] hidden sm:block" />
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
                <div className="text-lg sm:text-2xl font-bold">{formatCurrency(metrics.averageTicket)}</div>
                <p className="text-[10px] sm:text-xs text-neutral-500">por venda aprovada</p>
              </CardContent>
            </Card>

            <Card className="border-0 bg-white py-0 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
                <CardTitle className="text-[10px] sm:text-sm font-medium text-neutral-500 uppercase tracking-wider">Aprovação</CardTitle>
                <Percent className="h-4 w-4 text-[#fdbf08] hidden sm:block" />
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
                <div className="text-lg sm:text-2xl font-bold">{metrics.approvalRate.toFixed(1)}%</div>
                <p className="text-[10px] sm:text-xs text-neutral-500">vendas aprovadas</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabela */}
          <Card className="overflow-hidden border-0 bg-white py-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-neutral-200 px-4 py-3 sm:px-5">
              <div>
                <CardTitle className="text-base font-semibold">Vendas</CardTitle>
                <CardDescription className="text-xs">Histórico completo de compras, planos e tentativas.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-[#eceaec]" onClick={() => fetchSales()} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-[#eceaec]"
                  onClick={handleExport}
                  disabled={sales.length === 0}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <div className="overflow-x-auto overflow-y-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-neutral-200 bg-white hover:bg-white">
                    <TableHead className="w-[120px]">Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Oferta</TableHead>
                    <TableHead className="w-[120px]">Tipo</TableHead>
                    <TableHead className="w-[150px]">UTM</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-[80px] text-center">País</TableHead>
                    <TableHead className="w-[120px]">Método</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-48 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : !sales || sales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-48 text-center text-muted-foreground">
                        Nenhuma venda encontrada com os filtros aplicados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sales.map((sale) => (
                      <TableRow key={sale._id} className="border-neutral-100 hover:bg-[#f8f7f7]">
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

                        <TableCell>
                          {sale.utm_source || sale.utm_medium || sale.utm_campaign ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="cursor-help space-y-1">
                                    {sale.utm_source && (
                                      <div className="text-[10px] leading-tight flex items-center gap-1">
                                        <span className="text-muted-foreground font-medium uppercase text-[8px]">Src:</span>
                                        <span className="truncate max-w-[100px]">{sale.utm_source}</span>
                                      </div>
                                    )}
                                    {sale.utm_medium && (
                                      <div className="text-[10px] leading-tight flex items-center gap-1">
                                        <span className="text-muted-foreground font-medium uppercase text-[8px]">Med:</span>
                                        <span className="truncate max-w-[100px]">{sale.utm_medium}</span>
                                      </div>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="p-3 w-64 bg-card border shadow-lg text-card-foreground">
                                  <div className="space-y-2">
                                    <div className="text-xs font-bold border-bottom pb-1 mb-1 uppercase tracking-wider text-muted-foreground">
                                      Parâmetros UTM
                                    </div>
                                    {sale.utm_source && (
                                      <div className="flex justify-between gap-2 overflow-hidden">
                                        <span className="text-muted-foreground shrink-0 text-[10px]">Source:</span>
                                        <span className="font-medium truncate text-[10px]">{sale.utm_source}</span>
                                      </div>
                                    )}
                                    {sale.utm_medium && (
                                      <div className="flex justify-between gap-2 overflow-hidden">
                                        <span className="text-muted-foreground shrink-0 text-[10px]">Medium:</span>
                                        <span className="font-medium truncate text-[10px]">{sale.utm_medium}</span>
                                      </div>
                                    )}
                                    {sale.utm_campaign && (
                                      <div className="flex justify-between gap-2 overflow-hidden">
                                        <span className="text-muted-foreground shrink-0 text-[10px]">Campaign:</span>
                                        <span className="font-medium truncate text-[10px]">{sale.utm_campaign}</span>
                                      </div>
                                    )}
                                    {sale.utm_content && (
                                      <div className="flex justify-between gap-2 overflow-hidden">
                                        <span className="text-muted-foreground shrink-0 text-[10px]">Content:</span>
                                        <span className="font-medium truncate text-[10px]">{sale.utm_content}</span>
                                      </div>
                                    )}
                                    {sale.utm_term && (
                                      <div className="flex justify-between gap-2 overflow-hidden">
                                        <span className="text-muted-foreground shrink-0 text-[10px]">Term:</span>
                                        <span className="font-medium truncate text-[10px]">{sale.utm_term}</span>
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-muted-foreground text-[10px] italic">Sem UTM</span>
                          )}
                        </TableCell>

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
            </div>
          </Card>

          {/* Paginação */}
          {!isLoading && sales && sales.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
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
