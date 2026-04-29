// src/controllers/auth.controller.ts
import { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { CreateUserPayload, LoginPayload } from "../types/auth.types";
import User from "../models/user.model";

export const handleRegister = async (req: Request, res: Response) => {
  try {
    const payload = req.body as CreateUserPayload;
    // TODO: Adicionar validação (Zod, etc.)
    const user = await authService.registerUser(payload);

    // Não retornamos a senha
    const userResponse = user.toObject();
    delete userResponse.passwordHash;

    res.status(201).json(userResponse);
  } catch (error) {
    res.status(400).json({ error: { message: (error as Error).message } });
  }
};

export const handleLogin = async (req: Request, res: Response) => {
  try {
    const payload = req.body as LoginPayload;
    const token = await authService.loginUser(payload);
    res.status(200).json({ token });
  } catch (error) {
    res.status(401).json({ error: { message: (error as Error).message } });
  }
};

// Rota protegida para buscar o usuário logado
export const handleGetMe = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: { message: "Usuário não encontrado." } });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: { message: (error as Error).message } });
  }
};

// Rota protegida para reconhecer um milestone de faturamento
export const handleAcknowledgeMilestone = async (req: Request, res: Response) => {
  try {
    const { milestone } = req.body as { milestone: string };
    if (!milestone) {
      return res.status(400).json({ error: { message: "milestone é obrigatório." } });
    }
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $addToSet: { acknowledgedMilestones: milestone } },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ error: { message: "Usuário não encontrado." } });
    }
    res.status(200).json({ acknowledgedMilestones: user.acknowledgedMilestones });
  } catch (error) {
    res.status(500).json({ error: { message: (error as Error).message } });
  }
};
