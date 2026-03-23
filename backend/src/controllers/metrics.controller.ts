import { Request, Response } from "express";
import Sale from "../models/sale.model";
import CheckoutMetric from "../models/checkout-metric.model";
import mongoose from "mongoose";
import Offer from "../models/offer.model";
import { sendFacebookEvent, createFacebookUserData } from "../services/facebook.service";
import { convertToBRL } from "../services/currency-conversion.service";
import { convertToBRLSync, getExchangeRatesSync } from "../services/currency-conversion.service";

/**
 * Helper: Busca IDs de todas as ofertas ativas de um usuário
 * Usado pela rota /api/sales (RecentSalesTable)
 */
const getActiveOfferIds = async (ownerId: string): Promise<mongoose.Types.ObjectId[]> => {
  const activeOffers = await Offer.find({
    ownerId: new mongoose.Types.ObjectId(ownerId),
    isActive: true
  }).select("_id").lean();
  return activeOffers.map(offer => offer._id as mongoose.Types.ObjectId);
};

/**
 * Helper: Busca IDs de TODAS as ofertas de um usuário (sem filtrar por isActive)
 * Usado pelas métricas do dashboard (KPIs, gráficos)
 */
const getAllOfferIds = async (ownerId: string): Promise<mongoose.Types.ObjectId[]> => {
  const offers = await Offer.find({
    ownerId: new mongoose.Types.ObjectId(ownerId)
  }).select("_id").lean();
  return offers.map(offer => offer._id as mongoose.Types.ObjectId);
};

/**
 * Registra um evento de métrica (View ou Initiate Checkout)
 * Público: Não requer autenticação (pois é chamado pelo checkout do cliente)
 */
export const handleTrackMetric = async (req: Request, res: Response) => {
  const { offerId, type, fbc, fbp, email, phone, name, eventId, totalAmount, contentIds } = req.body;

  // Resposta imediata para não travar o cliente (Fire and Forget)
  res.status(200).send();

  // Todo o processamento async é isolado em try-catch próprio
  // para evitar unhandled rejections após o response
  try {
    const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "";
    const userAgent = req.headers["user-agent"] || "";
    const referer = req.headers["referer"] || "";

    if (!offerId || !["view", "view_total", "initiate_checkout"].includes(type)) {
      return;
    }

    // --- PROTEÇÃO CONTRA DUPLICIDADE (ANTI-POLLUTION) ---
    // Apenas para 'view'. Para 'view_total' e 'initiate_checkout' queremos registrar todas as tentativas.
    if (type === "view") {
      // Define janela de 24 horas atrás
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const alreadyViewed = await CheckoutMetric.exists({
        offerId,
        type: "view",
        ip: ip, // Verifica o mesmo IP
        createdAt: { $gte: oneDayAgo }, // Nos últimos 24h
      });

      if (alreadyViewed) {
        // Se já viu hoje, ignoramos (não salva no banco)
        // Isso impede que um F5 suje as métricas
        return;
      }
    }
    // ----------------------------------------------------

    // Salva métrica local (sem await para não travar se não quiser, mas aqui vamos esperar para buscar a offer)
    await CheckoutMetric.create({
      offerId,
      type,
      ip,
      userAgent,
    });

    // --- INTEGRAÇÃO FACEBOOK CAPI ---
    // Se for initiate_checkout, buscamos a oferta para pegar os pixels
    if (type === "initiate_checkout") {
      // Busca todos os campos necessários incluindo múltiplos pixels
      const offer = await Offer.findById(offerId, "facebookPixelId facebookAccessToken facebookPixels currency mainProduct name slug").lean();

      if (offer) {
        // Coleta TODOS os pixels configurados (novo array + campo antigo para retrocompatibilidade)
        const pixels: Array<{ pixelId: string; accessToken: string }> = [];

        // Adiciona pixels do novo array
        if (offer.facebookPixels && offer.facebookPixels.length > 0) {
          pixels.push(...offer.facebookPixels);
        }

        // Adiciona pixel antigo se existir e não estiver no array novo (retrocompatibilidade)
        if (offer.facebookPixelId && offer.facebookAccessToken) {
          const alreadyExists = pixels.some(p => p.pixelId === offer.facebookPixelId);
          if (!alreadyExists) {
            pixels.push({
              pixelId: offer.facebookPixelId,
              accessToken: offer.facebookAccessToken,
            });
          }
        }

        // Se houver pixels configurados, envia evento para TODOS
        if (pixels.length > 0) {
          // Cria userData completo com TODOS os dados disponíveis
          const userData = createFacebookUserData(
            ip,
            userAgent,
            email, // Email do cliente
            phone, // Telefone do cliente
            name, // Nome do cliente
            fbc, // Cookie Facebook
            fbp // Cookie Facebook
          );

          // Calcula valor total correto (já vem em centavos do frontend)
          const valueInCurrency = totalAmount ? totalAmount / 100 : ((offer.mainProduct as any).priceInCents || 0) / 100;

          // IDs de produtos (mainProduct + bumps selecionados)
          const productIds = contentIds && contentIds.length > 0
            ? contentIds
            : [(offer.mainProduct as any)._id?.toString()];

          // Payload do evento
          const eventPayload = {
            event_name: "InitiateCheckout" as const,
            event_time: Math.floor(Date.now() / 1000),
            event_id: eventId, // event_id para deduplicação com Pixel
            event_source_url: referer || `https://pay.spappcheckout.com/c/${offer.slug}`,
            action_source: "website" as const,
            user_data: userData,
            custom_data: {
              currency: offer.currency || "BRL",
              value: valueInCurrency,
              content_ids: productIds,
              content_type: "product",
            },
          };

          // Envia para TODOS os pixels configurados em paralelo com tratamento individual de erros

          // Promise.allSettled garante que todos os pixels sejam processados, mesmo se algum falhar
          const results = await Promise.allSettled(
            pixels.map((pixel, index) =>
              sendFacebookEvent(pixel.pixelId, pixel.accessToken, eventPayload)
                .then(() => {
                })
                .catch((err) => {
                  console.error(`❌ Erro ao enviar InitiateCheckout para pixel ${index + 1}/${pixels.length} (${pixel.pixelId}):`, err);
                  throw err; // Re-lança para que o Promise.allSettled capture como rejected
                })
            )
          );

          // Log do resumo final
          const successful = results.filter(r => r.status === 'fulfilled').length;
          const failed = results.filter(r => r.status === 'rejected').length;

          // Log detalhado dos erros
          results.forEach((result, index) => {
            if (result.status === 'rejected') {
              console.error(`❌ Detalhes do erro pixel ${index + 1} (${pixels[index].pixelId}):`, result.reason);
            }
          });
        }
      }
    }
    // -------------------------------
  } catch (error) {
    console.error("Erro tracking:", error);
    // Não precisa responder res.status, pois já respondemos no início
  }
};

