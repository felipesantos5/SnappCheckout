// src/controllers/sale.controller.ts
import { Request, Response } from "express";
import Sale from "../models/sale.model";
import * as saleService from "../services/sale.service";

export const getSales = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      offerId,
      status,
      country,
      paymentMethod,
      walletType,
      email,
      startDate,
      endDate
    } = req.query;
    const userId = (req as any).user.uid; // Assumindo que você pega o ID do user no middleware

    // Query Base: Sempre filtrar pelo dono (segurança)
    const query: any = { ownerId: userId };

    // 1. Filtro por Oferta (Opcional)
    if (offerId && offerId !== "all") {
      query.offerId = offerId;
    }

    // 2. Filtro por Status
    if (status && status !== "all") {
      query.status = status;
    } else if (!status) {
      // Default seguro: mostrar apenas vendas reais se nada for especificado
      query.status = "succeeded";
    }

    // 3. Filtro por País
    if (country && country !== "all") {
      query.country = country;
    }

    // 4. Filtro por Método de Pagamento
    if (paymentMethod && paymentMethod !== "all") {
      query.paymentMethod = paymentMethod;
    }

    // 5. Filtro por Wallet Type
    if (walletType && walletType !== "all") {
      if (walletType === "none") {
        // Filtra apenas vendas sem wallet (cartão normal)
        query.walletType = null;
      } else {
        query.walletType = walletType;
      }
    }

    // 6. Busca por Email (case-insensitive, partial match)
    if (email) {
      query.customerEmail = { $regex: email, $options: "i" };
    }

    // 7. Filtro por Data
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate as string);
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999); // Fim do dia
        query.createdAt.$lte = end;
      }
    }

    // Busca com paginação e ordenação por mais recente
    const salesRaw = await Sale.find(query)
      .select("-updatedAt -__v") // Performance: remove campos inúteis
      .populate({
        path: "offerId",
        select: "name slug isActive",
        match: { isActive: true }, // Filtra apenas ofertas ativas
      })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .lean(); // Converte para objeto JS puro para melhor performance

    // Remove vendas onde offerId é null (ofertas inativas filtradas pelo match)
    const sales = salesRaw.filter(sale => sale.offerId !== null);

    // Recalcula o total considerando apenas ofertas ativas
    const totalSalesWithActiveOffers = await Sale.find(query)
      .populate({
        path: "offerId",
        select: "_id isActive",
        match: { isActive: true },
      })
      .then(results => results.filter(sale => sale.offerId !== null).length);

    const total = totalSalesWithActiveOffers;

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

/**
 * Busca uma venda pelo ID (público) - Usado para polling de status
 */
export const handleGetSaleById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const sale = await saleService.getSaleById(id);

    if (!sale) {
      return res.status(404).json({ error: { message: "Venda não encontrada." } });
    }

    res.status(200).json(sale);
  } catch (error) {
    res.status(500).json({ error: { message: (error as Error).message } });
  }
};
