// api/src/services/integration.service.ts
import { ISale } from "../models/sale.model";
import { IOffer } from "../models/offer.model";
import { fetchWithTimeout } from "../lib/http-client";
import IntegrationEventLog, { IntegrationEventType } from "../models/integration-event-log.model";

interface ProductItem {
  id: string;
  name: string;
}

interface MembershipPayload {
  event: "ACCESS_GRANTED";
  customer: {
    email: string;
    name: string;
    phone: string;
  };
  products: ProductItem[];
  transactionId: string;
  subscriptionId: string | null;
}

export const sendGenericWebhook = async (
  offer: IOffer,
  sale: ISale,
) => {
  if (!offer.genericWebhook || !offer.genericWebhook.enabled || !offer.genericWebhook.url) {
    return;
  }

  const payload = {
    email: sale.customerEmail,
    status: "approved",
  };

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (offer.genericWebhook.authToken) {
      headers["Authorization"] = `Bearer ${offer.genericWebhook.authToken}`;
    }

    const response = await fetchWithTimeout(offer.genericWebhook.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      timeout: 30000,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro no Webhook Genérico: ${response.status} - ${errorText}`);
      await logIntegrationEvent("generic_webhook", "GENERIC_WEBHOOK", "failed", offer, sale, payload, offer.genericWebhook.url, response.status, errorText);
    } else {
      await logIntegrationEvent("generic_webhook", "GENERIC_WEBHOOK", "success", offer, sale, payload, offer.genericWebhook.url, response.status);
    }
  } catch (error: any) {
    console.error(`❌ Falha ao enviar webhook genérico: ${error.message}`);
    await logIntegrationEvent("generic_webhook", "GENERIC_WEBHOOK", "failed", offer, sale, payload, offer.genericWebhook.url, undefined, error.message);
  }
};

export const sendAccessWebhook = async (
  offer: IOffer,
  sale: ISale,
  items: Array<{ _id?: string; name: string; isOrderBump: boolean; customId?: string }>,
  customerPhone?: string
) => {
  if (!offer.membershipWebhook || !offer.membershipWebhook.enabled || !offer.membershipWebhook.url) {
    return;
  }

  const productsPayload: ProductItem[] = items.map((item) => ({
    id: item.customId || item._id || "product-no-id",
    name: item.name,
  }));

  const mainItem = items[0];
  const subscriptionId = mainItem?.customId || null;

  const payload: MembershipPayload = {
    event: "ACCESS_GRANTED",
    customer: {
      email: sale.customerEmail,
      name: sale.customerName,
      phone: customerPhone || (sale as any).customerPhone || "",
    },
    products: productsPayload,
    transactionId: sale.stripePaymentIntentId,
    subscriptionId: subscriptionId,
  };

  try {
    const response = await fetchWithTimeout(offer.membershipWebhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${offer.membershipWebhook.authToken || ""}`,
      },
      body: JSON.stringify(payload),
      timeout: 30000,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro no Webhook de Integração: ${response.status} - ${errorText}`);
      await logIntegrationEvent("membership_webhook", "ACCESS_GRANTED", "failed", offer, sale, payload, offer.membershipWebhook.url, response.status, errorText);
    } else {
      await logIntegrationEvent("membership_webhook", "ACCESS_GRANTED", "success", offer, sale, payload, offer.membershipWebhook.url, response.status);
    }
  } catch (error: any) {
    console.error(`❌ Falha ao enviar integração: ${error.message}`);
    await logIntegrationEvent("membership_webhook", "ACCESS_GRANTED", "failed", offer, sale, payload, offer.membershipWebhook.url, undefined, error.message);
  }
};

async function logIntegrationEvent(
  type: IntegrationEventType,
  event: string,
  status: "success" | "failed",
  offer: IOffer,
  sale: ISale,
  payload: any,
  destinationUrl?: string,
  responseStatus?: number,
  errorMessage?: string,
) {
  try {
    await IntegrationEventLog.create({
      ownerId: sale.ownerId,
      offerId: offer._id,
      saleId: sale._id,
      type,
      event,
      status,
      destinationUrl,
      payload: JSON.stringify(payload),
      responseStatus,
      errorMessage,
      customerEmail: sale.customerEmail,
      customerName: sale.customerName,
      sentAt: new Date(),
    });
  } catch (err) {
    console.error("Falha ao salvar log de evento de integracao:", err);
  }
}
