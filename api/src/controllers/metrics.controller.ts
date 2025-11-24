import { Request, Response } from "express";
import Sale from "../models/sale.model";
import CheckoutMetric from "../models/checkout-metric.model";
import mongoose from "mongoose";
import Offer from "../models/offer.model";
import { sendFacebookEvent, createFacebookUserData } from "../services/facebook.service";
import { convertToBRL } from "../services/currency-conversion.service";

/**
 * Registra um evento de métrica (View ou Initiate Checkout)
 * Público: Não requer autenticação (pois é chamado pelo checkout do cliente)
 */
export const handleTrackMetric = async (req: Request, res: Response) => {
  try {
    const { offerId, type, fbc, fbp } = req.body;

    res.status(200).send();

    const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "";
    const userAgent = req.headers["user-agent"] || "";
    const referer = req.headers["referer"] || "";

    if (!offerId || !["view", "initiate_checkout"].includes(type)) {
      return res.status(400).json({ error: "Dados inválidos." });
    }

    // Salva métrica local (sem await para não travar se não quiser, mas aqui vamos esperar para buscar a offer)
    await CheckoutMetric.create({
      offerId,
      type,
      ip,
      userAgent,
    });

    // --- INTEGRAÇÃO FACEBOOK CAPI ---
    // Se for initiate_checkout, buscamos a oferta para pegar o pixel
    if (type === "initiate_checkout") {
      // Busca apenas os campos necessários para performance
      const offer = await Offer.findById(offerId, "facebookPixelId facebookAccessToken currency mainProduct name slug");

      if (offer && offer.facebookPixelId && offer.facebookAccessToken) {
        const userData = createFacebookUserData(ip, userAgent);

        // Adicione fbc e fbp ao userData se existirem
        if (fbc) userData.fbc = fbc;
        if (fbp) userData.fbp = fbp;
        // Dispara evento em background (sem await para não atrasar resposta ao cliente)
        sendFacebookEvent(offer.facebookPixelId, offer.facebookAccessToken, {
          event_name: "InitiateCheckout",
          event_time: Math.floor(Date.now() / 1000),
          event_source_url: referer || `https://pay.spappcheckout.com/c/${offer.slug}`,
          action_source: "website",
          user_data: createFacebookUserData(ip, userAgent), // Aqui ainda não temos email/phone
          custom_data: {
            currency: offer.currency || "BRL",
            value: (offer.mainProduct as any).priceInCents ? (offer.mainProduct as any).priceInCents / 100 : 0,
            content_ids: [(offer.mainProduct as any)._id?.toString()],
            content_type: "product",
          },
        }).catch((err) => console.error("Erro async FB initiate:", err));
      }
    }
    // -------------------------------

    res.status(200).send();
  } catch (error) {
    console.error("Erro tracking:", error);
    res.status(200).send();
  }
};

/**
 * Retorna o funil de conversão detalhado por oferta
 * Protegido: Apenas para o dono da oferta (Admin)
 */
export const handleGetConversionFunnel = async (req: Request, res: Response) => {
  try {
    const ownerId = req.userId!;

    // 1. Buscar ofertas do usuário
    const offers = await Offer.find({ ownerId }).select("_id name slug").lean();

    // 2. Para cada oferta, buscar métricas e vendas
    const metricsPromises = offers.map(async (offer) => {
      const offerId = offer._id;

      // Buscar métricas
      const metrics = await CheckoutMetric.find({ offerId }).select("type").lean();
      const views = metrics.filter((m) => m.type === "view").length;
      const initiatedCheckout = metrics.filter((m) => m.type === "initiate_checkout").length;

      // Buscar vendas aprovadas
      const sales = await Sale.find({
        offerId,
        status: "succeeded",
      })
        .select("totalAmountInCents currency")
        .lean();

      // Converter receita para BRL
      let revenueInBRL = 0;
      for (const sale of sales) {
        revenueInBRL += await convertToBRL(sale.totalAmountInCents, sale.currency || "BRL");
      }

      const purchases = sales.length;
      const conversionRate = views > 0 ? (purchases / views) * 100 : 0;

      return {
        _id: offerId.toString(),
        offerName: offer.name,
        slug: offer.slug,
        views,
        initiatedCheckout,
        purchases,
        revenue: revenueInBRL,
        conversionRate,
      };
    });

    const metrics = await Promise.all(metricsPromises);

    // Ordenar por receita
    metrics.sort((a, b) => b.revenue - a.revenue);

    res.status(200).json(metrics);
  } catch (error) {
    console.error("Erro no funil de conversão:", error);
    res.status(500).json({ error: { message: (error as Error).message } });
  }
};

