import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_URL } from "@/config/BackendUrl";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ArrowLeft, Eye, ShoppingCart, CreditCard, TrendingUp, ExternalLink } from "lucide-react";
import { formatCurrency } from "@/helper/formatCurrency";
import { SalesHistoryTable } from "@/components/dashboard/SalesHistoryTable";
import { DailyOfferChart } from "@/components/dashboard/DailyOfferChart";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DateRange } from "react-day-picker";
import { subDays, startOfDay, endOfDay } from "date-fns";

interface FunnelData {
  _id: string;
  offerName: string;
  slug: string;
  views: number;
  totalViews: number;
  initiatedCheckout: number;
  purchases: number;
  revenue: number;
  conversionRate: number;
}

// interface TotalRevenueData {
//   offerId: string;
//   offerName: string;
//   totalRevenue: number;
//   totalSales: number;
//   averageTicket: number;
// }

export default function OfferAnalyticsPage() {
  const { id } = useParams<{ id: string }>(); // ID da oferta vindo da URL
  const { token } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<FunnelData | null>(null);
  const [overviewData, setOverviewData] = useState<any>(null);
  // const [totalRevenueData, setTotalRevenueData] = useState<TotalRevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Estados dos filtros
  const [dateFilter, setDateFilter] = useState<string>("30"); // "today", "7", "30", "custom"
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Calcula as datas baseado no filtro selecionado
        const now = new Date();
        let startDate: string;
        let endDate: string;

        if (dateFilter === "custom") {
          // Período personalizado - só busca se ambas as datas estiverem selecionadas
          if (!customDateRange?.from || !customDateRange?.to) {
            setLoading(false);
            return; // Aguarda seleção completa do range
          }
          startDate = startOfDay(customDateRange.from).toISOString();
          endDate = endOfDay(customDateRange.to).toISOString();
        } else {
          // Filtros pré-definidos
          endDate = endOfDay(now).toISOString();

          if (dateFilter === "today") {
            // Hoje: do início até o fim do dia atual
            startDate = startOfDay(now).toISOString();
          } else if (dateFilter === "yesterday") {
            // Ontem: do início ao fim do dia anterior
            const yesterday = subDays(now, 1);
            startDate = startOfDay(yesterday).toISOString();
            endDate = endOfDay(yesterday).toISOString();
          } else if (dateFilter === "7") {
            // Últimos 7 dias: inclui hoje
            startDate = startOfDay(subDays(now, 6)).toISOString();
          } else if (dateFilter === "30") {
            // Últimos 30 dias (padrão): inclui hoje
            startDate = startOfDay(subDays(now, 29)).toISOString();
          } else {
            // Tempo total
            startDate = new Date("2020-01-01").toISOString();
            endDate = endOfDay(now).toISOString();
          }
        }

        console.log("📅 Filtro selecionado:", dateFilter);
        console.log("📅 Período:", { startDate, endDate });

        // Busca métricas com filtro de data
        const response = await fetch(`${API_URL}/metrics/funnel?startDate=${startDate}&endDate=${endDate}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) throw new Error("Falha ao buscar métricas");

        const allOffers: FunnelData[] = await response.json();
        const currentOffer = allOffers.find((o) => o._id === id);

        if (!currentOffer) throw new Error("Oferta não encontrada nos registros de métricas.");

        setData(currentOffer);

        // Busca métricas detalhadas (gráficos diários)
        const overviewRes = await fetch(`${API_URL}/metrics/overview?offerId=${id}&startDate=${startDate}&endDate=${endDate}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (overviewRes.ok) {
          const overview = await overviewRes.json();
          setOverviewData(overview);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    if (token && id) fetchData();
  }, [token, id, dateFilter, customDateRange]);

  // Busca o faturamento total da oferta (histórico completo, sem filtro de data)
  // useEffect(() => {
  //   const fetchTotalRevenue = async () => {
  //     if (!token || !id) return;

  //     try {
  //       const response = await fetch(`${API_URL}/metrics/offer-total-revenue?offerId=${id}`, {
  //         headers: {
  //           Authorization: `Bearer ${token}`,
  //         },
  //       });

  //       if (!response.ok) throw new Error("Falha ao buscar faturamento total");

  //       const totalData: TotalRevenueData = await response.json();
  //       setTotalRevenueData(totalData);
  //     } catch (err) {
  //       console.error("Erro ao buscar faturamento total:", err);
  //       // Não exibe erro para não quebrar a página, apenas não mostra o card
  //     }
  //   };

  //   fetchTotalRevenue();
  // }, [token, id]);

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 flex flex-col items-center gap-4">
        <p className="text-red-500">Erro: {error || "Dados não encontrados"}</p>
        <Button onClick={() => navigate("/offers")}>Voltar</Button>
      </div>
    );
  }

  // Prepara dados para o gráfico
  const chartData = [
    { name: "Visualizações", value: data.views, color: "#fbe298" }, // Blue
    { name: "Checkout Iniciado", value: data.initiatedCheckout, color: "#fdd049" }, // Amber
    { name: "Vendas Aprovadas", value: data.purchases, color: "#fdbf08" }, // Emerald
  ];

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/offers")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{data.offerName}</h1>
              <p className="text-sm text-muted-foreground">Análise detalhada de performance do funil</p>
            </div>
          </div>

          {/* Filtros de Data e Botão Ver Página */}
          <div className="flex flex-col sm:flex-row gap-2 items-end sm:items-start">
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-full sm:w-[190px]">
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="yesterday">Ontem</SelectItem>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="all">Tempo Total</SelectItem>
                  <SelectItem value="custom">Período personalizado</SelectItem>
                </SelectContent>
              </Select>

              {dateFilter === "custom" && (
                <div className="w-full sm:w-auto">
                  <DateRangePicker value={customDateRange} onChange={setCustomDateRange} />
                </div>
              )}
            </div>

            <Button variant="outline" onClick={() => window.open(`https://pay.snappcheckout.com/c/${data.slug}`, "_blank")} className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Ver Página
            </Button>
          </div>
        </div>
      </div>
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Visualizações Únicas</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.views}</div>
            <p className="text-xs text-muted-foreground">Totais: {data.totalViews || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Checkout Iniciado</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.initiatedCheckout}</div>
            <p className="text-xs text-muted-foreground">
              {data.views > 0 ? ((data.initiatedCheckout / data.views) * 100).toFixed(1) : 0}% dos visitantes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas Aprovadas</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.purchases}</div>
            <p className="text-xs text-muted-foreground">Receita: {formatCurrency(data.revenue)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversão Geral</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{data.conversionRate.toFixed(2)}%</div>
            <p className="text-xs text-muted-foreground">De visualização para compra</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-12">
        <Card className="md:col-span-12 lg:col-span-3">
          <CardHeader>
            <CardTitle>Funil de Conversão</CardTitle>
            <CardDescription>Visualização do funil.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="horizontal" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={60}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Mini Detail Card - Right Side */}
        <Card className="md:col-span-12 lg:col-span-3">
          <CardHeader>
            <CardTitle>Detalhes da Receita</CardTitle>
            <CardDescription>Performance financeira.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              <div className="flex items-center">
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">Ticket Médio</p>
                  <p className="text-sm text-muted-foreground">Valor médio por venda</p>
                </div>
                <div className="ml-auto font-bold">{data.purchases > 0 ? formatCurrency(data.revenue / data.purchases) : "R$ 0,00"}</div>
              </div>

              <div className="flex items-center">
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">Drop-off Checkout</p>
                  <p className="text-sm text-muted-foreground">Iniciaram mas não compraram</p>
                </div>
                <div className="ml-auto font-bold text-red-500">{data.initiatedCheckout - data.purchases}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico Diário de Performance */}
        <div className="md:col-span-12 lg:col-span-6">
          {overviewData && (
            <DailyOfferChart
              data={{
                visitors: overviewData.charts.visitors,
                checkouts: overviewData.charts.checkouts,
                sales: overviewData.charts.sales,
              }}
            />
          )}
        </div>
      </div>

      <SalesHistoryTable offerId={id!} />
    </div>
  );
}
