import { useMemo } from "react";
import { Bar, BarChart, XAxis, YAxis, LabelList } from "recharts";

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

// Número máximo de barras no gráfico para boa visualização
const MAX_CHART_BARS = 15;

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

    // Caso contrário, retorna como está (já está formatado)
    return value;
  };

  // Agrega os dados quando houver muitos pontos para melhor visualização
  const aggregatedData = useMemo(() => {
    if (chartData.length <= MAX_CHART_BARS) {
      return chartData;
    }

    // Calcula quantos pontos agrupar para chegar em ~MAX_CHART_BARS
    const groupSize = Math.ceil(chartData.length / MAX_CHART_BARS);

    const result: { date: string; value: number }[] = [];

    for (let i = 0; i < chartData.length; i += groupSize) {
      const group = chartData.slice(i, i + groupSize);

      // Soma os valores do grupo
      const totalValue = group.reduce((sum, item) => sum + item.value, 0);

      // Cria label do período (primeira data - última data do grupo)
      const firstDate = group[0].date;
      const lastDate = group[group.length - 1].date;

      // Formata as datas para o label (formato compacto para ranges)
      const formatDate = (dateStr: string) => {
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const [, month, day] = dateStr.split("-");
          return { day, month };
        }
        return { day: dateStr, month: "" };
      };

      let dateLabel: string;
      if (group.length > 1) {
        const first = formatDate(firstDate);
        const last = formatDate(lastDate);
        // Formato compacto: "05-12/01" (mesmo mês) ou "28/01-03/02" (meses diferentes)
        if (first.month === last.month) {
          dateLabel = `${first.day}-${last.day}/${first.month}`;
        } else {
          dateLabel = `${first.day}/${first.month}-${last.day}/${last.month}`;
        }
      } else {
        const first = formatDate(firstDate);
        dateLabel = `${first.day}/${first.month}`;
      }

      result.push({
        date: dateLabel,
        value: totalValue,
      });
    }

    return result;
  }, [chartData]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 sm:pb-4">
        <CardTitle className="text-base sm:text-lg">Histórico de Vendas</CardTitle>
        <CardDescription className="text-xs sm:text-sm">Receita no período selecionado</CardDescription>
      </CardHeader>

      <CardContent className="flex-1 pb-3 sm:pb-4">
        <ChartContainer config={chartConfig} className="h-full min-h-[300px] w-full">
          <BarChart
            accessibilityLayer
            data={aggregatedData}
            layout="vertical"
            margin={{
              left: 10,
              right: 100,
              top: 10,
              bottom: 10,
            }}
          >
            <XAxis type="number" dataKey="value" hide />
            <YAxis
              dataKey="date"
              type="category"
              tickLine={false}
              tickMargin={5}
              axisLine={false}
              width={chartData.length > MAX_CHART_BARS ? 95 : 45}
              tick={(props: any) => {
                const { x, y, payload } = props;
                return (
                  <text
                    x={x}
                    y={y}
                    fill="hsl(var(--muted-foreground))"
                    fontSize={10}
                    textAnchor="end"
                    dominantBaseline="middle"
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {formatDateLabel(payload.value)}
                  </text>
                );
              }}
            />
            <Bar dataKey="value" fill="var(--color-value)" radius={5} barSize={32}>
              <LabelList
                dataKey="value"
                position="right"
                offset={8}
                className="fill-foreground"
                fontSize={10}
                fontWeight={600}
                content={(props: any) => {
                  const { x, y, width, height, value } = props;
                  if (!value || value === 0) return null;
                  return (
                    <text
                      x={x + width + 8}
                      y={y + height / 2}
                      fill="currentColor"
                      fontSize={10}
                      fontWeight={600}
                      textAnchor="start"
                      dominantBaseline="middle"
                    >
                      {formatCurrency(value)}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
