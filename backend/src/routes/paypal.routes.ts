import { Router } from "express";
import * as paypalController from "../controllers/paypal.controller";

const router = Router();

// Rota pública para obter o Client ID (usado pelo SDK no frontend)
router.get("/client-id/:offerId", paypalController.getClientId);

// Rotas de pagamento
router.post("/create-order", paypalController.createOrder);
router.post("/capture-order", paypalController.captureOrder);

// Rotas de upsell one-click
router.post("/one-click-upsell", paypalController.handlePayPalOneClickUpsell);
router.post("/upsell-refuse", paypalController.handlePayPalUpsellRefuse);

export default router;
