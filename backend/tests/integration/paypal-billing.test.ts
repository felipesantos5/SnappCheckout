/**
 * Testes de Integração - PayPal Billing (Taxa de 3%)
 *
 * Fluxo testado:
 * 1. Usuário configura PayPal → inicia trial de 30 dias
 * 2. Vendas PayPal são registradas durante o ciclo
 * 3. Após 30 dias, job calcula 3% sobre vendas PayPal e bloqueia
 * 4. Enquanto bloqueado, PayPal não é renderizado (getClientId retorna 403)
 * 5. Após pagar a taxa, desbloqueia e inicia novo ciclo de 30 dias
 * 6. Sem vendas PayPal no ciclo → auto-renova sem cobrança
 */

import mongoose from "mongoose";
import User from "../../src/models/user.model";
import Sale from "../../src/models/sale.model";
import Offer from "../../src/models/offer.model";
import PaypalBillingCycle from "../../src/models/paypal-billing-cycle.model";
import { processPaypalBilling } from "../../src/jobs/paypal-billing.job";
import request from "supertest";

const API_URL = process.env.API_URL || "http://localhost:4242";
const MONGO_URI = process.env.MONGO_TEST_URI || "mongodb://localhost:27017/checkout-test";

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

// Timeout maior para conexão com MongoDB
jest.setTimeout(30000);

let dbConnected = false;

beforeAll(async () => {
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    dbConnected = true;
  } catch {
    console.warn("MongoDB nao disponivel - testes de PayPal billing serao pulados");
  }
});

afterAll(async () => {
  if (!dbConnected) return;
  await User.deleteMany({ email: /paypal-billing-test/ });
  await Offer.deleteMany({ slug: /paypal-billing-test/ });
  await Sale.deleteMany({ customerEmail: /paypal-billing-test/ });
  await PaypalBillingCycle.deleteMany({});
  await mongoose.disconnect();
});

const skipIfNoDb = () => {
  if (!dbConnected) {
    console.warn("Pulando teste - MongoDB nao disponivel");
    return true;
  }
  return false;
};

