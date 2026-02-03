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

    console.log(`🔵 [Facebook Job] Processando ${pendingSales.length} venda(s) pendente(s) de Facebook Purchase`);

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
    console.log(`ℹ️ [Facebook Job] Nenhum pixel configurado para oferta ${offer.name} - marcando como enviado`);
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

  console.log(`🔵 [Facebook Job] Venda ${parentSale._id}: valor pai=${parentSale.totalAmountInCents / 100}, upsells=${childSales.length}, valor total consolidado=${totalValue}`);

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
  const eventData = {
    event_name: "Purchase" as const,
    event_time: Math.floor(new Date(parentSale.createdAt).getTime() / 1000),
    event_id: `consolidated_purchase_${parentSale._id}`,
    action_source: "website" as const,
    user_data: userData,
    custom_data: {
      currency: (parentSale.currency || "BRL").toUpperCase(),
      value: totalValue,
      order_id: String(parentSale._id),
      content_ids: allItems.map((i: any) => i._id?.toString() || i.customId || "unknown"),
      content_type: "product",
    },
  };

  console.log(`🔵 [Facebook Job] Enviando Purchase consolidado para ${pixels.length} pixel(s) | Valor: ${totalValue} ${parentSale.currency?.toUpperCase()} | Itens: ${allItems.length}`);

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
  console.log(`📊 [Facebook Job] Purchase consolidado: ${successful} sucesso, ${failed} falhas de ${pixels.length} pixels`);

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
      console.log(`✅ [Facebook Job] Marcadas ${childSales.length} venda(s) filha(s) como Facebook enviado`);
    }

    console.log(`✅ [Facebook Job] Venda ${parentSale._id} - Purchase consolidado enviado com sucesso`);
  } else {
    console.error(`❌ [Facebook Job] Falha ao enviar Purchase para todos os pixels da venda ${parentSale._id}`);
    // Não marca como enviado - tentará novamente no próximo ciclo
  }
};

/**
 * Inicia o job de envio consolidado de Facebook Purchase
 * Roda a cada 60 segundos e processa vendas pendentes
 */
export const startFacebookPurchaseJob = (): void => {
  console.log(`🚀 [Facebook Job] Iniciado - verificando a cada ${JOB_INTERVAL_MS / 1000}s`);

  // Processa imediatamente na inicialização (recovery de vendas atrasadas)
  processPendingFacebookPurchases().catch((err) => {
    console.error(`❌ [Facebook Job] Erro no processamento inicial:`, err.message);
  });

  // Agenda execução periódica
  setInterval(() => {
    processPendingFacebookPurchases().catch((err) => {
      console.error(`❌ [Facebook Job] Erro no ciclo:`, err.message);
    });
  }, JOB_INTERVAL_MS);
};
