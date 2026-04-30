import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeContext, type ThemeColors } from "../context/ThemeContext";
import { I18nProvider } from "../i18n/I18nContext";
import type { Language } from "../i18n/translations";

const theme: ThemeColors = {
  primary: "#0f766e",
  button: "#111827",
  buttonForeground: "#ffffff",
  backgroundColor: "#ffffff",
  foregroundColor: "#111827",
  textColor: "#111827",
};

export const renderCheckout = (ui: React.ReactElement, language: Language = "pt") =>
  render(
    <MemoryRouter>
      <I18nProvider language={language}>
        <ThemeContext.Provider value={theme}>{ui}</ThemeContext.Provider>
      </I18nProvider>
    </MemoryRouter>,
  );

export const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json", ...init.headers },
    ...init,
  });
