import { Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

interface DailyOfferChartProps {
  data: {
    visitors: { date: string; value: number }[];
    checkouts: { date: string; value: number }[];
    sales: { date: string; value: number }[];
  };
}

export function DailyOfferChart({ data }: DailyOfferChartProps) {
  // Combina os dados em um único array para o Recharts
  const combinedData = data.visitors.map((item, index) => {
    const v = item.value;
    const c = data.checkouts[index]?.value || 0;
    const s = data.sales[index]?.value || 0;
    const conversion = v > 0 ? ((s / v) * 100).toFixed(2) : "0.00";

    return {
      date: item.date,
      views: v,
      checkouts: c,
      sales: s,
      conversion: parseFloat(conversion),
    };
  });

  // Formatador de data para o eixo X
  const formatDateLabel = (value: string) => {
    if (value.includes(":")) return value.replace(":00", "h");
    if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [, month, day] = value.split("-");
      return `${day}/${month}`;
    }
    return value;
  };

  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
          <p className="font-medium text-foreground mb-2">{formatDateLabel(label)}</p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#fbe298" }} />
                <span className="text-muted-foreground">Views:</span>
              </div>
              <span className="font-semibold">{payload[0]?.value || 0}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#fdd049" }} />
                <span className="text-muted-foreground">Checkouts:</span>
              </div>
              <span className="font-semibold">{payload[1]?.value || 0}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#fdbf08" }} />
                <span className="text-muted-foreground">Vendas:</span>
              </div>
              <span className="font-semibold">{payload[2]?.value || 0}</span>
            </div>
            <div className="pt-1 mt-1 border-t flex items-center justify-between gap-4 text-green-600">
              <span className="font-medium">Conversão:</span>
              <span className="font-bold">{payload[0]?.payload.conversion}%</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-yellow-500" />
          Análise Diária de Performance
        </CardTitle>
        <CardDescription className="text-xs">
          Evolução de tráfego, checkouts e vendas por dia
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={combinedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fbe298" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#fbe298" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCheckouts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fdd049" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#fdd049" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fdbf08" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#fdbf08" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.5)" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickFormatter={formatDateLabel}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                minTickGap={30}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="views"
                stroke="#fbe298"
                fillOpacity={1}
                fill="url(#colorViews)"
                strokeWidth={2}
                name="Views"
              />
              <Area
                type="monotone"
                dataKey="checkouts"
                stroke="#fdd049"
                fillOpacity={1}
                fill="url(#colorCheckouts)"
                strokeWidth={2}
                name="Checkouts"
              />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="#fdbf08"
                fillOpacity={1}
                fill="url(#colorSales)"
                strokeWidth={2.5}
                name="Vendas"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-6 mt-4 text-[11px] font-medium text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#fbe298]" />
            Views
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#fdd049]" />
            Checkouts
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#fdbf08]" />
            Vendas
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
