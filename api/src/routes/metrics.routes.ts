// src/routes/sale.routes.ts
import { Router } from "express";
import * as metricsController from "../controllers/metrics.controller";
import { protectRoute } from "../middleware/auth.middleware";

const router = Router();

// --- ROTA NOVA (Coloque ANTES da rota /offer/:id) ---
// GET /api/sales/metrics?days=30
router.post("/track", metricsController.handleTrackMetric);

// Rotas Privadas: O Dashboard chama isso
router.get("/", protectRoute, metricsController.handleGetSalesMetrics);
router.get("/offers-ranking", protectRoute, metricsController.handleGetOffersRevenue);
router.get("/funnel", protectRoute, metricsController.handleGetConversionFunnel);
router.get("/overview", protectRoute, metricsController.handleGetDashboardOverview);

export default router;