/**
 * Envia evento InitiateCheckout apenas para o Facebook CAPI
 * NÃO salva no CheckoutMetric (dashboard)
 * Público: Chamado pelo checkout quando a página carrega
 */
export const handleFacebookInitiateCheckout = async (req: Request, res: Response) => {
  const { offerId, eventId, totalAmount, contentIds, email, phone, name, fbc, fbp, city, state, zipCode, country } = req.body;

  // Resposta imediata para não travar o cliente (Fire and Forget)
  res.status(200).send();

  // Processamento async isolado para evitar unhandled rejections
  try {
    if (!offerId) return;

    const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "";
    const userAgent = req.headers["user-agent"] || "";
    const referer = req.headers["referer"] || "";

    // Busca a oferta para pegar os pixels do Facebook
    const offer = await Offer.findById(offerId, "facebookPixelId facebookAccessToken facebookPixels currency mainProduct slug").lean();

    if (!offer) return;

    // Coleta TODOS os pixels configurados (novo array + campo antigo para retrocompatibilidade)
    const pixels: Array<{ pixelId: string; accessToken: string }> = [];

    // Adiciona pixels do novo array
    if (offer.facebookPixels && offer.facebookPixels.length > 0) {
      pixels.push(...offer.facebookPixels);
    }

    // Adiciona pixel antigo se existir e não estiver no array novo (retrocompatibilidade)
    if (offer.facebookPixelId && offer.facebookAccessToken) {
      const alreadyExists = pixels.some(p => p.pixelId === offer.facebookPixelId);
      if (!alreadyExists) {
        pixels.push({
          pixelId: offer.facebookPixelId,
          accessToken: offer.facebookAccessToken,
        });
      }
    }

    // Se houver pixels configurados, envia evento para TODOS
    if (pixels.length > 0) {
      // Cria userData com TODOS os dados disponíveis
      const userData = createFacebookUserData(
        ip,
        userAgent,
        email,
        phone,
        name,
        fbc,
        fbp,
        city,
        state,
        zipCode,
        country
      );

      // Calcula valor total correto (já vem em centavos do frontend)
      const valueInCurrency = totalAmount ? totalAmount / 100 : ((offer.mainProduct as any).priceInCents || 0) / 100;

      // IDs de produtos
      const productIds = contentIds && contentIds.length > 0
        ? contentIds
        : [(offer.mainProduct as any)._id?.toString()];

      // Payload do evento
      const eventPayload = {
        event_name: "InitiateCheckout" as const,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        event_source_url: referer || `https://pay.snappcheckout.com/c/${offer.slug}`,
        action_source: "website" as const,
        user_data: userData,
        custom_data: {
          currency: offer.currency || "BRL",
          value: valueInCurrency,
          content_ids: productIds,
          content_type: "product",
        },
      };

      // Envia para TODOS os pixels configurados em paralelo

      await Promise.allSettled(
        pixels.map((pixel) =>
          sendFacebookEvent(pixel.pixelId, pixel.accessToken, eventPayload)
            .catch((err) => console.error(`❌ Erro Facebook CAPI pixel ${pixel.pixelId}:`, err))
        )
      );
    }
  } catch (error) {
    console.error("Erro Facebook InitiateCheckout:", error);
  }
};

