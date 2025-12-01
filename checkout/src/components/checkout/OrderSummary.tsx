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
    const { primary } = useTheme();
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
      <Collapsible.Root open={isOpen} onOpenChange={setIsOpen} className="w-full bg-gray-50 rounded-lg shadow">
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
              <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">{productName}</h3>
              <div className="mt-1 flex items-center justify-between">
                <div className="flex flex-col">
                  {originalPriceInCents && originalPriceInCents > basePriceInCents && (
                    <span className="text-xs text-gray-500 line-through">{formatCurrency(originalPriceInCents, currency)}</span>
                  )}
                  <span className="text-base font-bold" style={{ color: primary }}>
                    {formatCurrency(basePriceInCents, currency)}
                  </span>
                </div>
                {!isOpen && (
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{t.orderSummary.total}</p>
                    <p className="text-lg font-bold" style={{ color: primary }}>
                      {totalSmallText}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Botão para expandir/colapsar detalhes */}
          <Collapsible.Trigger className="w-full mt-3 pt-3 border-t border-gray-200 flex items-center justify-center gap-2 cursor-pointer group">
            <span className="text-sm font-medium text-primary group-hover:underline">{isOpen ? t.orderSummary.hideTitle : t.orderSummary.title}</span>
            <ChevronDown className={`h-4 w-4 text-primary transition-transform duration-300 ease-in-out ${isOpen ? "rotate-180" : ""}`} />
          </Collapsible.Trigger>
        </div>

        {/* Detalhes expandíveis */}
        <Collapsible.Content className="overflow-hidden data-[state=closed]:animate-slideUp data-[state=open]:animate-slideDown">
          <div className="px-4 pb-4 border-t border-gray-200">
            {/* Seletor de quantidade */}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">{t.product.quantity}</span>
              <div className="flex items-center border rounded">
                <button
                  type="button"
                  className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                  onClick={handleDecrease}
                  disabled={quantity <= 1}
                >
                  —
                </button>
                <span className="px-4 py-1.5 border-l border-r font-medium">{quantity}</span>
                <button type="button" className="px-3 py-1.5 text-gray-600 hover:bg-gray-100" onClick={handleIncrease}>
                  +
                </button>
              </div>
            </div>

            {/* Resumo de preços */}
            <div className="mt-4 border-t border-gray-200 pt-4 text-sm text-gray-600 space-y-1">
              {originalPriceInCents && originalPriceInCents > basePriceInCents ? (
                <>
                  <div className="flex justify-between">
                    <span>{t.orderSummary.originalSubtotal}</span>
                    <span className="line-through text-gray-400">{formatCurrency(subtotalOldPrice, currency)}</span>
                  </div>
                  <div className="flex justify-between text-green-600 font-semibold">
                    <span>{t.orderSummary.discount}</span>
                    <span>- {formatCurrency(discountAmount, currency)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-gray-900">
                    <span>{t.orderSummary.subtotalWithDiscount}</span>
                    <span>{formatCurrency(subtotal, currency)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
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

              <div className="flex justify-between mt-2 pt-2 border-t border-gray-300 text-base font-bold text-gray-900">
                <span>{t.orderSummary.total}</span>
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
