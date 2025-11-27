interface SaleItem {
  name: string;
  priceInCents: number;
  isOrderBump: boolean;
  _id?: string;
}

export interface Sale {
  _id: string;
  customerName: string;
  customerEmail: string;
  totalAmountInCents: number;
  currency: string; // Moeda da transação (brl, usd, eur, etc)
  status: "succeeded" | "pending" | "refunded";
  createdAt: string;
  isUpsell?: boolean;
  country?: string; // Código do país (ex: BR, US, FR)
  offerId: {
    _id: string;
    name: string;
    currency?: string; // Moeda da oferta (para fallback)
    isUpsell?: boolean;
  } | null; // Pode ser null se a oferta foi deletada
  items: SaleItem[]; // Adicionamos os itens aqui
}
