// src/webhooks/pagarme/handlers/index.ts
import { handleOrderPaid } from "./order-paid.handler";

/**
 * Mapeamento de tipos de eventos para seus handlers
 */
const eventHandlers: Record<string, (data: any) => Promise<void>> = {
  "order.paid": handleOrderPaid,
  // Adicione outros eventos aqui conforme necessário
  // "order.payment_failed": handleOrderPaymentFailed,
  // "order.canceled": handleOrderCanceled,
};

/**
 * Processa um evento do webhook da Pagar.me
 * @param eventType Tipo do evento (ex: "order.paid")
 * @param eventData Dados do evento
 */
export const handlePagarMeEvent = async (eventType: string, eventData: any) => {
  const handler = eventHandlers[eventType];

  if (!handler) {
    console.warn(`[Pagar.me Webhook] Handler não encontrado para evento: ${eventType}`);
    return;
  }

  await handler(eventData);
};
