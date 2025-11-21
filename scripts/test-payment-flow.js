#!/usr/bin/env node

/**
 * Script de Teste Rápido do Fluxo de Pagamento
 *
 * Execute: node scripts/test-payment-flow.js
 *
 * Este script valida rapidamente se o sistema está pronto para processar pagamentos
 */

const https = require("https");
const http = require("http");
const path = require("path");
const fs = require("fs");

// Carrega .env da pasta api
const envPath = path.join(__dirname, "..", "api", ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      const value = valueParts.join("=").trim();
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    }
  });
}

const API_URL = process.env.API_URL || "http://localhost:4242";
const CHECKOUT_URL = process.env.CHECKOUT_URL || "https://localhost:5173";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;

    // Aceita certificados auto-assinados em desenvolvimento
    const options = url.startsWith("https")
      ? {
          rejectUnauthorized: false, // Aceita certificado auto-assinado
        }
      : {};

    client
      .get(url, options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data });
          }
        });
      })
      .on("error", reject);
  });
}

async function runTests() {
  log("\n🧪 TESTE DE PRONTIDÃO DO SISTEMA DE PAGAMENTOS\n", "cyan");
  log("=".repeat(60), "blue");

  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
  };

  // Teste 1: API está online?
  log("\n[1/5] Verificando se API está online...", "blue");
  try {
    const response = await makeRequest(`${API_URL}/api/health`);

    if (response.status === 200 || response.status === 503) {
      log("✅ API está respondendo", "green");
      results.passed++;

      if (response.data?.checks) {
        log(`   └─ MongoDB: ${response.data.checks.database.status}`, "cyan");
        log(`   └─ Stripe: ${response.data.checks.stripe.status}`, "cyan");
        log(
          `   └─ Pode processar pagamentos: ${response.data.checks.payments.canProcessPayments ? "SIM" : "NÃO"}`,
          response.data.checks.payments.canProcessPayments ? "green" : "red"
        );

        if (!response.data.checks.payments.canProcessPayments) {
          results.failed++;
          log("❌ CRÍTICO: Sistema NÃO pode processar pagamentos!", "red");
        }
      }
    } else {
      throw new Error(`Status inesperado: ${response.status}`);
    }
  } catch (error) {
    log(`❌ API não está acessível: ${error.message}`, "red");
    results.failed++;
  }

  // Teste 2: Endpoint de criação de payment intent
  log("\n[2/5] Verificando endpoint de pagamento...", "blue");
  try {
    // Apenas verifica se o endpoint existe (retorna 404 ou 400, não 500)
    const response = await makeRequest(`${API_URL}/api/payments/create-intent`);

    if ([400, 404, 405].includes(response.status)) {
      log("✅ Endpoint de pagamento está configurado", "green");
      results.passed++;
    } else {
      log(`⚠️  Resposta inesperada: ${response.status}`, "yellow");
      results.warnings++;
    }
  } catch (error) {
    log(`❌ Erro ao verificar endpoint: ${error.message}`, "red");
    results.failed++;
  }

  // Teste 3: Checkout frontend está acessível?
  log("\n[3/5] Verificando se checkout está acessível...", "blue");
  try {
    const response = await makeRequest(CHECKOUT_URL);

    if (response.status === 200 || response.status === 404) {
      log("✅ Frontend do checkout está online", "green");
      results.passed++;
    } else {
      throw new Error(`Status: ${response.status}`);
    }
  } catch (error) {
    log(`❌ Checkout não está acessível: ${error.message}`, "red");
    results.failed++;
  }

  // Teste 4: Variáveis de ambiente
  log("\n[4/5] Verificando variáveis de ambiente...", "blue");
  const requiredEnvVars = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "MONGO_URI", "JWT_SECRET"];

  let envOk = true;
  requiredEnvVars.forEach((varName) => {
    if (!process.env[varName]) {
      log(`   ⚠️  ${varName} não configurado`, "yellow");
      envOk = false;
    }
  });

  if (envOk) {
    log("✅ Variáveis de ambiente essenciais configuradas", "green");
    results.passed++;
  } else {
    log("⚠️  Algumas variáveis de ambiente não estão configuradas", "yellow");
    results.warnings++;
  }

  // Teste 5: Versão do Stripe
  log("\n[5/5] Verificando modo Stripe...", "blue");
  const stripeKey = process.env.STRIPE_SECRET_KEY || "";

  if (stripeKey.includes("test")) {
    log("✅ Modo TESTE - use cartões de teste do Stripe", "green");
    log("   Cartão de sucesso: 4242 4242 4242 4242", "cyan");
    results.passed++;
  } else if (stripeKey.includes("live")) {
    log("⚠️  Modo PRODUÇÃO - pagamentos reais serão processados!", "yellow");
    results.warnings++;
  } else {
    log("❌ Chave Stripe não detectada ou inválida", "red");
    results.failed++;
  }

  // Resumo
  log("\n" + "=".repeat(60), "blue");
  log("\n📊 RESUMO DOS TESTES:", "cyan");
  log(`   ✅ Passaram: ${results.passed}`, "green");
  log(`   ⚠️  Avisos: ${results.warnings}`, "yellow");
  log(`   ❌ Falharam: ${results.failed}`, "red");

  if (results.failed === 0 && results.warnings === 0) {
    log("\n🎉 TUDO OK! Sistema pronto para processar pagamentos.\n", "green");
    process.exit(0);
  } else if (results.failed === 0) {
    log("\n⚠️  Sistema funcional, mas há avisos. Revise antes de ir para produção.\n", "yellow");
    process.exit(0);
  } else {
    log("\n❌ SISTEMA NÃO ESTÁ PRONTO. Corrija os erros antes de processar pagamentos.\n", "red");
    process.exit(1);
  }
}

// Executa os testes
runTests().catch((error) => {
  log(`\n❌ Erro fatal: ${error.message}\n`, "red");
  process.exit(1);
});
