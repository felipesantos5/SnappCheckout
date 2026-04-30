import { Request, Response } from "express";
import mongoose from "mongoose";
import IntegrationEventLog from "../models/integration-event-log.model";

export const getIntegrationEventLogs = async (req: Request, res: Response) => {
  try {
    const ownerId = req.userId!;
    const {
      page = 1,
      limit = 20,
      type,
      status,
      startDate,
      endDate,
      search,
    } = req.query;

    const query: any = { ownerId: new mongoose.Types.ObjectId(ownerId) };

    if (type && type !== "all") {
      query.type = type;
    }

    if (status && status !== "all") {
      query.status = status;
    }

    if (startDate || endDate) {
      query.sentAt = {};
      if (startDate) query.sentAt.$gte = new Date(startDate as string);
      if (endDate) query.sentAt.$lte = new Date(endDate as string);
    }

    if (search) {
      query.$or = [
        { customerEmail: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
        { event: { $regex: search, $options: "i" } },
      ];
    }

    const [logs, total] = await Promise.all([
      IntegrationEventLog.find(query)
        .select("-payload")
        .populate({ path: "offerId", select: "name slug" })
        .sort({ sentAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean(),
      IntegrationEventLog.countDocuments(query),
    ]);

    return res.json({
      data: logs,
      meta: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Erro ao listar logs de eventos:", error);
    return res.status(500).json({ error: "Erro interno ao buscar logs de eventos." });
  }
};

export const getIntegrationEventLogDetail = async (req: Request, res: Response) => {
  try {
    const ownerId = req.userId!;
    const { id } = req.params;

    const log = await IntegrationEventLog.findOne({
      _id: id,
      ownerId: new mongoose.Types.ObjectId(ownerId),
    })
      .populate({ path: "offerId", select: "name slug" })
      .lean();

    if (!log) {
      return res.status(404).json({ error: "Log nao encontrado." });
    }

    return res.json(log);
  } catch (error) {
    console.error("Erro ao buscar detalhe do evento:", error);
    return res.status(500).json({ error: "Erro interno." });
  }
};
