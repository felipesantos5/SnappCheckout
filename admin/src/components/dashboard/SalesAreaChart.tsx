"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

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

interface SalesAreaChartProps {
  chartData?: { date: string; value: number }[];
}

export function SalesAreaChart({ chartData = [] }: SalesAreaChartProps) {
  const [isLoading, setIsLoading] = React.useState(false);

  // Função para formatar moeda no Tooltip
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Transformar os dados para o formato esperado pelo gráfico
  const formattedChartData = chartData.map((item) => ({
    date: item.date,
    revenue: item.value, // Já vem em reais do backend
  }));

  return (
    <Card className="w-full h-full">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row pt-0">
        <div className="grid flex-1 gap-1">
          <CardTitle>Histórico de Vendas</CardTitle>
          <CardDescription>Acompanhamento do faturamento diário</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          {formattedChartData.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">Nenhum dado disponível</div>
          ) : (
            <AreaChart data={formattedChartData}>
              <defs>
                <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-6)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0.1} />
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
            </AreaChart>
          )}
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
