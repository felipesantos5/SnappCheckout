// admin/src/pages/dashboard/DashboardOverview.tsx
import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { ConnectStripeCard } from "@/components/ConnectStripeCard";
import { API_URL } from "@/config/BackendUrl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, ShoppingCart, TrendingUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecentSalesTable } from "@/components/dashboard/RecentSalesTable";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/helper/formatCurrency";
import { SalesAreaChart } from "@/components/dashboard/SalesAreaChart";
import { TopOffersChart } from "@/components/dashboard/TopOffersChart";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { SalesWorldMap } from "@/components/dashboard/SalesWorldMap";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { MilestoneModal } from "@/components/dashboard/MilestoneModal";

// --- Interfaces ---
interface DashboardData {
  kpis: {
    totalRevenue: number;
    totalSales: number;
    totalVisitors: number;
    averageTicket: number;
    extraRevenue: number;
    averageUpsellTicket: number;
    isolatedProductRevenue: number;
    orderBumpRevenue: number;
    upsellRevenue: number;
    conversionRate: number;
    totalOrders: number;
    checkoutsInitiated: number;
    checkoutApprovalRate: number;
    paymentApprovalRate: number;
    totalPaymentAttempts: number;
    totalFailedPayments: number;
    revenueByGateway?: {
      stripe: number;
      paypal: number;
      pagarme: number;
    };
    totalRevenueChange?: number;
    extraRevenueChange?: number;
    averageUpsellTicketChange?: number;
    totalOrdersChange?: number;
    averageTicketChange?: number;
    totalVisitorsChange?: number;
    conversionRateChange?: number;
    checkoutApprovalRateChange?: number;
    paymentApprovalRateChange?: number;
  };
  charts: {
    revenue: { date: string; value: number }[];
    sales: { date: string; value: number }[];
    ticket: { date: string; value: number }[];
    visitors: { date: string; value: number }[];
    conversionRate: { date: string; value: number }[];
  };
  topOffers: { name: string; value: number; count: number }[];
  topProducts: { name: string; value: number; count: number }[];
  topCountries: { name: string; value: number; count: number }[];
}



interface Offer {
  _id: string;
  name: string;
}

