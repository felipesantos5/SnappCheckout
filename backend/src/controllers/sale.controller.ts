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
    const userId = req.userId!; // ID do usuário vem do middleware protectRoute

    // Query Base: Sempre filtrar pelo dono (segurança)
    const query: any = { ownerId: userId };

    // 1. Filtro por Oferta (Opcional) - Suporta múltiplas ofertas
    if (offerId && offerId !== "all") {
      if (Array.isArray(offerId)) {
        query.offerId = { $in: offerId };
      } else {
        query.offerId = offerId;
      }
    }

    // 2. Filtro por Status
    if (status && status !== "all") {
      // Se status for um array (múltiplos valores), usa $in
      if (Array.isArray(status)) {
        query.status = { $in: status };
      } else {
        query.status = status;
      }
    }
    // Removido o filtro padrão - mostra todos os status se não especificado

    // 3. Filtro por País
    if (country && country !== "all") {
      query.country = country;
    }

    // 4. Filtro por Método de Pagamento
    // Mapeia valores do frontend para valores do banco:
    // - "credit_card" → paymentMethod: "stripe" (sem wallet)
    // - "pix" → paymentMethod: "pagarme"
    // - "paypal" → paymentMethod: "paypal"
    if (paymentMethod && paymentMethod !== "all") {
      const methods = Array.isArray(paymentMethod) ? paymentMethod : [paymentMethod];
      const mappedMethods: any[] = [];

      methods.forEach((method) => {
        if (method === "credit_card") {
          mappedMethods.push({ paymentMethod: "stripe", walletType: null });
        } else if (method === "pix") {
          mappedMethods.push({ paymentMethod: "pagarme" });
        } else if (method === "paypal") {
          mappedMethods.push({ paymentMethod: "paypal" });
        }
      });

      if (mappedMethods.length === 1) {
        // Único método: adiciona diretamente na query
        Object.assign(query, mappedMethods[0]);
      } else if (mappedMethods.length > 1) {
        // Múltiplos métodos: usa $or
        query.$or = mappedMethods;
      }
    }

    // 5. Filtro por Wallet Type (Apple Pay, Google Pay)
    // Nota: Só aplica se não conflitar com filtro de método de pagamento
    if (walletType && walletType !== "all") {
      // Se já temos walletType definido pelo filtro de método (credit_card = walletType: null),
      // o filtro de wallet tem prioridade
      if (Array.isArray(walletType)) {
        query.walletType = { $in: walletType };
      } else if (walletType === "none") {
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
    const sales = await Sale.find(query)
      .select("-updatedAt -__v") // Performance: remove campos inúteis
      .populate({
        path: "offerId",
        select: "name slug isActive",
        // Removido filtro match: { isActive: true } para mostrar vendas de todas as ofertas
      })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .lean(); // Converte para objeto JS puro para melhor performance

    // Conta o total de vendas (sem filtro de ofertas ativas)
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
