// src/routes/offer.routes.ts
import { Router } from "express";
import * as offerController from "../controllers/offer.controller";
import { protectRoute } from "../middleware/auth.middleware";
import { createResourceLimiter } from "../middleware/rate-limit.middleware";

const router = Router();

// --- Rotas Protegidas (Dashboard) ---

// POST /api/offers (Cria uma nova oferta)
router.post("/", protectRoute, createResourceLimiter, offerController.handleCreateOffer);

// GET /api/offers (Lista todas as ofertas do usuário logado)
router.get("/", protectRoute, offerController.handleListMyOffers);

// --- ROTA NOVA ADICIONADA AQUI ---
// GET /api/offers/:id (Busca UMA oferta por ID para edição)
router.get("/:id", protectRoute, offerController.handleGetOfferById);

// --- ROTA NOVA ADICIONADA AQUI ---
// PUT /api/offers/:id (Atualiza uma oferta)
router.put("/:id", protectRoute, offerController.handleUpdateOffer);

// DELETE /api/offers/:id (Deleta uma oferta)
router.delete("/:id", protectRoute, offerController.handleDeleteOffer);

// POST /api/offers/:id/duplicate (Duplica uma oferta)
router.post("/:id/duplicate", protectRoute, offerController.handleDuplicateOffer);

// --- Rotas Públicas (Checkout) ---

// GET /api/offers/slug/:slug
router.get("/slug/:slug", offerController.handleGetOfferBySlug);

// POST /api/offers/checkout-started (Incrementa contador de checkout iniciado)
router.post("/checkout-started", offerController.handleIncrementCheckoutStarted);

export default router;