export function DashboardOverview() {
  const { token, user, acknowledgeMilestone } = useAuth();

  const [metrics, setMetrics] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const MILESTONES = [
    { key: "100k", threshold: 100_000, next: 500_000 },
    { key: "500k", threshold: 500_000, next: null },
  ];

  const [activeMilestone, setActiveMilestone] = useState<typeof MILESTONES[number] | null>(null);

  // --- FILTROS COM PERSISTÊNCIA (LOCALSTORAGE) ---
  // Inicializa lendo do LocalStorage ou usa o padrão
  const [period, setPeriod] = useState(() => {
    return localStorage.getItem("dashboard_period") || "30";
  });

  const [selectedOfferId, setSelectedOfferId] = useState(() => {
    return localStorage.getItem("dashboard_offer_id") || "all";
  });

  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);

  const [offers, setOffers] = useState<Offer[]>([]);

  // Salva no LocalStorage sempre que o valor mudar
  useEffect(() => {
    localStorage.setItem("dashboard_period", period);
  }, [period]);

  useEffect(() => {
    localStorage.setItem("dashboard_offer_id", selectedOfferId);
  }, [selectedOfferId]);
  // -----------------------------------------------

  // Buscar lista de ofertas para o filtro
  useEffect(() => {
    if (!token) return;

    const fetchOffers = async () => {
      try {
        const response = await axios.get(`${API_URL}/offers`, { headers: { Authorization: `Bearer ${token}` } });
        setOffers(response.data);
      } catch (error) {
        console.error("Erro ao carregar ofertas:", error);
      }
    };

    fetchOffers();
  }, [token]);

  // --- LÓGICA DE DATAS DO NAVEGADOR ---
  // Calcula as datas exatas baseadas no fuso horário do usuário
  const getDateRange = (days: string) => {
    const now = new Date();
    let startDate: string;
    let endDate: string;

    if (days === "all") {
      // Tempo Total - desde a criação da conta do usuário
      startDate = user?.createdAt ? startOfDay(new Date(user.createdAt)).toISOString() : new Date("2020-01-01").toISOString();
      endDate = endOfDay(now).toISOString();
    } else if (days === "custom") {
      // Período personalizado - usa o customDateRange
      if (!customDateRange?.from || !customDateRange?.to) {
        // Se não tiver range completo, usa os últimos 30 dias como fallback
        const start = new Date();
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        return {
          startDate: start.toISOString(),
          endDate: now.toISOString(),
        };
      }
      startDate = startOfDay(customDateRange.from).toISOString();
      endDate = endOfDay(customDateRange.to).toISOString();
    } else {
      // Filtros pré-definidos
      endDate = endOfDay(now).toISOString();

      if (days === "1") {
        // Hoje: do início até o fim do dia atual
        startDate = startOfDay(now).toISOString();
      } else if (days === "yesterday") {
        // Ontem: do início ao fim do dia anterior
        const yesterday = subDays(now, 1);
        startDate = startOfDay(yesterday).toISOString();
        endDate = endOfDay(yesterday).toISOString();
      } else if (days === "7") {
        // Últimos 7 dias: inclui hoje
        startDate = startOfDay(subDays(now, 6)).toISOString();
      } else if (days === "90") {
        // Últimos 3 meses
        startDate = startOfDay(subDays(now, 89)).toISOString();
      } else if (days === "365") {
        // Últimos 12 meses
        startDate = startOfDay(subDays(now, 364)).toISOString();
      } else {
        // Últimos 30 dias (padrão): inclui hoje
        startDate = startOfDay(subDays(now, 29)).toISOString();
      }
    }

    return {
      startDate,
      endDate,
    };
  };

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(period);

      // Envia as datas exatas para o backend
      const params = new URLSearchParams({
        startDate,
        endDate,
        ...(selectedOfferId !== "all" && { offerId: selectedOfferId }),
      });

      const metricsRes = await axios.get(`${API_URL}/metrics/overview?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      setMetrics(metricsRes.data);
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, period, selectedOfferId, customDateRange]);

  // Detecta milestone de faturamento total usando period "all"
  useEffect(() => {
    if (!metrics || !user || loading) return;
    // Busca receita total acumulada (period "all")
    // Só verifica quando o período é "all" para ter o faturamento completo
    if (period !== "all") return;
    const totalRevenue = metrics.kpis.totalRevenue;
    const acknowledged = user.acknowledgedMilestones ?? [];
    const hit = MILESTONES.find((m) => totalRevenue >= m.threshold && !acknowledged.includes(m.key));
    setActiveMilestone(hit ?? null);
  }, [metrics, user, loading, period]);

  const handleAcknowledgeMilestone = async () => {
    if (!activeMilestone) return;
    await acknowledgeMilestone(activeMilestone.key);
    setActiveMilestone(null);
  };

  const getPeriodLabel = () => {
    switch (period) {
      case "all":
        return "Tempo Total";
      case "1":
        return "Hoje";
      case "yesterday":
        return "Ontem";
      case "7":
        return "Últimos 7 dias";
      case "30":
        return "Últimos 30 dias";
      case "90":
        return "Últimos 3 meses";
      case "365":
        return "Últimos 12 meses";
      default:
        return "Últimos 30 dias";
    }
  };

  const periodOptions = [
    { value: "1", label: "Dia" },
    { value: "7", label: "Semana" },
    { value: "30", label: "Mês" },
    { value: "365", label: "Ano" },
  ];

  const getRevenueBreakdown = () => {
    if (!metrics) return null;

    const hasIsolated = metrics.kpis.isolatedProductRevenue > 0;
    const hasOrderBump = metrics.kpis.orderBumpRevenue > 0;
    const hasUpsell = metrics.kpis.upsellRevenue > 0;

    if (!hasOrderBump && !hasUpsell) return null;

    const rows: { label: string; value: string }[] = [];
    if (hasIsolated) rows.push({ label: "Venda", value: formatCurrency(metrics.kpis.isolatedProductRevenue) });
    if (hasOrderBump) rows.push({ label: "Bump", value: formatCurrency(metrics.kpis.orderBumpRevenue) });
    if (hasUpsell) rows.push({ label: "Upsell", value: formatCurrency(metrics.kpis.upsellRevenue) });

    return (
      <div className="flex gap-3 mt-0.5">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col leading-tight">
            <span className="text-white/90 text-[10px]">{row.label}</span>
            <span className="text-white font-semibold text-[10px]">{row.value}</span>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen space-y-4 bg-[#eceaec] p-4 sm:space-y-6 sm:p-6">
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-[116px] rounded-3xl sm:h-32" />
          <Skeleton className="h-[116px] rounded-3xl sm:h-32" />
          <Skeleton className="h-[116px] rounded-3xl sm:h-32" />
          <Skeleton className="h-[116px] rounded-3xl sm:h-32" />
        </div>
        <Skeleton className="h-48 rounded-3xl sm:h-64" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex-1 bg-[#eceaec] p-3 text-[#20211f] animate-in fade-in duration-500 sm:p-6">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4 sm:gap-5">
        <ConnectStripeCard />

        {/* Header Responsivo */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Visão Geral</h1>
            <p className="mt-1 text-xs text-neutral-500 sm:text-sm">{getPeriodLabel()} de performance do checkout</p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center xl:w-auto xl:justify-end">
            <div className="flex h-10 items-center gap-1 rounded-full bg-white p-1 shadow-sm">
              {periodOptions.map((option) => (
                <Button
                  key={option.value}
                  variant="ghost"
                  size="sm"
                  onClick={() => setPeriod(option.value)}
                  className={`h-8 rounded-full px-4 text-xs font-semibold transition-all ${period === option.value
                    ? "bg-[#5d5d5d] text-white shadow-sm hover:bg-[#4f4f4f] hover:text-white"
                    : "text-neutral-500 hover:bg-[#fdbf08]/15 hover:text-neutral-900"
                    }`}
                >
                  {option.label}
                </Button>
              ))}
            </div>

            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-10 w-full rounded-full border-white bg-white px-4 text-xs font-semibold shadow-sm sm:w-[150px]">
                <SelectValue placeholder="Mais períodos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yesterday">Ontem</SelectItem>
                <SelectItem value="90">Últimos 3 meses</SelectItem>
                <SelectItem value="all">Tempo Total</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>

            {period === "custom" && (
              <div className="w-full sm:w-[240px]">
                <DateRangePicker value={customDateRange} onChange={setCustomDateRange} />
              </div>
            )}

            <Select value={selectedOfferId} onValueChange={setSelectedOfferId}>
              <SelectTrigger className="h-10 w-full rounded-full border-white bg-white px-4 text-xs font-semibold shadow-sm sm:w-[180px]">
                <SelectValue placeholder="Oferta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ofertas</SelectItem>
                {offers.map((offer) => (
                  <SelectItem key={offer._id} value={offer._id}>
                    {offer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={fetchData}
              disabled={loading}
              className="h-10 w-10 rounded-full border-white bg-white shadow-sm hover:bg-white"
              title="Atualizar métricas"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      {/* Cards de KPIs */}
      <div className="w-full grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Total em Vendas */}
        <KpiCard
          title="Total em Vendas"
          value={formatCurrency(metrics?.kpis.totalRevenue || 0)}
          icon={DollarSign}
          subtext={getRevenueBreakdown() || getPeriodLabel()}
          chartData={metrics?.charts.revenue}
          color="#eab308"
          destaque={true}
          changePercentage={metrics?.kpis.totalRevenueChange}
          surface="overview"
        />

        {/* Card 2: Total de Pedidos */}
        <KpiCard
          title="Total de Pedidos"
          value={metrics?.kpis.totalOrders || 0}
          icon={ShoppingCart}
          subtext={`Visitantes ${metrics?.kpis.totalVisitors || 0}`}
          chartData={metrics?.charts.sales}
          color="#eab308"
          changePercentage={metrics?.kpis.totalOrdersChange}
          surface="overview"
        />

        {/* Card 3: Ticket Médio */}
        <KpiCard
          title="Ticket Médio"
          value={formatCurrency(metrics?.kpis.averageTicket || 0)}
          icon={DollarSign}
          subtext={`Upsell ${formatCurrency(metrics?.kpis.averageUpsellTicket || 0)}`}
          chartData={metrics?.charts.ticket}
          color="#eab308"
          changePercentage={metrics?.kpis.averageTicketChange}
          surface="overview"
        />

        {/* Card 4: Conversão do Checkout */}
        <KpiCard
          title="Conversão"
          value={`${metrics?.kpis.conversionRate.toFixed(1)}%`}
          icon={TrendingUp}
          subtext={`Aprovação ${metrics?.kpis.paymentApprovalRate?.toFixed(1) || 0}%`}
          chartData={metrics?.charts.conversionRate}
          color="#eab308"
          changePercentage={metrics?.kpis.conversionRateChange}
          surface="overview"
        />
      </div>

      {/* Seção Inferior: Gráficos Circulares + Histórico de Vendas */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-3">
        {/* Histórico de Vendas */}
        <div className="col-span-1">
          <SalesAreaChart chartData={metrics?.charts.revenue || []} />
        </div>

        {/* Top Ofertas (Gráfico Circular) */}
        <div className="col-span-1">
          <TopOffersChart data={metrics?.topOffers || []} />
        </div>

        {/* Mapa Mundial */}
        <div className="col-span-1">
          <SalesWorldMap data={metrics?.topCountries || []} />
        </div>
      </div>
      <RecentSalesTable period={period} customDateRange={customDateRange} />

      {activeMilestone && (
        <MilestoneModal
          milestone={activeMilestone.threshold}
          nextMilestone={activeMilestone.next}
          onAcknowledge={handleAcknowledgeMilestone}
        />
      )}
      </div>
    </div>
  );
}
