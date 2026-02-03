// src/app.ts
import express, { Express, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import "dotenv/config";
import mainRouter from "./routes";
import stripeWebhookRouter from "./webhooks/stripe/stripe-webhook.routes";
import paypalWebhookRouter from "./webhooks/paypal/paypal-webhook.routes";
import pagarmeWebhookRouter from "./webhooks/pagarme/pagarme-webhook.routes";
import { isMongoHealthy } from "./lib/db";

const app: Express = express();

app.set("trust proxy", 1);

// Configuração de segurança com Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
      },
    },
    crossOriginEmbedderPolicy: false, // Necessário para Stripe e integrações externas
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Permite recursos de diferentes origens
  })
);

app.use(
  cors({
    origin: true, // <--- ISSO LIBERA PARA QUALQUER URL (mantendo credentials funcionando)
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "sentry-trace", "baggage"],
  })
);

// Rate limiting global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 400, // Limite de 100 requisições por IP
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

// Webhooks que precisam de RAW body (Stripe)
app.use("/api/webhooks/stripe", stripeWebhookRouter);

// Middleware para parsear JSON (Global) - limite de 1MB para prevenir abuso
app.use(express.json({ limit: "1mb" }));

// Webhooks que podem usar JSON parseado
app.use("/api/webhooks/paypal", paypalWebhookRouter);
app.use("/api/webhooks/pagarme", pagarmeWebhookRouter);

// Rota de "health check" - verifica API + MongoDB
app.get("/health", async (req: Request, res: Response) => {
  const dbHealthy = await isMongoHealthy();
  if (dbHealthy) {
    res.status(200).json({ status: "ok", db: "connected" });
  } else {
    res.status(503).json({ status: "degraded", db: "disconnected" });
  }
});

// Monta o roteador principal na rota /api
app.use("/api", mainRouter);

// Global error handler - captura erros síncronos de middlewares e rotas
// DEVE ser o último middleware registrado
app.use((err: any, req: Request, res: Response, _next: any) => {
  // Log do erro para debug (sem expor detalhes ao cliente)
  console.error(`❌ [Express Error] ${req.method} ${req.path}:`, err.message || err);

  if (res.headersSent) {
    return; // Se já respondeu, não tenta responder de novo
  }

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: {
      message: process.env.NODE_ENV === "production"
        ? "Erro interno do servidor"
        : err.message || "Erro interno do servidor",
    },
  });
});

export default app;
