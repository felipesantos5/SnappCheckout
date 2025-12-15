// src/services/utmfy.service.ts
import "dotenv/config";
import { IOffer } from "../models/offer.model";
import { ISale } from "../models/sale.model";
import Stripe from "stripe";
import { convertToBRL, centsToUnits } from "./currency-conversion.service";

export interface UTMfyPayload {
  email: string;
  name: string;
  amountInCents: number; // Valor em centavos na moeda original
  currency: string; // Moeda original (USD, EUR, BRL, etc.)
  transactionId: string;
  // Campos opcionais adicionais
  productName?: string;
  offerId?: string;
  ownerId?: string;
}

/**
 * Envia dados de conversão para a API da UTMfy
 * IMPORTANTE: Converte valores para BRL antes de enviar
 *
 * @param payload - Dados da conversão a serem enviados
 * @returns Promise<void>
 */
export const sendConversionToUTMfy = async (payload: UTMfyPayload): Promise<void> => {
  try {
    const utmfyApiUrl = process.env.UTMFY_API_URL;
    const utmfyApiKey = process.env.UTMFY_API_KEY;

    // Validação de configuração
    if (!utmfyApiUrl || !utmfyApiKey) {
      console.warn("⚠️  UTMfy não configurada. Defina UTMFY_API_URL e UTMFY_API_KEY no .env");
      return;
    }

    console.log(`📤 Enviando conversão para UTMfy: ${payload.transactionId}`);

    // Converte para BRL (UTMfy sempre espera valores em BRL)
    const amountInBRL = await convertToBRL(payload.amountInCents, payload.currency);
    const valueInReais = centsToUnits(amountInBRL);

    // Faz a requisição para a UTMfy
    const response = await fetch(utmfyApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${utmfyApiKey}`,
        // Adicione outros headers conforme necessário
      },
      body: JSON.stringify({
        email: payload.email,
        name: payload.name,
        value: valueInReais, // Valor em reais (BRL)
        currency: "BRL", // Sempre BRL
        transaction_id: payload.transactionId,
        // Adicione campos extras conforme a API da UTMfy
        product_name: payload.productName,
        offer_id: payload.offerId,
        timestamp: new Date().toISOString(),
      }),
    });

    // Verifica se a resposta foi bem-sucedida
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`UTMfy API retornou ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();
    console.log("✅ Conversão enviada para UTMfy com sucesso:", responseData);
  } catch (error) {
    // IMPORTANTE: Não re-lançar o erro
    // Isso evita que o webhook do Stripe falhe se a UTMfy estiver fora do ar
    console.error("❌ Erro ao enviar conversão para UTMfy:", error);

    // TODO: Implementar retry logic ou dead letter queue
    // - Salvar em uma fila para retry posterior
    // - Enviar alerta para equipe de desenvolvimento
    // - Registrar em sistema de monitoramento
  }
};

/**
 * Envia dados de reembolso para a UTMfy
 *
 * @param transactionId - ID da transação original
 * @returns Promise<void>
 */
export const sendRefundToUTMfy = async (transactionId: string): Promise<void> => {
  try {
    const utmfyApiUrl = process.env.UTMFY_REFUND_API_URL || process.env.UTMFY_API_URL;
    const utmfyApiKey = process.env.UTMFY_API_KEY;

    if (!utmfyApiUrl || !utmfyApiKey) {
      console.warn("⚠️  UTMfy não configurada para reembolsos.");
      return;
    }

    console.log(`📤 Enviando reembolso para UTMfy: ${transactionId}`);

    const response = await fetch(`${utmfyApiUrl}/refund`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${utmfyApiKey}`,
      },
      body: JSON.stringify({
        transaction_id: transactionId,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`UTMfy Refund API retornou ${response.status}: ${errorText}`);
    }

    console.log("✅ Reembolso enviado para UTMfy com sucesso");
  } catch (error) {
    console.error("❌ Erro ao enviar reembolso para UTMfy:", error);
  }
};

/**
 * Envia um payload de compra detalhado para um Webhook da UTMfy.
 * Usa a nova estrutura de payload e a API Key global.
 *
 * @param webhookUrl - A URL de webhook específica da oferta
 * @param payload - O objeto JSON (formato 'Purchase_Order_Confirmed')
 */
export const sendPurchaseToUTMfyWebhook = async (webhookUrl: string, payload: any): Promise<void> => {
  try {
    // const utmfyApiKey = process.env.UTMFY_API_KEY;

    // Validação de configuração
    // if (!utmfyApiKey) {
    //   console.warn("⚠️  UTMfy não configurada. Defina UTMFY_API_KEY no .env");
    //   return;
    // }

    console.log(`📤 Enviando conversão (V2) para Webhook UTMfy: ${payload.Data.Purchase.PaymentId}`);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // Verifica se a resposta foi bem-sucedida
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Webhook UTMfy V2 retornou ${response.status}: ${errorText}`);
    }

    // Webhooks podem responder com 204 (No Content)
    if (response.status === 204) {
      console.log("✅ Conversão (V2) enviada para UTMfy com sucesso (204 No Content)");
    } else {
      const responseData = await response.json();
      console.log("✅ Conversão (V2) enviada para UTMfy com sucesso:", responseData);
    }
  } catch (error) {
    // IMPORTANTE: Não re-lançar o erro
    // Isso evita que o webhook do Stripe falhe se a UTMfy estiver fora do ar
    console.error("❌ Erro ao enviar conversão (V2) para Webhook UTMfy:", error);
  }
};

