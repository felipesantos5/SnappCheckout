// src/lib/db.ts
import mongoose from "mongoose";
import "dotenv/config";

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  throw new Error("Por favor, defina a variável de ambiente MONGO_URI dentro do .env");
}

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
 */
async function attemptReconnect(): Promise<void> {
  if (isReconnecting) return;
  if (process.env.SHUTTING_DOWN === "true") return;

  isReconnecting = true;
  reconnectAttempts++;

  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000); // Max 30s

  console.log(`🔄 Tentativa de reconexão ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} em ${delay / 1000}s...`);

  await new Promise(resolve => setTimeout(resolve, delay));

  try {
    await mongoose.connect(MONGO_URI!, mongooseOptions);
    console.log("✅ MongoDB reconectado com sucesso!");
    reconnectAttempts = 0;
    isReconnecting = false;
  } catch (error) {
    console.error("❌ Falha na reconexão:", error);
    isReconnecting = false;

    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      attemptReconnect();
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
    console.log("✅ MongoDB conectado com sucesso.");
    console.log(`   Pool: ${mongooseOptions.minPoolSize}-${mongooseOptions.maxPoolSize} conexões`);
    console.log(`   Buffer Commands: ${mongooseOptions.bufferCommands ? "ON (resiliente a blips)" : "OFF"}`);
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
    attemptReconnect();
  }
});

mongoose.connection.on("reconnected", () => {
  console.log("✅ MongoDB reconectado.");
  reconnectAttempts = 0;
  isReconnecting = false;
});

mongoose.connection.on("error", (err) => {
  console.error("❌ Erro na conexão com o MongoDB:", err.message);
});

mongoose.connection.on("connected", () => {
  console.log("📊 MongoDB: Conexão estabelecida");
});

mongoose.connection.on("close", () => {
  console.log("📊 MongoDB: Conexão fechada");
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
