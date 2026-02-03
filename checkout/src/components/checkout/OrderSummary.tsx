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
}

export const OrderSummary = memo<OrderSummaryProps>(
  ({ productName, productImageUrl, currency, totalAmountInCents, basePriceInCents, originalPriceInCents }) => {
    const { primary, backgroundColor, textColor } = useTheme();
    const { t } = useTranslation();

    const totalSmallText = useMemo(() => formatCurrency(totalAmountInCents, currency), [totalAmountInCents, currency]);

    return (
      <div
        className="w-full rounded-lg shadow border p-4"
        style={{ backgroundColor: backgroundColor, borderColor: `${textColor}20` }}
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
            <h3 className="text-sm font-semibold line-clamp-2" style={{ color: textColor }}>
              {productName}
            </h3>
            <div className="flex items-center justify-end">
              <div className="text-right">
                <p className="text-xs" style={{ color: textColor, opacity: 0.6 }}>
                  {t.orderSummary.total}
                </p>
                <p className="text-lg font-bold" style={{ color: primary }}>
                  {totalSmallText}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

OrderSummary.displayName = "OrderSummary";
