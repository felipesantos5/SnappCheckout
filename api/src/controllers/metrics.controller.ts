import { Request, Response } from "express";
import Sale from "../models/sale.model";
import CheckoutMetric from "../models/checkout-metric.model";
import mongoose from "mongoose";
import Offer from "../models/offer.model";

/**
 * Registra um evento de métrica (View ou Initiate Checkout)
 * Público: Não requer autenticação (pois é chamado pelo checkout do cliente)
 */
export const handleTrackMetric = async (req: Request, res: Response) => {
  try {
    const { offerId, type } = req.body;

    // Pega o IP real do cliente (considerando proxy/load balancer)
    const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "";
    const userAgent = req.headers["user-agent"] || "";

    if (!offerId || !["view", "initiate_checkout"].includes(type)) {
      return res.status(400).json({ error: "Dados inválidos." });
    }

    // Fire & Forget: Salva sem travar a resposta
    await CheckoutMetric.create({
      offerId,
      type,
      ip,
      userAgent,
    });

    res.status(200).send();
  } catch (error) {
    // Silencioso em caso de erro para não quebrar o checkout do cliente
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

    // Pipeline de agregação para cruzar Vendas e Métricas
    const metrics = await mongoose.model("Offer").aggregate([
      {
        $match: { ownerId: new mongoose.Types.ObjectId(ownerId) },
      },
      // 1. Buscar Métricas (Views e Initiates)
      {
        $lookup: {
          from: "checkoutmetrics",
          localField: "_id",
          foreignField: "offerId",
          as: "metrics",
        },
      },
      // 2. Buscar Vendas Aprovadas
      {
        $lookup: {
          from: "sales",
          let: { offerId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ["$offerId", "$$offerId"] }, { $eq: ["$status", "succeeded"] }],
                },
              },
            },
          ],
          as: "sales",
        },
      },
      // 3. Projetar e Calcular Totais
      {
        $project: {
          offerName: "$name",
          slug: "$slug",
          views: {
            $size: {
              $filter: { input: "$metrics", as: "m", cond: { $eq: ["$$m.type", "view"] } },
            },
          },
          initiatedCheckout: {
            $size: {
              $filter: { input: "$metrics", as: "m", cond: { $eq: ["$$m.type", "initiate_checkout"] } },
            },
          },
          purchases: { $size: "$sales" },
          revenue: { $sum: "$sales.totalAmountInCents" },
        },
      },
      // 4. Calcular Conversão (Evitar divisão por zero)
      {
        $addFields: {
          conversionRate: {
            $cond: [{ $eq: ["$views", 0] }, 0, { $multiply: [{ $divide: ["$purchases", "$views"] }, 100] }],
          },
        },
      },
      { $sort: { revenue: -1 } }, // Ordenar por receita
    ]);

    res.status(200).json(metrics);
  } catch (error) {
    console.error("Erro no funil de conversão:", error);
    res.status(500).json({ error: { message: (error as Error).message } });
  }
};

// Manter as funções antigas (handleGetSalesMetrics, etc.) abaixo...
export const handleGetSalesMetrics = async (req: Request, res: Response) => {
  // ... (Código existente do seu arquivo original)
  try {
    const ownerId = req.userId!;
    const daysParam = req.query.days ? parseInt(req.query.days as string) : 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysParam);
    startDate.setHours(0, 0, 0, 0);

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
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "America/Sao_Paulo" },
          },
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
  // ... (Código existente do seu arquivo original)
  try {
    const ownerId = req.userId!;

    const metrics = await Sale.aggregate([
      {
        $match: {
          ownerId: new mongoose.Types.ObjectId(ownerId),
          status: "succeeded",
        },
      },
      {
        $group: {
          _id: "$offerId",
          revenue: { $sum: "$totalAmountInCents" },
        },
      },
      {
        $lookup: {
          from: "offers",
          localField: "_id",
          foreignField: "_id",
          as: "offerData",
        },
      },
      {
        $unwind: "$offerData",
      },
      {
        $project: {
          offerName: "$offerData.name",
          revenue: 1,
        },
      },
      { $sort: { revenue: -1 } },
    ]);

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

    // 1. IDs das ofertas (para filtrar visitantes)
    const myOffers = await Offer.find({ ownerId }, "_id");
    const offerIds = myOffers.map((o) => o._id);

    // 2. KPIs Totais (Big Numbers)
    const salesStats = await Sale.aggregate([
      {
        $match: {
          ownerId: new mongoose.Types.ObjectId(ownerId),
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

    const { totalRevenue, totalSales } = salesStats[0] || { totalRevenue: 0, totalSales: 0 };
    const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    const totalVisitors = await CheckoutMetric.countDocuments({
      offerId: { $in: offerIds },
      type: "view",
    });

    // 3. Gráficos (Histórico de 30 dias)

    // A) Agregação Diária de Vendas (Receita e Quantidade)
    const salesDaily = await Sale.aggregate([
      {
        $match: {
          ownerId: new mongoose.Types.ObjectId(ownerId),
          status: "succeeded",
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "America/Sao_Paulo" } },
          dailyRevenue: { $sum: "$totalAmountInCents" },
          dailyCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // B) Agregação Diária de Visitantes
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

    // 4. Montar resposta formatada para os gráficos
    // Mapeamos os resultados do banco para o formato { date, value }

    const revenueChart = salesDaily.map((i) => ({
      date: i._id,
      value: i.dailyRevenue,
    }));

    const salesChart = salesDaily.map((i) => ({
      date: i._id,
      value: i.dailyCount,
    }));

    const ticketChart = salesDaily.map((i) => ({
      date: i._id,
      value: i.dailyCount > 0 ? Math.round(i.dailyRevenue / i.dailyCount) : 0,
    }));

    const visitorsChart = visitorsDaily.map((i) => ({
      date: i._id,
      value: i.dailyCount,
    }));

    res.status(200).json({
      kpis: {
        totalRevenue,
        totalSales,
        totalVisitors,
        averageTicket,
      },
      charts: {
        revenue: revenueChart,
        sales: salesChart,
        ticket: ticketChart,
        visitors: visitorsChart,
      },
    });
  } catch (error) {
    console.error("Erro Dashboard Overview:", error);
    res.status(500).json({ error: { message: (error as Error).message } });
  }
};
