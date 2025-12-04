// src/app.ts
import express, { Express, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import "dotenv/config";
import mainRouter from "./routes";
import stripeWebhookRouter from "./webhooks/stripe/stripe-webhook.routes";

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
  max: 300, // Limite de 100 requisições por IP
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

app.use("/api/webhooks/stripe", stripeWebhookRouter);

// Middleware para parsear JSON
app.use(express.json());

// Rota de "health check"
app.get("/health", (req: Request, res: Response) => {
  res.status(200).send("API is running!");
});

// Monta o roteador principal na rota /api
app.use("/api", mainRouter);

export default app;
