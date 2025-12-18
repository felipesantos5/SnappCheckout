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
 * Opções otimizadas para MongoDB em produção
 * - Pool maior para suportar mais conexões simultâneas
 * - Timeouts para evitar travamentos
 * - Heartbeat para manter conexões vivas
 */
const mongooseOptions: mongoose.ConnectOptions = {
  // Pool de conexões - aumentado para suportar picos de tráfego
  maxPoolSize: 50, // Máximo de conexões simultâneas (padrão era 10)
  minPoolSize: 5,  // Mínimo de conexões mantidas abertas

  // Timeouts para evitar travamentos
  serverSelectionTimeoutMS: 10000, // 10s para selecionar servidor
  socketTimeoutMS: 45000,          // 45s timeout para operações
  connectTimeoutMS: 10000,         // 10s para estabelecer conexão

  // Heartbeat para detectar desconexões mais rápido
  heartbeatFrequencyMS: 10000,     // Ping a cada 10s

  // Manter conexões vivas
  maxIdleTimeMS: 60000,            // Fecha conexões idle após 60s

  // Retry automático para escritas
  retryWrites: true,
  retryReads: true,

  // Buffer de comandos desabilitado para falhar rápido quando desconectado
  bufferCommands: false,
};

/**
 * Tenta reconectar ao MongoDB com backoff exponencial
 */
async function attemptReconnect(): Promise<void> {
  if (isReconnecting) return;

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
      // Agenda próxima tentativa
      attemptReconnect();
    } else {
      console.error("❌ Máximo de tentativas de reconexão atingido. Reiniciando processo...");
      process.exit(1); // Força reinício pelo orquestrador (Coolify)
    }
  }
}

/**
 * Conecta ao banco de dados MongoDB (Padrão para Containers/VPS).
 * Configurado com pool otimizado e timeouts para evitar travamentos.
 */
async function connectDB() {
  // Se já estiver conectado ou conectando, não faz nada
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  try {
    await mongoose.connect(MONGO_URI!, mongooseOptions);
    console.log("✅ MongoDB conectado com sucesso.");
    console.log(`   Pool: ${mongooseOptions.minPoolSize}-${mongooseOptions.maxPoolSize} conexões`);
  } catch (error) {
    console.error("❌ Erro ao conectar ao MongoDB:", error);
    // Lança o erro para que o server.ts decida se mata o processo
    throw error;
  }
}

// Listeners para monitorar a saúde da conexão em tempo real
mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB desconectado!");

  // Só tenta reconectar se não estiver em processo de shutdown
  if (process.env.SHUTTING_DOWN !== "true") {
    console.warn("🔄 Iniciando tentativa de reconexão automática...");
    attemptReconnect();
  }
});

mongoose.connection.on("reconnected", () => {
  console.log("✅ MongoDB reconectado.");
  reconnectAttempts = 0;
});

mongoose.connection.on("error", (err) => {
  console.error("❌ Erro na conexão com o MongoDB:", err);
});

// Evento quando a conexão está pronta
mongoose.connection.on("connected", () => {
  console.log("📊 MongoDB: Conexão estabelecida");
});

// Log de monitoramento do pool (útil para debug)
mongoose.connection.on("close", () => {
  console.log("📊 MongoDB: Conexão fechada");
});

export default connectDB;