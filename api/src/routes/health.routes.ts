import { Router } from "express";
import { handleHealthCheck, handlePaymentReadiness } from "../controllers/health.controller";

const router = Router();

/**
 * GET /api/health
 * Retorna status completo do sistema
 */
router.get("/", handleHealthCheck);

/**
 * GET /api/health/payments
 * Verifica apenas se o sistema pode processar pagamentos
 */
router.get("/payments", handlePaymentReadiness);

export default router;
