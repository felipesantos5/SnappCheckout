// src/webhooks/paypal/handlers/payment.handler.ts
import Sale from "../../../models/sale.model";
import Offer from "../../../models/offer.model";
import User from "../../../models/user.model";
import { sendAccessWebhook } from "../../../services/integration.service";
import { createFacebookUserData, sendFacebookEvent } from "../../../services/facebook.service";
import { getCountryFromIP } from "../../../helper/getCountryFromIP";

interface PayPalCaptureResource {
  id: string;
  status: string;
  amount: {
    currency_code: string;
    value: string;
  };
  custom_id?: string; // Usamos para passar o offerId
  invoice_id?: string;
  supplementary_data?: {
    related_ids?: {
      order_id?: string;
    };
  };
}

interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource: PayPalCaptureResource;
  create_time: string;
}

/**
 * Handler para PAYMENT.CAPTURE.COMPLETED
 * Chamado quando um pagamento PayPal é capturado com sucesso
 */
export const handlePaymentCaptureCompleted = async (event: PayPalWebhookEvent): Promise<void> => {
  try {
    const capture = event.resource;
    const captureId = capture.id;
    const paypalOrderId = capture.supplementary_data?.related_ids?.order_id;

    // 1. Verificar idempotência - evita processar o mesmo pagamento duas vezes
    const existingSale = await Sale.findOne({
      $or: [{ stripePaymentIntentId: `PAYPAL_${captureId}` }, { stripePaymentIntentId: `PAYPAL_${paypalOrderId}` }],
    });

    if (existingSale) {
      // Se a venda existe mas não foi enviada para o Husky, tenta enviar novamente
      if (existingSale.status === "succeeded") {
        await retrySendAccessWebhook(existingSale);
      }
      return;
    }

    // 2. Buscar a venda pendente pelo PayPal Order ID
    // O captureOrder já cria a Sale, então buscamos ela
    const pendingSale = await Sale.findOne({
      stripePaymentIntentId: { $regex: `PAYPAL_`, $options: "i" },
      status: "succeeded",
      createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }, // Últimos 5 minutos
    })
      .sort({ createdAt: -1 })
      .populate("offerId");

    if (pendingSale) {
      console.log(`✅ [PayPal Webhook] Venda encontrada: ${pendingSale._id}`);

      // Buscar oferta para enviar webhook
      const offer = await Offer.findById(pendingSale.offerId);

      if (offer) {
        // Montar items para o webhook
        const items = pendingSale.items || [
          {
            _id: (offer.mainProduct as any)._id?.toString(),
            name: offer.mainProduct.name,
            priceInCents: offer.mainProduct.priceInCents,
            isOrderBump: false,
            customId: (offer.mainProduct as any).customId,
          },
        ];

        // Enviar webhook para área de membros (Husky)
        console.log(`📤 [PayPal] Enviando webhook de acesso para Husky...`);
        await sendAccessWebhook(offer as any, pendingSale, items, "");

        // Enviar evento Purchase para Facebook CAPI
        await sendFacebookPurchaseEvent(offer, pendingSale, items);
      }

      return;
    }

    // 3. Se não encontrou venda, pode ser que o webhook chegou antes do captureOrder
    // Neste caso, logamos para investigação
    console.warn(`⚠️ [PayPal Webhook] Nenhuma venda encontrada para capture ${captureId}`);
    console.warn(`   - Isso pode indicar que o webhook chegou antes da captura ser processada`);
  } catch (error: any) {
    console.error(`❌ [PayPal] Erro ao processar PAYMENT.CAPTURE.COMPLETED:`, error.message);
    throw error;
  }
};

/**
 * Handler para PAYMENT.CAPTURE.DENIED
 * Chamado quando um pagamento PayPal é negado
 */
