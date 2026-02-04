import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface TopOffer {
  name: string;
  value: number;
  count: number;
}

interface TopOffersChartProps {
  data: TopOffer[];
}

// Cores usando as variáveis CSS do Tailwind
const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function TopOffersChart({ data }: TopOffersChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg">Top Ofertas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8 pt-4 lg:pt-36">Nenhum dado disponível</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 sm:pb-4">
        <CardTitle className="text-base sm:text-lg">Top Ofertas</CardTitle>
        <CardDescription className="text-xs sm:text-sm">Receita por oferta</CardDescription>
      </CardHeader>
      <CardContent className="pb-3 sm:pb-4">
        <div className="h-[180px] sm:h-[280px] flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={"80%"}
                innerRadius={"40%"}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: "12px" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-1.5 sm:space-y-2 mt-2">
          {data.slice(0, 5).map((offer, index) => (
            <div key={index} className="flex items-center justify-between text-xs sm:text-sm gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="font-medium truncate">{offer.name}</span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-nowrap flex-shrink-0">
                <span className="text-muted-foreground hidden sm:inline">{offer.count} vendas</span>
                <span className="font-bold">R$ {offer.value.toFixed(0)}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
