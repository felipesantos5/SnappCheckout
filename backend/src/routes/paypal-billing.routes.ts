import { Router } from "express";
import { getBillingStatus, initiatePayment, confirmPayment } from "../controllers/paypal-billing.controller";
import { protectRoute } from "../middleware/auth.middleware";

const router = Router();

router.get("/status", protectRoute, getBillingStatus);
router.post("/pay", protectRoute, initiatePayment);
router.post("/confirm", protectRoute, confirmPayment);

export default router;
