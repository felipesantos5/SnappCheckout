// src/app.ts
import express, { Express, Request, Response } from "express";
import cors from "cors";
import "dotenv/config"; // Garante que o .env seja lido
import mainRouter from "./routes"; // Nosso roteador principal
import stripeWebhookRouter from "./webhooks/stripe/stripe-webhook.routes";

const app: Express = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://localhost:5173",
  "http://localhost:5174",
  "https://admin.snappcheckout.com",
  "https://checkout.abatools.pro",
  "https://abatools.pro",
  "http://31.97.30.228:8088",
  "https://snappcheckout.com",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // 1. Permite requisições sem 'origin' (como Postman, Insomnia ou chamadas server-to-server)
      if (!origin) return callback(null, true);

      // 2. Verifica se a origem está na whitelist
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // (Opcional) 3. Permite subdomínios dinâmicos (ex: deploy previews da Vercel)
      if (origin.endsWith(".vercel.app")) {
        return callback(null, true);
      }

      console.log(`🚫 CORS Bloqueado: ${origin}`);
      return callback(new Error("Bloqueado pelo CORS policy"));
    },
    credentials: true, // IMPORTANTE: Permite enviar Cookies e Headers de Auth
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "sentry-trace", "baggage"],
  })
);

// app.use(cors({ origin: "*" }));

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