export const processUtmfyIntegration = async (
  offer: IOffer,
  sale: ISale,
  items: Array<{ _id?: string; name: string; priceInCents: number; isOrderBump: boolean; compareAtPriceInCents?: number }>,
  paymentIntent: Stripe.PaymentIntent,
  metadata: any
) => {
  // Coletar todas as URLs válidas (novo array + campo antigo para retrocompatibilidade)
  const webhookUrls: string[] = [];

  // Adiciona URLs do novo array
  if (offer.utmfyWebhookUrls && offer.utmfyWebhookUrls.length > 0) {
    webhookUrls.push(...offer.utmfyWebhookUrls.filter((url) => url && url.startsWith("http")));
  }

  // Adiciona URL antiga se existir e não estiver no array novo (retrocompatibilidade)
  if (offer.utmfyWebhookUrl && offer.utmfyWebhookUrl.startsWith("http") && !webhookUrls.includes(offer.utmfyWebhookUrl)) {
    webhookUrls.push(offer.utmfyWebhookUrl);
  }

  // Se não houver URLs válidas, retorna
  if (webhookUrls.length === 0) {
    return;
  }

  try {
    const quantity = parseInt(metadata.quantity || "1", 10);
    const isUpsell = metadata.isUpsell === "true";
    const owner = (offer as any).ownerId;

    // ... (mapeamento de produtos permanece igual)
    const utmfyProducts = items.map((item) => {
      let id = item._id ? item._id.toString() : crypto.randomUUID();
      if (!item.isOrderBump && !item._id) {
        id = (offer._id as any)?.toString() || crypto.randomUUID();
      }
      return { Id: id, Name: item.name };
    });

    // ... (cálculo de preço original permanece igual)
    let originalTotalInCents = 0;
    items.forEach((item) => {
      const price = item.compareAtPriceInCents && item.compareAtPriceInCents > item.priceInCents ? item.compareAtPriceInCents : item.priceInCents;
      if (item.isOrderBump) {
        originalTotalInCents += price;
      } else {
        originalTotalInCents += price * (isUpsell ? 1 : quantity);
      }
    });

    // Pegar a moeda do PaymentIntent e garantir maiúscula (ex: "usd" -> "USD")
    const currencyCode = paymentIntent.currency ? paymentIntent.currency.toUpperCase() : "BRL";

    // CONVERSÃO PARA BRL (UTMfy sempre espera valores em BRL)
    const originalTotalInBRL = await convertToBRL(originalTotalInCents, currencyCode);
    const totalAmountInBRL = await convertToBRL(sale.totalAmountInCents, currencyCode);
    const platformFeeInBRL = await convertToBRL(sale.platformFeeInCents, currencyCode);
    const producerAmountInBRL = totalAmountInBRL - platformFeeInBRL;

    const utmfyPayload = {
      Id: crypto.randomUUID(),
      IsTest: !paymentIntent.livemode,
      Event: "Purchase_Order_Confirmed",
      CreatedAt: new Date().toISOString(),
      Data: {
        Products: utmfyProducts,
        Buyer: {
          Id: paymentIntent.customer?.toString() || crypto.randomUUID(),
          Email: sale.customerEmail,
          Name: sale.customerName,
          PhoneNumber: metadata.customerPhone || null,
        },
        Seller: {
          Id: owner._id ? owner._id.toString() : "unknown_seller",
          Email: owner.email || "unknown@email.com",
        },
        Commissions: [
          { Value: centsToUnits(platformFeeInBRL), Source: "MARKETPLACE" },
          { Value: centsToUnits(producerAmountInBRL), Source: "PRODUCER" },
        ],
        Purchase: {
          PaymentId: crypto.randomUUID(),
          Recurrency: 1,
          PaymentDate: new Date(paymentIntent.created * 1000).toISOString(),
          // VALORES SEMPRE EM BRL (conforme requisito da UTMfy)
          OriginalPrice: {
            Value: centsToUnits(originalTotalInBRL),
            Currency: "BRL",
          },
          Price: {
            Value: centsToUnits(totalAmountInBRL),
            Currency: "BRL",
          },
          Payment: {
            NumberOfInstallments: 1,
            PaymentMethod: "credit_card",
            InterestRateAmount: 0,
          },
        },
        Offer: {
          Id: (offer._id as any)?.toString() || crypto.randomUUID(),
          Name: offer.name,
          Url: `${process.env.FRONTEND_URL || "https://pay.snappcheckout.com"}/p/${offer.slug}`,
        },
        Utm: {
          UtmSource: metadata.utm_source || null,
          UtmMedium: metadata.utm_medium || null,
          UtmCampaign: metadata.utm_campaign || null,
          UtmTerm: metadata.utm_term || null,
          UtmContent: metadata.utm_content || null,
        },
        DeviceInfo: {
          UserAgent: metadata.userAgent || null,
          ip: metadata.ip || null,
        },
      },
    };

    // Envia para todas as URLs configuradas em paralelo
    console.log(`📤 Enviando para ${webhookUrls.length} webhook(s) UTMfy...`);
    await Promise.all(webhookUrls.map((url) => sendPurchaseToUTMfyWebhook(url, utmfyPayload)));
  } catch (error) {
    console.error("Erro na lógica do serviço UTMfy:", error);
  }
};