/**
 * Retorna o funil de conversão detalhado por oferta
 * Protegido: Apenas para o dono da oferta (Admin)
 * Suporta filtros de data via query params: startDate e endDate
 */
export const handleGetConversionFunnel = async (req: Request, res: Response) => {
  try {
    const ownerId = req.userId!;
    const startDateParam = req.query.startDate as string | undefined;
    const endDateParam = req.query.endDate as string | undefined;

    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    const startDate = startDateParam ? new Date(startDateParam) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: "Datas inválidas." });
    }

    // Busca TODAS as ofertas (métricas do dashboard não filtram por isActive)
    const offers = await Offer.find({ ownerId }).select("_id name slug checkoutStarted").lean();
    if (!offers.length) return res.status(200).json([]);

    const offerIds = offers.map((offer) => offer._id);

    // Usa aggregation para agrupar por oferta no MongoDB (sem carregar tudo na memória)
    const [metricsByOffer, salesByOffer] = await Promise.all([
      CheckoutMetric.aggregate([
        { $match: { offerId: { $in: offerIds }, createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: { offerId: "$offerId", type: "$type" }, count: { $sum: 1 } } },
      ]),

      Sale.aggregate([
        { $match: { offerId: { $in: offerIds }, status: "succeeded", createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: "$offerId", revenue: { $sum: "$totalAmountInCents" }, count: { $sum: 1 } } },
      ]),
    ]);

    // Monta maps para acesso rápido
    const metricsMap = new Map<string, { view: number; view_total: number; initiate_checkout: number }>();
    for (const m of metricsByOffer) {
      const offId = m._id.offerId.toString();
      if (!metricsMap.has(offId)) metricsMap.set(offId, { view: 0, view_total: 0, initiate_checkout: 0 });
      const entry = metricsMap.get(offId)!;
      if (m._id.type === "view") entry.view = m.count;
      else if (m._id.type === "view_total") entry.view_total = m.count;
      else if (m._id.type === "initiate_checkout") entry.initiate_checkout = m.count;
    }

    const salesMap = new Map<string, { revenue: number; count: number }>();
    for (const s of salesByOffer) {
      salesMap.set(s._id.toString(), { revenue: s.revenue, count: s.count });
    }

    const metrics = offers.map((offer) => {
      const currentOfferId = offer._id.toString();
      const offerMetric = metricsMap.get(currentOfferId) || { view: 0, view_total: 0, initiate_checkout: 0 };
      const offerSale = salesMap.get(currentOfferId) || { revenue: 0, count: 0 };

      const views = offerMetric.view;
      const totalViews = offerMetric.view_total;
      const initiatedCheckout = offerMetric.initiate_checkout;
      const purchases = offerSale.count;
      const conversionRate = views > 0 ? (purchases / views) * 100 : 0;

      return {
        _id: currentOfferId,
        offerName: offer.name,
        slug: offer.slug,
        views,
        totalViews,
        initiatedCheckout,
        purchases,
        revenue: offerSale.revenue,
        conversionRate,
      };
    });

    metrics.sort((a, b) => b.revenue - a.revenue);

    res.status(200).json(metrics);
  } catch (error) {
    console.error("Erro no funil:", error);
    res.status(500).json({ error: { message: (error as Error).message } });
  }
};

