// src/routes/payment.routes.ts
import { Router } from "express";
import * as paymentController from "../controllers/payment.controller";
import { paymentLimiter } from "../middleware/rate-limit.middleware";

const router = Router();

router.post("/create-intent", paymentLimiter, paymentController.handleCreatePaymentIntent);
router.post("/track-cart", paymentController.handleTrackCart);
router.post("/upsell-token", paymentLimiter, paymentController.generateUpsellToken);
router.post("/one-click-upsell", paymentLimiter, paymentController.handleOneClickUpsell);
router.post("/upsell-refuse", paymentLimiter, paymentController.handleRefuseUpsell);

export default router;
