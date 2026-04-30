// api/src/services/integration.service.ts
import { ISale } from "../models/sale.model";
import { IOffer } from "../models/offer.model";
import { fetchWithTimeout } from "../lib/http-client";

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

  try {
    const payload = {
      email: sale.customerEmail,
      status: "approved",
    };

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
    }
  } catch (error: any) {
    console.error(`❌ Falha ao enviar webhook genérico: ${error.message}`);
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

  try {
    const productsPayload: ProductItem[] = items.map((item) => ({
      id: item.customId || item._id || "product-no-id",
      name: item.name,
    }));

    // 3. Define o subscriptionId usando o customId do produto principal (item 0)
    // Se não tiver customId, enviamos null ou vazio
    const mainItem = items[0];
    const subscriptionId = mainItem?.customId || null;

    // 4. Monta o Payload
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

    // console.log(`🚀 [Husky/Membership Webhook] Sending payload to ${offer.membershipWebhook.url}:`, JSON.stringify(payload, null, 2));

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
    }
  } catch (error: any) {
    console.error(`❌ Falha ao enviar integração: ${error.message}`);
  }
};
