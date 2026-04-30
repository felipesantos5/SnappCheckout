import { memo, useMemo } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useTranslation } from "../../i18n/I18nContext";
import { formatCurrency } from "../../helper/formatCurrency";
import { OptimizedImage } from "../ui/OptimizedImage";

interface OrderSummaryProps {
  productName: string;
  productImageUrl?: string;
  currency: string;
  totalAmountInCents: number;
  basePriceInCents: number;
  originalPriceInCents?: number;
  discountPercentage?: number;
  paymentType?: "one_time" | "subscription";
  subscriptionInterval?: "day" | "week" | "month" | "year";
}

export const OrderSummary = memo<OrderSummaryProps>(
  ({ productName, productImageUrl, currency, totalAmountInCents, basePriceInCents, originalPriceInCents, paymentType, subscriptionInterval }) => {
    const { textColor, backgroundColor, foregroundColor } = useTheme();
    const { t } = useTranslation();

    const totalSmallText = useMemo(() => formatCurrency(totalAmountInCents, currency), [totalAmountInCents, currency]);
    const originalPriceText = useMemo(
      () => (originalPriceInCents ? formatCurrency(originalPriceInCents, currency) : null),
      [originalPriceInCents, currency]
    );

    return (
      <div
        className="w-full rounded-lg shadow border p-4"
        style={{ backgroundColor: backgroundColor, borderColor: `${foregroundColor}20` }}
      >
        <div className="flex items-start gap-3">
          {productImageUrl && (
            <OptimizedImage
              src={productImageUrl}
              alt={productName}
              className="w-14 h-14 shrink-0 rounded border object-cover"
              width={64}
              aspectRatio="1/1"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold line-clamp-2" style={{ color: foregroundColor }}>
                {productName}
              </h3>
              {paymentType === "subscription" && subscriptionInterval && (
                <span
                  className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: `${textColor}15`, color: textColor }}
                >
                  {t.orderSummary.subscriptionBadge}
                </span>
              )}
            </div>
            <div className="flex items-center justify-end">
              <div className="text-right">
                <p className="text-xs" style={{ color: foregroundColor, opacity: 0.6 }}>
                  {t.orderSummary.total}
                </p>
                <div className="flex items-center gap-2 justify-end">
                  {originalPriceText && (
                    <p className="text-sm line-through" style={{ color: foregroundColor, opacity: 0.4 }}>
                      {originalPriceText}
                    </p>
                  )}
                  <p className="text-lg font-bold" style={{ color: textColor }}>
                    {totalSmallText}
                    {paymentType === "subscription" && subscriptionInterval && (
                      <span className="text-xs font-medium" style={{ opacity: 0.7 }}>
                        {t.orderSummary.interval[subscriptionInterval]}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

OrderSummary.displayName = "OrderSummary";
