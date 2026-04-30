import { describe, expect, it, beforeEach } from "vitest";
import { getCookie } from "../getCookie";

describe("Logica de Cookies - getCookie", () => {
  beforeEach(() => {
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "",
    });
  });

  it("retorna valor de cookie existente", () => {
    document.cookie = "token=abc123; path=/";
    expect(getCookie("token")).toBe("abc123");
  });

  it("retorna null para cookie inexistente", () => {
    document.cookie = "token=abc123";
    expect(getCookie("outro")).toBeNull();
  });

  it("retorna cookie correto quando ha multiplos cookies", () => {
    document.cookie = "a=1; b=2; c=3";
    expect(getCookie("b")).toBe("2");
  });

  it("retorna null para string vazia", () => {
    expect(getCookie("qualquer")).toBeNull();
  });
});
