import { Request, Response } from "express";
import mongoose from "mongoose";
import EmailLog from "../models/email-log.model";

export const getEmailLogs = async (req: Request, res: Response) => {
  try {
    const ownerId = req.userId!;
    const {
      page = 1,
      limit = 20,
      type,
      status,
      offerId,
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

    if (offerId && offerId !== "all") {
      query.offerId = new mongoose.Types.ObjectId(offerId as string);
    }

    if (startDate || endDate) {
      query.sentAt = {};
      if (startDate) query.sentAt.$gte = new Date(startDate as string);
      if (endDate) query.sentAt.$lte = new Date(endDate as string);
    }

    if (search) {
      query.$or = [
        { to: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
      ];
    }

    const [logs, total] = await Promise.all([
      EmailLog.find(query)
        .select("-htmlContent") // não retorna o HTML na listagem
        .populate({ path: "offerId", select: "name slug" })
        .sort({ sentAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean(),
      EmailLog.countDocuments(query),
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
    console.error("Erro ao listar logs de email:", error);
    return res.status(500).json({ error: "Erro interno ao buscar logs de email." });
  }
};

export const getEmailLogHtml = async (req: Request, res: Response) => {
  try {
    const ownerId = req.userId!;
    const { id } = req.params;

    const log = await EmailLog.findOne({
      _id: id,
      ownerId: new mongoose.Types.ObjectId(ownerId),
    }).select("htmlContent subject to customerName type sentAt status");

    if (!log) {
      return res.status(404).json({ error: "Log não encontrado." });
    }

    return res.json({
      _id: log._id,
      subject: log.subject,
      to: log.to,
      customerName: log.customerName,
      type: log.type,
      sentAt: log.sentAt,
      status: log.status,
      htmlContent: log.htmlContent,
    });
  } catch (error) {
    console.error("Erro ao buscar HTML do email:", error);
    return res.status(500).json({ error: "Erro interno." });
  }
};
