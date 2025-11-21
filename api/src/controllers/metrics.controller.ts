import { Request, Response } from "express";
import Sale from "../models/sale.model";
import mongoose from "mongoose";

export const handleGetSalesMetrics = async (req: Request, res: Response) => {
  try {
    const ownerId = req.userId!;
    const daysParam = req.query.days ? parseInt(req.query.days as string) : 30;

    // Calcula a data de início (hoje - X dias)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysParam);
    startDate.setHours(0, 0, 0, 0);

    const metrics = await Sale.aggregate([
      {
        $match: {
          ownerId: new mongoose.Types.ObjectId(ownerId), // Filtra pelo dono
          status: "succeeded", // Apenas vendas aprovadas
          createdAt: { $gte: startDate }, // Apenas a partir da data calculada
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "America/Sao_Paulo" },
          },
          revenue: { $sum: "$totalAmountInCents" }, // Soma o valor total
          count: { $sum: 1 }, // Conta o número de vendas
        },
      },
      { $sort: { _id: 1 } }, // Ordena cronologicamente
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

    const metrics = await Sale.aggregate([
      {
        $match: {
          ownerId: new mongoose.Types.ObjectId(ownerId),
          status: "succeeded", // Somente vendas aprovadas
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
      { $sort: { revenue: -1 } }, // Ordena do maior para o menor
    ]);

    res.status(200).json(metrics);
  } catch (error) {
    console.error("Erro Offers Revenue:", error);
    res.status(500).json({ error: { message: (error as Error).message } });
  }
};
