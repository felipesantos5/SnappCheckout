import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarClock, RefreshCw, ShoppingBag, XCircle } from "lucide-react";

type SubscriptionInterval = "day" | "week" | "month" | "year" | string;

type SaleTypeBadgeSale = {
  createdAt?: string;
  stripeSubscriptionId?: string;
  subscriptionCycle?: number | null;
  subscriptionStatus?: "active" | "past_due" | "canceled" | "unpaid";
  isRenewalAttempt?: boolean;
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
  const isCanceled = sale.subscriptionStatus === "canceled";
  const isRenewal = Boolean(sale.isRenewalAttempt) && cycle >= 2;

  if (isSubscription) {
    const periodicity = intervalLabel[interval || ""] || "Recorrente";
    const cycleLabel = getSubscriptionCycleLabel(cycle, interval);

    if (isCanceled) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="h-5 cursor-help border-gray-200 bg-gray-50 px-1.5 text-[10px] font-semibold text-gray-500 hover:bg-gray-50"
              >
                <XCircle className="mr-1 h-3 w-3" />
                {compact ? "Cancelada" : "Cancelada"}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="w-52 border bg-card p-3 text-card-foreground shadow-lg">
              <div className="space-y-1.5 text-xs">
                <div className="font-semibold text-gray-600">Assinatura cancelada</div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Plano</span>
                  <span className="font-medium">{periodicity}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Cobrado em</span>
                  <span className="text-right font-medium">{formatPaidAt(sale.createdAt)}</span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    const badgeLabel = isRenewal ? "Renovação" : "Plano";
    const badgeClass = isRenewal
      ? "h-5 cursor-help border-blue-200 bg-blue-50 px-1.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-50"
      : "h-5 cursor-help border-teal-200 bg-teal-50 px-1.5 text-[10px] font-semibold text-teal-700 hover:bg-teal-50";
    const iconClass = isRenewal ? "h-3.5 w-3.5 text-blue-600" : "h-3.5 w-3.5 text-teal-600";

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={badgeClass}>
              <RefreshCw className="mr-1 h-3 w-3" />
              {compact ? badgeLabel : badgeLabel}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="w-56 border bg-card p-3 text-card-foreground shadow-lg">
            <div className="space-y-2">
              <div className="flex items-center gap-2 border-b pb-2 text-xs font-semibold">
                <CalendarClock className={iconClass} />
                {isRenewal ? `Renovação — plano ${periodicity.toLowerCase()}` : `Plano ${periodicity.toLowerCase()}`}
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