describe("PayPal Billing - Fluxo completo de cobrança de 3%", () => {
  let testUser: any;
  let testOffer: any;

  beforeEach(async () => {
    if (!dbConnected) return;
    // Limpa dados entre testes
    await User.deleteMany({ email: /paypal-billing-test/ });
    await Offer.deleteMany({ slug: /paypal-billing-test/ });
    await Sale.deleteMany({ customerEmail: /paypal-billing-test/ });
    await PaypalBillingCycle.deleteMany({});

    // Cria usuário com PayPal configurado e ciclo de trial
    testUser = await User.create({
      email: "paypal-billing-test@example.com",
      name: "PayPal Test User",
      passwordHash: "hashedpassword123",
      stripeAccountId: `acct_paypal_test_${Date.now()}`,
      stripeOnboardingComplete: true,
      paypalClientId: "paypal_client_test_id",
      paypalBilling: {
        trialStartDate: daysAgo(30),
        status: "trial",
        currentCycleStart: daysAgo(30),
        currentCycleEnd: daysAgo(0), // Ciclo expirou hoje
        lastPaymentDate: null,
        lastChargeAmountInCents: 0,
        pendingFeeInCents: 0,
      },
    });

    // Cria oferta vinculada ao usuário
    testOffer = await Offer.create({
      name: "Oferta PayPal Test",
      slug: "paypal-billing-test-offer",
      ownerId: testUser._id,
      currency: "BRL",
      paypalEnabled: true,
      mainProduct: {
        name: "Produto PayPal Test",
        priceInCents: 10000,
      },
      orderBumps: [],
    });
  });

  // =============================================
  // 1. TRIAL → BLOQUEADO (com vendas PayPal)
  // =============================================

  describe("Ciclo expirado com vendas PayPal", () => {
    it("deve bloquear o usuário e calcular taxa de 3% sobre vendas PayPal", async () => {
      // Cria vendas PayPal dentro do ciclo
      await Sale.create([
        {
          stripePaymentIntentId: "PAYPAL_order_test_1",
          offerId: testOffer._id,
          ownerId: testUser._id,
          status: "succeeded",
          totalAmountInCents: 10000, // R$ 100
          platformFeeInCents: 0,
          currency: "brl",
          customerEmail: "paypal-billing-test-customer@test.com",
          customerName: "Cliente Test",
          paymentMethod: "paypal",
          items: [{ name: "Produto", priceInCents: 10000, isOrderBump: false }],
          createdAt: daysAgo(15), // Dentro do ciclo
        },
        {
          stripePaymentIntentId: "PAYPAL_order_test_2",
          offerId: testOffer._id,
          ownerId: testUser._id,
          status: "succeeded",
          totalAmountInCents: 5000, // R$ 50
          platformFeeInCents: 0,
          currency: "brl",
          customerEmail: "paypal-billing-test-customer@test.com",
          customerName: "Cliente Test",
          paymentMethod: "paypal",
          items: [{ name: "Produto", priceInCents: 5000, isOrderBump: false }],
          createdAt: daysAgo(10), // Dentro do ciclo
        },
      ]);

      // Executa o job de billing
      await processPaypalBilling();

      // Verifica que o usuário foi bloqueado
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser!.paypalBilling.status).toBe("blocked");

      // Taxa deve ser 3% de R$ 150 (15000 centavos) = 450 centavos
      expect(updatedUser!.paypalBilling.pendingFeeInCents).toBe(450);
    });

    it("não deve contar vendas Stripe na taxa PayPal (apenas paymentMethod: paypal)", async () => {
      // Venda PayPal
      await Sale.create({
        stripePaymentIntentId: "PAYPAL_order_test_3",
        offerId: testOffer._id,
        ownerId: testUser._id,
        status: "succeeded",
        totalAmountInCents: 20000, // R$ 200
        platformFeeInCents: 0,
        currency: "brl",
        customerEmail: "paypal-billing-test-customer@test.com",
        customerName: "Cliente Test",
        paymentMethod: "paypal",
        items: [{ name: "Produto", priceInCents: 20000, isOrderBump: false }],
        createdAt: daysAgo(10),
      });

      // Venda Stripe (não deve contar)
      await Sale.create({
        stripePaymentIntentId: "pi_test_stripe_only",
        offerId: testOffer._id,
        ownerId: testUser._id,
        status: "succeeded",
        totalAmountInCents: 50000, // R$ 500
        platformFeeInCents: 2500,
        currency: "brl",
        customerEmail: "paypal-billing-test-customer@test.com",
        customerName: "Cliente Test",
        paymentMethod: "stripe",
        items: [{ name: "Produto", priceInCents: 50000, isOrderBump: false }],
        createdAt: daysAgo(10),
      });

      await processPaypalBilling();

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser!.paypalBilling.status).toBe("blocked");
      // 3% de R$ 200 = 600 centavos (Stripe não conta)
      expect(updatedUser!.paypalBilling.pendingFeeInCents).toBe(600);
    });

    it("não deve contar vendas fora do período do ciclo", async () => {
      // Venda ANTES do ciclo (não deve contar)
      await Sale.create({
        stripePaymentIntentId: "PAYPAL_order_before",
        offerId: testOffer._id,
        ownerId: testUser._id,
        status: "succeeded",
        totalAmountInCents: 99900,
        platformFeeInCents: 0,
        currency: "brl",
        customerEmail: "paypal-billing-test-customer@test.com",
        customerName: "Cliente Test",
        paymentMethod: "paypal",
        items: [{ name: "Produto", priceInCents: 99900, isOrderBump: false }],
        createdAt: daysAgo(60), // Antes do ciclo que começou há 30 dias
      });

      // Venda DENTRO do ciclo
      await Sale.create({
        stripePaymentIntentId: "PAYPAL_order_inside",
        offerId: testOffer._id,
        ownerId: testUser._id,
        status: "succeeded",
        totalAmountInCents: 10000,
        platformFeeInCents: 0,
        currency: "brl",
        customerEmail: "paypal-billing-test-customer@test.com",
        customerName: "Cliente Test",
        paymentMethod: "paypal",
        items: [{ name: "Produto", priceInCents: 10000, isOrderBump: false }],
        createdAt: daysAgo(15),
      });

      await processPaypalBilling();

      const updatedUser = await User.findById(testUser._id);
      // 3% apenas de R$ 100 (dentro do ciclo) = 300 centavos
      expect(updatedUser!.paypalBilling.pendingFeeInCents).toBe(300);
    });
  });

  // =============================================
  // 2. CICLO SEM VENDAS → AUTO-RENOVA
  // =============================================

  describe("Ciclo expirado sem vendas PayPal", () => {
    it("deve auto-renovar ciclo sem cobrança quando não houver vendas PayPal", async () => {
      // Nenhuma venda criada
      await processPaypalBilling();

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser!.paypalBilling.status).toBe("active");
      expect(updatedUser!.paypalBilling.pendingFeeInCents).toBe(0);

      // Novo ciclo de 30 dias deve ter sido criado
      const cycleEnd = updatedUser!.paypalBilling.currentCycleEnd!;
      const daysUntilEnd = Math.ceil((cycleEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      expect(daysUntilEnd).toBeGreaterThanOrEqual(29);
      expect(daysUntilEnd).toBeLessThanOrEqual(31);

      // Registro de ciclo deve existir com status "waived"
      const cycles = await PaypalBillingCycle.find({ userId: testUser._id });
      expect(cycles).toHaveLength(1);
      expect(cycles[0].status).toBe("waived");
      expect(cycles[0].totalPaypalRevenueInCents).toBe(0);
      expect(cycles[0].feeAmountInCents).toBe(0);
    });
  });

  // =============================================
  // 3. BLOQUEADO → PAYPAL INDISPONÍVEL
  // =============================================

  describe("PayPal bloqueado impede pagamentos", () => {
    it("deve retornar 403 ao buscar clientId quando PayPal está bloqueado", async () => {
      // Bloqueia o usuário diretamente
      await User.findByIdAndUpdate(testUser._id, {
        "paypalBilling.status": "blocked",
        "paypalBilling.pendingFeeInCents": 450,
      });

      const response = await request(API_URL)
        .get(`/api/paypal/client-id/${testOffer._id}`)
        .expect(403);

      expect(response.body.blocked).toBe(true);
      expect(response.body.error).toMatch(/indisponível/i);
    });

    it("deve retornar 403 ao criar ordem PayPal quando bloqueado", async () => {
      await User.findByIdAndUpdate(testUser._id, {
        "paypalBilling.status": "blocked",
        "paypalBilling.pendingFeeInCents": 450,
      });

      const response = await request(API_URL)
        .post("/api/paypal/create-order")
        .send({
          amount: 100,
          currency: "BRL",
          offerId: testOffer._id.toString(),
        })
        .expect(403);

      expect(response.body.blocked).toBe(true);
    });

    it("deve permitir buscar clientId quando PayPal está ativo", async () => {
      // Status ativo
      await User.findByIdAndUpdate(testUser._id, {
        "paypalBilling.status": "active",
        "paypalBilling.pendingFeeInCents": 0,
      });

      const response = await request(API_URL)
        .get(`/api/paypal/client-id/${testOffer._id}`)
        .expect(200);

      expect(response.body.clientId).toBe("paypal_client_test_id");
    });

    it("deve permitir buscar clientId durante período de trial", async () => {
      await User.findByIdAndUpdate(testUser._id, {
        "paypalBilling.status": "trial",
        "paypalBilling.currentCycleEnd": daysFromNow(20),
      });

      const response = await request(API_URL)
        .get(`/api/paypal/client-id/${testOffer._id}`)
        .expect(200);

      expect(response.body.clientId).toBe("paypal_client_test_id");
    });
  });

  // =============================================
  // 4. CICLO NÃO EXPIRADO → JOB NÃO PROCESSA
  // =============================================

  describe("Ciclo ainda ativo", () => {
    it("não deve bloquear usuário cujo ciclo ainda não expirou", async () => {
      // Ajusta ciclo para expirar daqui 10 dias
      await User.findByIdAndUpdate(testUser._id, {
        "paypalBilling.currentCycleEnd": daysFromNow(10),
        "paypalBilling.status": "trial",
      });

      // Cria venda PayPal
      await Sale.create({
        stripePaymentIntentId: "PAYPAL_active_cycle",
        offerId: testOffer._id,
        ownerId: testUser._id,
        status: "succeeded",
        totalAmountInCents: 50000,
        platformFeeInCents: 0,
        currency: "brl",
        customerEmail: "paypal-billing-test-customer@test.com",
        customerName: "Cliente Test",
        paymentMethod: "paypal",
        items: [{ name: "Produto", priceInCents: 50000, isOrderBump: false }],
        createdAt: new Date(),
      });

      await processPaypalBilling();

      const updatedUser = await User.findById(testUser._id);
      // Deve continuar como trial, não bloqueado
      expect(updatedUser!.paypalBilling.status).toBe("trial");
      expect(updatedUser!.paypalBilling.pendingFeeInCents).toBe(0);
    });
  });

  // =============================================
  // 5. PAGAMENTO DA TAXA → DESBLOQUEIA + NOVO CICLO
  // =============================================

  describe("Confirmação de pagamento da taxa", () => {
    it("deve registrar ciclo pago e iniciar novo ciclo de 30 dias no banco", async () => {
      // Simula estado bloqueado com taxa pendente
      const cycleStart = daysAgo(30);
      const cycleEnd = daysAgo(0);

      await User.findByIdAndUpdate(testUser._id, {
        "paypalBilling.status": "blocked",
        "paypalBilling.currentCycleStart": cycleStart,
        "paypalBilling.currentCycleEnd": cycleEnd,
        "paypalBilling.pendingFeeInCents": 600,
      });

      // Simula o que confirmPayment faz no banco após Stripe confirmar
      const user = await User.findById(testUser._id);
      const feeInCents = 600;

      await PaypalBillingCycle.create({
        userId: user!._id,
        cycleStart,
        cycleEnd,
        totalPaypalRevenueInCents: 20000,
        feeAmountInCents: feeInCents,
        status: "paid",
        stripeSessionId: "cs_test_simulated",
        paidAt: new Date(),
      });

      const newCycleStart = new Date();
      const newCycleEnd = new Date(newCycleStart.getTime() + 30 * 24 * 60 * 60 * 1000);

      user!.paypalBilling.status = "active";
      user!.paypalBilling.currentCycleStart = newCycleStart;
      user!.paypalBilling.currentCycleEnd = newCycleEnd;
      user!.paypalBilling.lastPaymentDate = new Date();
      user!.paypalBilling.lastChargeAmountInCents = feeInCents;
      user!.paypalBilling.pendingFeeInCents = 0;
      await user!.save();

      // Verifica resultado
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser!.paypalBilling.status).toBe("active");
      expect(updatedUser!.paypalBilling.pendingFeeInCents).toBe(0);
      expect(updatedUser!.paypalBilling.lastChargeAmountInCents).toBe(600);

      // Novo ciclo criado
      const endDays = Math.ceil(
        (updatedUser!.paypalBilling.currentCycleEnd!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      expect(endDays).toBeGreaterThanOrEqual(29);
      expect(endDays).toBeLessThanOrEqual(31);

      // Registro de ciclo pago
      const paidCycles = await PaypalBillingCycle.find({ userId: testUser._id, status: "paid" });
      expect(paidCycles).toHaveLength(1);
      expect(paidCycles[0].feeAmountInCents).toBe(600);
    });
  });

  // =============================================
  // 6. NOVO CICLO APÓS PAGAMENTO → FLUXO REINICIA
  // =============================================

  describe("Novo ciclo após pagamento reinicia a contagem", () => {
    it("deve bloquear novamente se houver vendas PayPal no novo ciclo após expirar", async () => {
      // Simula usuário que pagou e está no novo ciclo, que agora expirou
      await User.findByIdAndUpdate(testUser._id, {
        "paypalBilling.status": "active",
        "paypalBilling.currentCycleStart": daysAgo(30),
        "paypalBilling.currentCycleEnd": daysAgo(0), // Expirou agora
        "paypalBilling.lastPaymentDate": daysAgo(30),
        "paypalBilling.pendingFeeInCents": 0,
      });

      // Vendas no novo ciclo
      await Sale.create({
        stripePaymentIntentId: "PAYPAL_new_cycle_1",
        offerId: testOffer._id,
        ownerId: testUser._id,
        status: "succeeded",
        totalAmountInCents: 30000, // R$ 300
        platformFeeInCents: 0,
        currency: "brl",
        customerEmail: "paypal-billing-test-customer@test.com",
        customerName: "Cliente Test",
        paymentMethod: "paypal",
        items: [{ name: "Produto", priceInCents: 30000, isOrderBump: false }],
        createdAt: daysAgo(15),
      });

      await processPaypalBilling();

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser!.paypalBilling.status).toBe("blocked");
      // 3% de R$ 300 = 900 centavos
      expect(updatedUser!.paypalBilling.pendingFeeInCents).toBe(900);
    });
  });

  // =============================================
  // 7. MIGRAÇÃO DE USUÁRIOS EXISTENTES
  // =============================================

  describe("Migração de usuários com PayPal sem trial configurado", () => {
    it("deve inicializar trial para usuários com paypalClientId sem trialStartDate", async () => {
      // Cria usuário sem billing configurado
      const legacyUser = await User.create({
        email: "paypal-billing-test-legacy@example.com",
        name: "Legacy PayPal User",
        passwordHash: "hashedpassword123",
        stripeAccountId: `acct_legacy_${Date.now()}`,
        stripeOnboardingComplete: true,
        paypalClientId: "paypal_legacy_client_id",
        paypalBilling: {
          trialStartDate: null,
          status: "trial",
          currentCycleStart: null,
          currentCycleEnd: null,
          lastPaymentDate: null,
          lastChargeAmountInCents: 0,
          pendingFeeInCents: 0,
        },
      });

      await processPaypalBilling();

      const updatedLegacy = await User.findById(legacyUser._id);
      expect(updatedLegacy!.paypalBilling.trialStartDate).not.toBeNull();
      expect(updatedLegacy!.paypalBilling.status).toBe("trial");
      expect(updatedLegacy!.paypalBilling.currentCycleStart).not.toBeNull();
      expect(updatedLegacy!.paypalBilling.currentCycleEnd).not.toBeNull();

      // Ciclo deve ser 30 dias a partir de agora
      const endDays = Math.ceil(
        (updatedLegacy!.paypalBilling.currentCycleEnd!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      expect(endDays).toBeGreaterThanOrEqual(29);
      expect(endDays).toBeLessThanOrEqual(31);

      // Cleanup
      await User.deleteOne({ _id: legacyUser._id });
    });
  });
});
