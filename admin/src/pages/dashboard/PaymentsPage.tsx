// admin/src/pages/dashboard/PaymentsPage.tsx
import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { API_URL } from "@/config/BackendUrl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/helper/formatCurrency";
import { StripeIcon } from "@/components/icons/stripe";
import { PaypalIcon } from "@/components/icons/paypal";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { TrendingUp, CreditCard, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface PaymentPlatformMetrics {
  totalSales: number;
  totalRevenue: number;
  totalFees: number;
}

interface ChartDataPoint {
  date: string;
  stripe: number;
  paypal: number;
}

interface PaymentMetrics {
  stripe: PaymentPlatformMetrics & {
    pending: number;
    available: number;
  };
  paypal: PaymentPlatformMetrics;
  chart: ChartDataPoint[];
  period: {
    startDate: string;
    endDate: string;
  };
}

export default function PaymentsPage() {
  const { token } = useAuth();
  const [metrics, setMetrics] = useState<PaymentMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [period, setPeriod] = useState(() => {
    return localStorage.getItem("payments_period") || "30";
  });
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    localStorage.setItem("payments_period", period);
  }, [period]);

  // Calcula datas baseadas no período
  const getDateRange = (days: string) => {
    const now = new Date();
    let startDate: string;
    let endDate: string;

    if (days === "custom") {
      if (!customDateRange?.from || !customDateRange?.to) {
        const start = new Date();
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        return {
          startDate: start.toISOString(),
          endDate: now.toISOString(),
        };
      }
      startDate = startOfDay(customDateRange.from).toISOString();
      endDate = endOfDay(customDateRange.to).toISOString();
    } else {
      endDate = endOfDay(now).toISOString();

      if (days === "1") {
        startDate = startOfDay(now).toISOString();
      } else if (days === "7") {
        startDate = startOfDay(subDays(now, 6)).toISOString();
      } else if (days === "90") {
        startDate = startOfDay(subDays(now, 89)).toISOString();
      } else {
        startDate = startOfDay(subDays(now, 29)).toISOString();
      }
    }

    return { startDate, endDate };
  };

  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const { startDate, endDate } = getDateRange(period);

        const response = await axios.get(`${API_URL}/metrics/payments`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { startDate, endDate },
        });

        setMetrics(response.data);
      } catch (error) {
        console.error("Erro ao carregar métricas de pagamentos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, period, customDateRange]);

  const getPeriodLabel = () => {
    switch (period) {
      case "1":
        return "Hoje";
      case "7":
        return "Últimos 7 dias";
      case "30":
        return "Últimos 30 dias";
      case "90":
        return "Últimos 3 meses";
      default:
        return "Últimos 30 dias";
    }
  };

  // Formatar moeda para tooltip
  const formatTooltipValue = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  // Calcular totais consolidados
  const totalRevenue = metrics ? metrics.stripe.totalRevenue + metrics.paypal.totalRevenue : 0;
  const totalSales = metrics ? metrics.stripe.totalSales + metrics.paypal.totalSales : 0;
  const stripePercentage = totalRevenue > 0 ? (metrics!.stripe.totalRevenue / totalRevenue) * 100 : 0;
  const paypalPercentage = totalRevenue > 0 ? (metrics!.paypal.totalRevenue / totalRevenue) * 100 : 0;

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 p-4 sm:p-6 animate-in fade-in duration-300">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 flex-1 mx-auto p-0 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pagamentos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visão consolidada das suas vendas por plataforma
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[145px] h-9">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Hoje</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 3 meses</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          {period === "custom" && (
            <div className="w-[220px]">
              <DateRangePicker value={customDateRange} onChange={setCustomDateRange} />
            </div>
          )}
        </div>
      </div>

      {/* Card Resumo Total */}
      <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-yellow-500" />
            Total de Vendas
          </CardTitle>
          <CardDescription>{getPeriodLabel()}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-3xl sm:text-4xl font-bold text-yellow-500">
                {formatCurrency(totalRevenue)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {totalSales} {totalSales === 1 ? "venda" : "vendas"} no período
              </p>
            </div>

            {/* Mini gráfico de proporção */}
            {totalRevenue > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#635BFF]" />
                  <span className="text-sm">{stripePercentage.toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#003087]" />
                  <span className="text-sm">{paypalPercentage.toFixed(0)}%</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cards por Plataforma */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {/* Card Stripe */}
        <Card className="border-[#635BFF]/30 hover:border-[#635BFF]/50 transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="">
                <StripeIcon />
              </div>
              <CreditCard className="h-5 w-5 text-[#635BFF]" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Vendas e Receita */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Vendido</p>
                <p className="text-2xl font-bold">{formatCurrency(metrics?.stripe.totalRevenue || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vendas</p>
                <p className="text-2xl font-bold">{metrics?.stripe.totalSales || 0}</p>
              </div>
            </div>

            {/* Separador */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground mb-3">Saldo na Conta</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-2">
                  <div className="p-1.5 rounded-full bg-yellow-500/10">
                    <ArrowDownRight className="h-4 w-4 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">A Receber</p>
                    <p className="text-lg font-semibold text-yellow-500">
                      {formatCurrency(metrics?.stripe.pending || 0)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="p-1.5 rounded-full bg-green-500/10">
                    <ArrowUpRight className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Disponível</p>
                    <p className="text-lg font-semibold text-green-500">
                      {formatCurrency(metrics?.stripe.available || 0)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Taxas */}
            {metrics && metrics.stripe.totalFees > 0 && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Taxas da Plataforma</span>
                  <span className="font-medium">{formatCurrency(metrics.stripe.totalFees)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card PayPal */}
        <Card className="border-[#003087]/30 hover:border-[#003087]/50 transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="w-28">
                <PaypalIcon />
              </div>
              <Wallet className="h-5 w-5 text-[#003087]" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Vendas e Receita */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Vendido</p>
                <p className="text-2xl font-bold">{formatCurrency(metrics?.paypal.totalRevenue || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vendas</p>
                <p className="text-2xl font-bold">{metrics?.paypal.totalSales || 0}</p>
              </div>
            </div>

            {/* Nota sobre saldo */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground mb-3">Saldo na Conta</p>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  Para verificar seu saldo do PayPal, acesse diretamente o{" "}
                  <a
                    href="https://www.paypal.com/myaccount/summary"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#003087] hover:underline font-medium"
                  >
                    painel do PayPal
                  </a>
                  .
                </p>
              </div>
            </div>

            {/* Taxas */}
            {metrics && metrics.paypal.totalFees > 0 && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Taxas da Plataforma</span>
                  <span className="font-medium">{formatCurrency(metrics.paypal.totalFees)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Vendas por Plataforma */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Vendas por Plataforma</CardTitle>
          <CardDescription>Comparativo de vendas ao longo do tempo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] sm:h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={metrics?.chart || []}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="stripeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#635BFF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#635BFF" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="paypalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#003087" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#003087" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `R$${value}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                  formatter={(value: number, name: string) => [
                    formatTooltipValue(value),
                    name === "stripe" ? "Stripe" : "PayPal",
                  ]}
                />
                <Legend
                  verticalAlign="top"
                  height={36}
                  formatter={(value) => (value === "stripe" ? "Stripe" : "PayPal")}
                />
                <Area
                  type="monotone"
                  dataKey="stripe"
                  stroke="#635BFF"
                  strokeWidth={2}
                  fill="url(#stripeGradient)"
                  dot={false}
                  activeDot={{ r: 6, fill: "#635BFF" }}
                />
                <Area
                  type="monotone"
                  dataKey="paypal"
                  stroke="#003087"
                  strokeWidth={2}
                  fill="url(#paypalGradient)"
                  dot={false}
                  activeDot={{ r: 6, fill: "#003087" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

