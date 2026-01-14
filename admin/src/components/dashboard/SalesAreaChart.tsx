import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";

interface SalesChartProps {
  chartData: { date: string; value: number }[];
}

// Configuração de cores e labels
const chartConfig = {
  value: {
    label: "Receita",
    color: "#EAB308", // Seu Amarelo/Dourado
  },
} satisfies ChartConfig;

export function SalesAreaChart({ chartData }: SalesChartProps) {
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
      const [, month, day] = value.split("-");
      return `${day}/${month}`;
    }

    // Caso contrário, retorna como está
    return value;
  };

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-2 sm:pb-4">
        <CardTitle className="text-base sm:text-lg">Histórico de Vendas</CardTitle>
        <CardDescription className="text-xs sm:text-sm">Receita no período selecionado</CardDescription>
      </CardHeader>

      <CardContent className="flex-1 pb-3 sm:pb-4 pt-4">
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{
                left: -20,
                right: 5,
                top: 10,
                bottom: 10,
              }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--muted))" />
              <XAxis
                dataKey="date"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                tickFormatter={formatDateLabel}
                minTickGap={30}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                tickFormatter={(val) => `R$ ${val >= 1000 ? (val / 1000).toFixed(1) + "k" : val}`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-background border rounded-lg shadow-lg p-2 text-xs">
                        <div className="font-bold text-muted-foreground mb-1">
                          {formatDateLabel(payload[0].payload.date)}
                        </div>
                        <div className="text-foreground font-semibold">
                          {formatCurrency(payload[0].value as number)}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="value"
                fill="var(--color-value)"
                radius={[4, 4, 0, 0]}
                barSize={chartData.length > 30 ? undefined : 20}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
