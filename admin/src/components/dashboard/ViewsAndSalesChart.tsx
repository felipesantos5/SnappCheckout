import { Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye } from "lucide-react";

interface ViewsAndSalesChartProps {
  visitorsData: { date: string; value: number }[];
  salesData: { date: string; value: number }[];
}

export function ViewsAndSalesChart({ visitorsData, salesData }: ViewsAndSalesChartProps) {
  // Combina os dados de visualizações e vendas em um único array
  const combinedData = visitorsData.map((item, index) => ({
    date: item.date,
    visitors: item.value,
    sales: salesData[index]?.value || 0,
  }));

  // Calcula totais para exibir na legenda
  const totalVisitors = visitorsData.reduce((sum, item) => sum + item.value, 0);
  const totalSales = salesData.reduce((sum, item) => sum + item.value, 0);

  // Formatador de data para o eixo X
  const formatDateLabel = (value: string) => {
    // Se for formato de hora (HH:MM), retorna direto
    if (value.includes(":")) {
      return value.replace(":00", "h");
    }
    // Se for formato YYYY-MM-DD, converte para DD/MM
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
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#fbbf24" }} />
              <span className="text-muted-foreground">Visualizações:</span>
              <span className="font-semibold">{payload[0]?.value || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#d97706" }} />
              <span className="text-muted-foreground">Vendas:</span>
              <span className="font-semibold">{payload[1]?.value || 0}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader className="pb-2 sm:pb-4">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Eye className="w-5 h-5 text-yellow-500" />
          Tráfego e Conversões
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Visualizações e vendas no período selecionado
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-3 sm:pb-4">
        {/* Legenda com totais */}
        <div className="flex items-center gap-4 mb-4 text-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <span className="text-muted-foreground">Visualizações</span>
            <span className="font-bold">{totalVisitors.toLocaleString("pt-BR")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-amber-600" />
            <span className="text-muted-foreground">Vendas</span>
            <span className="font-bold">{totalSales.toLocaleString("pt-BR")}</span>
          </div>
        </div>

        {/* Gráfico */}
        <div className="h-[200px] sm:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={combinedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                {/* Gradiente para Visualizações (amarelo claro) */}
                <linearGradient id="gradientVisitors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.05} />
                </linearGradient>
                {/* Gradiente para Vendas (amarelo escuro) */}
                <linearGradient id="gradientSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d97706" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#d97706" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                tickFormatter={formatDateLabel}
                interval="preserveStartEnd"
              />
              
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                width={40}
              />
              
              <Tooltip content={<CustomTooltip />} />
              
              {/* Área de Visualizações (atrás) */}
              <Area
                type="monotone"
                dataKey="visitors"
                stroke="#fbbf24"
                strokeWidth={2}
                fill="url(#gradientVisitors)"
                name="Visualizações"
              />
              
              {/* Área de Vendas (frente) */}
              <Area
                type="monotone"
                dataKey="sales"
                stroke="#d97706"
                strokeWidth={2}
                fill="url(#gradientSales)"
                name="Vendas"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
