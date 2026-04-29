// src/routes/auth.routes.ts
import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { protectRoute } from "../middleware/auth.middleware";
import { authLimiter } from "../middleware/rate-limit.middleware";

const router = Router();

// (PÚBLICO) Registra um novo "cliente" (usuário do dashboard)
// POST /api/auth/register
router.post("/register", authLimiter, authController.handleRegister);

// (PÚBLICO) Login do cliente
// POST /api/auth/login
router.post("/login", authLimiter, authController.handleLogin);

// (PROTEGIDO) Busca os dados do usuário logado
// GET /api/auth/me
router.get("/me", protectRoute, authController.handleGetMe);

// (PROTEGIDO) Reconhece um milestone de faturamento
// POST /api/auth/acknowledge-milestone
router.post("/acknowledge-milestone", protectRoute, authController.handleAcknowledgeMilestone);

export default router;
