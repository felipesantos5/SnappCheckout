// src/controllers/payment.controller.ts
import { Request, Response } from "express";
import User, { IUser } from "../models/user.model";
import Offer, { IOffer } from "../models/offer.model";
import stripe from "../lib/stripe";
import * as offerService from "../services/offer.service"; // Importe o service de oferta
import UpsellSession from "../models/upsell-session.model";
import { v4 as uuidv4 } from "uuid";
import { getOrCreateCustomer } from "../helper/getOrCreateCustomer";
// Payload que o frontend (CheckoutForm) vai enviar
interface CreateIntentPayload {
  offerSlug: string;
  selectedOrderBumps: string[];
  quantity: number;
  contactInfo: {
    email: string;
    name: string;
    phone: string;
    // O 'country' não está vindo, então não vamos usá-lo por enquanto
  };
  metadata?: { [key: string]: any };
}

/**
 * Helper SUPER SEGURO para buscar o ID da conta e verificar o status
 */
const getStripeAccountId = async (slug: string): Promise<string> => {
  // 1. Busca a oferta E o dono dela (com 'populate')
  const offer = await Offer.findOne({ slug }).populate("ownerId");
  if (!offer) {
    throw new Error(`Oferta com slug '${slug}' não encontrada.`);
  }

  // 2. Acessa o usuário (dono)
  const owner = offer.ownerId as unknown as IUser;
  if (!owner) {
    throw new Error(`Oferta '${slug}' não tem um dono (ownerId) associado.`);
  }

  // 3. Verifica se o dono TEM um ID do Stripe salvo
  if (!owner.stripeAccountId) {
    throw new Error(`O vendedor '${owner.email}' não conectou sua conta Stripe.`);
  }

  // 4. (Opcional, mas recomendado) Verifica se a conta pode receber pagamentos
  const account = await stripe.accounts.retrieve(owner.stripeAccountId);
  if (!account.charges_enabled) {
    throw new Error(`A conta de pagamento do vendedor ('${owner.email}') não está ativa ou não concluiu o cadastro.`);
  }

  // 5. Retorna o ID da conta conectada (ex: 'acct_...')
  return owner.stripeAccountId;
};

/**
 * Helper para calcular o preço total (seguro)
 */
const calculateTotalAmount = async (slug: string, bumpIds: string[], quantity: number): Promise<number> => {
  const offer = await offerService.getOfferBySlug(slug);
  if (!offer) {
    throw new Error("Oferta não encontrada para cálculo.");
  }

  // Validação da quantidade
  const qty = Math.max(1, quantity || 1); // Garante que seja pelo menos 1

  // 3. O TOTAL É CALCULADO COM A QUANTIDADE
  let totalAmount = offer.mainProduct.priceInCents * qty;

  // Adiciona os bumps (bumps não são multiplicados pela quantidade)
  if (bumpIds && bumpIds.length > 0) {
    for (const bumpId of bumpIds) {
      const bump = offer.orderBumps.find((b: any) => b.id === bumpId);
      if (bump) {
        totalAmount += bump.priceInCents;
      }
    }
  }
  return totalAmount;
};

/**
 * Controller FINAL para criar um PaymentIntent (Cartão ou PIX)
 */
export const handleCreatePaymentIntent = async (req: Request, res: Response) => {
  try {
    const { offerSlug, selectedOrderBumps, quantity, contactInfo, metadata } = req.body;
    const stripeAccountId = await getStripeAccountId(offerSlug);

    // Busca ou cria cliente para permitir salvar o cartão
    const customerId = await getOrCreateCustomer(stripeAccountId, contactInfo.email, contactInfo.name, contactInfo.phone);

    const totalAmount = await calculateTotalAmount(offerSlug, selectedOrderBumps, quantity || 1);
    const applicationFee = Math.round(totalAmount * 0.05);

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totalAmount,
        currency: "brl",
        customer: customerId,
        setup_future_usage: "off_session",
        payment_method_types: ["card"],
        application_fee_amount: applicationFee,
        metadata: {
          offerSlug,
          selectedOrderBumps: JSON.stringify(selectedOrderBumps || []),
          customerEmail: contactInfo.email,
          ...metadata,
        },
      },
      { stripeAccount: stripeAccountId }
    );

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    console.error("Erro createIntent:", error);
    res.status(500).json({ error: { message: error.message } });
  }
};

export const generateUpsellToken = async (req: Request, res: Response) => {
  try {
    const { paymentIntentId, offerSlug } = req.body;

    if (!paymentIntentId || !offerSlug) {
      return res.status(400).json({ error: "Dados insuficientes." });
    }

    const stripeAccountId = await getStripeAccountId(offerSlug);

    // Busca o PaymentIntent no Stripe da conta conectada para confirmar os dados
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      stripeAccount: stripeAccountId,
    });

    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({ error: "Pagamento original não confirmado." });
    }

    if (!paymentIntent.customer || !paymentIntent.payment_method) {
      return res.status(400).json({ error: "Dados de pagamento não salvos." });
    }

    // Gera um token único
    const token = uuidv4();

    // Salva no banco temporário
    await UpsellSession.create({
      token,
      accountId: stripeAccountId,
      customerId: paymentIntent.customer as string,
      paymentMethodId: paymentIntent.payment_method as string,
    });

    res.status(200).json({ token });
  } catch (error: any) {
    console.error("Erro generateUpsellToken:", error);
    res.status(500).json({ error: { message: "Falha ao gerar link de upsell." } });
  }
};

export const handleOneClickUpsell = async (req: Request, res: Response) => {
  try {
    const { token, upsellSlug } = req.body;

    if (!token || !upsellSlug) {
      throw new Error("Token ou produto inválido.");
    }

    // Busca a sessão válida
    const session = await UpsellSession.findOne({ token });
    if (!session) {
      return res.status(403).json({ success: false, message: "Sessão expirada ou inválida." });
    }

    // Calcula valor do Upsell
    const totalAmount = await calculateTotalAmount(upsellSlug, [], 1);
    const applicationFee = Math.round(totalAmount * 0.05);

    // Cria e Confirma o pagamento na hora
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totalAmount,
        currency: "brl",
        customer: session.customerId,
        payment_method: session.paymentMethodId,
        off_session: true, // Indica cobrança automática
        confirm: true, // Cobra imediatamente
        application_fee_amount: applicationFee,
        metadata: {
          offerSlug: upsellSlug,
          isUpsell: "true",
          originalSessionToken: token,
        },
      },
      { stripeAccount: session.accountId }
    );

    // Opcional: Invalidar o token após uso (se for uso único)
    // await UpsellSession.deleteOne({ token });

    if (paymentIntent.status === "succeeded") {
      res.status(200).json({ success: true, message: "Upsell aprovado!" });
    } else {
      res.status(400).json({ success: false, message: "Pagamento não aprovado.", status: paymentIntent.status });
    }
  } catch (error: any) {
    console.error("Erro OneClickUpsell:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
