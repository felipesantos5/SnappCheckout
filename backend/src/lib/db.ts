// src/lib/db.ts
import mongoose from "mongoose";
import "dotenv/config";

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  throw new Error("Por favor, defina a variável de ambiente MONGO_URI dentro do .env");
}

// Configura timeout global para comandos bufferizados
// Quando MongoDB desconecta, operações ficam em buffer por até 30s antes de falharem
// Isso evita que operações fiquem penduradas indefinidamente durante desconexões
mongoose.set("bufferTimeoutMS", 30000);

// Flag para controlar tentativas de reconexão
let isReconnecting = false;
const MAX_RECONNECT_ATTEMPTS = 10;
let reconnectAttempts = 0;

/**
 * Opções otimizadas para MongoDB local na VPS
 * - bufferCommands true com bufferTimeoutMS para sobreviver a blips de conexão
 * - Pool dimensionado para tráfego de checkout
 * - Timeouts ajustados para MongoDB local (baixa latência)
 */
const mongooseOptions: mongoose.ConnectOptions = {
  // Pool de conexões
  maxPoolSize: 30,  // Reduzido de 50 - suficiente para checkout + webhooks + admin
  minPoolSize: 5,   // Mantém conexões quentes

  // Timeouts
  serverSelectionTimeoutMS: 15000, // 15s para selecionar servidor (aumentado para dar margem em restart do mongo)
  socketTimeoutMS: 30000,          // 30s timeout para operações (reduzido - operações não devem demorar tanto)
  connectTimeoutMS: 15000,         // 15s para estabelecer conexão

  // Heartbeat para detectar desconexões
  heartbeatFrequencyMS: 10000,     // Ping a cada 10s

  // Conexões idle
  maxIdleTimeMS: 60000,            // Fecha conexões idle após 60s

  // Retry automático (crítico para resistir a blips)
  retryWrites: true,
  retryReads: true,

  // CRÍTICO: bufferCommands TRUE para sobreviver a micro-desconexões
  // Quando o MongoDB desconecta brevemente (restart, network blip),
  // comandos são bufferizados ao invés de falharem instantaneamente
  bufferCommands: true,


  // Auto-index em produção desabilitado para performance
  autoIndex: process.env.NODE_ENV !== "production",
};

/**
 * Tenta reconectar ao MongoDB com backoff exponencial
 * IMPORTANTE: Erros aqui NÃO devem gerar unhandled rejections
 */
async function attemptReconnect(): Promise<void> {
  if (isReconnecting) return;
  if (process.env.SHUTTING_DOWN === "true") return;

  isReconnecting = true;
  reconnectAttempts++;

  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000); // Max 30s
  console.warn(`🔄 Tentativa de reconexão ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} em ${delay}ms...`);

  await new Promise(resolve => setTimeout(resolve, delay));

  try {
    // Verifica se já reconectou automaticamente pelo driver (readyState 1 = connected)
    if (mongoose.connection.readyState === 1) {
      console.log("✅ MongoDB já reconectou automaticamente pelo driver");
      reconnectAttempts = 0;
      isReconnecting = false;
      return;
    }

    await mongoose.connect(MONGO_URI!, mongooseOptions);
    reconnectAttempts = 0;
    isReconnecting = false;
  } catch (error) {
    console.error("❌ Falha na reconexão:", error);
    isReconnecting = false;

    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      // Usa .catch() para garantir que a promise não vira unhandled rejection
      attemptReconnect().catch((err) => {
        console.error("❌ Erro inesperado no attemptReconnect:", err);
      });
    } else {
      console.error("❌ Máximo de tentativas de reconexão atingido. Reiniciando processo...");
      process.exit(1); // Força reinício pelo orquestrador (Coolify)
    }
  }
}

/**
 * Conecta ao banco de dados MongoDB
 */
async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  try {
    await mongoose.connect(MONGO_URI!, mongooseOptions);
  } catch (error) {
    console.error("❌ Erro ao conectar ao MongoDB:", error);
    throw error;
  }
}

// Listeners para monitorar a saúde da conexão em tempo real
mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB desconectado!");

  if (process.env.SHUTTING_DOWN !== "true") {
    console.warn("🔄 Iniciando tentativa de reconexão automática...");
    // .catch() evita unhandled rejection que pode acumular e derrubar o processo
    attemptReconnect().catch((err) => {
      console.error("❌ Erro inesperado ao tentar reconectar:", err);
    });
  }
});

mongoose.connection.on("reconnected", () => {
  reconnectAttempts = 0;
  isReconnecting = false;
});

mongoose.connection.on("error", (err) => {
  console.error("❌ Erro na conexão com o MongoDB:", err.message);
});

mongoose.connection.on("connected", () => {
});

mongoose.connection.on("close", () => {
});

/**
 * Verifica se o MongoDB está saudável (para health check)
 */
export async function isMongoHealthy(): Promise<boolean> {
  try {
    if (mongoose.connection.readyState !== 1) return false;
    await mongoose.connection.db!.admin().ping();
    return true;
  } catch {
    return false;
  }
}

export default connectDB;
