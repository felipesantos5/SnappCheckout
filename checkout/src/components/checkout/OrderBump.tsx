// src/components/checkout/OrderBump.tsx
import React from "react";
import { useTheme } from "../../context/ThemeContext";
import { useTranslation } from "../../i18n/I18nContext";
import { formatCurrency } from "../../helper/formatCurrency";

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

export const OrderBump: React.FC<OrderBumpProps> = ({ bumps, selectedBumps, onToggleBump, currency }) => {
  const { primary } = useTheme();
  const { t } = useTranslation();

  if (!bumps || bumps.length === 0) {
    return null;
  }

  return (
    <>
      {bumps.map((bump) => {
        const isSelected = selectedBumps.includes(bump._id);

        return (
          <div
            key={bump._id}
            onClick={() => onToggleBump(bump._id)}
            className={`w-full mt-6 p-5 pb-4 rounded-lg border-2 transition-all cursor-pointer ${
              isSelected ? "border-green-500 bg-green-50  shadow-md" : "border-gray-300 bg-white hover:border-gray-400 hover:shadow-sm border-dashed"
            }`}
          >
            <div className="flex items-start gap-2">
              {/* Imagem */}

              {/* Conteúdo */}
              <div className="flex-1 gap-2 min-w-0">
                {/* Headline */}
                <div className="flex justify-between gap-1 items-start">
                  <h3 className="text-base font-bold mb-5 wrap-break-word flex-1 min-w-0" style={{ color: primary }}>
                    {bump.headline ? bump.headline : bump.name}
                  </h3>
                </div>
                <div className="flex justify-between gap-3">
                  {bump.imageUrl && (
                    <div className="flex-none">
                      <img src={bump.imageUrl} alt={bump.name} className="w-20 h-20 rounded-lg object-cover border border-gray-200 " />
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    {!bump.headline ? (
                      <></>
                    ) : (
                      <label
                        htmlFor={`order-bump-${bump._id}`}
                        className="font-semibold text-[13px] text-gray-800 cursor-pointer block wrap-break-word"
                      >
                        {bump.name}
                      </label>
                    )}
                    {bump.description && <p className="text-sm text-gray-600 mb-3 wrap-break-word whitespace-normal">{bump.description}</p>}
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
                      onChange={() => onToggleBump(bump._id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <p className="font-medium">{t.orderBump.action}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
};
