// src/jobs/facebook-purchase.job.ts
// Job de envio consolidado de Facebook Purchase via CAPI
// Agrupa venda principal + upsells em 1 único evento Purchase após janela de 10 minutos

import Sale from "../models/sale.model";
import Offer from "../models/offer.model";
import { createFacebookUserData, sendFacebookEvent } from "../services/facebook.service";

const JOB_INTERVAL_MS = 60 * 1000; // Executa a cada 60 segundos

/**
 * Processa vendas pendentes de envio de Facebook Purchase consolidado
 */
const processPendingFacebookPurchases = async (): Promise<void> => {
  try {
    // Busca vendas pai (não-upsell) que estão prontas para enviar
    const pendingSales = await Sale.find({
      facebookPurchaseSendAfter: { $lte: new Date() },
      integrationsFacebookSent: { $ne: true },
      status: "succeeded",
      isUpsell: false,
    }).limit(50); // Processa no máximo 50 por ciclo

    if (pendingSales.length === 0) return;


    for (const sale of pendingSales) {
      try {
        await processConsolidatedPurchase(sale);
      } catch (error: any) {
        console.error(`❌ [Facebook Job] Erro ao processar venda ${sale._id}:`, error.message);
        // Continua processando as demais vendas
      }
    }
  } catch (error: any) {
    console.error(`❌ [Facebook Job] Erro no ciclo de processamento:`, error.message);
  }
};

/**
 * Processa uma venda individual: consolida valor com upsells filhos e envia 1 evento Purchase
 */
const processConsolidatedPurchase = async (parentSale: any): Promise<void> => {
  // 1. Busca a oferta com pixels configurados
  const offer = await Offer.findById(parentSale.offerId).populate("ownerId");
  if (!offer) {
    console.warn(`⚠️ [Facebook Job] Oferta ${parentSale.offerId} não encontrada para venda ${parentSale._id}`);
    // Marca como enviado para não tentar novamente
    parentSale.integrationsFacebookSent = true;
    await parentSale.save();
    return;
  }

  // 2. Coleta todos os pixels Facebook configurados
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

  if (pixels.length === 0) {
    parentSale.integrationsFacebookSent = true;
    await parentSale.save();
    return;
  }

  // 3. Busca vendas filhas (upsells) vinculadas a esta venda
  const childSales = await Sale.find({
    parentSaleId: parentSale._id,
    status: "succeeded",
  });

  // 4. Consolida valor total e itens
  let totalAmountInCents = parentSale.totalAmountInCents;
  const allItems = [...parentSale.items];

  for (const childSale of childSales) {
    totalAmountInCents += childSale.totalAmountInCents;
    allItems.push(...childSale.items);
  }

  const totalValue = totalAmountInCents / 100;


  // 5. Cria user_data com dados disponíveis do sale
  const userData = createFacebookUserData(
    parentSale.ip || "",
    parentSale.userAgent || "",
    parentSale.customerEmail,
    parentSale.customerPhone || "",
    parentSale.customerName,
    parentSale.fbc,
    parentSale.fbp,
    parentSale.addressCity,
    parentSale.addressState,
    parentSale.addressZipCode,
    parentSale.addressCountry
  );

  // 6. Monta evento Purchase consolidado
  const baseUrl = `${process.env.FRONTEND_URL || "https://pay.snappcheckout.com"}/p/${offer.slug}`;
  const utmParams = new URLSearchParams();
  if (parentSale.utm_source) utmParams.set("utm_source", parentSale.utm_source);
  if (parentSale.utm_medium) utmParams.set("utm_medium", parentSale.utm_medium);
  if (parentSale.utm_campaign) utmParams.set("utm_campaign", parentSale.utm_campaign);
  if (parentSale.utm_term) utmParams.set("utm_term", parentSale.utm_term);
  if (parentSale.utm_content) utmParams.set("utm_content", parentSale.utm_content);

  const eventSourceUrl = utmParams.toString() ? `${baseUrl}?${utmParams.toString()}` : baseUrl;

  const eventData = {
    event_name: "Purchase" as const,
    event_time: Math.floor(new Date(parentSale.createdAt).getTime() / 1000),
    event_id: `consolidated_purchase_${parentSale._id}`,
    action_source: "website" as const,
    event_source_url: eventSourceUrl,
    user_data: userData,
    custom_data: {
      currency: (parentSale.currency || "BRL").toUpperCase(),
      value: totalValue,
      order_id: String(parentSale._id),
      content_ids: allItems.map((i: any) => i._id?.toString() || i.customId || "unknown"),
      content_type: "product",
      // UTM Tracking
      utm_source: parentSale.utm_source || "",
      utm_medium: parentSale.utm_medium || "",
      utm_campaign: parentSale.utm_campaign || "",
      utm_term: parentSale.utm_term || "",
      utm_content: parentSale.utm_content || "",
    },
  };


  // 7. Envia para todos os pixels
  const results = await Promise.allSettled(
    pixels.map((pixel) =>
      sendFacebookEvent(pixel.pixelId, pixel.accessToken, eventData).catch((err) => {
        console.error(`❌ [Facebook Job] Erro pixel ${pixel.pixelId}:`, err.message);
        throw err;
      })
    )
  );

  const successful = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  // 8. Marca venda pai como enviada se pelo menos 1 pixel teve sucesso
  if (successful > 0) {
    parentSale.integrationsFacebookSent = true;
    await parentSale.save();

    // Marca todas as vendas filhas como enviadas também
    if (childSales.length > 0) {
      await Sale.updateMany(
        { _id: { $in: childSales.map((s) => s._id) } },
        { $set: { integrationsFacebookSent: true } }
      );
    }

  } else {
    console.error(`❌ [Facebook Job] Falha ao enviar Purchase para todos os pixels da venda ${parentSale._id}`);
    // Não marca como enviado - tentará novamente no próximo ciclo
  }
};

// Referência ao interval para limpeza no shutdown
let jobInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Inicia o job de envio consolidado de Facebook Purchase
 * Roda a cada 60 segundos e processa vendas pendentes
 */
export const startFacebookPurchaseJob = (): void => {

  // Processa imediatamente na inicialização (recovery de vendas atrasadas)
  processPendingFacebookPurchases().catch((err) => {
    console.error(`❌ [Facebook Job] Erro no processamento inicial:`, err.message);
  });

  // Agenda execução periódica
  jobInterval = setInterval(() => {
    processPendingFacebookPurchases().catch((err) => {
      console.error(`❌ [Facebook Job] Erro no ciclo:`, err.message);
    });
  }, JOB_INTERVAL_MS);
};

/**
 * Para o job de Facebook Purchase (chamado no graceful shutdown)
 */
export const stopFacebookPurchaseJob = (): void => {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
  }
};
