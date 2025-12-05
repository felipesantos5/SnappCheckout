// src/controllers/offer.controller.ts
import { Request, Response } from "express";
import * as offerService from "../services/offer.service";
import { CreateOfferPayload, UpdateOfferPayload } from "../services/offer.service";

/**
 * Controller para CRIAR uma nova oferta.
 */
export const handleCreateOffer = async (req: Request, res: Response) => {
  try {
    // O req.body (payload) já vem do frontend no formato correto
    // (com mainProduct como objeto e orderBumps como array de objetos)
    const payload = req.body as CreateOfferPayload;
    const ownerId = req.userId!;

    const offer = await offerService.createOffer(payload, ownerId);
    res.status(201).json(offer);
  } catch (error) {
    res.status(400).json({ error: { message: (error as Error).message } });
  }
};

/**
 * Controller para BUSCAR uma oferta pelo SLUG (público)
 */
export const handleGetOfferBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const offer = await offerService.getOfferBySlug(slug);

    if (!offer) {
      return res.status(404).json({ error: { message: "Oferta não encontrada." } });
    }

    // --- IMPLEMENTAÇÃO DO CACHE ---
    // public: qualquer um pode cachear (CDN, Browser)
    // max-age=60: O navegador do cliente guarda por 60 segundos (1 min)
    // s-maxage=600: A CDN da Vercel guarda por 600 segundos (10 min)
    // stale-while-revalidate=30: Aceita dado vencido por +30s enquanto renova em background
    res.set("Cache-Control", "public, max-age=60, s-maxage=600, stale-while-revalidate=30");
    // ------------------------------

    res.status(200).json(offer);
  } catch (error) {
    res.status(500).json({ error: { message: (error as Error).message } });
  }
};

export const handleListMyOffers = async (req: Request, res: Response) => {
  try {
    const ownerId = req.userId!; // Vem do middleware 'protectRoute'
    const offers = await offerService.listOffersByOwner(ownerId);
    res.status(200).json(offers);
  } catch (error) {
    res.status(500).json({ error: { message: (error as Error).message } });
  }
};

export const handleGetOfferById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ownerId = req.userId!;
    const offer = await offerService.getOfferById(id, ownerId);

    if (!offer) {
      return res.status(404).json({ error: { message: "Oferta não encontrada ou não pertence a você." } });
    }
    res.status(200).json(offer);
  } catch (error) {
    res.status(500).json({ error: { message: (error as Error).message } });
  }
};

// --- CONTROLLER NOVO ADICIONADO AQUI ---
/**
 * Controller para ATUALIZAR uma oferta
 */
export const handleUpdateOffer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ownerId = req.userId!;
    const payload = req.body as UpdateOfferPayload;

    const offer = await offerService.updateOffer(id, ownerId, payload);

    if (!offer) {
      return res.status(404).json({ error: { message: "Oferta não encontrada ou não pertence a você." } });
    }
    res.status(200).json(offer);
  } catch (error) {
    res.status(400).json({ error: { message: (error as Error).message } });
  }
};

/**
 * Controller para DELETAR uma oferta
 */
export const handleDeleteOffer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ownerId = req.userId!;

    const deleted = await offerService.deleteOffer(id, ownerId);

    if (!deleted) {
      return res.status(404).json({ error: { message: "Oferta não encontrada ou não pertence a você." } });
    }
    res.status(200).json({ message: "Oferta deletada com sucesso." });
  } catch (error) {
    res.status(400).json({ error: { message: (error as Error).message } });
  }
};

/**
 * Controller para DUPLICAR uma oferta
 */
export const handleDuplicateOffer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ownerId = req.userId!;

    const duplicatedOffer = await offerService.duplicateOffer(id, ownerId);

    if (!duplicatedOffer) {
      return res.status(404).json({ error: { message: "Oferta não encontrada ou não pertence a você." } });
    }
    res.status(201).json(duplicatedOffer);
  } catch (error) {
    res.status(400).json({ error: { message: (error as Error).message } });
  }
};

/**
 * Controller para INCREMENTAR o contador de checkout iniciado (endpoint público)
 */
export const handleIncrementCheckoutStarted = async (req: Request, res: Response) => {
  try {
    const { offerId } = req.body;

    if (!offerId) {
      return res.status(400).json({ error: { message: "offerId é obrigatório." } });
    }

    const updated = await offerService.incrementCheckoutStarted(offerId);

    if (!updated) {
      return res.status(404).json({ error: { message: "Oferta não encontrada." } });
    }

    res.status(200).json({ message: "Checkout iniciado registrado com sucesso." });
  } catch (error) {
    res.status(500).json({ error: { message: (error as Error).message } });
  }
};
