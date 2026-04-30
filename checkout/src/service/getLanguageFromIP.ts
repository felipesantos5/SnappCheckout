import type { Language } from "../i18n/translations";

const countryToLanguage: Record<string, Language> = {
  // Português
  BR: "pt",
  PT: "pt",
  AO: "pt",
  MZ: "pt",
  CV: "pt",
  // Inglês
  US: "en",
  GB: "en",
  AU: "en",
  CA: "en",
  NZ: "en",
  IE: "en",
  ZA: "en",
  IN: "en",
  SG: "en",
  // Espanhol
  ES: "es",
  MX: "es",
  AR: "es",
  CO: "es",
  CL: "es",
  PE: "es",
  VE: "es",
  EC: "es",
  BO: "es",
  UY: "es",
  PY: "es",
  CR: "es",
  PA: "es",
  DO: "es",
  GT: "es",
  HN: "es",
  SV: "es",
  NI: "es",
  CU: "es",
  // Francês
  FR: "fr",
  BE: "fr",
  CH: "fr",
  LU: "fr",
  MC: "fr",
  CI: "fr",
  SN: "fr",
  CM: "fr",
  // Alemão
  DE: "de",
  AT: "de",
  // Italiano
  IT: "it",
  SM: "it",
};

export const getLanguageFromIP = async (): Promise<Language | null> => {
  try {
    const response = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;
    const data = await response.json();
    const countryCode: string = data.country_code;
    return countryToLanguage[countryCode] ?? null;
  } catch {
    return null;
  }
};
