export const formatCurrency = (amountInCents: number, currency: string) => {
  const amount = amountInCents / 100;

  // USD usa formato americano (ponto como decimal)
  if (currency === "USD") {
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
    return formatted; // $10.50
  }

  // Outras moedas usam formato brasileiro (vírgula como decimal)
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency,
  }).format(amount);
};
