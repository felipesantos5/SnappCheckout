// src/components/checkout/OrderBump.tsx
import React from "react";

// Tipagem para um único bump
interface Bump {
  _id: string;
  name: string;
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
  if (!bumps || bumps.length === 0) {
    return null; // Não renderiza nada se não houver bumps
  }

  return (
    <>
      {/* Renderiza um bloco para CADA bump */}
      {bumps.map((bump) => (
        <div key={bump._id} className="w-full mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-start">
            <input
              id={`order-bump-${bump._id}`}
              type="checkbox"
              className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
              checked={selectedBumps.includes(bump._id)}
              onChange={() => onToggleBump(bump._id)}
            />
            <div className="ml-3 text-sm">
              <label htmlFor={`order-bump-${bump._id}`} className="font-medium text-gray-800">
                {bump.name}
              </label>

              <div className="flex items-center gap-2 mt-1">
                {bump.originalPriceInCents && bump.originalPriceInCents > bump.priceInCents && (
                  <>
                    <span className="text-sm text-gray-500 line-through">{formatCurrency(bump.originalPriceInCents, currency)}</span>
                    {bump.discountPercentage && (
                      <span className="text-xs font-semibold text-white bg-green-600 px-2 py-0.5 rounded">{bump.discountPercentage}% OFF</span>
                    )}
                  </>
                )}
                <span className="font-bold text-green-600">{formatCurrency(bump.priceInCents, currency)}</span>
              </div>

              <div className="flex items-center mt-2">
                {bump.imageUrl && <img src={bump.imageUrl} alt={bump.name} className="w-14 h-auto rounded" />}
                <p className="ml-3 text-xs text-gray-600">{bump.description}</p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
};
