export const formatCurrency = (amountInCents: number, currency: string = "BRL") => {
  // Mapeia os códigos de moeda em minúscula para maiúscula
  const currencyCode = currency.toUpperCase();

  // Define o locale baseado na moeda
  const locale = currencyCode === "BRL" ? "pt-BR" : currencyCode === "EUR" ? "fr-FR" : "en-US";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
  }).format(amountInCents / 100);
};
