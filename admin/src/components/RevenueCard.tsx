import { useEffect, useState } from "react";

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
    <div className="relative overflow-hidden rounded-xl border border-sidebar-primary bg-linear-to-br from-yellow-50 via-white to-yellow-400/20 dark:from-black dark:via-gray-900 dark:to-yellow-600/20 px-4 pt-1 shadow-sm transition-all duration-300 hover:shadow-md">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-linear-to-br from-yellow-100/50 via-transparent to-transparent dark:from-yellow-600/20 dark:via-transparent dark:to-black/50 opacity-50" />

      <div className="relative space-y-1">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Faturamento</h3>
          </div>
        </div>

        {/* Revenue Display */}
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold bg-linear-to-r from-yellow-600 to-yellow-500 bg-clip-text text-transparent">
              {formatCompact(currentRevenueInReais)}
            </span>
            {/* <span className="text-sm font-medium text-gray-500">/ {goalRevenueInReais}</span> */}
            <span className="text-sm font-medium text-muted-foreground">/ R$ 100K</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-2 mb-0">
          {/* Progress bar container */}
          <div className="w-full relative flex h-2.5 overflow-hidden rounded-full bg-linear-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 shadow-inner">
            {/* Animated progress fill */}
            <div
              className="w-full h-full rounded-full bg-linear-to-r from-yellow-400 via-yellow-500 to-yellow-400 dark:from-yellow-600 dark:via-yellow-500 dark:to-yellow-600 shadow-sm transition-all duration-1000 ease-out"
              style={{
                width: `${animatedProgress}%`,
                backgroundSize: "200% 100%",
              }}
            >
              {/* Shine effect */}
              <div className="h-full w-full animate-shimmer bg-linear-to-r from-transparent via-white/30 to-transparent" />
            </div>

            {/* Glow on the progress */}
            {animatedProgress > 0 && (
              <div
                className="absolute top-0 h-full rounded-full bg-yellow-400/40 blur-sm transition-all duration-1000 ease-out"
                style={{ width: `${animatedProgress}%` }}
              />
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold bg-linear-to-r from-yellow-600 to-yellow-500 bg-clip-text text-transparent">
              {percentage.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Footer hint */}
        <div className="pt-1">
          <p className="text-xs text-muted-foreground">
            {percentage > 100 && <span className="font-semibold text-yellow-600">🎉 Meta atingida!</span>}
          </p>
        </div>
      </div>
    </div>
  );
}
