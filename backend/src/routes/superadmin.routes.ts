import { Router } from "express";
import rateLimit from "express-rate-limit";
import { superAdminLogin, getSuperAdminStats, getSuperAdminUsers, updateUserFee } from "../controllers/superadmin.controller";
import { protectSuperAdmin } from "../middleware/superadmin.middleware";

const router = Router();

// Strict rate limit on login — 10 attempts per 15 min per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Muitas tentativas. Tente novamente em 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/auth", loginLimiter, superAdminLogin);
router.get("/stats", protectSuperAdmin, getSuperAdminStats);
router.get("/users", protectSuperAdmin, getSuperAdminUsers);
router.patch("/users/:userId/fee", protectSuperAdmin, updateUserFee);

export default router;
