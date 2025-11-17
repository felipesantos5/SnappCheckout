// src/controllers/stripe.controller.ts
import { Request, Response } from "express";
import User, { IUser } from "../models/user.model";
import stripe from "../lib/stripe";
import Offer from "../models/offer.model";
import Sale from "../models/sale.model";
import { Stripe } from "stripe";
import * as stripeService from "../services/stripe.service";

// !! IMPORTANTE !!
// Altere estas URLs para as rotas do seu frontend (dashboard-admin)
// O usuário será enviado para cá DEPOIS de terminar o onboarding do Stripe.
const STRIPE_ONBOARDING_RETURN_URL = "https://admin.snappcheckout.com/dashboard/stripe-return";
const STRIPE_ONBOARDING_REFRESH_URL = "https://admin.snappcheckout.com/dashboard/stripe-refresh";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Cria um Link de Conta (Account Link) para o usuário
 * completar o onboarding do Stripe Standard.
 */
export const handleCreateAccountLink = async (req: Request, res: Response) => {
  try {
    const userId = req.userId; // Vem do middleware 'protectRoute'
    const user = await User.findById(userId);

    if (!user?.stripeAccountId) {
      return res.status(400).json({ error: { message: "Conta Stripe deste usuário não encontrada." } });
    }

    // Crie o link de onboarding
    const accountLink = await stripe.accountLinks.create({
      account: user.stripeAccountId,
      return_url: STRIPE_ONBOARDING_RETURN_URL,
      refresh_url: STRIPE_ONBOARDING_REFRESH_URL,
      type: "account_onboarding",
    });

    // Envie a URL para o frontend
    res.status(200).json({ url: accountLink.url });
  } catch (error) {
    console.error("Erro ao criar Account Link:", error);
    res.status(500).json({ error: { message: "Falha ao criar link de onboarding." } });
  }
};

export const handleWebhook = async (req: Request, res: Response) => {
  if (!webhookSecret) {
    console.error("Segredo do Webhook do Stripe não está configurado.");
    return res.status(500).send("Webhook não configurado.");
  }

  const sig = req.headers["stripe-signature"] as string;
  const rawBody = req.body; // Graças ao 'express.raw()', este é o buffer

  let event: Stripe.Event;

  try {
    // 1. Verifique a assinatura (SEGURANÇA MÁXIMA)
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error(`Erro na verificação do Webhook: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 2. Lide com os eventos que nos interessam
  switch (event.type) {
    // --- CASO 1: VENDA BEM-SUCEDIDA ---
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      // Puxe os metadados que salvamos
      const { platformOwnerId, platformOfferId, customerEmail, customerName } = paymentIntent.metadata;

      try {
        // Verifique se a venda já não foi salva (para evitar duplicatas)
        const existingSale = await Sale.findOne({ stripePaymentIntentId: paymentIntent.id });
        if (existingSale) {
          console.warn(`Webhook: Venda ${paymentIntent.id} já existe.`);
          break; // Sai do switch
        }

        // Busca a oferta para pegar os 'line items' (o que foi comprado)
        const offer = await Offer.findById(platformOfferId);
        if (!offer) throw new Error(`Webhook: Oferta ${platformOfferId} não encontrada.`);

        // Cria a lista de itens comprados
        const items = [
          {
            name: offer.mainProduct.name,
            priceInCents: offer.mainProduct.priceInCents,
            isOrderBump: false,
          },
        ];

        // TODO: Precisamos saber quais bumps foram comprados.
        // O ideal é salvar os IDs dos bumps nos 'metadata' também.
        // Por agora, vamos salvar apenas o produto principal.

        // Crie a venda no banco de dados
        const newSale = new Sale({
          ownerId: platformOwnerId,
          offerId: platformOfferId,
          stripePaymentIntentId: paymentIntent.id,
          customerName: customerName,
          customerEmail: customerEmail,
          totalAmountInCents: paymentIntent.amount,
          platformFeeInCents: paymentIntent.application_fee_amount || 0,
          status: "succeeded",
          items: items,
        });
        await newSale.save();
      } catch (dbError) {
        console.error("Falha ao salvar venda do webhook:", dbError);
        // Retorne 500 para o Stripe tentar de novo
        return res.status(500).json({ error: "Falha no banco de dados." });
      }
      break;
    }

    // --- CASO 2: CANCELAMENTO (REEMBOLSO) ---
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = charge.payment_intent as string;

      try {
        // Encontre a venda original e atualize seu status
        await Sale.findOneAndUpdate({ stripePaymentIntentId: paymentIntentId }, { status: "refunded" });
      } catch (dbError) {
        console.error('Falha ao atualizar venda para "refunded":', dbError);
        return res.status(500).json({ error: "Falha no banco de dados." });
      }
      break;
    }

    default:
      console.log(`Webhook: Evento não tratado ${event.type}`);
  }

  // 3. Responda 200 OK para o Stripe
  res.status(200).json({ received: true });
};

export const handleGetBalance = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);

    // 1. Verifique se o usuário tem uma conta e se ela está ativa
    if (!user?.stripeAccountId) {
      return res.status(400).json({
        error: { message: "Conta Stripe não conectada ou onboarding incompleto." },
      });
    }

    // 2. Chame a API de Saldo da Stripe, autenticando
    //    como a conta conectada
    const balance = await stripe.balance.retrieve({
      stripeAccount: user.stripeAccountId,
    });

    // 3. Retorne os saldos 'available' (disponível) e 'pending' (pendente)
    //    Eles vêm como arrays, mas geralmente só nos importa o primeiro (BRL, USD)
    res.status(200).json({
      available: balance.available, // Saldo disponível para saque
      pending: balance.pending, // Saldo processando
    });
  } catch (error) {
    console.error("Erro ao buscar saldo Stripe:", error);
    res.status(500).json({ error: { message: (error as Error).message } });
  }
};

export const httpGetAccountBalance = async (req: Request, res: Response) => {
  try {
    // req.user deve ser populado pelo seu middleware de autenticação
    // Defina um tipo local que inclui 'user' para o Request
    type AuthRequest = Request & { user?: IUser };
    const userId = (req as AuthRequest).user?._id;

    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado." });
    }

    // Precisamos buscar o usuário para garantir que temos o stripeAccountId
    // (Seu req.user pode não ter todos os campos do DB)
    const user = await User.findById(userId);
    if (!user || !user.stripeAccountId) {
      return res.status(404).json({ error: "Conta Stripe não encontrada ou não conectada." });
    }

    const balance = await stripeService.getAccountBalance(user.stripeAccountId);

    res.status(200).json({
      available: balance.available, // Array de saldos
      pending: balance.pending, // Array de saldos
    });
  } catch (error: any) {
    console.error("❌ Erro ao buscar saldo do Stripe:", error);
    res.status(500).json({ error: error.message });
  }
};