export const handlePaymentCaptureDenied = async (event: PayPalWebhookEvent): Promise<void> => {
  try {
    const capture = event.resource;
    console.log(`❌ [PayPal] Pagamento negado: ${capture.id}`);

    // Buscar e atualizar a venda se existir
    const sale = await Sale.findOne({
      stripePaymentIntentId: { $regex: `PAYPAL_`, $options: "i" },
      createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) }, // Últimos 30 minutos
    }).sort({ createdAt: -1 });

    if (sale && sale.status !== "failed") {
      sale.status = "failed";
      sale.failureReason = "payment_denied";
      sale.failureMessage = "Pagamento PayPal negado";
      await sale.save();
      console.log(`✅ [PayPal] Venda ${sale._id} marcada como falha`);
    }
  } catch (error: any) {
    console.error(`❌ [PayPal] Erro ao processar PAYMENT.CAPTURE.DENIED:`, error.message);
  }
};

/**
 * Handler para PAYMENT.CAPTURE.REFUNDED
 * Chamado quando um pagamento PayPal é reembolsado
 */
export const handlePaymentCaptureRefunded = async (event: PayPalWebhookEvent): Promise<void> => {
  try {
    const capture = event.resource;
    console.log(`💰 [PayPal] Pagamento reembolsado: ${capture.id}`);

    // Buscar a venda pelo ID do PayPal
    const sale = await Sale.findOne({
      stripePaymentIntentId: { $regex: `PAYPAL_`, $options: "i" },
    });

    if (sale) {
      sale.status = "refunded";
      await sale.save();
      console.log(`✅ [PayPal] Venda ${sale._id} marcada como reembolsada`);
    }
  } catch (error: any) {
    console.error(`❌ [PayPal] Erro ao processar PAYMENT.CAPTURE.REFUNDED:`, error.message);
  }
};

/**
 * Tenta reenviar o webhook de acesso caso tenha falhado anteriormente
 */
const retrySendAccessWebhook = async (sale: any): Promise<void> => {
  try {
    const offer = await Offer.findById(sale.offerId);
    if (!offer) return;

    const items = sale.items || [
      {
        _id: (offer.mainProduct as any)._id?.toString(),
        name: offer.mainProduct.name,
        priceInCents: offer.mainProduct.priceInCents,
        isOrderBump: false,
        customId: (offer.mainProduct as any).customId,
      },
    ];

    console.log(`🔄 [PayPal] Reenviando webhook de acesso para venda ${sale._id}...`);
    await sendAccessWebhook(offer as any, sale, items, "");
  } catch (error: any) {
    console.error(`❌ [PayPal] Erro ao reenviar webhook:`, error.message);
  }
};

/**
 * Envia evento Purchase para o Facebook CAPI
 */
const sendFacebookPurchaseEvent = async (offer: any, sale: any, items: any[]): Promise<void> => {
  try {
    // Coletar todos os pixels
    const pixels: Array<{ pixelId: string; accessToken: string }> = [];

    if (offer.facebookPixels && offer.facebookPixels.length > 0) {
      pixels.push(...offer.facebookPixels);
    }

    if (offer.facebookPixelId && offer.facebookAccessToken) {
      const alreadyExists = pixels.some((p) => p.pixelId === offer.facebookPixelId);
      if (!alreadyExists) {
        pixels.push({
          pixelId: offer.facebookPixelId,
          accessToken: offer.facebookAccessToken,
        });
      }
    }

    if (pixels.length === 0) return;

    const totalValue = sale.totalAmountInCents / 100;

    const userData = createFacebookUserData(sale.ip || "", "", sale.customerEmail, "", sale.customerName);

    const eventData = {
      event_name: "Purchase" as const,
      event_time: Math.floor(Date.now() / 1000),
      event_id: `paypal_purchase_${sale._id}`,
      action_source: "website" as const,
      user_data: userData,
      custom_data: {
        currency: sale.currency?.toUpperCase() || "BRL",
        value: totalValue,
        order_id: String(sale._id),
        content_ids: items.map((i) => i._id || i.customId || "unknown"),
        content_type: "product",
      },
    };

    console.log(`🔵 [PayPal] Enviando Purchase para ${pixels.length} pixel(s) Facebook`);

    await Promise.allSettled(
      pixels.map((pixel) =>
        sendFacebookEvent(pixel.pixelId, pixel.accessToken, eventData).catch((err) =>
          console.error(`❌ Erro Facebook pixel ${pixel.pixelId}:`, err)
        )
      )
    );
  } catch (error: any) {
    console.error(`⚠️ [PayPal] Erro ao enviar evento Facebook:`, error.message);
  }
};
