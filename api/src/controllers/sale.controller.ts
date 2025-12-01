// src/controllers/sale.controller.ts
import { Request, Response } from "express";
import Sale from "../models/sale.model";
import * as saleService from "../services/sale.service";

export const getSales = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, offerId, status } = req.query;
    const userId = (req as any).user.uid; // Assumindo que você pega o ID do user no middleware

    // Query Base: Sempre filtrar pelo dono (segurança)
    const query: any = { ownerId: userId };

    // 1. Filtro por Oferta (Opcional)
    if (offerId) {
      query.offerId = offerId;
    }

    // 2. Filtro por Status (CRÍTICO PARA O QUE VOCÊ QUER)
    // Se o frontend mandar ?status=failed, trazemos as falhas.
    // Se mandar ?status=succeeded, trazemos as vendas.
    // Se não mandar nada, trazemos apenas sucessos (padrão de dashboard)
    if (status && status !== "all") {
      query.status = status;
    } else if (!status) {
      // Default seguro: mostrar apenas vendas reais se nada for especificado
      query.status = "succeeded";
    }

    // Busca com paginação e ordenação por mais recente
    const sales = await Sale.find(query)
      .select("-updatedAt -__v") // Performance: remove campos inúteis
      .populate("offerId", "name slug") // Traz nome da oferta
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Sale.countDocuments(query);

    return res.json({
      data: sales,
      meta: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Erro ao listar vendas:", error);
    return res.status(500).json({ error: "Erro interno ao buscar vendas." });
  }
};

/**
 * Lista todas as vendas pertencentes ao usuário logado (vendedor)
 */
export const handleListMySales = async (req: Request, res: Response) => {
  try {
    const ownerId = req.userId!;
    const sales = await saleService.listMySales(ownerId); // Chama o serviço
    res.status(200).json(sales);
  } catch (error) {
    res.status(500).json({ error: { message: (error as Error).message } });
  }
};

// --- CONTROLLER NOVO ADICIONADO AQUI ---
/**
 * Lista todas as vendas de UMA OFERTA
 */
export const handleListSalesByOffer = async (req: Request, res: Response) => {
  try {
    const ownerId = req.userId!;
    const { offerId } = req.params; // Pega o ID da oferta pela URL

    if (!offerId) {
      return res.status(400).json({ error: { message: "ID da oferta é obrigatório." } });
    }

    const sales = await saleService.listSalesByOffer(ownerId, offerId);
    res.status(200).json(sales);
  } catch (error) {
    res.status(500).json({ error: { message: (error as Error).message } });
  }
};
