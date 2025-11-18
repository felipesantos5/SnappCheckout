// src/types/payment.types.ts
export interface CreatePaymentPayload {
  isOrderBumpChecked: boolean;
  // Futuramente:
  // items: { id: string, quantity: number }[];
  // customerInfo: { ... }
}

export interface CreatePaymentIntentBody {
  offerSlug: string;
  selectedOrderBumps: string[];
  // contactInfo: ContactInfo;

  // --- ADICIONE ESTA LINHA ---
  metadata?: { [key: string]: any };
}
