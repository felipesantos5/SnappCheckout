// src/webhooks/pagarme/handlers/order-paid.handler.ts
import Sale from "../../../models/sale.model";
import Offer from "../../../models/offer.model";
import { sendAccessWebhook } from "../../../services/integration.service";
import { processUtmfyIntegrationForPayPal } from "../../../services/utmfy.service";

/**
 * Handler para o evento order.paid da Pagar.me
 * Chamado quando um pagamento PIX é confirmado
 */
export const handleOrderPaid = async (eventData: any) => {
  try {
    const orderId = eventData.id;
    const orderStatus = eventData.status;


    // Busca a venda pelo orderId
    const sale = await Sale.findOne({ pagarme_order_id: orderId });
    if (!sale) {
      console.warn(`[Pagar.me Webhook] Venda não encontrada para orderId=${orderId}`);
      return;
    }

    // Verifica se a venda já foi processada
    if (sale.status === "succeeded") {
      return;
    }

    // Atualiza o status da venda para succeeded
    sale.status = "succeeded";
    sale.integrationsLastAttempt = new Date();
    // Facebook Purchase consolidado: envia após 10 minutos para agrupar com upsell
    sale.facebookPurchaseSendAfter = new Date(Date.now() + 10 * 60 * 1000);
    await sale.save();


    // Busca a oferta para obter configurações de integração
    const offer = await Offer.findById(sale.offerId).populate("ownerId");
    if (!offer) {
      console.warn(`[Pagar.me Webhook] Oferta não encontrada: offerId=${sale.offerId}`);
      return;
    }

    // Montar items para os webhooks
    const items =
      sale.items ||
      [
        {
          _id: (offer.mainProduct as any)._id?.toString(),
          name: offer.mainProduct.name,
          priceInCents: offer.mainProduct.priceInCents,
          isOrderBump: false,
          customId: (offer.mainProduct as any).customId,
        },
      ];

    // Dispara TODAS as integrações (Facebook, Husky, UTMfy)
    await dispatchAllIntegrations(sale, offer, items);

  } catch (error: any) {
    console.error(`[Pagar.me Webhook] Erro ao processar order.paid:`, error);
    throw error; // Re-throw para que o webhook seja retentado
  }
};

/**
 * Dispara TODAS as integrações (Facebook, Husky, UTMfy) de forma padronizada
 */
const dispatchAllIntegrations = async (sale: any, offer: any, items: any[]) => {
  // A: Webhook de Área de Membros (Husky/MemberKit)
  try {
    await sendAccessWebhook(offer as any, sale, items, sale.customerPhone || "");
    sale.integrationsHuskySent = true;
  } catch (error: any) {
    console.error(`❌ [Pagar.me] Erro ao enviar webhook Husky:`, error.message);
    sale.integrationsHuskySent = false;
  }

  // B: Facebook CAPI (Purchase) - NÃO envia imediatamente
  // O evento Purchase será enviado consolidado pelo job (facebook-purchase.job.ts)
  // após a janela de 10 minutos, agrupando valor do produto principal + order bumps + upsell

  // C: Webhook de Rastreamento (UTMfy)
  try {
    await processUtmfyIntegrationForPayPal(
      offer as any,
      sale,
      items,
      sale.pagarme_order_id, // Pagar.me Order ID
      {
        email: sale.customerEmail,
        name: sale.customerName,
        phone: sale.customerPhone,
      },
      {
        ip: sale.ip,
        userAgent: sale.userAgent,
        utm_source: (sale as any).utm_source,
        utm_medium: (sale as any).utm_medium,
        utm_campaign: (sale as any).utm_campaign,
        utm_term: (sale as any).utm_term,
        utm_content: (sale as any).utm_content,
      }
    );
    sale.integrationsUtmfySent = true;
  } catch (error: any) {
    console.error(`❌ [Pagar.me] Erro ao enviar webhook UTMfy:`, error.message);
    sale.integrationsUtmfySent = false;
  }

  // Salva as flags de integração
  await sale.save();
};