// Manter as funções antigas (handleGetSalesMetrics, etc.) abaixo...
export const handleGetSalesMetrics = async (req: Request, res: Response) => {
  try {
    const ownerId = req.userId!;
    const daysParam = req.query.days ? parseInt(req.query.days as string) : 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysParam);
    startDate.setHours(0, 0, 0, 0);

    // Buscar vendas com moeda
    const sales = await Sale.find({
      ownerId: new mongoose.Types.ObjectId(ownerId),
      status: "succeeded",
      createdAt: { $gte: startDate },
    })
      .select("totalAmountInCents currency createdAt")
      .lean();

    // Agrupar por data e converter para BRL
    const dailyMetricsMap = new Map<string, { revenue: number; count: number }>();

    for (const sale of sales) {
      const dateStr = sale.createdAt.toISOString().split("T")[0];
      const revenueInBRL = await convertToBRL(sale.totalAmountInCents, sale.currency || "BRL");

      const existing = dailyMetricsMap.get(dateStr) || { revenue: 0, count: 0 };
      existing.revenue += revenueInBRL;
      existing.count += 1;
      dailyMetricsMap.set(dateStr, existing);
    }

    // Converter para array e ordenar
    const metrics = Array.from(dailyMetricsMap.entries())
      .map(([date, data]) => ({
        _id: date,
        revenue: data.revenue,
        count: data.count,
      }))
      .sort((a, b) => a._id.localeCompare(b._id));

    res.status(200).json(metrics);
  } catch (error) {
    console.error("Erro metrics:", error);
    res.status(500).json({ error: { message: (error as Error).message } });
  }
};

