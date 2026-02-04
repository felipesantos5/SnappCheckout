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
}: KpiCardProps) {
  const isPositive = (changePercentage ?? 0) >= 0;
  const showChange = changePercentage !== undefined && changePercentage !== null;

  return (
    <Card
      className={`overflow-hidden flex flex-col h-[140px] sm:h-[180px] relative py-2 gap-2 sm:gap-3 ${destaque ? "bg-linear-to-br from-yellow-400 via-yellow-500 to-chart-1 border-chart-1 shadow-lg shadow-yellow-500/50" : ""
        }`}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 pt-3 sm:pt-4 px-3 sm:px-4">
        <CardTitle className={`text-sm sm:text-base whitespace-nowrap font-medium ${destaque ? "text-white" : "text-muted-foreground"}`}>{title}</CardTitle>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {showChange && (
            <span
              className={`text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded-full ${destaque
                ? isPositive
                  ? "bg-white text-yellow-500 dark:bg-zinc-800"
                  : "bg-white text-yellow-500 dark:bg-zinc-800"
                : isPositive
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                }`}
            >
              {isPositive ? "+" : ""}
              {changePercentage.toFixed(1)}%
            </span>
          )}
          <Icon className={`h-3.5 w-3.5 sm:h-5 sm:w-5 hidden sm:block ${destaque ? "text-white" : "text-muted-foreground"}`} />
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-4 pb-0">
        <span className={`text-xl sm:text-3xl font-bold ${destaque && "text-white"}`}>{value}</span>
        {subtext && <p className={`text-[10px] sm:text-xs mt-0.5 ${destaque ? "text-white/90" : "text-muted-foreground"}`}>{subtext}</p>}
      </CardContent>
      {/* Área do Gráfico colada na base */}
      <div className="absolute bottom-1 sm:bottom-2 w-full h-10 sm:h-14">
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
