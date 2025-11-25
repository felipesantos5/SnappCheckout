import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";

interface RevenueCardProps {
  currentRevenue: number;
  goalRevenue?: number;
}

export function RevenueCard({ currentRevenue, goalRevenue = 10000000 }: RevenueCardProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);

  // Valores vêm em centavos do backend
  const currentRevenueInReais = currentRevenue / 100;
  const goalRevenueInReais = goalRevenue / 100;

  const percentage = Math.min((currentRevenueInReais / goalRevenueInReais) * 100, 100);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(percentage);
    }, 100);
    return () => clearTimeout(timer);
  }, [percentage]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatCompact = (value: number) => {
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(1).replace(".", ",")}K`;
    }
    return formatCurrency(value);
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-yellow-200/50 bg-gradient-to-br from-yellow-50 via-white to-yellow-50/30 p-4 shadow-sm transition-all duration-300 hover:shadow-md">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-100/20 via-transparent to-transparent opacity-50" />

      <div className="relative space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-500 shadow-sm">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700">Faturamento</h3>
          </div>
        </div>

        {/* Revenue Display */}
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-yellow-600 to-yellow-500 bg-clip-text text-transparent">
              {formatCompact(currentRevenueInReais)}
            </span>
            <span className="text-sm font-medium text-gray-500">/ {formatCompact(goalRevenueInReais)}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Progresso</span>
            <span className="text-sm font-bold bg-gradient-to-r from-yellow-600 to-yellow-500 bg-clip-text text-transparent">
              {percentage.toFixed(1)}%
            </span>
          </div>

          {/* Progress bar container */}
          <div className="relative h-2.5 overflow-hidden rounded-full bg-gradient-to-r from-gray-100 to-gray-200 shadow-inner">
            {/* Animated progress fill */}
            <div
              className="h-full rounded-full bg-linear-to-r from-yellow-400 via-yellow-500 to-yellow-400 shadow-sm transition-all duration-1000 ease-out"
              style={{
                width: `${animatedProgress}%`,
                backgroundSize: "200% 100%",
              }}
            >
              {/* Shine effect */}
              <div className="h-full w-full animate-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            </div>

            {/* Glow on the progress */}
            {animatedProgress > 0 && (
              <div
                className="absolute top-0 h-full rounded-full bg-yellow-400/40 blur-sm transition-all duration-1000 ease-out"
                style={{ width: `${animatedProgress}%` }}
              />
            )}
          </div>
        </div>

        {/* Footer hint */}
        <div className="pt-1">
          <p className="text-xs text-gray-500">{percentage > 100 && <span className="font-semibold text-yellow-600">🎉 Meta atingida!</span>}</p>
        </div>
      </div>
    </div>
  );
}
