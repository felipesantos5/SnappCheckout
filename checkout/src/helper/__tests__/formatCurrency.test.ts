import { describe, expect, it } from "vitest";
import { formatCurrency } from "../formatCurrency";

describe("Logica de Precos - formatCurrency", () => {
  it("formata BRL corretamente (centavos para reais)", () => {
    expect(formatCurrency(4990, "BRL")).toContain("49,90");
  });

  it("formata USD corretamente", () => {
    expect(formatCurrency(1999, "USD")).toContain("19.99");
  });

  it("formata EUR corretamente", () => {
    expect(formatCurrency(1050, "EUR")).toContain("10,50");
  });

  it("formata GBP corretamente", () => {
    expect(formatCurrency(2500, "GBP")).toContain("25.00");
  });

  it("trata moeda desconhecida com fallback pt-BR", () => {
    const result = formatCurrency(1000, "JPY");
    expect(result).toBeDefined();
  });

  it("formata zero centavos", () => {
    expect(formatCurrency(0, "BRL")).toContain("0,00");
  });

  it("formata valores altos corretamente", () => {
    const result = formatCurrency(99990, "BRL");
    expect(result).toContain("999,90");
  });

  it("aceita moeda em lowercase", () => {
    const result = formatCurrency(4990, "brl");
    expect(result).toContain("49,90");
  });
});