/**
 * Processa a integração com UTMfy para pagamentos PayPal
 * Versão adaptada de processUtmfyIntegration que não depende de Stripe.PaymentIntent
 * 
 * IMPORTANTE: Esta função segue o mesmo padrão de dados da versão Stripe
 * para garantir consistência nos webhooks enviados à UTMfy
 *
 * @param offer - A oferta do produto
 * @param sale - A venda salva no banco
 * @param items - Lista de itens da compra
 * @param paypalOrderId - ID da ordem do PayPal
 * @param customerData - Dados do cliente (email, name, phone)
 * @param metadata - Metadados adicionais (UTMs, IP, userAgent, etc.)
 */
export const processUtmfyIntegrationForPayPal = async (
  offer: IOffer,
  sale: ISale,
  items: Array<{ _id?: string; name: string; priceInCents: number; isOrderBump: boolean; compareAtPriceInCents?: number }>,
  paypalOrderId: string,
  customerData: { email?: string; name?: string; phone?: string },
  metadata: {
    quantity?: string;
    isUpsell?: string; // Consistente com Stripe
    ip?: string;
    userAgent?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_term?: string;
    utm_content?: string;
  }
) => {
  // Coletar todas as URLs válidas (novo array + campo antigo para retrocompatibilidade)
  const webhookUrls: string[] = [];

  // Adiciona URLs do novo array
  if (offer.utmfyWebhookUrls && offer.utmfyWebhookUrls.length > 0) {
    webhookUrls.push(...offer.utmfyWebhookUrls.filter((url) => url && url.startsWith("http")));
  }

  // Adiciona URL antiga se existir e não estiver no array novo (retrocompatibilidade)
  if (offer.utmfyWebhookUrl && offer.utmfyWebhookUrl.startsWith("http") && !webhookUrls.includes(offer.utmfyWebhookUrl)) {
    webhookUrls.push(offer.utmfyWebhookUrl);
  }

  // Se não houver URLs válidas, retorna
  if (webhookUrls.length === 0) {
    return;
  }

  try {
    const quantity = parseInt(metadata.quantity || "1", 10);
    const isUpsell = metadata.isUpsell === "true"; // Consistente com Stripe
    const owner = (offer as any).ownerId;

    // Mapeamento de produtos para o formato UTMfy (igual ao Stripe)
    const utmfyProducts = items.map((item) => {
      let id = item._id ? item._id.toString() : crypto.randomUUID();
      if (!item.isOrderBump && !item._id) {
        id = (offer._id as any)?.toString() || crypto.randomUUID();
      }
      return { Id: id, Name: item.name };
    });

    // Cálculo de preço original (igual ao Stripe - considera isUpsell)
    let originalTotalInCents = 0;
    items.forEach((item) => {
      const price = item.compareAtPriceInCents && item.compareAtPriceInCents > item.priceInCents ? item.compareAtPriceInCents : item.priceInCents;
      if (item.isOrderBump) {
        originalTotalInCents += price;
      } else {
        originalTotalInCents += price * (isUpsell ? 1 : quantity);
      }
    });

    // Pegar a moeda da venda e garantir maiúscula
    const currencyCode = sale.currency ? sale.currency.toUpperCase() : "BRL";

    // CONVERSÃO PARA BRL (UTMfy sempre espera valores em BRL)
    const originalTotalInBRL = await convertToBRL(originalTotalInCents, currencyCode);
    const totalAmountInBRL = await convertToBRL(sale.totalAmountInCents, currencyCode);
    const platformFeeInBRL = await convertToBRL(sale.platformFeeInCents, currencyCode);
    const producerAmountInBRL = totalAmountInBRL - platformFeeInBRL;

    // ID único para o comprador - usa o saleId para consistência
    // No Stripe usamos paymentIntent.customer || UUID
    // Aqui usamos o saleId pois é o identificador único da transação
    const buyerId = (sale as any)._id?.toString() || crypto.randomUUID();

    // PaymentDate - usa a data de criação da venda (igual ao Stripe que usa paymentIntent.created)
    const paymentDate = (sale as any).createdAt 
      ? new Date((sale as any).createdAt).toISOString() 
      : new Date().toISOString();

    const utmfyPayload = {
      Id: crypto.randomUUID(),
      IsTest: false, // PayPal em produção (Sandbox seria detectado no ambiente)
      Event: "Purchase_Order_Confirmed",
      CreatedAt: new Date().toISOString(),
      Data: {
        Products: utmfyProducts,
        Buyer: {
          Id: buyerId, // Consistente: usa sale._id como identificador
          Email: sale.customerEmail || customerData.email || "",
          Name: sale.customerName || customerData.name || "",
          PhoneNumber: customerData.phone || null,
        },
        Seller: {
          Id: owner._id ? owner._id.toString() : "unknown_seller",
          Email: owner.email || "unknown@email.com",
        },
        Commissions: [
          { Value: centsToUnits(platformFeeInBRL), Source: "MARKETPLACE" },
          { Value: centsToUnits(producerAmountInBRL), Source: "PRODUCER" },
        ],
        Purchase: {
          PaymentId: crypto.randomUUID(), // Consistente com Stripe: usa UUID
          Recurrency: 1,
          PaymentDate: paymentDate, // Consistente: usa data de criação da venda
          // VALORES SEMPRE EM BRL (conforme requisito da UTMfy)
          OriginalPrice: {
            Value: centsToUnits(originalTotalInBRL),
            Currency: "BRL",
          },
          Price: {
            Value: centsToUnits(totalAmountInBRL),
            Currency: "BRL",
          },
          Payment: {
            NumberOfInstallments: 1,
            PaymentMethod: "paypal", // Identificador específico para PayPal
            InterestRateAmount: 0,
          },
        },
        Offer: {
          Id: (offer._id as any)?.toString() || crypto.randomUUID(),
          Name: offer.name,
          Url: `${process.env.FRONTEND_URL || "https://pay.snappcheckout.com"}/p/${offer.slug}`,
        },
        Utm: {
          UtmSource: metadata.utm_source || null,
          UtmMedium: metadata.utm_medium || null,
          UtmCampaign: metadata.utm_campaign || null,
          UtmTerm: metadata.utm_term || null,
          UtmContent: metadata.utm_content || null,
        },
        DeviceInfo: {
          UserAgent: metadata.userAgent || null,
          ip: metadata.ip || null,
        },
      },
    };

    // Envia para todas as URLs configuradas em paralelo
    console.log(`📤 [PayPal] Enviando para ${webhookUrls.length} webhook(s) UTMfy...`);
    await Promise.all(webhookUrls.map((url) => sendPurchaseToUTMfyWebhook(url, utmfyPayload)));
  } catch (error) {
    console.error("❌ [PayPal] Erro na lógica do serviço UTMfy:", error);
  }
};
