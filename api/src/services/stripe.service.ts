// src/services/stripe.service.ts
import Stripe from "stripe";

// Validamos a chave secreta na inicialização
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY não está definida no .env");
}

// Instanciamos o cliente Stripe UMA VEZ
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
  typescript: true,
});

/**
 * Cria uma Intenção de Pagamento para Cartão de Crédito.
 */
export const createCardPaymentIntent = async (amountInCents: number): Promise<Stripe.PaymentIntent> => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 100,
      currency: "usd",
      payment_method_types: ["card"],
    });
    return paymentIntent;
  } catch (error) {
    console.error("Erro no Stripe Service (Card):", error);
    throw new Error("Falha ao criar intenção de pagamento com cartão.");
  }
};

/**
 * Cria uma Intenção de Pagamento para PIX.
 */
export const createPixPaymentIntent = async (amountInCents: number): Promise<Stripe.PaymentIntent> => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "brl",
      payment_method_types: ["pix"], // A mudança é aqui
    });
    return paymentIntent;
  } catch (error) {
    console.error("Erro no Stripe Service (PIX):", error);
    throw new Error("Falha ao criar intenção de pagamento com PIX.");
  }
};

export const getAccountBalance = async (stripeAccountId: string) => {
  if (!stripeAccountId) {
    throw new Error("Usuário não possui uma conta Stripe conectada.");
  }

  // Isso faz a chamada "As That Account"
  const balance = await stripe.balance.retrieve({
    stripeAccount: stripeAccountId,
  });

  return balance;
};
