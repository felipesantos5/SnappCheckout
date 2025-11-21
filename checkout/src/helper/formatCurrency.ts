export const formatCurrency = (amountInCents: number, currency: string) => {
  const amount = amountInCents / 100;
  const formatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency,
  }).format(amount);

  // Se for Dólar (USD), remove o "US" e deixa apenas "$"
  if (currency === "USD") {
    return formatted.replace("US$", "$");
  }

  return formatted;
};
