// src/server.ts
import app from "./app";
import connectDB from "./lib/db";
import { initializeCurrencyService } from "./services/currency-conversion.service";

process.on("uncaughtException", (error) => {
  console.error("CRITICAL ERROR: Uncaught Exception:", error);
  process.exit(1); // Força o reinício pelo orquestrador (Coolify)
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("CRITICAL ERROR: Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1)
  // Dependendo da gravidade, pode valer a pena sair também, ou apenas logar
});

const PORT = process.env.PORT || 4242;
let server: any;

// Crie uma função 'startServer' assíncrona
async function startServer() {
  try {
    // Aguarde a conexão com o DB antes de iniciar o Express
    await connectDB();

    // Inicializa serviço de conversão de moeda (busca taxas de câmbio)
    await initializeCurrencyService();

    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error("Falha ao iniciar servidor:", error);
    process.exit(1);
  }
}

const gracefulShutdown = async () => {
  console.log('SIGTERM recebido. Fechando servidor HTTP e conexões...');
  
  if (server) {
    server.close(() => {
      console.log('Servidor HTTP fechado.');
    });
  }

  try {
    await mongoose.connection.close(false);
    console.log('Conexão MongoDB fechada.');
    process.exit(0);
  } catch (err) {
    console.error('Erro ao fechar conexão MongoDB', err);
    process.exit(1);
  }
};

// Sinais de encerramento do Docker/Coolify
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Chame a função
startServer();
