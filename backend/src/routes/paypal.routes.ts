import { Router } from "express";
import * as paypalController from "../controllers/paypal.controller";

const router = Router();

// Rota pública para obter o Client ID (usado pelo SDK no frontend)
router.get("/client-id/:offerId", paypalController.getClientId);

router.post("/create-order", paypalController.createOrder);
router.post("/capture-order", paypalController.captureOrder);

export default router;
