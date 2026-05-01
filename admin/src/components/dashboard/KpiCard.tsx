// src/components/dashboard/KpiCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import React from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import type { LucideIcon } from "lucide-react";

export interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtext?: React.ReactNode;
  chartData?: { value: number }[];
  color?: string;
  destaque?: boolean;
  changePercentage?: number;
  surface?: "default" | "overview";
}

export function KpiCard({
  title,
  value,
  icon: Icon,
  subtext,
  chartData,
  color = "#eab308",
  destaque = false,
  changePercentage,
  surface = "default",
}: KpiCardProps) {
  const isPositive = (changePercentage ?? 0) >= 0;
  const showChange = changePercentage !== undefined && changePercentage !== null;
  const isOverview = surface === "overview";

  const cardClass = isOverview
    ? `overflow-hidden flex flex-col h-[116px] sm:h-[128px] relative py-0 gap-1 border-0 shadow-sm ${destaque ? "bg-[#20211f] text-white" : "bg-white text-[#20211f]"}`
    : `overflow-hidden flex flex-col h-[140px] sm:h-[180px] relative py-2 gap-2 sm:gap-3 ${destaque ? "bg-linear-to-br from-yellow-400 via-yellow-500 to-chart-1 border-chart-1 shadow-lg shadow-yellow-500/50" : ""}`;

  return (
    <Card className={cardClass}>
      {isOverview && destaque && (
        <div className="pointer-events-none absolute inset-0 opacity-30 [background:linear-gradient(135deg,transparent_0%,transparent_34%,#fdbf08_35%,transparent_36%,transparent_63%,#fdbf08_64%,transparent_65%)]" />
      )}
      <CardHeader className={`relative flex flex-row items-center justify-between space-y-0 pb-0 ${isOverview ? "px-4 pt-4" : "pt-3 sm:pt-4 px-3 sm:px-4"}`}>
        <CardTitle className={`${isOverview ? "text-xs sm:text-sm" : "text-sm sm:text-base"} whitespace-nowrap font-medium ${destaque ? "text-white/80" : isOverview ? "text-neutral-500" : "text-muted-foreground"}`}>{title}</CardTitle>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {showChange && (
            <span
              className={`text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded-full ${destaque
                ? isPositive
                  ? "bg-white/95 text-emerald-700 dark:bg-zinc-800"
                  : "bg-white/95 text-red-600 dark:bg-zinc-800"
                : isPositive
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
                }`}
            >
              {isPositive ? "+" : ""}
              {changePercentage.toFixed(1)}%
            </span>
          )}
          <Icon className={`h-3.5 w-3.5 sm:h-5 sm:w-5 hidden sm:block ${destaque ? "text-[#fdbf08]" : isOverview ? "text-[#fdbf08]" : "text-muted-foreground"}`} />
        </div>
      </CardHeader>
      <CardContent className={`relative ${isOverview ? "px-4 pb-0 pt-1" : "px-3 sm:px-4 pb-0"}`}>
        <span className={`${isOverview ? "text-2xl sm:text-[28px]" : "text-xl sm:text-3xl"} font-bold ${destaque && "text-white"}`}>{value}</span>
        {subtext && <p className={`text-[10px] sm:text-xs mt-0.5 ${destaque ? "text-white/80" : isOverview ? "text-neutral-500" : "text-muted-foreground"}`}>{subtext}</p>}
      </CardContent>
      {/* Área do Gráfico colada na base */}
      <div className={`absolute bottom-1 sm:bottom-2 w-full ${isOverview ? "h-7 sm:h-8 opacity-70" : "h-10 sm:h-12"}`}>
        {chartData && chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={destaque ? "#ffffff" : color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: destaque ? "#ffffff" : color }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className={`w-full h-full border-t ${destaque ? "border-white/30" : "border-gray-100"}`}></div>
        )}
      </div>
    </Card>
  );
}
