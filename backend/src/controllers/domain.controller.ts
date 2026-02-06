// src/controllers/domain.controller.ts
import { Request, Response } from "express";
import Offer from "../models/offer.model";

/**
 * Endpoint para o Caddy verificar se um domínio é autorizado
 * O Caddy faz uma requisição GET para este endpoint antes de emitir um certificado SSL
 * 
 * @param domain - Query parameter com o domínio a ser verificado
 * @returns 200 OK se o domínio existe, 404 caso contrário
 */
export const handleAskDomain = async (req: Request, res: Response) => {
  try {
    const { domain } = req.query;

    if (!domain || typeof domain !== "string") {
      return res.status(400).send("Domain parameter is required");
    }

    // Normaliza o domínio para lowercase
    const normalizedDomain = domain.toLowerCase().trim();

    // Busca oferta com este domínio customizado
    const offer = await Offer.findOne({ customDomain: normalizedDomain });

    if (offer) {
      return res.status(200).send("OK");
    }

    return res.status(404).send("Not found");
  } catch (error) {
    console.error("Error checking domain:", error);
    return res.status(500).send("Internal server error");
  }
};

/**
 * Busca uma oferta pelo seu domínio customizado
 * Usado pelo frontend quando acessado via domínio customizado
 */
export const handleGetOfferByDomain = async (req: Request, res: Response) => {
  try {
    const { domain } = req.query;

    if (!domain || typeof domain !== "string") {
      return res.status(400).json({ error: { message: "Domain parameter is required" } });
    }

    // Normaliza o domínio para lowercase
    const normalizedDomain = domain.toLowerCase().trim();

    // Busca oferta com este domínio customizado e popula o owner
    const offer = await Offer.findOne({ customDomain: normalizedDomain })
      .populate("ownerId", "stripeAccountId paypalClientId");

    if (!offer) {
      return res.status(404).json({ error: { message: "Oferta não encontrada para este domínio" } });
    }

    return res.status(200).json(offer);
  } catch (error) {
    console.error("Error fetching offer by domain:", error);
    return res.status(500).json({ error: { message: "Erro interno do servidor" } });
  }
};

/**
 * Verifica se um domínio customizado já está em uso
 * Usado pelo admin para validar antes de salvar
 */
export const handleCheckDomainAvailability = async (req: Request, res: Response) => {
  try {
    const { domain, offerId } = req.query;

    if (!domain || typeof domain !== "string") {
      return res.status(400).json({ error: { message: "Domain parameter is required" } });
    }

    // Normaliza o domínio para lowercase
    const normalizedDomain = domain.toLowerCase().trim();

    // Busca oferta com este domínio customizado
    const existingOffer = await Offer.findOne({ customDomain: normalizedDomain });

    // Se não existe, está disponível
    if (!existingOffer) {
      return res.status(200).json({ available: true });
    }

    // Se existe mas é a mesma oferta (edição), está disponível
    if (offerId && (existingOffer._id as any).toString() === offerId) {
      return res.status(200).json({ available: true });
    }

    // Domínio já em uso por outra oferta
    return res.status(200).json({ available: false, usedBy: existingOffer.name });
  } catch (error) {
    console.error("Error checking domain availability:", error);
    return res.status(500).json({ error: { message: "Erro interno do servidor" } });
  }
};
