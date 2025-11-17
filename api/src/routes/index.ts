// src/routes/index.ts
import { Router } from "express";
import authRoutes from "./auth.routes";
import productRoutes from "./product.routes";
import offerRoutes from "./offer.routes";
import paymentRoutes from "./payment.routes";
import uploadRoutes from "./upload.routes"; // 1. Importe
import saleRoutes from "./sale.routes";
import stripeRoutes from "./stripe.routes";

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
router.use("/upload", uploadRoutes); // 2. Adicione

router.use("/stripe", stripeRoutes); // 2. Adicione

router.use("/sales", saleRoutes);

export default router;
