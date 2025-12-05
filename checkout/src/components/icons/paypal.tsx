// src/components/icons/paypal.tsx
import React from "react";

export const PayPalIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ height: "24px", width: "auto" }} // Garante altura fixa
  >
    <path
      d="M20.067 8.086c-1.78 2.37-6.096 2.37-6.096 2.37h-2.19l-1.07 6.84h-3.52l1.62-10.28H14.1c1.99 0 3.39.23 4.16 1.07z"
      fill="#00214B" // Azul Escuro do texto "Pal"
    />
    <path
      d="M17.45 4.39C16.3 3.16 14.33 3.16 14.33 3.16H8.22L5.56 20.03h4.31l.9-5.74h2.23c4.19 0 6.8-2.07 6.8-6.19 0-1.88-.7-3.23-2.35-3.71z"
      fill="#003087" // Azul Médio do texto "Pay"
    />
    <path
      d="M8.22 3.16l-2.66 16.87h4.31l.9-5.74h2.23c4.19 0 6.8-2.07 6.8-6.19 0-4.12-2.61-6.19-6.8-6.19H8.22z"
      fill="#009cde" // Azul Claro do ícone "P"
      fillOpacity="0.2" // Dá o efeito de sobreposição
    />
    <path d="M8.22 3.16l-2.66 16.87h4.31l.67-4.23h1.79c3.35 0 5.44-1.66 5.44-4.95 0-3.3-2.09-4.95-5.44-4.95H8.22z" fill="#003087" />
  </svg>
);
