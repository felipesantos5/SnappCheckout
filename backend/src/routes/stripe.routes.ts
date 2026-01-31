// src/routes/stripe.routes.ts
import { Router } from "express";
import * as stripeController from "../controllers/stripe.controller";
import { protectRoute } from "../middleware/auth.middleware";
import express from "express";
import { handleStripeWebhook } from "../webhooks/stripe/stripe-webhook.controller";

const router = Router();

/**
 * Rota para o usuário (vendedor) obter um link para
 * completar o onboarding do Stripe.
 *
 * POST /api/stripe/onboard-link
 */
router.post(
  "/onboard-link",
  protectRoute, // Apenas usuários logados
  stripeController.handleCreateAccountLink
);

router.post(
  "/webhook",
  express.raw({ type: "application/json" }), // Middleware importante!
  stripeController.handleWebhook // Usa o novo handler com sistema de eventos
);

router.get(
  "/balance",
  protectRoute, // Apenas usuários logados
  stripeController.handleGetBalance
);

export default router;
