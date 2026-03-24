// src/server.ts
import http from "http";
import mongoose from "mongoose";
import app from "./app";
import connectDB from "./lib/db";
import { initializeCurrencyService } from "./services/currency-conversion.service";
import { startFacebookPurchaseJob, stopFacebookPurchaseJob } from "./jobs/facebook-purchase.job";

// Flag para evitar múltiplos shutdowns
let isShuttingDown = false;

// Contador de erros consecutivos para detectar cascata
let unhandledRejectionCount = 0;
let lastRejectionReset = Date.now();

process.on("uncaughtException", (error) => {
  console.error("CRITICAL ERROR: Uncaught Exception:", error);
  // uncaughtException é irrecuperável - encerra o processo
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("WARNING: Unhandled Rejection at:", promise, "reason:", reason);

  // Reseta o contador a cada 60 segundos
  if (Date.now() - lastRejectionReset > 60000) {
    unhandledRejectionCount = 0;
    lastRejectionReset = Date.now();
  }

  unhandledRejectionCount++;

  // Só mata o processo se houver cascata (10+ rejeições em 60s)
  // Isso indica problema sistêmico (ex: MongoDB caiu de vez)
  if (unhandledRejectionCount >= 10) {
    console.error("CRITICAL: 10+ unhandled rejections in 60s - restarting process");
    gracefulShutdown("unhandledRejection_cascade");
  }
  // Rejeições isoladas são logadas mas NÃO matam o processo
  // (ex: Facebook API timeout, webhook async error)
});

const PORT = process.env.PORT || 4242;
let server: http.Server | null = null;

// Timeout para forçar shutdown se graceful demorar muito
const SHUTDOWN_TIMEOUT = 30000; // 30 segundos

/**
 * Graceful shutdown com timeout de segurança
 * Fecha conexões de forma ordenada antes de encerrar
 */
const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  process.env.SHUTTING_DOWN = "true"; // Sinaliza para db.ts não tentar reconectar


  // Timeout de segurança - força encerramento se demorar muito
  const forceShutdownTimer = setTimeout(() => {
    console.error("❌ Timeout de shutdown excedido. Forçando encerramento...");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  try {
    // 0. Para jobs em background
    stopFacebookPurchaseJob();

    // 1. Para de aceitar novas conexões HTTP
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => {
          if (err) {
            console.error("❌ Erro ao fechar servidor HTTP:", err);
            reject(err);
          } else {
            resolve();
          }
        });

        // Timeout para fechar conexões HTTP ativas
        setTimeout(() => {
          resolve();
        }, 10000);
      });
    }

    // 2. Fecha conexão com MongoDB
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close(false);
    }

    // 3. Limpa o timer de força
    clearTimeout(forceShutdownTimer);

    process.exit(0);
  } catch (err) {
    console.error("❌ Erro durante graceful shutdown:", err);
    clearTimeout(forceShutdownTimer);
    process.exit(1);
  }
};

/**
 * Inicia o servidor Express com todas as dependências
 */
async function startServer() {
  try {
    // Aguarde a conexão com o DB antes de iniciar o Express
    await connectDB();

    // Inicializa serviço de conversão de moeda (busca taxas de câmbio)
    // Wrapped em try-catch para não bloquear startup se API estiver fora
    try {
      await initializeCurrencyService();
    } catch (currencyError) {
      console.warn("⚠️ Falha ao inicializar serviço de câmbio, usando taxas padrão:", currencyError);
      // Continua mesmo se falhar - usará taxas em cache
    }

    // Inicia job de envio consolidado de Facebook Purchase
    startFacebookPurchaseJob();

    // Cria servidor HTTP e guarda referência para graceful shutdown
    server = http.createServer(app);

    // Configura timeouts do servidor
    server.timeout = 120000;        // 2 min timeout para requisições
    server.keepAliveTimeout = 65000; // Keep-alive maior que load balancer (geralmente 60s)
    server.headersTimeout = 66000;   // Headers timeout ligeiramente maior

    server.listen(PORT, () => {
    });

    // Monitora conexões ativas (útil para debug)
    server.on("connection", (socket) => {
      socket.setKeepAlive(true, 30000); // Keep-alive a cada 30s
    });

  } catch (error) {
    console.error("❌ Falha ao iniciar servidor:", error);
    process.exit(1);
  }
}

// Sinais de encerramento do Docker/Coolify
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Inicia o servidor
startServer();
