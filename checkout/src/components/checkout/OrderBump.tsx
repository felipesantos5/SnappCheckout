// src/components/checkout/OrderBump.tsx
import React, { memo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { useTheme } from "../../context/ThemeContext";
import { useTranslation } from "../../i18n/I18nContext";
import { formatCurrency } from "../../helper/formatCurrency";
import { OptimizedImage } from "../ui/OptimizedImage";

// Tipagem para um único bump
interface Bump {
  _id: string;
  name: string;
  headline?: string;
  imageUrl?: string;
  description?: string;
  priceInCents: number;
  originalPriceInCents?: number;
  discountPercentage?: number;
}

interface OrderBumpProps {
  bumps: Bump[]; // A lista de bumps vinda da API
  selectedBumps: string[]; // A lista de IDs selecionados
  onToggleBump: (bumpId: string) => void; // Função para (des)marcar
  currency: string;
}

// Componente individual de bump memoizado
const BumpItem = memo<{ bump: Bump; isSelected: boolean; onToggle: () => void; currency: string; primary: string; t: any }>(
  ({ bump, isSelected, onToggle, currency, primary, t }) => {
    const { textColor } = useTheme();

    const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
    }, []);

    return (
      <div
        onClick={onToggle}
        className={`w-full mt-6 p-5 pb-4 rounded-lg border-2 transition-all cursor-pointer ${isSelected ? "border-green-500 shadow-md" : "border-gray-300 hover:border-gray-400 hover:shadow-sm border-dashed"
          }`}
      >
        <div className="flex items-start gap-2">
          {/* Conteúdo */}
          <div className="flex-1 gap-2 min-w-0">
            {/* Headline */}
            <div className="flex justify-between gap-1 items-start">
              <h3 className="text-base font-bold mb-4 wrap-break-word flex-1 min-w-0" style={{ color: primary }}>
                {bump.headline ? bump.headline : bump.name}
              </h3>
            </div>
            <div className="flex justify-between gap-3">
              {bump.imageUrl && (
                <div className="flex-none">
                  <OptimizedImage src={bump.imageUrl} alt={bump.name} className="w-16 h-16 border border-gray-200" width={80} aspectRatio="1/1" />
                </div>
              )}
              <div className="flex flex-col gap-1.5 flex-1 min-w-0" style={{ color: textColor }}>
                {!bump.headline ? (
                  <></>
                ) : (
                  <label htmlFor={`order-bump-${bump._id}`} className="font-semibold text-[13px] cursor-pointer block wrap-break-word">
                    {bump.name}
                  </label>
                )}
                {bump.description && (
                  <div className="text-xs mb-3 wrap-break-word markdown-content">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-1">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="text-sm">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        em: ({ children }) => <em className="italic">{children}</em>,
                      }}
                    >
                      {bump.description}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
            <div>
              <span className="text-lg font-bold text-green-600 shrink-0">{formatCurrency(bump.priceInCents, currency)}</span>
            </div>
            <div className="border-dashed border-t-2 mt-2 pt-3 orderbump-checkbox">
              <div className="flex gap-2 items-center ml-4">
                <input
                  id={`order-bump-${bump._id}`}
                  type="checkbox"
                  className="h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500 cursor-pointer"
                  checked={isSelected}
                  onChange={onToggle}
                  onClick={handleCheckboxClick}
                />
                <p className="font-medium" style={{ color: textColor }}>
                  {t.orderBump.action}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

BumpItem.displayName = "BumpItem";

export const OrderBump = memo<OrderBumpProps>(({ bumps, selectedBumps, onToggleBump, currency }) => {
  const { primary } = useTheme();
  const { t } = useTranslation();

  if (!bumps || bumps.length === 0) {
    return null;
  }

  return (
    <>
      {bumps.map((bump) => (
        <BumpItem
          key={bump._id}
          bump={bump}
          isSelected={selectedBumps.includes(bump._id)}
          onToggle={() => onToggleBump(bump._id)}
          currency={currency}
          primary={primary}
          t={t}
        />
      ))}
    </>
  );
});

OrderBump.displayName = "OrderBump";
