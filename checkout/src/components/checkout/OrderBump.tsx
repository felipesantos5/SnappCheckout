// src/components/checkout/OrderBump.tsx
import React from "react";
import { useTheme } from "../../context/ThemeContext";

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

// Helper de formatação
const formatCurrency = (amountInCents: number, currency: string) => {
  const amount = amountInCents / 100;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency,
  }).format(amount);
};

export const OrderBump: React.FC<OrderBumpProps> = ({ bumps, selectedBumps, onToggleBump, currency }) => {
  const { primary } = useTheme();

  if (!bumps || bumps.length === 0) {
    return null; // Não renderiza nada se não houver bumps
  }

  return (
    <>
      {/* Renderiza um bloco para CADA bump */}
      {bumps.map((bump) => {
        const isSelected = selectedBumps.includes(bump._id);

        return (
          <div
            key={bump._id}
            onClick={() => onToggleBump(bump._id)}
            className={`w-full mt-6 p-5 rounded-lg border-2 transition-all cursor-pointer ${
              isSelected ? "border-green-500 bg-green-50  shadow-md" : "border-gray-300 bg-white hover:border-gray-400 hover:shadow-sm border-dashed"
            }`}
          >
            <div className="flex items-start gap-4">
              {/* Checkbox */}
              <div className="flex shrink-0 pt-1">
                <input
                  id={`order-bump-${bump._id}`}
                  type="checkbox"
                  className="h-3 w-3 text-green-600 border-gray-300 rounded focus:ring-green-500 cursor-pointer"
                  checked={isSelected}
                  onChange={() => onToggleBump(bump._id)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Imagem */}

              {/* Conteúdo */}
              <div className="flex-1 gap-2">
                {/* Headline */}
                <div className="flex justify-between">
                  <h3 className="text-lg font-bold mb-2" style={{ color: primary }}>
                    {bump.headline ? bump.headline : bump.name}
                  </h3>
                  <span className="text-2xl font-bold text-green-600">{formatCurrency(bump.priceInCents, currency)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  {bump.imageUrl && (
                    <div className="flex-none">
                      <img src={bump.imageUrl} alt={bump.name} className="w-24 h-24 rounded-lg object-cover border border-gray-200 " />
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`order-bump-${bump._id}`} className="font-semibold text-gray-800 cursor-pointer block mb-1">
                      {bump.name}
                    </label>
                    {bump.description && <p className="text-sm text-gray-600 mb-3">{bump.description}</p>}
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
