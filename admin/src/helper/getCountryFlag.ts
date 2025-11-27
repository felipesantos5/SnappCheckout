/**
 * Converte um código de país ISO (2 letras) em emoji de bandeira
 * @param countryCode - Código do país em formato ISO 3166-1 alpha-2 (ex: "BR", "US", "FR")
 * @returns Emoji da bandeira do país
 *
 * @example
 * getCountryFlag("BR") // 🇧🇷
 * getCountryFlag("US") // 🇺🇸
 * getCountryFlag("FR") // 🇫🇷
 */
export function getCountryFlag(countryCode?: string): string {
  if (!countryCode || countryCode.length !== 2) {
    return "🌐"; // Emoji de globo como fallback
  }

  // Converte o código do país em emoji de bandeira
  // Cada letra é convertida para seu equivalente "Regional Indicator Symbol"
  // A = U+1F1E6, B = U+1F1E7, ... Z = U+1F1FF
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));

  return String.fromCodePoint(...codePoints);
}

/**
 * Retorna o nome do país por extenso (opcional, para tooltip)
 * @param countryCode - Código do país em formato ISO 3166-1 alpha-2
 * @returns Nome do país em português
 */
export function getCountryName(countryCode?: string): string {
  const countryNames: Record<string, string> = {
    BR: "Brasil",
    US: "Estados Unidos",
    FR: "França",
    DE: "Alemanha",
    GB: "Reino Unido",
    IT: "Itália",
    ES: "Espanha",
    PT: "Portugal",
    CA: "Canadá",
    MX: "México",
    AR: "Argentina",
    CL: "Chile",
    CO: "Colômbia",
    PE: "Peru",
    VE: "Venezuela",
    UY: "Uruguai",
    PY: "Paraguai",
    BO: "Bolívia",
    EC: "Equador",
    JP: "Japão",
    CN: "China",
    IN: "Índia",
    AU: "Austrália",
    NZ: "Nova Zelândia",
    ZA: "África do Sul",
    NG: "Nigéria",
    EG: "Egito",
    KE: "Quênia",
    RU: "Rússia",
    TR: "Turquia",
    SA: "Arábia Saudita",
    AE: "Emirados Árabes",
    IL: "Israel",
    KR: "Coreia do Sul",
    TH: "Tailândia",
    VN: "Vietnã",
    ID: "Indonésia",
    MY: "Malásia",
    SG: "Singapura",
    PH: "Filipinas",
  };

  return countryNames[countryCode?.toUpperCase() || ""] || countryCode || "Desconhecido";
}
