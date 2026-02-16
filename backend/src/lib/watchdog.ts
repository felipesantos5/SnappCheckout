// src/lib/watchdog.ts
// Watchdog interno: monitora a saúde do processo e força restart se necessário
// Isso garante auto-heal SEM depender de ferramentas externas (autoheal, etc)

import mongoose from "mongoose";

const CHECK_INTERVAL = 30_000; // Verifica a cada 30s
const MAX_CONSECUTIVE_FAILURES = 5; // 5 falhas = 2.5 min de falha contínua
const MONGO_PING_TIMEOUT = 5_000; // 5s para MongoDB responder

let consecutiveFailures = 0;
let watchdogTimer: NodeJS.Timeout | null = null;

/**
 * Faz ping no MongoDB com timeout para evitar hang infinito
 */
async function checkMongo(): Promise<boolean> {
  try {
    if (mongoose.connection.readyState !== 1) return false;

    await Promise.race([
      mongoose.connection.db!.admin().ping(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("MongoDB ping timeout")), MONGO_PING_TIMEOUT)
      ),
    ]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Verifica uso de memória
 */
function checkMemory(): boolean {
  const heapUsedMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
  return heapUsedMB < 1500; // Limite de 1.5GB
}

/**
 * Executa verificação de saúde e age se necessário
 */
async function performCheck() {
  if (process.env.SHUTTING_DOWN === "true") return;

  const mongoOk = await checkMongo();
  const memoryOk = checkMemory();
  const isHealthy = mongoOk && memoryOk;

  if (isHealthy) {
    if (consecutiveFailures > 0) {
      console.log(`[Watchdog] Recuperado após ${consecutiveFailures} falha(s)`);
    }
    consecutiveFailures = 0;
    return;
  }

  consecutiveFailures++;
  const reasons: string[] = [];
  if (!mongoOk) reasons.push("MongoDB");
  if (!memoryOk) reasons.push("Memória");

  console.warn(
    `[Watchdog] Falha ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES} - Problemas: ${reasons.join(", ")}`
  );

  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    console.error(
      `[Watchdog] ${MAX_CONSECUTIVE_FAILURES} falhas consecutivas detectadas. Forçando restart do processo...`
    );
    // process.exit(1) será capturado pelo Docker restart policy
    process.exit(1);
  }
}

/**
 * Inicia o watchdog - chamar após o servidor estar pronto
 */
export function startWatchdog() {
  if (watchdogTimer) return;

  console.log(
    `[Watchdog] Iniciado - verificação a cada ${CHECK_INTERVAL / 1000}s, ` +
    `max ${MAX_CONSECUTIVE_FAILURES} falhas consecutivas antes de restart`
  );

  watchdogTimer = setInterval(performCheck, CHECK_INTERVAL);
  // Não impede o processo de encerrar naturalmente
  watchdogTimer.unref();
}

/**
 * Para o watchdog (usar no graceful shutdown)
 */
export function stopWatchdog() {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
}
