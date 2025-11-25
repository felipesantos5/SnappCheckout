export const formatCurrency = (amountInCents: number, currency: string) => {
  const amount = amountInCents / 100;

  // Mapeamento de moedas para locales apropriados
  const localeMap: Record<string, string> = {
    BRL: "pt-BR",
    USD: "en-US",
    EUR: "de-DE", // Formato europeu: 10,50 €
    GBP: "en-GB",
  };

  const locale = localeMap[currency.toUpperCase()] || "pt-BR";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);
};
