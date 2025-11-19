// api/src/services/integration.service.ts
import { ISale } from "../models/sale.model";
import { IOffer } from "../models/offer.model";

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

export const sendAccessWebhook = async (offer: IOffer, sale: ISale, items: Array<{ _id?: string; name: string; isOrderBump: boolean }>) => {
  // 1. Valida se a integração está ativa
  if (!offer.membershipWebhook || !offer.membershipWebhook.enabled || !offer.membershipWebhook.url) {
    return;
  }

  console.log(`\n🔗 INICIANDO INTEGRAÇÃO DE ACESSO (Membership)...`);

  try {
    // 2. Prepara a lista de produtos (Principal, Bump ou Upsell)
    // Mapeamos os itens da venda para o formato { id, name }
    const productsPayload: ProductItem[] = items.map((item) => ({
      id: item._id || "upsell-product", // Usa o ID do banco ou fallback se for upsell one-click sem ID
      name: item.name,
    }));

    // 3. Monta o Payload exato que o cliente pediu
    const payload: MembershipPayload = {
      event: "ACCESS_GRANTED",
      customer: {
        email: sale.customerEmail,
        name: sale.customerName,
        phone: "", // Se tiver salvo no sale, coloque aqui (ex: sale.customerPhone)
      },
      products: productsPayload,
      transactionId: sale.stripePaymentIntentId,
      subscriptionId: null, // Como é venda única, enviamos null ou vazio
    };

    console.log(`📤 Enviando para: ${offer.membershipWebhook.url}`);
    // console.log(JSON.stringify(payload, null, 2));

    // 4. Faz o envio com o Bearer Token
    const response = await fetch(offer.membershipWebhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${offer.membershipWebhook.authToken || ""}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro no Webhook de Integração: ${response.status} - ${errorText}`);
    } else {
      console.log(`✅ Integração de Acesso enviada com sucesso!`);
    }
  } catch (error: any) {
    console.error(`❌ Falha ao enviar integração: ${error.message}`);
    // Não damos throw aqui para não falhar o webhook do Stripe principal
  }
};