export const handleGetOffersRevenue = async (req: Request, res: Response) => {
  try {
    const ownerId = req.userId!;

    // Buscar todas as vendas com moeda e oferta
    const sales = await Sale.find({
      ownerId: new mongoose.Types.ObjectId(ownerId),
      status: "succeeded",
    })
      .select("totalAmountInCents currency offerId")
      .populate("offerId", "name")
      .lean();

    // Agrupar por oferta e converter para BRL
    const offerRevenueMap = new Map<string, { offerName: string; revenue: number }>();

    for (const sale of sales) {
      const offerId = (sale.offerId as any)?._id?.toString();
      const offerName = (sale.offerId as any)?.name || "Oferta Removida";

      if (!offerId) continue;

      const revenueInBRL = await convertToBRL(sale.totalAmountInCents, sale.currency || "BRL");

      const existing = offerRevenueMap.get(offerId) || { offerName, revenue: 0 };
      existing.revenue += revenueInBRL;
      offerRevenueMap.set(offerId, existing);
    }

    // Converter para array e ordenar por receita
    const metrics = Array.from(offerRevenueMap.entries())
      .map(([offerId, data]) => ({
        _id: offerId,
        offerName: data.offerName,
        revenue: data.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    res.status(200).json(metrics);
  } catch (error) {
    console.error("Erro Offers Revenue:", error);
    res.status(500).json({ error: { message: (error as Error).message } });
  }
};

// overview dashboard
export const handleGetDashboardOverview = async (req: Request, res: Response) => {
  try {
    const ownerId = req.userId!;
    const days = 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // 1. IDs das ofertas
    const myOffers = await Offer.find({ ownerId }, "_id");
    const offerIds = myOffers.map((o) => o._id);

    // 2. Buscar todas as vendas com moeda para conversão
    const allSales = await Sale.find({
      ownerId: new mongoose.Types.ObjectId(ownerId),
      status: "succeeded",
    }).lean();

    // 3. Converter e calcular totais
    let totalRevenueInBRL = 0;
    let extraRevenueInBRL = 0;
    const totalSales = allSales.length;

    for (const sale of allSales) {
      // Converte o total da venda para BRL
      const saleAmountInBRL = await convertToBRL(sale.totalAmountInCents, sale.currency || "BRL");
      totalRevenueInBRL += saleAmountInBRL;

      // Calcula receita extra (upsells e order bumps)
      if (sale.isUpsell) {
        extraRevenueInBRL += saleAmountInBRL;
      } else {
        // Soma apenas os order bumps
        for (const item of sale.items) {
          if (item.isOrderBump) {
            const itemAmountInBRL = await convertToBRL(item.priceInCents, sale.currency || "BRL");
            extraRevenueInBRL += itemAmountInBRL;
          }
        }
      }
    }

    const averageTicket = totalSales > 0 ? totalRevenueInBRL / totalSales : 0;

    // Cálculo da Taxa de Conversão
    const totalVisitors = await CheckoutMetric.countDocuments({
      offerId: { $in: offerIds },
      type: "view",
    });

    const conversionRate = totalVisitors > 0 ? (totalSales / totalVisitors) * 100 : 0;

    // 4. Gráficos (Histórico de 30 dias) - Buscar vendas por dia e converter
    const salesByDate = await Sale.find({
      ownerId: new mongoose.Types.ObjectId(ownerId),
      status: "succeeded",
      createdAt: { $gte: startDate },
    })
      .select("totalAmountInCents currency createdAt")
      .lean();

    // Agrupar vendas por data e converter para BRL
    const dailyRevenueMap = new Map<string, { revenue: number; count: number }>();

    for (const sale of salesByDate) {
      const dateStr = sale.createdAt.toISOString().split("T")[0]; // YYYY-MM-DD
      const revenueInBRL = await convertToBRL(sale.totalAmountInCents, sale.currency || "BRL");

      const existing = dailyRevenueMap.get(dateStr) || { revenue: 0, count: 0 };
      existing.revenue += revenueInBRL;
      existing.count += 1;
      dailyRevenueMap.set(dateStr, existing);
    }

    // Converter para array e ordenar
    const salesDaily = Array.from(dailyRevenueMap.entries())
      .map(([date, data]) => ({
        _id: date,
        dailyRevenue: data.revenue,
        dailyCount: data.count,
      }))
      .sort((a, b) => a._id.localeCompare(b._id));

    const visitorsDaily = await CheckoutMetric.aggregate([
      {
        $match: {
          offerId: { $in: offerIds },
          type: "view",
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "America/Sao_Paulo" } },
          dailyCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const revenueChart = salesDaily.map((i) => ({ date: i._id, value: i.dailyRevenue / 100 })); // Envia em Reais para o gráfico
    const salesChart = salesDaily.map((i) => ({ date: i._id, value: i.dailyCount }));
    const ticketChart = salesDaily.map((i) => ({ date: i._id, value: i.dailyCount > 0 ? Math.round(i.dailyRevenue / i.dailyCount / 100) : 0 }));
    const visitorsChart = visitorsDaily.map((i) => ({ date: i._id, value: i.dailyCount }));

    // 5. Calcular taxa de conversão diária
    // Para cada dia, calcular: (vendas / visitantes) * 100
    const conversionRateChart = salesDaily.map((saleDay) => {
      const visitorDay = visitorsDaily.find((v) => v._id === saleDay._id);
      const dailyVisitors = visitorDay?.dailyCount || 0;
      const dailyConversionRate = dailyVisitors > 0 ? (saleDay.dailyCount / dailyVisitors) * 100 : 0;

      return {
        date: saleDay._id,
        value: parseFloat(dailyConversionRate.toFixed(2)), // Taxa em % com 2 decimais
      };
    });

    res.status(200).json({
      kpis: {
        totalRevenue: totalRevenueInBRL,
        totalSales,
        totalVisitors,
        averageTicket,
        extraRevenue: extraRevenueInBRL, // Nova métrica
        conversionRate, // Nova métrica
      },
      charts: {
        revenue: revenueChart,
        sales: salesChart,
        ticket: ticketChart,
        visitors: visitorsChart,
        conversionRate: conversionRateChart, // Nova métrica de gráfico
      },
    });
  } catch (error) {
    console.error("Erro Dashboard Overview:", error);
    res.status(500).json({ error: { message: (error as Error).message } });
  }
};
