import { Request, Response } from "express";
import Sale from "../models/sale.model";
import CheckoutMetric from "../models/checkout-metric.model";
import mongoose from "mongoose";
import Offer from "../models/offer.model";
import { sendFacebookEvent, createFacebookUserData } from "../services/facebook.service";
import { convertToBRL } from "../services/currency-conversion.service";

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
          console.log(`🔵 Enviando InitiateCheckout para ${pixels.length} pixel(s) [eventID: ${eventId}]`);

          // Promise.allSettled garante que todos os pixels sejam processados, mesmo se algum falhar
          const results = await Promise.allSettled(
            pixels.map((pixel, index) =>
              sendFacebookEvent(pixel.pixelId, pixel.accessToken, eventPayload)
                .then(() => {
                  console.log(`✅ InitiateCheckout enviado com sucesso para pixel ${index + 1}/${pixels.length}: ${pixel.pixelId}`);
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
          console.log(`📊 InitiateCheckout: ${successful} sucesso, ${failed} falhas de ${pixels.length} pixels`);

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
      console.log(`🔵 [Facebook CAPI] Enviando InitiateCheckout para ${pixels.length} pixel(s) [eventID: ${eventId}]`);

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
    // Se o intervalo for menor que 25 horas, agrupamos por hora. Se não, por dia.
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const hoursDiff = Math.ceil(diffTime / (1000 * 60 * 60));
    const isHourly = hoursDiff <= 25; // Define se vamos mostrar horas ou dias
    // -------------------------------

    let offerIds: any[];
    if (filterOfferId && filterOfferId !== "all") {
      const offer = await Offer.findOne({ _id: filterOfferId, ownerId }, "_id");
      if (!offer) return res.status(404).json({ error: "Oferta não encontrada" });
      offerIds = [offer._id];
    } else {
      // Busca TODAS as ofertas (métricas do dashboard não filtram por isActive)
      const allOfferIds = await getAllOfferIds(ownerId);
      offerIds = allOfferIds;
    }

    const [allSales, allFailedSalesCount, allMetrics] = await Promise.all([
      // Vendas aprovadas - seleciona APENAS os campos necessários
      Sale.find({
        ownerId: new mongoose.Types.ObjectId(ownerId),
        status: "succeeded",
        createdAt: { $gte: startDate, $lte: endDate },
        offerId: { $in: offerIds },
      })
        .select("totalAmountInCents currency createdAt offerId isUpsell items.isOrderBump items.name items.priceInCents country gateway paymentMethod")
        .lean(),

      // Vendas falhadas - só precisamos da contagem
      Sale.countDocuments({
        ownerId: new mongoose.Types.ObjectId(ownerId),
        status: "failed",
        createdAt: { $gte: startDate, $lte: endDate },
        offerId: { $in: offerIds },
      }),

      CheckoutMetric.find({
        offerId: { $in: offerIds },
        createdAt: { $gte: startDate, $lte: endDate },
      })
        .select("type createdAt")
        .lean(),
    ]);

    // Calcular KPIs Totais
    let totalRevenueInBRL = 0;
    let extraRevenueInBRL = 0;
    const revenueByGateway: Record<string, number> = {
      stripe: 0,
      paypal: 0,
      pagarme: 0
    };
    const totalSales = allSales.length;

    // Processamento sequencial para evitar race condition em +=
    for (const sale of allSales) {
      const saleAmountInBRL = await convertToBRL(sale.totalAmountInCents, sale.currency || "BRL");
      totalRevenueInBRL += saleAmountInBRL;

      // Breakdown por gateway
      const gateway = sale.gateway || sale.paymentMethod || "stripe";
      revenueByGateway[gateway] = (revenueByGateway[gateway] || 0) + saleAmountInBRL;

      if (sale.isUpsell) {
        extraRevenueInBRL += saleAmountInBRL;
      } else {
        if (sale.items && sale.items.length > 0) {
          for (const item of sale.items) {
            if (item.isOrderBump) {
              const itemAmountInBRL = await convertToBRL(item.priceInCents, sale.currency || "BRL");
              extraRevenueInBRL += itemAmountInBRL;
            }
          }
        }
      }
    }

    const averageTicket = totalSales > 0 ? totalRevenueInBRL / totalSales : 0;
    const views = allMetrics.filter((m) => m.type === "view");
    const checkoutsInitiatedCount = allMetrics.filter((m) => m.type === "initiate_checkout").length;
    const totalVisitors = views.length;
    const conversionRate = totalVisitors > 0 ? (totalSales / totalVisitors) * 100 : 0;
    const checkoutApprovalRate = checkoutsInitiatedCount > 0 ? (totalSales / checkoutsInitiatedCount) * 100 : 0;

    // NOVA MÉTRICA: Taxa de Aprovação de Pagamentos (Aprovados / Total de Tentativas)
    const totalFailedSales = allFailedSalesCount;
    const totalPaymentAttempts = totalSales + totalFailedSales;
    const paymentApprovalRate = totalPaymentAttempts > 0 ? (totalSales / totalPaymentAttempts) * 100 : 0;

    // --- GRÁFICOS (PREENCHIMENTO DE GAPS E FORMATAÇÃO) ---
    const dailyMap = new Map<string, { revenue: number; salesCount: number; visitorsCount: number; label: string }>();

    // Função auxiliar para gerar a chave de agrupamento e o label
    const formatKeyAndLabel = (dateInput: Date | string) => {
      const date = new Date(dateInput);
      if (isHourly) {
        // Chave única: YYYY-MM-DD-HH
        const key = date.toISOString().slice(0, 13); // ex: 2023-10-25T10
        // Label visual: HH:00
        const label = date.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
        return { key, label };
      } else {
        // Chave única: YYYY-MM-DD (usando fuso BR para garantir dia correto)
        const brDate = new Date(date.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
        const key = brDate.toISOString().split("T")[0];
        // Label visual: DD/MM (ou YYYY-MM-DD)
        const label = key; // O frontend já lida bem com YYYY-MM-DD
        return { key, label };
      }
    };

    // 1. Inicializar o mapa com ZEROS para todos os intervalos (Preencher Gaps)
    // Isso garante que o gráfico não fique com buracos ou um ponto só
    let current = new Date(startDate);
    const endLoop = new Date(endDate);

    // Pequena margem de segurança no loop
    while (current <= endLoop || (isHourly && current.getDate() === endLoop.getDate() && current.getHours() <= endLoop.getHours())) {
      const { key, label } = formatKeyAndLabel(current);
      if (!dailyMap.has(key)) {
        dailyMap.set(key, { revenue: 0, salesCount: 0, visitorsCount: 0, label });
      }

      // Incremento
      if (isHourly) {
        current.setHours(current.getHours() + 1);
      } else {
        current.setDate(current.getDate() + 1);
      }
    }

    // 2. Preencher com dados reais
    for (const sale of allSales) {
      const { key } = formatKeyAndLabel(sale.createdAt);
      // Proteção: caso a venda esteja fora do range gerado (raro, mas possível com timezone)
      if (dailyMap.has(key)) {
        const amount = await convertToBRL(sale.totalAmountInCents, sale.currency || "BRL");
        const entry = dailyMap.get(key)!;
        entry.revenue += amount;
        entry.salesCount += 1;
      }
    }

    for (const metric of views) {
      const { key } = formatKeyAndLabel(metric.createdAt);
      if (dailyMap.has(key)) {
        dailyMap.get(key)!.visitorsCount += 1;
      }
    }

    // Ordenar as chaves para o gráfico
    const sortedKeys = Array.from(dailyMap.keys()).sort();

    const revenueChart = sortedKeys.map((key) => ({ date: dailyMap.get(key)!.label, value: dailyMap.get(key)!.revenue / 100 }));
    const salesChart = sortedKeys.map((key) => ({ date: dailyMap.get(key)!.label, value: dailyMap.get(key)!.salesCount }));
    const visitorsChart = sortedKeys.map((key) => ({ date: dailyMap.get(key)!.label, value: dailyMap.get(key)!.visitorsCount }));

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

    // Top Lists (Mesma lógica de antes)
    const offersMap = new Map<string, { name: string; revenue: number; count: number }>();
    const allOfferDetails = await Offer.find({ _id: { $in: offerIds } }, "name").lean();
    const offerNameMap = new Map(allOfferDetails.map((o) => [o._id.toString(), o.name]));

    for (const sale of allSales) {
      const oId = (sale.offerId as any)?.toString();
      if (!oId) continue;
      const name = offerNameMap.get(oId) || "Oferta Removida";
      const amount = await convertToBRL(sale.totalAmountInCents, sale.currency || "BRL");
      const current = offersMap.get(oId) || { name, revenue: 0, count: 0 };
      current.revenue += amount;
      current.count += 1;
      offersMap.set(oId, current);
    }
    const topOffers = Array.from(offersMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((o) => ({ ...o, value: o.revenue / 100 }));

    const topCountriesMap = new Map<string, { revenue: number; count: number }>();
    const topProductsMap = new Map<string, { name: string; revenue: number; count: number }>();

    for (const sale of allSales) {
      const country = sale.country || "BR";
      const amount = await convertToBRL(sale.totalAmountInCents, sale.currency || "BRL");
      const cCurrent = topCountriesMap.get(country) || { revenue: 0, count: 0 };
      cCurrent.revenue += amount;
      cCurrent.count += 1;
      topCountriesMap.set(country, cCurrent);

      if (sale.isUpsell && sale.items && sale.items.length > 0) {
        const pName = sale.items[0].name || "Produto sem nome";
        const pCurrent = topProductsMap.get(pName) || { name: pName, revenue: 0, count: 0 };
        pCurrent.revenue += amount;
        pCurrent.count += 1;
        topProductsMap.set(pName, pCurrent);
      } else if (sale.items) {
        for (const item of sale.items) {
          if (item.isOrderBump) {
            const itemAmount = await convertToBRL(item.priceInCents, sale.currency || "BRL");
            const pName = item.name || "Order Bump";
            const pCurrent = topProductsMap.get(pName) || { name: pName, revenue: 0, count: 0 };
            pCurrent.revenue += itemAmount;
            pCurrent.count += 1;
            topProductsMap.set(pName, pCurrent);
          }
        }
      }
    }
    const topCountries = Array.from(topCountriesMap.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5)
      .map(([name, data]) => ({ name, value: data.revenue / 100, count: data.count }));
    const topProducts = Array.from(topProductsMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((p) => ({ name: p.name, value: p.revenue / 100, count: p.count }));

    // --- CÁLCULO DO PERÍODO ANTERIOR PARA COMPARAÇÃO ---
    const periodDiffMs = endDate.getTime() - startDate.getTime();
    const previousStartDate = new Date(startDate.getTime() - periodDiffMs);
    const previousEndDate = new Date(startDate);

    const [previousSales, previousFailedSalesCount, previousMetrics] = await Promise.all([
      Sale.find({
        ownerId: new mongoose.Types.ObjectId(ownerId),
        status: "succeeded",
        createdAt: { $gte: previousStartDate, $lt: previousEndDate },
        offerId: { $in: offerIds },
      })
        .select("totalAmountInCents currency isUpsell items.isOrderBump items.priceInCents")
        .lean(),

      Sale.countDocuments({
        ownerId: new mongoose.Types.ObjectId(ownerId),
        status: "failed",
        createdAt: { $gte: previousStartDate, $lt: previousEndDate },
        offerId: { $in: offerIds },
      }),

      CheckoutMetric.find({
        offerId: { $in: offerIds },
        createdAt: { $gte: previousStartDate, $lt: previousEndDate },
      })
        .select("type")
        .lean(),
    ]);

    // Calcular KPIs do período anterior (Sequencial)
    let previousTotalRevenueInBRL = 0;
    let previousExtraRevenueInBRL = 0;

    for (const sale of previousSales) {
      const saleAmountInBRL = await convertToBRL(sale.totalAmountInCents, sale.currency || "BRL");
      previousTotalRevenueInBRL += saleAmountInBRL;

      if (sale.isUpsell) {
        previousExtraRevenueInBRL += saleAmountInBRL;
      } else {
        if (sale.items && sale.items.length > 0) {
          for (const item of sale.items) {
            if (item.isOrderBump) {
              const itemAmountInBRL = await convertToBRL(item.priceInCents, sale.currency || "BRL");
              previousExtraRevenueInBRL += itemAmountInBRL;
            }
          }
        }
      }
    }

    const previousTotalSales = previousSales.length;
    const previousAverageTicket = previousTotalSales > 0 ? previousTotalRevenueInBRL / previousTotalSales : 0;
    const previousViews = previousMetrics.filter((m) => m.type === "view");
    const previousCheckoutsInitiatedCount = previousMetrics.filter((m) => m.type === "initiate_checkout").length;
    const previousTotalVisitors = previousViews.length;
    const previousConversionRate = previousTotalVisitors > 0 ? (previousTotalSales / previousTotalVisitors) * 100 : 0;
    const previousCheckoutApprovalRate = previousCheckoutsInitiatedCount > 0 ? (previousTotalSales / previousCheckoutsInitiatedCount) * 100 : 0;

    // Taxa de aprovação de pagamentos do período anterior
    const previousTotalFailedSales = previousFailedSalesCount;
    const previousTotalPaymentAttempts = previousTotalSales + previousTotalFailedSales;
    const previousPaymentApprovalRate = previousTotalPaymentAttempts > 0 ? (previousTotalSales / previousTotalPaymentAttempts) * 100 : 0;

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
        conversionRate,
        totalOrders: totalSales,
        checkoutsInitiated: checkoutsInitiatedCount,
        checkoutApprovalRate,

        // NOVA MÉTRICA: Taxa de Aprovação de Pagamentos
        paymentApprovalRate, // % de pagamentos aprovados do total de tentativas
        totalPaymentAttempts, // Total de tentativas (aprovadas + negadas)
        totalFailedPayments: totalFailedSales, // Total de pagamentos negados

        // Breakdown por gateway
        revenueByGateway,

        // Comparações com período anterior
        totalRevenueChange: calculateChangePercentage(totalRevenueInBRL, previousTotalRevenueInBRL),
        extraRevenueChange: calculateChangePercentage(extraRevenueInBRL, previousExtraRevenueInBRL),
        totalOrdersChange: calculateChangePercentage(totalSales, previousTotalSales),
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
