import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarClock, RefreshCw, ShoppingBag } from "lucide-react";

type SubscriptionInterval = "day" | "week" | "month" | "year" | string;

type SaleTypeBadgeSale = {
  createdAt?: string;
  stripeSubscriptionId?: string;
  subscriptionCycle?: number | null;
  offerId?: {
    paymentType?: "one_time" | "subscription" | string;
    subscriptionInterval?: SubscriptionInterval;
  } | null;
};

interface SaleTypeBadgeProps {
  sale: SaleTypeBadgeSale;
  compact?: boolean;
}

const intervalLabel: Record<string, string> = {
  day: "Diário",
  week: "Semanal",
  month: "Mensal",
  year: "Anual",
};

const cycleUnitLabel: Record<string, { singular: string; feminine?: boolean }> = {
  day: { singular: "dia" },
  week: { singular: "semana", feminine: true },
  month: { singular: "mes" },
  year: { singular: "ano" },
};

const formatPaidAt = (date?: string) => {
  if (!date) return "Data não informada";

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  } catch {
    return "Data inválida";
  }
};

const getSubscriptionCycleLabel = (cycle: number, interval?: SubscriptionInterval) => {
  const unit = cycleUnitLabel[interval || ""];

  if (!unit) {
    return `${cycle}ª cobrança`;
  }

  const ordinal = unit.feminine ? `${cycle}ª` : `${cycle}º`;
  return `${ordinal} ${unit.singular}`;
};

export function SaleTypeBadge({ sale, compact = false }: SaleTypeBadgeProps) {
  const isSubscription = Boolean(sale.stripeSubscriptionId) || sale.offerId?.paymentType === "subscription";
  const interval = sale.offerId?.subscriptionInterval;
  const cycle = sale.subscriptionCycle || 1;

  if (isSubscription) {
    const periodicity = intervalLabel[interval || ""] || "Recorrente";
    const cycleLabel = getSubscriptionCycleLabel(cycle, interval);

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="h-5 cursor-help border-teal-200 bg-teal-50 px-1.5 text-[10px] font-semibold text-teal-700 hover:bg-teal-50"
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              {compact ? "Plano" : "Plano"}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="w-56 border bg-card p-3 text-card-foreground shadow-lg">
            <div className="space-y-2">
              <div className="flex items-center gap-2 border-b pb-2 text-xs font-semibold">
                <CalendarClock className="h-3.5 w-3.5 text-teal-600" />
                Plano {periodicity.toLowerCase()}
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Pagamento</span>
                  <span className="font-medium">{cycleLabel}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Periodicidade</span>
                  <span className="font-medium">{periodicity}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Pago em</span>
                  <span className="text-right font-medium">{formatPaidAt(sale.createdAt)}</span>
                </div>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className="h-5 cursor-help px-1.5 text-[10px] font-semibold">
            <ShoppingBag className="mr-1 h-3 w-3" />
            {compact ? "Padrao" : "Padrao"}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="w-52 border bg-card p-3 text-card-foreground shadow-lg">
          <div className="space-y-1.5 text-xs">
            <div className="font-semibold">Venda direta</div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Pagamento</span>
              <span className="font-medium">Único</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Pago em</span>
              <span className="text-right font-medium">{formatPaidAt(sale.createdAt)}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
