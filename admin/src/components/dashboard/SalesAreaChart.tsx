import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface SalesChartProps {
  chartData: { date: string; value: number }[];
}

// Configuração de cores e labels
const chartConfig = {
  revenue: {
    label: "Receita",
    color: "#EAB308", // Seu Amarelo/Dourado
  },
} satisfies ChartConfig;

export function SalesAreaChart({ chartData }: SalesChartProps) {
  // const totalRevenue = useMemo(() => {
  //   return chartData.reduce((acc, curr) => acc + curr.value, 0);
  // }, [chartData]);

  // Formata valor para o tooltip (BRL)
  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  // Formatador inteligente de data
  const formatDateLabel = (value: string) => {
    // Se for formato de hora (HH:MM), retorna direto
    if (value.includes(":")) {
      return value;
    }

    // Se for formato YYYY-MM-DD, converte para DD/MM
    if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [month, day] = value.split("-");
      return `${day}/${month}`;
    }

    // Caso contrário, retorna como está
    return value;
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="mb-10">
        <CardTitle>Histórico de Vendas</CardTitle>
        <CardDescription>Receita no período selecionado</CardDescription>
      </CardHeader>

      <CardContent className="flex-1 h-full">
        <ChartContainer config={chartConfig}>
          <BarChart accessibilityLayer data={chartData} margin={{ top: 20, right: 10, left: 10, bottom: 0 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis
              dataKey="date"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              tickFormatter={formatDateLabel}
            />
            <ChartTooltip
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.2 }}
              content={<ChartTooltipContent hideLabel formatter={(value) => formatCurrency(Number(value))} className="bg-popover border-border" />}
            />
            <Bar dataKey="value" fill={chartConfig.revenue.color} radius={[8, 8, 0, 0]} maxBarSize={60} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
