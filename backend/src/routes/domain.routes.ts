// src/routes/domain.routes.ts
import { Router } from "express";
import * as domainController from "../controllers/domain.controller";

const router = Router();

// Endpoint para o Caddy verificar se um domínio é autorizado (público, sem auth)
router.get("/ask", domainController.handleAskDomain);

// Endpoint para buscar oferta por domínio (público, sem auth)
router.get("/by-domain", domainController.handleGetOfferByDomain);

// Endpoint para verificar disponibilidade de domínio (requer auth)
router.get("/check-availability", domainController.handleCheckDomainAvailability);

export default router;
