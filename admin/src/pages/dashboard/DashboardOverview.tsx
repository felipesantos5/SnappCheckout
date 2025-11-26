// admin/src/pages/dashboard/DashboardOverview.tsx
import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { ConnectStripeCard } from "@/components/ConnectStripeCard";
import { API_URL } from "@/config/BackendUrl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Users, ShoppingCart, TrendingUp, Zap, Filter } from "lucide-react";
import { RecentSalesTable } from "@/components/dashboard/RecentSalesTable";
import { Skeleton } from "@/components/ui/skeleton";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/helper/formatCurrency";
import { SalesAreaChart } from "@/components/dashboard/SalesAreaChart";
import { TopOffersChart } from "@/components/dashboard/TopOffersChart";
import { TopCountriesChart } from "@/components/dashboard/TopCountriesChart";

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

interface StripeBalance {
  available: { amount: number; currency: string }[];
  pending: { amount: number; currency: string }[];
}

interface Offer {
  _id: string;
  name: string;
}

const KpiCard = ({ title, value, icon: Icon, subtext, chartData, color, destaque = false }: any) => (
  <Card
    className={`overflow-hidden flex flex-col h-[180px] relative py-2 gap-3 ${
      destaque ? "bg-linear-to-br from-yellow-400 via-yellow-500 to-chart-1 border-chart-1 shadow-lg shadow-yellow-500/50" : ""
    }`}
  >
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 pt-4 px-4">
      <CardTitle className={`text-sm font-medium ${destaque ? "text-white" : "text-muted-foreground"}`}>{title}</CardTitle>
      <Icon className={`h-4 w-4 ${destaque ? "text-white" : "text-muted-foreground"}`} />
    </CardHeader>
    <CardContent className="px-4 pb-0">
      <span className={`text-2xl font-bold ${destaque ? "text-white text-3xl" : ""}`}>{value}</span>
      {subtext && <p className={`text-xs ${destaque ? "text-white/90" : "text-muted-foreground"}`}>{subtext}</p>}
    </CardContent>
    {/* Área do Gráfico colada na base */}
    <div className="absolute bottom-0 w-full h-20">
      {chartData && chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={destaque ? "#ffffff" : color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: destaque ? "#ffffff" : color }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className={`w-full h-full border-t ${destaque ? "border-white/30" : "border-gray-100"}`}></div>
      )}
    </div>
  </Card>
);

export function DashboardOverview() {
  const { token } = useAuth();

  const [metrics, setMetrics] = useState<DashboardData | null>(null);
  const [balance, setBalance] = useState<StripeBalance | null>(null);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [period, setPeriod] = useState("30"); // 1 = hoje, 7 = 7 dias, 30 = 30 dias, 90 = 3 meses
  const [selectedOfferId, setSelectedOfferId] = useState<string>("all");
  const [offers, setOffers] = useState<Offer[]>([]);

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

  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Construir query params para filtros
        const params = new URLSearchParams({
          days: period,
          ...(selectedOfferId !== "all" && { offerId: selectedOfferId }),
        });

        const [metricsRes, balanceRes] = await Promise.all([
          axios.get(`${API_URL}/metrics/overview?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_URL}/stripe/balance`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        setMetrics(metricsRes.data);
        setBalance(balanceRes.data);
      } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, period, selectedOfferId]);

  const formatStripe = (bal: any[]) => {
    if (!bal?.length) return "R$ 0,00";
    return (bal[0].amount / 100).toLocaleString("pt-BR", { style: "currency", currency: bal[0].currency });
  };

  const getPeriodLabel = () => {
    switch (period) {
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
      <div className="max-w-6xl mx-auto space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 flex-1 mx-auto p-4 md:p-0 animate-in fade-in duration-500">
      <ConnectStripeCard />

      <div className="flex items-center justify-between mb-2 gap-4 flex-wrap">
        <h1 className="text-3xl font-bold tracking-tight">Visão Geral</h1>

        {/* Filtros */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Filtros:</span>
          </div>

          {/* Filtro de Período */}
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Hoje</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 3 meses</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro de Oferta */}
          <Select value={selectedOfferId} onValueChange={setSelectedOfferId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todas ofertas" />
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
        </div>
      </div>

      {/* 8 Cards de KPIs */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total em Vendas */}
        <KpiCard
          title="Total em Vendas"
          value={formatCurrency(metrics?.kpis.totalRevenue || 0)}
          icon={DollarSign}
          subtext={getPeriodLabel()}
          chartData={metrics?.charts.revenue}
          color="#eab308"
          destaque={true}
        />

        {/* Card 2: Upsells */}
        <KpiCard
          title="Upsells"
          value={formatCurrency(metrics?.kpis.extraRevenue || 0)}
          icon={Zap}
          subtext={getPeriodLabel()}
          chartData={metrics?.charts.revenue}
          color="#eab308"
        />

        {/* Card 3: Total de Pedidos */}
        <KpiCard
          title="Total de Pedidos"
          value={metrics?.kpis.totalOrders || 0}
          icon={ShoppingCart}
          subtext={getPeriodLabel()}
          chartData={metrics?.charts.sales}
          color="#eab308"
        />

        {/* Card 4: Valor a Receber (Pendente) */}
        <KpiCard
          title="Valor a Receber"
          value={formatStripe(balance?.pending || [])}
          icon={TrendingUp}
          subtext="Pendente da plataforma"
          chartData={metrics?.charts.conversionRate}
          color="#eab308"
        />

        {/* Card 5: Ticket Médio */}
        <KpiCard
          title="Ticket Médio"
          value={formatCurrency(metrics?.kpis.averageTicket || 0)}
          icon={DollarSign}
          subtext={getPeriodLabel()}
          chartData={metrics?.charts.ticket}
          color="#eab308"
        />

        {/* Card 6: Total de Visitantes */}
        <KpiCard
          title="Total de Visitantes"
          value={metrics?.kpis.totalVisitors || 0}
          icon={Users}
          subtext={getPeriodLabel()}
          chartData={metrics?.charts.visitors}
          color="#eab308"
        />

        {/* Card 7: Conversão do Checkout */}
        <KpiCard
          title="Conversão do Checkout"
          value={`${metrics?.kpis.conversionRate.toFixed(1)}%`}
          icon={TrendingUp}
          subtext="Visitantes → Compras"
          chartData={metrics?.charts.conversionRate}
          color="#eab308"
        />

        {/* Card 8: Aprovação do Checkout */}
        <KpiCard
          title="Aprovação do Checkout"
          value={`${metrics?.kpis.checkoutApprovalRate.toFixed(1)}%`}
          icon={TrendingUp}
          subtext="Checkout → Compras"
          chartData={metrics?.charts.conversionRate}
          color="#eab308"
        />
      </div>

      {/* Seção Inferior: Gráficos Circulares + Histórico de Vendas */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        {/* Top Ofertas (Gráfico Circular) */}
        <div className="lg:col-span-1">
          <TopOffersChart data={metrics?.topOffers || []} />
        </div>

        {/* Top Países (Gráfico Circular) */}
        <div className="lg:col-span-1">
          <TopCountriesChart data={metrics?.topCountries || []} />
        </div>

        {/* Histórico de Vendas */}
        <div className="lg:col-span-1">
          <SalesAreaChart chartData={metrics?.charts.revenue || []} />
        </div>
      </div>
      <RecentSalesTable />
    </div>
  );
}
