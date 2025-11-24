// admin/src/pages/dashboard/DashboardOverview.tsx
import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { ConnectStripeCard } from "@/components/ConnectStripeCard";
import { API_URL } from "@/config/BackendUrl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, ShoppingCart, TrendingUp, Zap } from "lucide-react";
import { RecentSalesTable } from "@/components/dashboard/RecentSalesTable";
import { Skeleton } from "@/components/ui/skeleton";
import { Line, LineChart, ResponsiveContainer } from "recharts"; // Usando LineChart agora
import { formatCurrency } from "@/helper/formatCurrency";
import { SalesAreaChart } from "@/components/dashboard/SalesAreaChart";
import { OffersRevenueChart } from "@/components/dashboard/OffersRevenueChart";

// --- Interfaces ---
interface DashboardData {
  kpis: {
    totalRevenue: number;
    totalSales: number;
    totalVisitors: number;
    averageTicket: number;
    extraRevenue: number;
    conversionRate: number;
  };
  charts: {
    revenue: { date: string; value: number }[];
    sales: { date: string; value: number }[]; // Novo
    ticket: { date: string; value: number }[]; // Novo
    visitors: { date: string; value: number }[];
    conversionRate: { date: string; value: number }[]; // Novo gráfico de conversão
  };
}

interface StripeBalance {
  available: { amount: number; currency: string }[];
  pending: { amount: number; currency: string }[];
}

const KpiCard = ({ title, value, icon: Icon, subtext, chartData, color }: any) => (
  <Card className="overflow-hidden flex flex-col h-[200px] relative py-2 gap-3">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 pt-4 px-4">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent className="px-4 pb-0">
      <div className="text-2xl font-bold">{value}</div>
      {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
    </CardContent>
    {/* Área do Gráfico colada na base */}
    <div className="absolute bottom-0 w-full h-20">
      {chartData && chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="w-full h-full border-t border-gray-100"></div>
      )}
    </div>
  </Card>
);

export function DashboardOverview() {
  const { token } = useAuth();

  const [metrics, setMetrics] = useState<DashboardData | null>(null);
  const [balance, setBalance] = useState<StripeBalance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [metricsRes, balanceRes] = await Promise.all([
          axios.get(`${API_URL}/metrics/overview`, { headers: { Authorization: `Bearer ${token}` } }),
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
  }, [token]);

  const formatStripe = (bal: any[]) => {
    if (!bal?.length) return "R$ 0,00";
    return (bal[0].amount / 100).toLocaleString("pt-BR", { style: "currency", currency: bal[0].currency });
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

      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-bold tracking-tight">Visão Geral</h1>
      </div>

      <div className="grid gap-4 flex-wrap   lg:grid-cols-5">
        <KpiCard
          title="Faturamento Aprovado"
          value={formatCurrency(metrics?.kpis.totalRevenue || 0)}
          icon={DollarSign}
          subtext="Últimos 30 dias"
          chartData={metrics?.charts.revenue}
          color="#eab308" // Verde
        />

        {/* 2. Lucro Extra (DESTAQUE) */}
        <KpiCard
          title="Lucro Extra (Upsell/Bump)"
          value={formatCurrency(metrics?.kpis.extraRevenue || 0)}
          icon={Zap}
          subtext="Receita gerada pelo checkout"
          chartData={metrics?.charts.revenue} // Pode usar o mesmo ou um específico se tiver
          color="#eab308" // Amarelo Ouro
          highlight={true} // Card Destacado
        />

        {/* 3. Vendas */}
        <KpiCard
          title="Vendas Realizadas"
          value={metrics?.kpis.totalSales || 0}
          icon={ShoppingCart}
          subtext="Transações aprovadas"
          chartData={metrics?.charts.sales}
          color="#eab308" // Azul
        />

        {/* 4. Taxa de Conversão */}
        <KpiCard
          title="Taxa de Conversão"
          value={`${metrics?.kpis.conversionRate.toFixed(1)}%`}
          icon={TrendingUp}
          subtext="Visitantes x Compradores"
          chartData={metrics?.charts.conversionRate}
          color="#eab308"
        />

        {/* 5. Ticket Médio */}
        <KpiCard
          title="Ticket Médio"
          value={formatCurrency(metrics?.kpis.averageTicket || 0)}
          icon={Users}
          subtext="Por cliente"
          chartData={metrics?.charts.ticket}
          color="#eab308" // Laranja
        />
      </div>

      <div className="grid gap-4">
        <Card className="bg-white border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">A Receber (Pendente)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{formatStripe(balance?.pending || [])}</div>
          </CardContent>
        </Card>
      </div>
      <div className="flex gap-10">
        <SalesAreaChart />
        <OffersRevenueChart />
      </div>

      <div className="mt-4">
        <h2 className="text-lg font-semibold mb-4">Transações Recentes</h2>
        <RecentSalesTable />
      </div>
    </div>
  );
}