export const handleGetSalesMetrics = async (req: Request, res: Response) => {
  try {
    const ownerId = req.userId!;
    const daysParam = req.query.days ? parseInt(req.query.days as string) : 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysParam);
    startDate.setHours(0, 0, 0, 0);

    // Usa aggregation para agrupar por data no MongoDB (sem carregar docs na memória)
    const metrics = await Sale.aggregate([
      {
        $match: {
          ownerId: new mongoose.Types.ObjectId(ownerId),
          status: "succeeded",
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$totalAmountInCents" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json(metrics);
  } catch (error) {
    console.error("Erro metrics:", error);
    res.status(500).json({ error: { message: (error as Error).message } });
  }
};

export const handleGetOffersRevenue = async (req: Request, res: Response) => {
  try {
    const ownerId = req.userId!;

    const days = parseInt(req.query.days as string) || 30;
    const filterOfferId = req.query.offerId as string | undefined;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const matchStage: any = {
      ownerId: new mongoose.Types.ObjectId(ownerId),
      status: "succeeded",
      createdAt: { $gte: startDate },
    };

    if (filterOfferId && filterOfferId !== "all") {
      matchStage.offerId = new mongoose.Types.ObjectId(filterOfferId);
    }

    // Aggregation: agrupa por oferta no MongoDB
    const aggregated = await Sale.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$offerId",
          revenue: { $sum: "$totalAmountInCents" },
          salesCount: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    // Busca nomes das ofertas em uma única query
    const offerIds = aggregated.map((a) => a._id);
    const offers = await Offer.find({ _id: { $in: offerIds } }, "name").lean();
    const offerNameMap = new Map(offers.map((o) => [o._id.toString(), o.name]));

    const metrics = aggregated.map((a) => ({
      _id: a._id.toString(),
      offerName: offerNameMap.get(a._id.toString()) || "Oferta Removida",
      revenue: a.revenue,
      salesCount: a.salesCount,
    }));

    res.status(200).json(metrics);
  } catch (error) {
    console.error("Erro Offers Revenue:", error);
    res.status(500).json({ error: { message: (error as Error).message } });
  }
};

// overview dashboard
/**
 * Retorna o faturamento total de uma oferta específica (histórico completo)
 * Protegido: Apenas para o dono da oferta
 */
export const handleGetOfferTotalRevenue = async (req: Request, res: Response) => {
  try {
    const ownerId = req.userId!;
    const offerId = req.query.offerId as string;

    if (!offerId) {
      return res.status(400).json({ error: "offerId é obrigatório" });
    }

    // Verifica se a oferta pertence ao usuário
    const offer = await Offer.findOne({ _id: offerId, ownerId });
    if (!offer) {
      return res.status(404).json({ error: "Oferta não encontrada" });
    }

    // Usa aggregation para calcular total no MongoDB
    const result = await Sale.aggregate([
      {
        $match: {
          offerId: new mongoose.Types.ObjectId(offerId),
          status: "succeeded",
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmountInCents" },
          totalSales: { $sum: 1 },
        },
      },
    ]);

    const totalRevenueInBRL = result.length > 0 ? result[0].totalRevenue : 0;
    const totalSales = result.length > 0 ? result[0].totalSales : 0;

    res.status(200).json({
      offerId,
      offerName: offer.name,
      totalRevenue: totalRevenueInBRL, // Em centavos BRL
      totalSales,
      averageTicket: totalSales > 0 ? totalRevenueInBRL / totalSales : 0,
    });
  } catch (error) {
    console.error("Erro ao buscar faturamento total da oferta:", error);
    res.status(500).json({ error: { message: (error as Error).message } });
  }
};

/**
 * Helper: Converte valores agregados por moeda para BRL usando convertToBRLSync
 * Recebe array de { currency, total } e retorna soma em BRL
 */
function convertAggregatedToBRL(byCurrency: Array<{ currency: string; total: number }>): number {
  let totalBRL = 0;
  for (const entry of byCurrency) {
    totalBRL += convertToBRLSync(entry.total, entry.currency || "BRL");
  }
  return totalBRL;
}

/**
 * Dashboard Overview - Versão otimizada com MongoDB Aggregation
 * Em vez de carregar 5000+ vendas e iterar com await, usa pipelines de aggregation
 * que computam KPIs diretamente no banco, retornando apenas os totais.
 */
export const handleGetDashboardOverview = async (req: Request, res: Response) => {
  try {
    const ownerId = req.userId!;

    const daysParam = req.query.days ? parseInt(req.query.days as string) : 30;
    const startDateParam = req.query.startDate as string | undefined;
    const endDateParam = req.query.endDate as string | undefined;
    const filterOfferId = req.query.offerId as string | undefined;

    let startDate: Date;
    let endDate: Date;

    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
    } else {
      endDate = new Date();
      startDate = new Date();
      if (daysParam === 1) {
        startDate.setHours(0, 0, 0, 0);
      } else {
        startDate.setDate(startDate.getDate() - daysParam);
        startDate.setHours(0, 0, 0, 0);
      }
    }

    // --- LÓGICA DE GRANULARIDADE ---
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const hoursDiff = Math.ceil(diffTime / (1000 * 60 * 60));
    const isHourly = hoursDiff <= 25;

    let offerIds: any[];
    if (filterOfferId && filterOfferId !== "all") {
      const offer = await Offer.findOne({ _id: filterOfferId, ownerId }, "_id");
      if (!offer) return res.status(404).json({ error: "Oferta não encontrada" });
      offerIds = [offer._id];
    } else {
      const allOfferIds = await getAllOfferIds(ownerId);
      offerIds = allOfferIds;
    }

    const baseMatch = {
      ownerId: new mongoose.Types.ObjectId(ownerId),
      status: "succeeded",
      createdAt: { $gte: startDate, $lte: endDate },
      offerId: { $in: offerIds },
    };

    // --- PERÍODO ANTERIOR PARA COMPARAÇÃO ---
    const periodDiffMs = endDate.getTime() - startDate.getTime();
    const previousStartDate = new Date(startDate.getTime() - periodDiffMs);
    const previousEndDate = new Date(startDate);

    const previousMatch = {
      ownerId: new mongoose.Types.ObjectId(ownerId),
      status: "succeeded",
      createdAt: { $gte: previousStartDate, $lt: previousEndDate },
      offerId: { $in: offerIds },
    };

    // Formato de agrupamento para gráficos
    const dateGroupExpr = isHourly
      ? { $dateToString: { format: "%Y-%m-%dT%H", date: "$createdAt", timezone: "America/Sao_Paulo" } }
      : { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "America/Sao_Paulo" } };

    // === TODAS AS AGGREGATIONS EM PARALELO ===
    const [
      // Período atual
      kpiAgg,
      chartAgg,
      topOffersAgg,
      topCountriesAgg,
      topProductsAgg,
      failedCount,
      metricsCounts,
      metricsChartAgg,
      // Período anterior
      prevKpiAgg,
      prevFailedCount,
      prevMetricsCounts,
    ] = await Promise.all([
      // 1. KPIs do período atual - agrupados por moeda para conversão
      Sale.aggregate([
        { $match: baseMatch },
        {
          $facet: {
            // Total geral por moeda
            totalByCurrency: [
              {
                $group: {
                  _id: "$currency",
                  total: { $sum: "$totalAmountInCents" },
                  count: { $sum: 1 },
                },
              },
            ],
            // Upsells por moeda
            upsellByCurrency: [
              { $match: { isUpsell: true } },
              {
                $group: {
                  _id: "$currency",
                  total: { $sum: "$totalAmountInCents" },
                  count: { $sum: 1 },
                },
              },
            ],
            // Order bumps - unwind items para pegar isOrderBump
            orderBumpByCurrency: [
              { $match: { isUpsell: { $ne: true } } },
              { $unwind: "$items" },
              { $match: { "items.isOrderBump": true } },
              {
                $group: {
                  _id: "$currency",
                  total: { $sum: "$items.priceInCents" },
                  count: { $sum: 1 },
                },
              },
            ],
            // Breakdown por gateway+moeda
            byGateway: [
              {
                $group: {
                  _id: {
                    gateway: {
                      $ifNull: ["$gateway", { $ifNull: ["$paymentMethod", "stripe"] }],
                    },
                    currency: "$currency",
                  },
                  total: { $sum: "$totalAmountInCents" },
                },
              },
            ],
            // Contagem total
            totalCount: [
              { $count: "count" },
            ],
          },
        },
      ]),

      // 2. Dados do gráfico - agrupados por data + moeda
      Sale.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: {
              date: dateGroupExpr,
              currency: "$currency",
            },
            revenue: { $sum: "$totalAmountInCents" },
            salesCount: { $sum: 1 },
          },
        },
        { $sort: { "_id.date": 1 } },
      ]),

      // 3. Top ofertas
      Sale.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: { offerId: "$offerId", currency: "$currency" },
            total: { $sum: "$totalAmountInCents" },
            count: { $sum: 1 },
          },
        },
      ]),

      // 4. Top países
      Sale.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: { country: { $ifNull: ["$country", "BR"] }, currency: "$currency" },
            total: { $sum: "$totalAmountInCents" },
            count: { $sum: 1 },
          },
        },
      ]),

      // 5. Top produtos (upsells + order bumps)
      Sale.aggregate([
        { $match: baseMatch },
        { $unwind: "$items" },
        {
          $match: {
            $or: [
              { isUpsell: true },
              { "items.isOrderBump": true },
            ],
          },
        },
        {
          $group: {
            _id: { name: { $ifNull: ["$items.name", "Produto sem nome"] }, currency: "$currency" },
            total: { $sum: "$items.priceInCents" },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
        { $limit: 20 }, // Pega mais que 5 para consolidar por moeda depois
      ]),

      // 6. Contagem de falhas
      Sale.countDocuments({
        ownerId: new mongoose.Types.ObjectId(ownerId),
        status: "failed",
        createdAt: { $gte: startDate, $lte: endDate },
        offerId: { $in: offerIds },
      }),

      // 7. Métricas de checkout (views, initiate_checkout) - contagem
      CheckoutMetric.aggregate([
        {
          $match: {
            offerId: { $in: offerIds },
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: "$type",
            count: { $sum: 1 },
          },
        },
      ]),

      // 8. Métricas de checkout por período (para gráficos)
      CheckoutMetric.aggregate([
        {
          $match: {
            offerId: { $in: offerIds },
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: {
              date: dateGroupExpr,
              type: "$type",
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.date": 1 } },
      ]),

      // === PERÍODO ANTERIOR ===
      // 9. KPIs anteriores
      Sale.aggregate([
        { $match: previousMatch },
        {
          $facet: {
            totalByCurrency: [
              {
                $group: {
                  _id: "$currency",
                  total: { $sum: "$totalAmountInCents" },
                  count: { $sum: 1 },
                },
              },
            ],
            upsellByCurrency: [
              { $match: { isUpsell: true } },
              {
                $group: {
                  _id: "$currency",
                  total: { $sum: "$totalAmountInCents" },
                  count: { $sum: 1 },
                },
              },
            ],
            orderBumpByCurrency: [
              { $match: { isUpsell: { $ne: true } } },
              { $unwind: "$items" },
              { $match: { "items.isOrderBump": true } },
              {
                $group: {
                  _id: "$currency",
                  total: { $sum: "$items.priceInCents" },
                  count: { $sum: 1 },
                },
              },
            ],
            totalCount: [
              { $count: "count" },
            ],
          },
        },
      ]),

      // 10. Falhas anteriores
      Sale.countDocuments({
        ownerId: new mongoose.Types.ObjectId(ownerId),
        status: "failed",
        createdAt: { $gte: previousStartDate, $lt: previousEndDate },
        offerId: { $in: offerIds },
      }),

      // 11. Métricas checkout anteriores
      CheckoutMetric.aggregate([
        {
          $match: {
            offerId: { $in: offerIds },
            createdAt: { $gte: previousStartDate, $lt: previousEndDate },
          },
        },
        {
          $group: {
            _id: "$type",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // === PROCESSAR RESULTADOS (tudo síncrono, sem await em loops) ===

    const currentKpi = kpiAgg[0];
    const prevKpi = prevKpiAgg[0];

    // --- KPIs do período atual ---
    const totalSales = currentKpi.totalCount[0]?.count || 0;
    const totalRevenueInBRL = convertAggregatedToBRL(
      currentKpi.totalByCurrency.map((r: any) => ({ currency: r._id || "BRL", total: r.total }))
    );

    // Upsells
    let upsellRevenueInBRL = 0;
    let upsellCount = 0;
    for (const entry of currentKpi.upsellByCurrency) {
      upsellRevenueInBRL += convertToBRLSync(entry.total, entry._id || "BRL");
      upsellCount += entry.count;
    }

    // Order bumps
    let orderBumpRevenueInBRL = 0;
    for (const entry of currentKpi.orderBumpByCurrency) {
      orderBumpRevenueInBRL += convertToBRLSync(entry.total, entry._id || "BRL");
    }

    const extraRevenueInBRL = upsellRevenueInBRL + orderBumpRevenueInBRL;
    const isolatedProductRevenueInBRL = totalRevenueInBRL - extraRevenueInBRL;

    // Contagem de upsells: vendas com isUpsell + vendas com orderBumps
    // Para contar vendas com orderBump (não-upsell), usamos a contagem das que têm pelo menos 1 orderBump
    const salesWithOrderBumps = currentKpi.orderBumpByCurrency.reduce((acc: number, e: any) => acc + e.count, 0);
    const totalUpsellCount = upsellCount + (salesWithOrderBumps > 0 ? salesWithOrderBumps : 0);

    const averageTicket = totalSales > 0 ? totalRevenueInBRL / totalSales : 0;
    const averageUpsellTicket = totalUpsellCount > 0 ? extraRevenueInBRL / totalUpsellCount : 0;

    // Gateway breakdown
    const revenueByGateway: Record<string, number> = { stripe: 0, paypal: 0, pagarme: 0 };
    for (const entry of currentKpi.byGateway) {
      const gateway = entry._id.gateway || "stripe";
      const amountBRL = convertToBRLSync(entry.total, entry._id.currency || "BRL");
      revenueByGateway[gateway] = (revenueByGateway[gateway] || 0) + amountBRL;
    }

    // Métricas de checkout
    const metricsCountMap = new Map<string, number>();
    for (const m of metricsCounts) {
      metricsCountMap.set(m._id, m.count);
    }
    const totalVisitors = metricsCountMap.get("view") || 0;
    const checkoutsInitiatedCount = metricsCountMap.get("initiate_checkout") || 0;
    const conversionRate = totalVisitors > 0 ? (totalSales / totalVisitors) * 100 : 0;
    const checkoutApprovalRate = checkoutsInitiatedCount > 0 ? (totalSales / checkoutsInitiatedCount) * 100 : 0;

    // Payment approval
    const totalFailedSales = failedCount;
    const totalPaymentAttempts = totalSales + totalFailedSales;
    const paymentApprovalRate = totalPaymentAttempts > 0 ? (totalSales / totalPaymentAttempts) * 100 : 0;

    // --- GRÁFICOS ---
    const dailyMap = new Map<string, { revenue: number; salesCount: number; visitorsCount: number; checkoutCount: number; label: string }>();

    const formatKeyAndLabel = (dateKey: string) => {
      if (isHourly) {
        // dateKey format: YYYY-MM-DDTHH (from MongoDB)
        const date = new Date(dateKey + ":00:00");
        const label = date.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
        return { key: dateKey, label };
      } else {
        return { key: dateKey, label: dateKey };
      }
    };

    // Inicializar gaps
    let current = new Date(startDate);
    const endLoop = new Date(endDate);

    while (current <= endLoop || (isHourly && current.getDate() === endLoop.getDate() && current.getHours() <= endLoop.getHours())) {
      let key: string;
      let label: string;

      if (isHourly) {
        const brDate = new Date(current.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
        const y = brDate.getFullYear();
        const m = (brDate.getMonth() + 1).toString().padStart(2, "0");
        const d = brDate.getDate().toString().padStart(2, "0");
        const h = brDate.getHours().toString().padStart(2, "0");
        key = `${y}-${m}-${d}T${h}`;
        label = `${h}:00`;
      } else {
        const brDate = new Date(current.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
        const y = brDate.getFullYear();
        const m = (brDate.getMonth() + 1).toString().padStart(2, "0");
        const d = brDate.getDate().toString().padStart(2, "0");
        key = `${y}-${m}-${d}`;
        label = key;
      }

      if (!dailyMap.has(key)) {
        dailyMap.set(key, { revenue: 0, salesCount: 0, visitorsCount: 0, checkoutCount: 0, label });
      }

      if (isHourly) {
        current.setHours(current.getHours() + 1);
      } else {
        current.setDate(current.getDate() + 1);
      }
    }

    // Preencher com dados reais dos gráficos (já agrupados pelo MongoDB)
    for (const entry of chartAgg) {
      const key = entry._id.date;
      if (dailyMap.has(key)) {
        const data = dailyMap.get(key)!;
        data.revenue += convertToBRLSync(entry.revenue, entry._id.currency || "BRL");
        data.salesCount += entry.salesCount;
      }
    }

    // Métricas de checkout no gráfico
    for (const entry of metricsChartAgg) {
      const key = entry._id.date;
      if (dailyMap.has(key)) {
        const data = dailyMap.get(key)!;
        if (entry._id.type === "view") {
          data.visitorsCount += entry.count;
        } else if (entry._id.type === "initiate_checkout") {
          data.checkoutCount += entry.count;
        }
      }
    }

    const sortedKeys = Array.from(dailyMap.keys()).sort();

    const revenueChart = sortedKeys.map((key) => ({ date: dailyMap.get(key)!.label, value: dailyMap.get(key)!.revenue / 100 }));
    const salesChart = sortedKeys.map((key) => ({ date: dailyMap.get(key)!.label, value: dailyMap.get(key)!.salesCount }));
    const visitorsChart = sortedKeys.map((key) => ({ date: dailyMap.get(key)!.label, value: dailyMap.get(key)!.visitorsCount }));
    const checkoutsChart = sortedKeys.map((key) => ({ date: dailyMap.get(key)!.label, value: dailyMap.get(key)!.checkoutCount }));

    const ticketChart = sortedKeys.map((key) => {
      const data = dailyMap.get(key)!;
      return { date: data.label, value: data.salesCount > 0 ? Math.round(data.revenue / data.salesCount / 100) : 0 };
    });

    const conversionRateChart = sortedKeys.map((key) => {
      const data = dailyMap.get(key)!;
      return {
        date: data.label,
        value: data.visitorsCount > 0 ? parseFloat(((data.salesCount / data.visitorsCount) * 100).toFixed(2)) : 0,
      };
    });

    // --- TOP LISTS ---
    // Top ofertas - consolida moedas
    const allOfferDetails = await Offer.find({ _id: { $in: offerIds } }, "name").lean();
    const offerNameMap = new Map(allOfferDetails.map((o) => [o._id.toString(), o.name]));

    const offersConsolidated = new Map<string, { name: string; revenue: number; count: number }>();
    for (const entry of topOffersAgg) {
      const oId = entry._id.offerId.toString();
      const name = offerNameMap.get(oId) || "Oferta Removida";
      const amountBRL = convertToBRLSync(entry.total, entry._id.currency || "BRL");
      const existing = offersConsolidated.get(oId) || { name, revenue: 0, count: 0 };
      existing.revenue += amountBRL;
      existing.count += entry.count;
      offersConsolidated.set(oId, existing);
    }
    const topOffers = Array.from(offersConsolidated.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((o) => ({ ...o, value: o.revenue / 100 }));

    // Top países
    const countriesConsolidated = new Map<string, { revenue: number; count: number }>();
    for (const entry of topCountriesAgg) {
      const country = entry._id.country;
      const amountBRL = convertToBRLSync(entry.total, entry._id.currency || "BRL");
      const existing = countriesConsolidated.get(country) || { revenue: 0, count: 0 };
      existing.revenue += amountBRL;
      existing.count += entry.count;
      countriesConsolidated.set(country, existing);
    }
    const topCountries = Array.from(countriesConsolidated.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .map(([name, data]) => ({ name, value: data.revenue / 100, count: data.count }));

    // Top produtos
    const productsConsolidated = new Map<string, { name: string; revenue: number; count: number }>();
    for (const entry of topProductsAgg) {
      const pName = entry._id.name;
      const amountBRL = convertToBRLSync(entry.total, entry._id.currency || "BRL");
      const existing = productsConsolidated.get(pName) || { name: pName, revenue: 0, count: 0 };
      existing.revenue += amountBRL;
      existing.count += entry.count;
      productsConsolidated.set(pName, existing);
    }
    const topProducts = Array.from(productsConsolidated.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((p) => ({ name: p.name, value: p.revenue / 100, count: p.count }));

    // --- KPIs DO PERÍODO ANTERIOR ---
    const prevTotalSales = prevKpi.totalCount[0]?.count || 0;
    const previousTotalRevenueInBRL = convertAggregatedToBRL(
      prevKpi.totalByCurrency.map((r: any) => ({ currency: r._id || "BRL", total: r.total }))
    );

    let prevUpsellRevenueInBRL = 0;
    let prevUpsellCount = 0;
    for (const entry of prevKpi.upsellByCurrency) {
      prevUpsellRevenueInBRL += convertToBRLSync(entry.total, entry._id || "BRL");
      prevUpsellCount += entry.count;
    }

    let prevOrderBumpRevenueInBRL = 0;
    for (const entry of prevKpi.orderBumpByCurrency) {
      prevOrderBumpRevenueInBRL += convertToBRLSync(entry.total, entry._id || "BRL");
    }

    const previousExtraRevenueInBRL = prevUpsellRevenueInBRL + prevOrderBumpRevenueInBRL;
    const prevSalesWithOrderBumps = prevKpi.orderBumpByCurrency.reduce((acc: number, e: any) => acc + e.count, 0);
    const prevTotalUpsellCount = prevUpsellCount + (prevSalesWithOrderBumps > 0 ? prevSalesWithOrderBumps : 0);
    const previousAverageUpsellTicket = prevTotalUpsellCount > 0 ? previousExtraRevenueInBRL / prevTotalUpsellCount : 0;

    const previousAverageTicket = prevTotalSales > 0 ? previousTotalRevenueInBRL / prevTotalSales : 0;

    const prevMetricsMap = new Map<string, number>();
    for (const m of prevMetricsCounts) {
      prevMetricsMap.set(m._id, m.count);
    }
    const previousTotalVisitors = prevMetricsMap.get("view") || 0;
    const previousCheckoutsInitiatedCount = prevMetricsMap.get("initiate_checkout") || 0;
    const previousConversionRate = previousTotalVisitors > 0 ? (prevTotalSales / previousTotalVisitors) * 100 : 0;
    const previousCheckoutApprovalRate = previousCheckoutsInitiatedCount > 0 ? (prevTotalSales / previousCheckoutsInitiatedCount) * 100 : 0;

    const previousTotalFailedSales = prevFailedCount;
    const previousTotalPaymentAttempts = prevTotalSales + previousTotalFailedSales;
    const previousPaymentApprovalRate = previousTotalPaymentAttempts > 0 ? (prevTotalSales / previousTotalPaymentAttempts) * 100 : 0;

    // Calcular porcentagens de mudança
    const calculateChangePercentage = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    res.status(200).json({
      kpis: {
        totalRevenue: totalRevenueInBRL,
        totalSales,
        totalVisitors,
        averageTicket,
        extraRevenue: extraRevenueInBRL,
        averageUpsellTicket,
        isolatedProductRevenue: isolatedProductRevenueInBRL,
        orderBumpRevenue: orderBumpRevenueInBRL,
        upsellRevenue: upsellRevenueInBRL,
        conversionRate,
        totalOrders: totalSales,
        checkoutsInitiated: checkoutsInitiatedCount,
        checkoutApprovalRate,

        // NOVA MÉTRICA: Taxa de Aprovação de Pagamentos
        paymentApprovalRate,
        totalPaymentAttempts,
        totalFailedPayments: totalFailedSales,

        // Breakdown por gateway
        revenueByGateway,

        // Comparações com período anterior
        totalRevenueChange: calculateChangePercentage(totalRevenueInBRL, previousTotalRevenueInBRL),
        extraRevenueChange: calculateChangePercentage(extraRevenueInBRL, previousExtraRevenueInBRL),
        averageUpsellTicketChange: calculateChangePercentage(averageUpsellTicket, previousAverageUpsellTicket),
        totalOrdersChange: calculateChangePercentage(totalSales, prevTotalSales),
        averageTicketChange: calculateChangePercentage(averageTicket, previousAverageTicket),
        totalVisitorsChange: calculateChangePercentage(totalVisitors, previousTotalVisitors),
        conversionRateChange: calculateChangePercentage(conversionRate, previousConversionRate),
        checkoutApprovalRateChange: calculateChangePercentage(checkoutApprovalRate, previousCheckoutApprovalRate),
        paymentApprovalRateChange: calculateChangePercentage(paymentApprovalRate, previousPaymentApprovalRate),
      },
      charts: {
        revenue: revenueChart,
        sales: salesChart,
        ticket: ticketChart,
        visitors: visitorsChart,
        checkouts: checkoutsChart,
        conversionRate: conversionRateChart,
      },
      topOffers,
      topProducts,
      topCountries,
    });
  } catch (error) {
    console.error("Erro Dashboard Overview:", error);
    res.status(500).json({ error: { message: (error as Error).message } });
  }
};
