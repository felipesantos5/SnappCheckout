// src/config/payment-fees.config.ts

/**
 * Configuração centralizada de taxas das plataformas de pagamento
 * 
 * IMPORTANTE: Estas taxas devem ser atualizadas conforme os contratos com cada plataforma.
 * As taxas são aplicadas sobre o valor total da transação para calcular o valor líquido
 * que será enviado para a UTMfy e usado para conferência de faturamento.
 */

export interface PaymentFeeConfig {
  /** Taxa percentual (ex: 0.0499 = 4.99%) */
  percentageFee: number;
  /** Taxa fixa em centavos (ex: 39 = R$ 0,39) */
  fixedFeeInCents: number;
  /** Descrição da taxa para documentação */
  description: string;
  /** Data da última atualização */
  lastUpdated: string;
}

/**
 * Taxas das plataformas de pagamento
 * 
 * Fontes:
 * - Stripe: https://stripe.com/br/pricing
 * - PayPal: https://www.paypal.com/br/webapps/mpp/merchant-fees
 * - Pagar.me: Contrato específico
 */
export const PAYMENT_FEES: Record<string, PaymentFeeConfig> = {
  // Stripe - Cartão de Crédito Internacional
  stripe_card_international: {
    percentageFee: 0.0499, // 4.99%
    fixedFeeInCents: 39, // R$ 0,39 por transação
    description: "Stripe - Cartão de Crédito Internacional",
    lastUpdated: "2026-02-07",
  },

  // Stripe - Cartão de Crédito Nacional (Brasil)
  stripe_card_national: {
    percentageFee: 0.0399, // 3.99%
    fixedFeeInCents: 39, // R$ 0,39 por transação
    description: "Stripe - Cartão de Crédito Nacional (Brasil)",
    lastUpdated: "2026-02-07",
  },

  // PayPal - Vendas Nacionais (Brasil)
  paypal_national: {
    percentageFee: 0.0439, // 4.39%
    fixedFeeInCents: 60, // R$ 0,60 por transação
    description: "PayPal - Vendas Nacionais (Brasil)",
    lastUpdated: "2026-02-07",
  },

  // PayPal - Vendas Internacionais
  paypal_international: {
    percentageFee: 0.0639, // 6.39% (4.39% + 2% de conversão de moeda)
    fixedFeeInCents: 60, // R$ 0,60 por transação
    description: "PayPal - Vendas Internacionais",
    lastUpdated: "2026-02-07",
  },

  // Pagar.me - PIX
  pagarme_pix: {
    percentageFee: 0.0119, // 1.19%
    fixedFeeInCents: 0, // Sem taxa fixa
    description: "Pagar.me - PIX",
    lastUpdated: "2026-02-07",
  },

  // Pagar.me - Cartão de Crédito
  pagarme_card: {
    percentageFee: 0.0299, // 2.99% (estimativa - verificar contrato)
    fixedFeeInCents: 0, // Sem taxa fixa
    description: "Pagar.me - Cartão de Crédito",
    lastUpdated: "2026-02-07",
  },
};

/**
 * Calcula a taxa total da plataforma de pagamento
 * 
 * @param amountInCents - Valor total da transação em centavos
 * @param feeConfig - Configuração da taxa da plataforma
 * @returns Taxa total em centavos
 * 
 * @example
 * ```typescript
 * const amount = 10000; // R$ 100,00
 * const fee = calculatePaymentFee(amount, PAYMENT_FEES.stripe_card_national);
 * // Retorna: 438 centavos (R$ 4,38)
 * // Cálculo: (10000 * 0.0399) + 39 = 399 + 39 = 438
 * ```
 */
export function calculatePaymentFee(
  amountInCents: number,
  feeConfig: PaymentFeeConfig
): number {
  const percentageFee = Math.round(amountInCents * feeConfig.percentageFee);
  const totalFee = percentageFee + feeConfig.fixedFeeInCents;
  return totalFee;
}

/**
 * Calcula o valor líquido após deduzir as taxas da plataforma
 * 
 * @param amountInCents - Valor total da transação em centavos
 * @param feeConfig - Configuração da taxa da plataforma
 * @returns Valor líquido em centavos (valor que você realmente recebe)
 * 
 * @example
 * ```typescript
 * const amount = 10000; // R$ 100,00
 * const netAmount = calculateNetAmount(amount, PAYMENT_FEES.stripe_card_national);
 * // Retorna: 9562 centavos (R$ 95,62)
 * // Cálculo: 10000 - 438 = 9562
 * ```
 */
export function calculateNetAmount(
  amountInCents: number,
  feeConfig: PaymentFeeConfig
): number {
  const fee = calculatePaymentFee(amountInCents, feeConfig);
  return amountInCents - fee;
}

/**
 * Detecta qual configuração de taxa usar baseado no método de pagamento e país
 * 
 * @param paymentMethod - Método de pagamento (stripe, paypal, pagarme)
 * @param currency - Código da moeda (BRL, USD, EUR, etc.)
 * @param gateway - Gateway de pagamento (opcional)
 * @returns Configuração de taxa apropriada
 */
export function getPaymentFeeConfig(
  paymentMethod: string,
  currency: string = "BRL",
  gateway?: string
): PaymentFeeConfig {
  const currencyUpper = currency.toUpperCase();
  const isBrazilian = currencyUpper === "BRL";

  // Stripe
  if (paymentMethod === "stripe" || gateway === "stripe") {
    return isBrazilian
      ? PAYMENT_FEES.stripe_card_national
      : PAYMENT_FEES.stripe_card_international;
  }

  // PayPal
  if (paymentMethod === "paypal" || gateway === "paypal") {
    return isBrazilian
      ? PAYMENT_FEES.paypal_national
      : PAYMENT_FEES.paypal_international;
  }

  // Pagar.me
  if (paymentMethod === "pix" || gateway === "pagarme") {
    return PAYMENT_FEES.pagarme_pix;
  }

  if (paymentMethod === "credit_card" && gateway === "pagarme") {
    return PAYMENT_FEES.pagarme_card;
  }

  // Fallback: usa Stripe nacional como padrão
  console.warn(
    `⚠️ [Payment Fees] Método de pagamento desconhecido: ${paymentMethod}/${gateway}. Usando Stripe nacional como fallback.`
  );
  return PAYMENT_FEES.stripe_card_national;
}
