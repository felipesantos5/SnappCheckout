"use client";

import * as React from "react";
import axios from "axios";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API_URL } from "@/config/BackendUrl";

// Configuração visual
const chartConfig = {
  visitors: {
    label: "Vendas",
  },
  revenue: {
    label: "Faturamento",
    color: "hsl(var(--primary))", // Usa a cor amarela do seu tema
  },
} satisfies ChartConfig;

export function SalesAreaChart() {
  const [timeRange, setTimeRange] = React.useState("7d");
  const [chartData, setChartData] = React.useState<{ date: string; revenue: number }[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Função para formatar moeda no Tooltip
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Função para preencher dias sem vendas com 0 (para o gráfico ficar contínuo)
  const fillMissingDates = (data: { _id: string; revenue: number }[], days: number) => {
    const result = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split("T")[0]; // YYYY-MM-DD

      const found = data.find((item) => item._id === dateStr);

      result.push({
        date: dateStr,
        revenue: found ? found.revenue / 100 : 0, // Converte centavos para reais
      });
    }
    return result;
  };

  // Efeito para buscar dados quando o timeRange muda
  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Converte "90d" -> 90
        const days = parseInt(timeRange.replace("d", ""));

        const response = await axios.get(`${API_URL}/metrics?days=${days}`, {
          withCredentials: true,
        });

        const processedData = fillMissingDates(response.data, days);
        setChartData(processedData);
      } catch (error) {
        console.error("Erro ao carregar gráfico:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [timeRange]);

  return (
    <Card className="w-full">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row pt-0">
        <div className="grid flex-1 gap-1">
          <CardTitle>Histórico de Vendas</CardTitle>
          <CardDescription>Acompanhamento do faturamento diário</CardDescription>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-40 rounded-lg sm:ml-auto" aria-label="Selecione o período">
            <SelectValue placeholder="Últimos 3 meses" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="90d" className="rounded-lg">
              Últimos 3 meses
            </SelectItem>
            <SelectItem value="30d" className="rounded-lg">
              Últimos 30 dias
            </SelectItem>
            <SelectItem value="7d" className="rounded-lg">
              Últimos 7 dias
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground animate-pulse">Carregando dados...</div>
          ) : (
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString("pt-BR", {
                    month: "short",
                    day: "numeric",
                  });
                }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => {
                      return new Date(value).toLocaleDateString("pt-BR", {
                        weekday: "long",
                        month: "2-digit",
                        day: "numeric",
                      });
                    }}
                    indicator="dot"
                    // Custom formatter para mostrar R$
                    formatter={(value, name) => (
                      <div className="flex min-w-[130px] items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{chartConfig[name as keyof typeof chartConfig]?.label || name}</span>
                        <div className="ml-auto font-mono font-medium text-foreground">{formatCurrency(Number(value))}</div>
                      </div>
                    )}
                  />
                }
              />
              <Area dataKey="revenue" type="natural" fill="url(#fillRevenue)" stroke="var(--color-revenue)" stackId="a" />
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          )}
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
