import React, { useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDown, ShoppingCart } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

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

const formatCurrency = (amountInCents: number, currency: string) => {
  const amount = amountInCents / 100;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency,
  }).format(amount);
};

export const OrderSummary: React.FC<OrderSummaryProps> = ({
  productName,
  productImageUrl,
  currency,
  totalAmountInCents,
  basePriceInCents,
  quantity,
  setQuantity,
  originalPriceInCents,
  discountPercentage,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { primary } = useTheme();

  const subtotal = basePriceInCents * quantity;
  const bumpsTotal = totalAmountInCents - subtotal;
  const totalSmallText = formatCurrency(totalAmountInCents, currency);

  const handleIncrease = () => {
    setQuantity(quantity + 1);
  };
  const handleDecrease = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  return (
    <Collapsible.Root open={isOpen} onOpenChange={setIsOpen} className="w-full bg-gray-50 rounded-lg shadow">
      <Collapsible.Trigger className="w-full p-4 flex justify-between items-center cursor-pointer">
        <div className="flex items-center">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <span className="text-md font-semibold text-primary ml-2">{isOpen ? "Ocultar resumo do pedido" : "Resumo do pedido"}</span>
          <ChevronDown className={`h-5 w-5 text-primary ml-1 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>

        {!isOpen && (
          <div className="text-right">
            <p className="text-md font-semibold" style={{ color: primary }}>
              {totalSmallText}
            </p>
          </div>
        )}
      </Collapsible.Trigger>

      <Collapsible.Content className="p-4 border-t border-gray-200">
        <div className="flex items-center">
          {productImageUrl && <img src={productImageUrl} alt={productName} className="w-20 h-20 rounded-md object-cover border" />}
          <div className="ml-4 flex-1">
            <h3 className="text-sm font-medium text-gray-800">{productName}</h3>
            <div className="flex items-center justify-between mt-1">
              <div className="flex flex-col">
                {originalPriceInCents && originalPriceInCents > basePriceInCents && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 line-through">{formatCurrency(originalPriceInCents, currency)}</span>
                    {discountPercentage && (
                      <span className="text-xs font-semibold text-white bg-green-600 px-2 py-0.5 rounded">{discountPercentage}% OFF</span>
                    )}
                  </div>
                )}
                <span className="text-lg font-bold text-gray-900">{formatCurrency(basePriceInCents, currency)}</span>
              </div>

              <div className="flex items-center border rounded">
                <button type="button" className="px-2 py-1 text-gray-600 disabled:opacity-50" onClick={handleDecrease} disabled={quantity <= 1}>
                  —
                </button>
                <span className="px-3 py-1 border-l border-r">{quantity}</span>
                <button type="button" className="px-2 py-1 text-gray-600" onClick={handleIncrease}>
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-gray-200 pt-4 text-sm text-gray-600 space-y-1">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal, currency)}</span>
          </div>

          {bumpsTotal > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Order Bumps</span>
              <span>+ {formatCurrency(bumpsTotal, currency)}</span>
            </div>
          )}

          <div className="flex justify-between mt-2 pt-2 border-t border-gray-300 text-base font-bold text-gray-900">
            <span>Total</span>
            <span style={{ color: primary }}>{formatCurrency(totalAmountInCents, currency)}</span>
          </div>
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
};
