"use client";

import * as React from "react";
import axios from "axios";
import { Pie, PieChart, Label } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { API_URL } from "@/config/BackendUrl";

export function OffersRevenueChart() {
  const [chartData, setChartData] = React.useState<any[]>([]);
  const [chartConfig, setChartConfig] = React.useState<ChartConfig>({
    revenue: { label: "Faturamento" },
  });
  // const [totalRevenue, setTotalRevenue] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(`${API_URL}/metrics/offers-ranking`, {
          withCredentials: true,
        });

        const rawData = response.data as { offerName: string; revenue: number }[];
        let total = 0;

        // Cores do tema (shadcn charts)
        const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

        const processedData = rawData.map((item, index) => {
          const value = item.revenue / 100; // Centavos para Reais
          total += value;

          // Cria uma chave segura para o config
          const key = `offer_${index}`;

          return {
            offerKey: key, // Chave usada para ligar com a config
            offerName: item.offerName, // Nome real para exibição
            revenue: value,
            fill: colors[index % colors.length], // Cicla as cores
          };
        });

        // Gera a configuração dinâmica baseada nos dados recebidos
        const newConfig: ChartConfig = {
          revenue: { label: "Faturamento" },
        };

        processedData.forEach((item) => {
          newConfig[item.offerKey] = {
            label: item.offerName,
            color: item.fill,
          };
        });

        // setTotalRevenue(total);
        setChartData(processedData);
        setChartConfig(newConfig);
      } catch (error) {
        console.error("Erro ao carregar ranking de ofertas:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Encontra a oferta campeã para o rodapé
  // const topOffer = chartData.length > 0 ? chartData[0] : null;

  return (
    <Card className="flex flex-col w-1/3">
      <CardHeader className="items-center pb-0">
        <CardTitle>Top Ofertas</CardTitle>
        <CardDescription>Faturamento por Produto</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        {isLoading ? (
          <div className="h-[250px] flex items-center justify-center animate-pulse text-muted-foreground">Carregando...</div>
        ) : (
          <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[250px]">
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, _name, item) => (
                      <div className="flex min-w-[130px] items-center gap-2 text-xs">
                        <span className="font-medium text-foreground">{chartConfig[item.payload.offerKey as keyof typeof chartConfig]?.label}</span>
                        <div className="ml-auto font-mono font-medium text-foreground">{formatCurrency(Number(value))}</div>
                      </div>
                    )}
                  />
                }
              />
              <Pie data={chartData} dataKey="revenue" nameKey="offerKey" innerRadius={60} strokeWidth={5}>
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">
                            {chartData.length}
                          </tspan>
                          <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="fill-muted-foreground text-xs">
                            Ofertas Ativas
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>

      {/* {topOffer && (
        <CardFooter className="flex-col gap-2 text-sm">
          <div className="flex items-center gap-2 leading-none font-medium">
            Campeã: {topOffer.offerName} <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          <div className="text-muted-foreground leading-none">Representa a maior fatia do seu faturamento.</div>
        </CardFooter>
      )} */}
    </Card>
  );
}
