// src/pages/dashboard/ABTestAnalyticsPage.tsx
import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { API_URL } from "@/config/BackendUrl";
import { ArrowLeft, FlaskConical, Loader2, Eye, ShoppingCart, DollarSign, TrendingUp, Trophy, Calendar, Percent, Target, ExternalLink } from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KpiCard } from "@/components/dashboard/KpiCard";

import { subDays, startOfDay, endOfDay } from "date-fns";

interface OfferMetrics {
  offerId: string;
  offerName: string;
  percentage: number;
  views: number;
  initiatedCheckout: number; // Novo campo
  sales: number;
  revenue: number;
  conversionRate: number;
  averageTicket: number;
}

interface DailyMetric {
  date: string;
  offerId: string;
  offerName: string;
  views: number;
  initiatedCheckout: number; // Novo campo
  sales: number;
  revenue: number;
  conversionRate: number;
}

interface ABTestMetrics {
  abTestId: string;
  abTestName: string;
  abTestSlug: string;
  dateRange: { start: string; end: string };
  offers: OfferMetrics[];
  totals: {
    views: number;
    initiatedCheckout: number; // Novo campo
    sales: number;
    revenue: number;
    conversionRate: number;
    averageTicket: number;
  };
  dailyData: { [offerId: string]: DailyMetric[] };
  bestPerformers: {
    byConversion: string;
    byRevenue: string;
  };
}

// Cores das variantes usando as variáveis CSS do Tailwind
const OFFER_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const formatCurrency = (valueInCents: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valueInCents / 100);
};

const formatPercentage = (value: number) => {
  return `${value.toFixed(2)}%`;
};

