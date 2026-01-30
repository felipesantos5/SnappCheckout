// admin/src/pages/dashboard/DashboardOverview.tsx
import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
// import { ConnectStripeCard } from "@/components/ConnectStripeCard";
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

// --- Interfaces ---
interface DashboardData {
  kpis: {
    totalRevenue: number;
    totalSales: number;
    totalVisitors: number;
    averageTicket: number;
    extraRevenue: number;
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
  const { token } = useAuth();

  const [metrics, setMetrics] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

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
      // Tempo Total - desde o início da operação (2020)
      startDate = new Date("2020-01-01").toISOString();
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
      } else if (days === "7") {
        // Últimos 7 dias: inclui hoje
        startDate = startOfDay(subDays(now, 6)).toISOString();
      } else if (days === "90") {
        // Últimos 3 meses
        startDate = startOfDay(subDays(now, 89)).toISOString();
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



  const getPeriodLabel = () => {
    switch (period) {
      case "all":
        return "Tempo Total";
      case "1":
        return "Hoje";
      case "7":
        return "Últimos 7 dias";
      case "30":
        return "Últimos 30 dias";
      case "90":
        return "Últimos 3 meses";
      default:
        return "Últimos 30 dias";
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 p-4 sm:p-6">
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-[140px] sm:h-32" />
          <Skeleton className="h-[140px] sm:h-32" />
          <Skeleton className="h-[140px] sm:h-32" />
          <Skeleton className="h-[140px] sm:h-32" />
        </div>
        <Skeleton className="h-48 sm:h-64" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-8 flex-1 mx-auto p-0 animate-in fade-in duration-500">
      {/* <ConnectStripeCard /> */}

      {/* Header Responsivo */}
      <div className="flex flex-col gap-3 lg:gap-0">
        {/* Desktop (lg+): Título à esquerda + Filtros à direita | Mobile/Tablet: Empilhado */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4">
          {/* Título */}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight whitespace-nowrap">Visão Geral</h1>

          {/* Container direito: Filtros */}
          <div className="flex flex-wrap items-center gap-2 lg:gap-3">

            <Button
              variant="outline"
              size="icon"
              onClick={fetchData}
              disabled={loading}
              className="h-[36px] w-[36px]"
              title="Atualizar métricas"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {/* Filtro de Período */}
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[155px] h-9">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tempo Total</SelectItem>
                <SelectItem value="1">Hoje</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 3 meses</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>

            {/* DateRangePicker (só aparece quando period === "custom") */}
            {period === "custom" && (
              <div className="w-[220px]">
                <DateRangePicker value={customDateRange} onChange={setCustomDateRange} />
              </div>
            )}

            {/* Filtro de Oferta */}
            <Select value={selectedOfferId} onValueChange={setSelectedOfferId}>
              <SelectTrigger className="w-[145px] h-9">
                <SelectValue placeholder="Oferta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {offers.map((offer) => (
                  <SelectItem key={offer._id} value={offer._id}>
                    {offer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      {/* Cards de KPIs */}
      <div className="w-full grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total em Vendas */}
        <KpiCard
          title="Total em Vendas"
          value={formatCurrency(metrics?.kpis.totalRevenue || 0)}
          icon={DollarSign}
          subtext={getPeriodLabel()}
          chartData={metrics?.charts.revenue}
          color="#eab308"
          destaque={true}
          changePercentage={metrics?.kpis.totalRevenueChange}
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
        />

        {/* Card 3: Ticket Médio */}
        <KpiCard
          title="Ticket Médio"
          value={formatCurrency(metrics?.kpis.averageTicket || 0)}
          icon={DollarSign}
          subtext={`Upsell ${formatCurrency(metrics?.kpis.extraRevenue || 0)}`}
          chartData={metrics?.charts.ticket}
          color="#eab308"
          changePercentage={metrics?.kpis.averageTicketChange}
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
        />
      </div>

      {/* Seção Inferior: Gráficos Circulares + Histórico de Vendas */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
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
    </div>
  );
}
