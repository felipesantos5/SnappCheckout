import { Router } from "express";
import express from "express";
import * as paypalWebhookController from "./paypal-webhook.controller";

const router = Router();

/**
 * Rota de webhook do PayPal
 * POST /webhooks/paypal
 *
 * IMPORTANTE: Esta rota usa express.raw() para receber o body como Buffer
 * Isso é necessário para verificar a assinatura do webhook
 */
router.post("/", express.raw({ type: "application/json" }), paypalWebhookController.handlePayPalWebhook);

export default router;
