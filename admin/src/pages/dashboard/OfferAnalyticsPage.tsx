import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_URL } from "@/config/BackendUrl";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ArrowLeft, Eye, ShoppingCart, CreditCard, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/helper/formatCurrency";
import { SalesHistoryTable } from "@/components/dashboard/SalesHistoryTable";

interface FunnelData {
  _id: string;
  offerName: string;
  slug: string;
  views: number;
  initiatedCheckout: number;
  purchases: number;
  revenue: number;
  conversionRate: number;
}

export default function OfferAnalyticsPage() {
  const { id } = useParams<{ id: string }>(); // ID da oferta vindo da URL
  const { token } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Buscamos o funil de TODAS as ofertas e filtramos aqui (ou crie uma rota específica no backend se preferir)
        const response = await fetch(`${API_URL}/metrics/funnel`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) throw new Error("Falha ao buscar métricas");

        const allOffers: FunnelData[] = await response.json();
        const currentOffer = allOffers.find((o) => o._id === id);

        if (!currentOffer) throw new Error("Oferta não encontrada nos registros de métricas.");

        setData(currentOffer);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    if (token && id) fetchData();
  }, [token, id]);

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
    <div className="p-6 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" onClick={() => navigate("/offers")} className="-ml-2 text-gray-500">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{data.offerName}</h1>
          <p className="text-muted-foreground">Análise detalhada de performance do funil.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open(`http://localhost:5173/${data.slug}`, "_blank")}>
            Ver Página
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Visualizações</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.views}</div>
            <p className="text-xs text-muted-foreground">Acessos únicos à página</p>
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
      <div className="grid gap-4 md:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Funil de Conversão</CardTitle>
            <CardDescription>Visualização gráfica da perda de tráfego entre etapas.</CardDescription>
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
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Detalhes da Receita</CardTitle>
            <CardDescription>Performance financeira desta oferta.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              <div className="flex items-center">
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">Ticket Médio</p>
                  <p className="text-sm text-muted-foreground">Valor médio por venda aprovada</p>
                </div>
                <div className="ml-auto font-bold">{data.purchases > 0 ? formatCurrency(data.revenue / data.purchases) : "R$ 0,00"}</div>
              </div>

              <div className="flex items-center">
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">Drop-off Checkout</p>
                  <p className="text-sm text-muted-foreground">Pessoas que iniciaram mas não compraram</p>
                </div>
                <div className="ml-auto font-bold text-red-500">{data.initiatedCheckout - data.purchases}</div>
              </div>

              <div className="flex items-center">
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">ROI (Estimado)</p>
                  <p className="text-sm text-muted-foreground">Baseado apenas na receita bruta</p>
                </div>
                <div className="ml-auto font-bold text-green-600">Positivo</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <SalesHistoryTable offerId={id!} />
    </div>
  );
}
