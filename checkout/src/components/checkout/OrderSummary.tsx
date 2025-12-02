import { useState, memo, useCallback, useMemo } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDown } from "lucide-react";
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
  quantity: number;
  setQuantity: (qty: number) => void;
  originalPriceInCents?: number;
  discountPercentage?: number;
}

export const OrderSummary = memo<OrderSummaryProps>(
  ({ productName, productImageUrl, currency, totalAmountInCents, basePriceInCents, quantity, setQuantity, originalPriceInCents }) => {
    const [isOpen, setIsOpen] = useState(false);
    // Puxamos backgroundColor e textColor
    const { primary, backgroundColor, textColor } = useTheme();
    const { t } = useTranslation();

    const subtotal = useMemo(() => basePriceInCents * quantity, [basePriceInCents, quantity]);
    const subtotalOldPrice = useMemo(() => (originalPriceInCents || 0) * quantity, [originalPriceInCents, quantity]);
    const discountAmount = useMemo(
      () => (originalPriceInCents ? (originalPriceInCents - basePriceInCents) * quantity : 0),
      [originalPriceInCents, basePriceInCents, quantity]
    );
    const bumpsTotal = useMemo(() => totalAmountInCents - subtotal, [totalAmountInCents, subtotal]);
    const totalSmallText = useMemo(() => formatCurrency(totalAmountInCents, currency), [totalAmountInCents, currency]);

    const handleIncrease = useCallback(() => {
      setQuantity(quantity + 1);
    }, [quantity, setQuantity]);

    const handleDecrease = useCallback(() => {
      if (quantity > 1) {
        setQuantity(quantity - 1);
      }
    }, [quantity, setQuantity]);

    return (
      <Collapsible.Root
        open={isOpen}
        onOpenChange={setIsOpen}
        className="w-full rounded-lg shadow border"
        // Cor de fundo e texto dinâmicas. Borda com opacidade para funcionar em dark mode
        style={{ backgroundColor: backgroundColor, borderColor: `${textColor}20` }}
      >
        {/* Produto sempre visível (collapsed/expanded) */}
        <div className="p-4">
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
              <div className="mt-1 flex items-center justify-between">
                <div className="flex flex-col">
                  {originalPriceInCents && originalPriceInCents > basePriceInCents && (
                    <span className="text-xs line-through" style={{ color: textColor, opacity: 0.6 }}>
                      {formatCurrency(originalPriceInCents, currency)}
                    </span>
                  )}
                  {/* Preço em destaque usa cor Primária */}
                  <span className="text-base font-bold" style={{ color: primary }}>
                    {formatCurrency(basePriceInCents, currency)}
                  </span>
                </div>
                {!isOpen && (
                  <div className="text-right">
                    <p className="text-xs" style={{ color: textColor, opacity: 0.6 }}>
                      {t.orderSummary.total}
                    </p>
                    <p className="text-lg font-bold" style={{ color: primary }}>
                      {totalSmallText}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Collapsible.Trigger
            className="w-full mt-3 pt-3 border-t flex items-center justify-center gap-2 cursor-pointer group"
            style={{ borderColor: `${textColor}20` }}
          >
            <span className="text-sm font-medium group-hover:underline" style={{ color: primary }}>
              {isOpen ? t.orderSummary.hideTitle : t.orderSummary.title}
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-300 ease-in-out ${isOpen ? "rotate-180" : ""}`}
              style={{ color: primary }}
            />
          </Collapsible.Trigger>
        </div>

        {/* Detalhes expandíveis */}
        <Collapsible.Content className="overflow-hidden data-[state=closed]:animate-slideUp data-[state=open]:animate-slideDown">
          <div className="px-4 pb-4 border-t" style={{ borderColor: `${textColor}20` }}>
            {/* Seletor de quantidade */}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: textColor }}>
                {t.product.quantity}
              </span>
              <div className="flex items-center border rounded" style={{ borderColor: `${textColor}40` }}>
                <button
                  type="button"
                  className="px-3 py-1.5 hover:bg-black/5 disabled:opacity-50"
                  style={{ color: textColor }}
                  onClick={handleDecrease}
                  disabled={quantity <= 1}
                >
                  —
                </button>
                <span className="px-4 py-1.5 border-l border-r font-medium" style={{ color: textColor, borderColor: `${textColor}40` }}>
                  {quantity}
                </span>
                <button type="button" className="px-3 py-1.5 hover:bg-black/5" style={{ color: textColor }} onClick={handleIncrease}>
                  +
                </button>
              </div>
            </div>

            {/* Resumo de preços */}
            <div className="mt-4 border-t pt-4 text-sm space-y-1" style={{ borderColor: `${textColor}20` }}>
              {originalPriceInCents && originalPriceInCents > basePriceInCents ? (
                <>
                  <div className="flex justify-between" style={{ color: textColor, opacity: 0.8 }}>
                    <span>{t.orderSummary.originalSubtotal}</span>
                    <span className="line-through opacity-60">{formatCurrency(subtotalOldPrice, currency)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-green-600">
                    <span>{t.orderSummary.discount}</span>
                    <span>- {formatCurrency(discountAmount, currency)}</span>
                  </div>
                  <div className="flex justify-between font-medium" style={{ color: textColor }}>
                    <span>{t.orderSummary.subtotalWithDiscount}</span>
                    <span>{formatCurrency(subtotal, currency)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between" style={{ color: textColor, opacity: 0.8 }}>
                  <span>{t.orderSummary.subtotal}</span>
                  <span>{formatCurrency(subtotal, currency)}</span>
                </div>
              )}

              {bumpsTotal > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>{t.orderSummary.extraProduct}</span>
                  <span>+ {formatCurrency(bumpsTotal, currency)}</span>
                </div>
              )}

              <div className="flex justify-between mt-2 pt-2 border-t text-base font-bold" style={{ borderColor: `${textColor}20` }}>
                <span style={{ color: textColor }}>{t.orderSummary.total}</span>
                <span style={{ color: primary }}>{formatCurrency(totalAmountInCents, currency)}</span>
              </div>
            </div>
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    );
  }
);

OrderSummary.displayName = "OrderSummary";
