// src/context/ThemeContext.tsx
import { createContext, useContext } from "react";

export interface ThemeColors {
  primary: string;
  button: string;
  buttonForeground: string;
  backgroundColor: string;
  foregroundColor: string; // auto-computed from backgroundColor
  textColor: string; // cor do preço (customizável)
}

// Valores padrão caso algo falhe
const defaultTheme: ThemeColors = {
  primary: "#000000",
  button: "#2563eb",
  buttonForeground: "#ffffff",
  backgroundColor: "#ffffff",
  foregroundColor: "#000000",
  textColor: "#374151",
};

export const ThemeContext = createContext<ThemeColors>(defaultTheme);

export const useTheme = () => {
  return useContext(ThemeContext);
};
