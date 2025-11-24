// src/services/sale.service.ts
import Sale, { ISale } from "../models/sale.model";

/**
 * Lista todas as vendas pertencentes ao usuário logado (vendedor)
 */
export const listMySales = async (ownerId: string): Promise<ISale[]> => {
  try {
    return await Sale.find({ ownerId })
      .populate({
        path: "offerId",
        select: "name currency", // Seleciona nome e moeda da oferta
      })
      .sort({ createdAt: -1 })
      .limit(100);
    // --- FIM DA MUDANÇA ---
  } catch (error) {
    throw new Error("Falha ao listar vendas.");
  }
};

// --- FUNÇÃO NOVA ADICIONADA AQUI ---
/**
 * Lista todas as vendas de UMA OFERTA específica
 */
export const listSalesByOffer = async (ownerId: string, offerId: string): Promise<ISale[]> => {
  try {
    return await Sale.find({
      ownerId: ownerId,
      offerId: offerId, // Filtro pela oferta
    })
      .sort({ createdAt: -1 }) // Mais recentes primeiro
      .limit(100); // Limita às últimas 100
  } catch (error) {
    throw new Error("Falha ao buscar vendas da oferta.");
  }
};
