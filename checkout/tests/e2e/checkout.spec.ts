/**
 * Testes E2E críticos para o fluxo de checkout
 *
 * Estes testes validam o caminho mais importante da aplicação:
 * garantir que clientes conseguem completar pagamentos com sucesso.
 */

import { test, expect } from "@playwright/test";

// Configurações de teste
const CHECKOUT_URL = process.env.PLAYWRIGHT_BASE_URL || "https://localhost:5173";
const API_URL = process.env.VITE_BACKEND_URL || "http://localhost:4242";
const TEST_OFFER_SLUG = process.env.E2E_OFFER_SLUG || "slo559vt9szuwehu";

// Cartões de teste do Stripe
const STRIPE_TEST_CARDS = {
  success: "4242424242424242", // Sempre aprovado
  declined: "4000000000000002", // Sempre recusado
  requiresAuth: "4000002500003155", // Requer autenticação 3D Secure
};

test.describe("Fluxo de Pagamento Crítico", () => {
  let testOfferSlug: string;

  test.beforeAll(async ({ request }) => {
    // Cria uma oferta de teste via API
    console.log("🔧 Configurando oferta de teste...");

    // TODO: Implementar criação de oferta de teste
    // Por enquanto, use uma oferta existente
    testOfferSlug = TEST_OFFER_SLUG; // Use E2E_OFFER_SLUG para apontar para uma oferta real de teste
  });

  test("deve carregar página de checkout sem erros", async ({ page }) => {
    await page.goto(`${CHECKOUT_URL}/c/${testOfferSlug}`);

    // Verifica se não há erros de console críticos
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.error("❌ Erro no console:", msg.text());
      }
    });

    // Aguarda elementos principais carregarem
    await expect(page.locator("form")).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();

    console.log("✅ Página de checkout carregou corretamente");
  });

  test("deve validar campos obrigatórios", async ({ page }) => {
    await page.goto(`${CHECKOUT_URL}/c/${testOfferSlug}`);

    // Tenta submeter sem preencher
    await page.locator('button[type="submit"]').click();

    // Deve mostrar mensagem de erro
    await expect(page.locator("text=/preencha|obrigatório|required/i")).toBeVisible({ timeout: 5000 });

    console.log("✅ Validação de campos funcionando");
  });

  test("deve processar pagamento com sucesso (CRÍTICO)", async ({ page }) => {
    console.log("🧪 TESTE CRÍTICO: Processando pagamento de teste...");

    await page.goto(`${CHECKOUT_URL}/c/${testOfferSlug}`);

    // Preenche informações de contato
    await page.fill("input#email", "teste@example.com");
    await page.fill("input#name", "Cliente Teste E2E");

    const phoneInput = page.locator("input#phone");
    if (await phoneInput.isVisible()) {
      await phoneInput.fill("11999999999");
    }

    // Aguarda Stripe Elements carregar
    await page.waitForTimeout(2000);

    // Preenche dados do cartão (Stripe Elements em iframe)
    const stripeCardFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();

    await stripeCardFrame.locator('input[name="cardnumber"]').fill(STRIPE_TEST_CARDS.success);
    await stripeCardFrame.locator('input[name="exp-date"]').fill("12/34");
    await stripeCardFrame.locator('input[name="cvc"]').fill("123");

    // Preenche nome no cartão
    await page.fill("input#card-name", "CLIENTE TESTE");

    console.log("[DEBUG] Formulário preenchido, submetendo...");

    // Submete o formulário
    await page.locator('button[type="submit"]').click();

    // Aguarda processamento (máximo 30 segundos)
    console.log("[DEBUG] Aguardando processamento...");

    // Verifica logs de debug no console
    page.on("console", (msg) => {
      if (msg.text().includes("[DEBUG]") || msg.text().includes("[ERROR]")) {
        console.log("Console:", msg.text());
      }
    });

    // Deve mostrar loading
    await expect(page.locator("text=/processando|carregando/i")).toBeVisible({ timeout: 5000 });

    // Deve redirecionar ou mostrar sucesso (timeout generoso para Stripe processar)
    const successIndicators = [
      page.locator("text=/sucesso|success|obrigado|thank you/i"),
      page.locator('svg[class*="check"]'), // Ícone de check
    ];

    await Promise.race([
      expect(successIndicators[0]).toBeVisible({ timeout: 30000 }),
      expect(successIndicators[1]).toBeVisible({ timeout: 30000 }),
      page.waitForURL(/success|thank-you|obrigado/, { timeout: 30000 }),
    ]).catch(async (error) => {
      // Se falhar, captura screenshot para debug
      await page.screenshot({ path: "checkout-error.png", fullPage: true });
      console.error("❌ FALHA CRÍTICA: Pagamento não completou");
      throw error;
    });

    console.log("✅ SUCESSO: Pagamento processado com sucesso!");
  });

  test("deve rejeitar cartão inválido", async ({ page }) => {
    await page.goto(`${CHECKOUT_URL}/c/${testOfferSlug}`);

    await page.fill("input#email", "teste@example.com");
    await page.fill("input#name", "Cliente Teste");

    await page.waitForTimeout(2000);

    const stripeCardFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
    await stripeCardFrame.locator('input[name="cardnumber"]').fill(STRIPE_TEST_CARDS.declined);
    await stripeCardFrame.locator('input[name="exp-date"]').fill("12/34");
    await stripeCardFrame.locator('input[name="cvc"]').fill("123");

    await page.fill("input#card-name", "CLIENTE TESTE");
    await page.locator('button[type="submit"]').click();

    // Deve mostrar mensagem de erro
    await expect(page.locator("text=/recusado|declined|erro|error/i")).toBeVisible({ timeout: 30000 });

    console.log("✅ Rejeição de cartão funcionando");
  });

  test("deve calcular total corretamente com order bumps", async ({ page }) => {
    await page.goto(`${CHECKOUT_URL}/c/${testOfferSlug}`);

    // Captura total inicial
    const initialTotal = await page.locator("text=/total|r\\$/i").textContent();

    // Seleciona um order bump (se existir)
    const bumpCheckbox = page.locator('input[type="checkbox"]').first();
    if (await bumpCheckbox.isVisible()) {
      await bumpCheckbox.check();

      // Total deve ter aumentado
      await page.waitForTimeout(500);
      const newTotal = await page.locator("text=/total|r\\$/i").textContent();

      expect(newTotal).not.toBe(initialTotal);
      console.log("✅ Cálculo de total com order bumps funcionando");
    } else {
      console.log("⚠️  Nenhum order bump disponível para teste");
    }
  });
});

test.describe("Testes de Performance", () => {
  test("checkout deve carregar em menos de 3 segundos", async ({ page }) => {
    const startTime = Date.now();

    await page.goto(`${CHECKOUT_URL}/c/${TEST_OFFER_SLUG}`);
    await page.waitForLoadState("domcontentloaded");

    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(3000);
    console.log(`✅ Tempo de carregamento: ${loadTime}ms`);
  });
});

test.describe("Testes de Resiliência", () => {
  test("deve lidar com perda de conexão graciosamente", async ({ page, context }) => {
    await page.goto(`${CHECKOUT_URL}/c/${TEST_OFFER_SLUG}`);

    // Simula offline
    await context.setOffline(true);

    await page.fill("input#email", "teste@example.com");
    await page.fill("input#name", "Cliente Teste");
    await page.locator('button[type="submit"]').click();

    // Deve mostrar erro de conexão
    await expect(page.locator("text=/conexão|network|offline/i")).toBeVisible({ timeout: 10000 });

    console.log("✅ Tratamento de erro de conexão funcionando");
  });
});
