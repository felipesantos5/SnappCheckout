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
  updatedAt: string;
  isUpsell?: boolean;
  isDownsell?: boolean;
  stripeSubscriptionId?: string;
  subscriptionCycle?: number | null;
  country?: string; // Código do país (ex: BR, US, FR)
  paymentMethod?: "stripe" | "paypal" | "pagarme"; // Plataforma de pagamento usada
  offerId: {
    _id: string;
    name: string;
    currency?: string; // Moeda da oferta (para fallback)
    isUpsell?: boolean;
    bannerImageUrl?: string;
    mainProduct?: {
      imageUrl?: string;
    };
    paymentType?: "one_time" | "subscription" | string;
    subscriptionInterval?: "day" | "week" | "month" | "year" | string;
  } | null; // Pode ser null se a oferta foi deletada
  items: SaleItem[]; // Adicionamos os itens aqui
}
