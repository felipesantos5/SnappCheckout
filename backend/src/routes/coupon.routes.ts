import { Router } from "express";
import { validateCoupon } from "../controllers/coupon.controller";

const router = Router();

// Público — chamado pelo checkout para validar um cupom
router.post("/validate", validateCoupon);

export default router;
