// src/controllers/settings.controller.ts
import { Request, Response } from "express";
import User from "../models/user.model";

export const getSettings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const user = await User.findById(userId).select("+paypalClientSecret");
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    res.status(200).json({
      paypalClientId: user.paypalClientId || "",
      paypalClientSecret: user.paypalClientSecret || "",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { paypalClientId, paypalClientSecret } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    if (paypalClientId !== undefined) {
      user.paypalClientId = paypalClientId;
    }
    if (paypalClientSecret !== undefined) {
      user.paypalClientSecret = paypalClientSecret;
    }

    await user.save();

    res.status(200).json({ message: "Configurações atualizadas com sucesso." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
