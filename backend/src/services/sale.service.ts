// src/services/sale.service.ts
import Sale, { ISale } from "../models/sale.model";

/**
 * Lista todas as vendas pertencentes ao usuário logado (vendedor)
 */
export const listMySales = async (ownerId: string): Promise<ISale[]> => {
  try {
    const sales = await Sale.find({ ownerId })
      .populate({
        path: "offerId",
        select: "name currency isActive", // Seleciona nome, moeda e status ativo
        match: { isActive: true }, // Filtra apenas ofertas ativas
      })
      .sort({ createdAt: -1 })
      .limit(100);

    // Remove vendas onde offerId é null (ofertas inativas são filtradas pelo match)
    return sales.filter(sale => sale.offerId !== null);
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
    const sales = await Sale.find({
      ownerId: ownerId,
      offerId: offerId, // Filtro pela oferta
    })
      .populate({
        path: "offerId",
        select: "name currency isActive",
        // SEM FILTRO de isActive - mostra TODAS as vendas da oferta
      })
      .sort({ createdAt: -1 }) // Mais recentes primeiro
      .limit(100); // Limita às últimas 100

    return sales;
  } catch (error) {
    throw new Error("Falha ao buscar vendas da oferta.");
  }
};

/**
 * Busca uma venda pelo ID (público)
 */
export const getSaleById = async (id: string): Promise<ISale | null> => {
  try {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return null;
    }
    return await Sale.findById(id);
  } catch (error) {
    throw new Error("Falha ao buscar venda pelo ID.");
  }
};