export function ABTestAnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<ABTestMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filtro com persistência no localStorage (específico para analytics de A/B test)
  const [dateRange, setDateRange] = useState(() => {
    return localStorage.getItem("abtest_analytics_period") || "30";
  });

  // Salva no localStorage quando o valor mudar
  useEffect(() => {
    localStorage.setItem("abtest_analytics_period", dateRange);
  }, [dateRange]);

  useEffect(() => {
    const fetchMetrics = async () => {
      setIsLoading(true);
      try {
        const now = new Date();
        let startDate: Date;
        let endDate: Date = now;

        if (dateRange === "today") {
          startDate = startOfDay(now);
          endDate = endOfDay(now);
        } else if (dateRange === "yesterday") {
          const yesterday = subDays(now, 1);
          startDate = startOfDay(yesterday);
          endDate = endOfDay(yesterday);
        } else if (dateRange === "all") {
          startDate = new Date("2020-01-01");
          endDate = endOfDay(now);
        } else {
          startDate = startOfDay(subDays(now, parseInt(dateRange) - 1));
          endDate = endOfDay(now);
        }

        const response = await axios.get(`${API_URL}/metrics/abtest/${id}`, {
          params: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
        });
        setMetrics(response.data);
      } catch (error) {
        toast.error("Falha ao carregar métricas.", {
          description: (error as Error).message,
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchMetrics();
  }, [id, dateRange]);

  // Prepare data for line chart (conversion rate over time)
  const conversionLineData = useMemo(() => {
    if (!metrics) return [];

    const dates = new Set<string>();
    Object.values(metrics.dailyData).forEach((data) => {
      data.forEach((d) => dates.add(d.date));
    });

    return Array.from(dates)
      .sort()
      .map((date) => {
        const point: any = { date: new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) };
        metrics.offers.forEach((offer) => {
          const dayData = metrics.dailyData[offer.offerId]?.find((d) => d.date === date);
          point[offer.offerName] = dayData?.conversionRate || 0;
        });
        return point;
      });
  }, [metrics]);

  // Data for pie chart (sales distribution)
  const pieChartData = useMemo(() => {
    if (!metrics) return [];
    return metrics.offers.map((offer, index) => ({
      name: offer.offerName.length > 12 ? offer.offerName.substring(0, 12) + "..." : offer.offerName,
      fullName: offer.offerName,
      value: offer.sales,
      color: OFFER_COLORS[index % OFFER_COLORS.length],
    }));
  }, [metrics]);

  // Data for bar chart (revenue comparison)
  const barChartData = useMemo(() => {
    if (!metrics) return [];
    return metrics.offers.map((offer, index) => ({
      name: offer.offerName.length > 12 ? offer.offerName.substring(0, 12) + "..." : offer.offerName,
      fullName: offer.offerName,
      revenue: offer.revenue / 100,
      averageTicket: offer.averageTicket / 100,
      color: OFFER_COLORS[index % OFFER_COLORS.length],
    }));
  }, [metrics]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Não foi possível carregar as métricas.</p>
        <Button variant="outline" onClick={() => navigate("/abtests")} className="mt-4">
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/abtests")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <FlaskConical className="h-6 w-6 text-yellow-500" />
              {metrics.abTestName}
            </h1>
            <p className="text-sm text-muted-foreground">Análise comparativa de performance</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="yesterday">Ontem</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="14">Últimos 14 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="all">Tempo Total</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => window.open(`https://pay.snappcheckout.com/c/${metrics.abTestSlug}`, "_blank")} className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Ver Página
          </Button>
        </div>
      </div>

      {/* KPI Cards - Totais */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-5">
        <KpiCard
          title="Visualizações"
          value={metrics.totals.views.toLocaleString()}
          icon={Eye}
          color="#fbbf24"
        />
        <KpiCard
          title="Checkouts Iniciados"
          value={metrics.totals.initiatedCheckout.toLocaleString()}
          icon={ShoppingCart}
          color="#3b82f6"
        />
        <KpiCard
          title="Vendas Totais"
          value={metrics.totals.sales.toLocaleString()}
          icon={Trophy}
          color="#f59e0b"
        />
        <KpiCard
          title="Faturamento"
          value={formatCurrency(metrics.totals.revenue)}
          icon={DollarSign}
          destaque={true}
        />
        <KpiCard
          title="Conversão"
          value={formatPercentage(metrics.totals.conversionRate)}
          icon={TrendingUp}
          subtext={`Ticket Médio: ${formatCurrency(metrics.totals.averageTicket)}`}
          color="#d97706"
        />
      </div>

      {/* Comparação de Variantes */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Cards das Variantes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-yellow-500" />
              Comparação de Variantes
            </CardTitle>
            <CardDescription>Performance individual de cada oferta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.offers.map((offer, index) => {
              const isBestConversion = offer.offerId === metrics.bestPerformers.byConversion;
              const isBestRevenue = offer.offerId === metrics.bestPerformers.byRevenue;
              const color = OFFER_COLORS[index % OFFER_COLORS.length];
              const hasSales = offer.sales >= 1;

              return (
                <div
                  key={offer.offerId}
                  className={`p-4 rounded-lg border bg-card transition-all hover:shadow-md ${(isBestConversion || isBestRevenue) && hasSales ? "ring-2 ring-yellow-400" : ""
                    }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-semibold text-sm">{offer.offerName}</span>
                      <Badge variant="outline" className="text-xs">
                        <Percent className="h-3 w-3 mr-1" />
                        {offer.percentage}%
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      {isBestConversion && offer.sales >= 1 && (
                        <Badge className="bg-yellow-500 text-yellow-950 text-xs">
                          <Trophy className="h-3 w-3 mr-1" />
                          Melhor CVR
                        </Badge>
                      )}
                      {isBestRevenue && !isBestConversion && offer.sales >= 1 && (
                        <Badge className="bg-green-500 text-white text-xs">
                          <DollarSign className="h-3 w-3 mr-1" />
                          Maior $
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-2 text-center">
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground uppercase">Views</p>
                      <p className="text-sm font-bold">{offer.views.toLocaleString()}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground uppercase">Checkout</p>
                      <p className="text-sm font-bold">{offer.initiatedCheckout.toLocaleString()}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground uppercase">Vendas</p>
                      <p className="text-sm font-bold">{offer.sales.toLocaleString()}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground uppercase">CVR</p>
                      <p className={`text-sm font-bold ${isBestConversion ? "text-yellow-500" : ""}`}>
                        {formatPercentage(offer.conversionRate)}
                      </p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground uppercase">Receita</p>
                      <p className="text-sm font-bold">{formatCurrency(offer.revenue)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Gráfico de Pizza - Distribuição de Vendas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Distribuição de Vendas</CardTitle>
            <CardDescription>Proporção de vendas por variante</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius="80%"
                    innerRadius="40%"
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, _name, props) => [`${value} vendas`, props.payload.fullName]}
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-2">
              {pieChartData.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="font-medium">{item.fullName}</span>
                  </div>
                  <span className="font-bold">{item.value} vendas</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos de Linha e Barra */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Conversão ao Longo do Tempo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Taxa de Conversão ao Longo do Tempo</CardTitle>
            <CardDescription>Comparação diária entre variantes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={conversionLineData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(v) => `${v}%`} className="text-xs" tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(2)}%`, ""]}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                  />
                  <Legend />
                  {metrics.offers.map((offer, index) => (
                    <Line
                      key={offer.offerId}
                      type="monotone"
                      dataKey={offer.offerName}
                      stroke={OFFER_COLORS[index % OFFER_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Faturamento por Variante */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Faturamento por Variante</CardTitle>
            <CardDescription>Comparação de receita gerada</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(v) => `R$ ${v.toLocaleString()}`} className="text-xs" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={80} className="text-xs" tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "Faturamento"]}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                  />
                  <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                    {barChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ABTestAnalyticsPage;
