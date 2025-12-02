// src/context/ThemeContext.tsx
import { createContext, useContext } from "react";

export interface ThemeColors {
  primary: string;
  button: string;
  buttonForeground: string;
  backgroundColor: string; // NOVO
  textColor: string; // NOVO
}

// Valores padrão caso algo falhe
const defaultTheme: ThemeColors = {
  primary: "#000000",
  button: "#2563eb",
  buttonForeground: "#ffffff",
  backgroundColor: "#ffffff", // NOVO - Padrão branco
  textColor: "#374151", // NOVO - Padrão cinza escuro (gray-700)
};

export const ThemeContext = createContext<ThemeColors>(defaultTheme);

export const useTheme = () => {
  return useContext(ThemeContext);
};
