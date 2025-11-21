// src/routes/sale.routes.ts
import { Router } from "express";
import * as metricsController from "../controllers/metrics.controller";
import { protectRoute } from "../middleware/auth.middleware";

const router = Router();

// --- ROTA NOVA (Coloque ANTES da rota /offer/:id) ---
// GET /api/sales/metrics?days=30
router.get("/", protectRoute, metricsController.handleGetSalesMetrics);

router.get("/offers-ranking", protectRoute, metricsController.handleGetOffersRevenue);

export default router;
