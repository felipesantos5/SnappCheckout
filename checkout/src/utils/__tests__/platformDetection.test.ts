import { describe, expect, it, vi, beforeEach } from "vitest";
import { detectPlatform, isMobile } from "../platformDetection";

describe("Deteccao de Plataforma", () => {
  const originalNavigator = navigator.userAgent;

  beforeEach(() => {
    Object.defineProperty(navigator, "userAgent", {
      writable: true,
      value: originalNavigator,
    });
    delete (window as any).MSStream;
  });

  it("detecta iOS pelo userAgent do iPhone", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
      writable: true,
    });
    expect(detectPlatform()).toBe("ios");
    expect(isMobile()).toBe(true);
  });

  it("detecta Android pelo userAgent", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Linux; Android 13; Pixel 7)",
      writable: true,
    });
    expect(detectPlatform()).toBe("android");
    expect(isMobile()).toBe(true);
  });

  it("detecta desktop para userAgent generico", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      writable: true,
    });
    expect(detectPlatform()).toBe("desktop");
    expect(isMobile()).toBe(false);
  });

  it("detecta iPad como iOS", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)",
      writable: true,
    });
    expect(detectPlatform()).toBe("ios");
  });
});
