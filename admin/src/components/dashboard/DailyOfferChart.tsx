import { useState } from "react";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { TrendingUp, Eye, ShoppingCart, Percent, LineChart, Table as TableIcon } from "lucide-react";

interface DailyOfferChartProps {
  data: {
    visitors: { date: string; value: number }[];
    checkouts: { date: string; value: number }[];
    sales: { date: string; value: number }[];
  };
}

export function DailyOfferChart({ data }: DailyOfferChartProps) {
  const [viewType, setViewType] = useState<"chart" | "table">("chart");

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
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-yellow-500" />
            Análise Diária de Performance
          </CardTitle>
          <CardDescription className="text-xs">
            Evolução de tráfego, checkouts e vendas por dia
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setViewType(viewType === "chart" ? "table" : "chart")}
          className="gap-2 h-8 text-xs font-semibold"
        >
          {viewType === "chart" ? (
            <>
              <TableIcon className="h-3.5 w-3.5" />
              VISUALIZAR TABELA
            </>
          ) : (
            <>
              <LineChart className="h-3.5 w-3.5" />
              VISUALIZAR GRÁFICO
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {/* Altura fixa de 400px para evitar pulo de layout */}
        <div className="h-[400px] w-full flex flex-col pt-4">
          {viewType === "chart" ? (
            <>
              <div className="flex-1 min-h-0">
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
              <div className="flex flex-wrap items-center justify-center gap-6 mt-4 text-[11px] font-medium text-muted-foreground pb-2">
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
            </>
          ) : (
            <div className="flex-1 overflow-auto pr-1">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[10px] sm:text-xs uppercase font-bold text-muted-foreground w-[100px]">Data</TableHead>
                    <TableHead className="text-center text-[10px] sm:text-xs uppercase font-bold text-muted-foreground">
                      <div className="flex flex-col items-center">
                        <Eye className="h-3 w-3 mb-1 text-[#fbe298]" />
                        Views
                      </div>
                    </TableHead>
                    <TableHead className="text-center text-[10px] sm:text-xs uppercase font-bold text-muted-foreground">
                      <div className="flex flex-col items-center">
                        <ShoppingCart className="h-3 w-3 mb-1 text-[#fdd049]" />
                        Checkouts
                      </div>
                    </TableHead>
                    <TableHead className="text-center text-[10px] sm:text-xs uppercase font-bold text-muted-foreground">
                      <div className="flex flex-col items-center">
                        <ShoppingCart className="h-3 w-3 mb-1 text-[#fdbf08]" />
                        Vendas
                      </div>
                    </TableHead>
                    <TableHead className="text-right text-[10px] sm:text-xs uppercase font-bold text-muted-foreground">
                      <div className="flex flex-col items-end">
                        <Percent className="h-3 w-3 mb-1 text-green-500" />
                        Conversão
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {combinedData.slice().reverse().map((day) => (
                    <TableRow key={day.date} className="hover:bg-muted/30">
                      <TableCell className="font-semibold text-xs py-3">{formatDateLabel(day.date)}</TableCell>
                      <TableCell className="text-center font-medium text-xs py-3">{day.views}</TableCell>
                      <TableCell className="text-center font-medium text-xs py-3">{day.checkouts}</TableCell>
                      <TableCell className="text-center font-medium text-xs py-3">{day.sales}</TableCell>
                      <TableCell className="text-right py-3">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-bold ring-1 ring-inset ring-green-600/20">
                          {day.conversion.toFixed(2)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
