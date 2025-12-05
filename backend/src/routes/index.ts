// src/routes/index.ts
import { Router } from "express";
import authRoutes from "./auth.routes";
import productRoutes from "./product.routes";
import offerRoutes from "./offer.routes";
import paymentRoutes from "./payment.routes";
import payPalRoutes from "./paypal.routes";
import uploadRoutes from "./upload.routes"; // 1. Importe
import saleRoutes from "./sale.routes";
import stripeRoutes from "./stripe.routes";
import metricsRoutes from "./metrics.routes";
import healthRoutes from "./health.routes";
import settingsRoutes from "./settings.routes";
import { getUpsellScript } from "../controllers/script.controller";

const router = Router();

// Rotas de Autenticação
router.use("/auth", authRoutes);

// Rotas para CRUD de Produtos (protegido)
router.use("/products", productRoutes);

// Rotas para CRUD de Ofertas (protegido) e busca pública por slug
router.use("/offers", offerRoutes);

// Rotas de Pagamento (público)
router.use("/payments", paymentRoutes);

// Rotas de Upload (protegido)
router.use("/upload", uploadRoutes);

router.use("/stripe", stripeRoutes);

router.use("/sales", saleRoutes);

router.use("/metrics", metricsRoutes);

router.use("/health", healthRoutes);

router.use("/paypal", payPalRoutes);

router.use("/settings", settingsRoutes);

router.get("/v1/upsell.js", getUpsellScript);

export default router;
