// src/controllers/payment.controller.ts
import { Request, Response } from "express";
import User, { IUser } from "../models/user.model";
import Offer, { IOffer } from "../models/offer.model";
import stripe from "../lib/stripe";
import * as offerService from "../services/offer.service"; // Importe o service de oferta

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
    const { offerSlug, selectedOrderBumps, quantity, contactInfo, metadata } = req.body as CreateIntentPayload;

    const stripeAccountId = await getStripeAccountId(offerSlug);

    // 4. Passe a quantidade para o cálculo seguro
    const totalAmount = await calculateTotalAmount(offerSlug, selectedOrderBumps, quantity || 1);

    if (totalAmount < 50) {
      throw new Error("Valor da compra muito baixo.");
    }

    const applicationFee = Math.round(totalAmount * 0.05);

    // 5. Adicione os metadados completos para processar no webhook
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totalAmount,
        currency: "brl",
        payment_method_types: ["card", "apple_pay", "google_pay"],
        application_fee_amount: applicationFee,
        metadata: {
          offerSlug: offerSlug,
          selectedOrderBumps: JSON.stringify(selectedOrderBumps || []),
          quantity: String(quantity || 1),
          customerEmail: contactInfo.email,
          customerName: contactInfo.name,
          customerPhone: contactInfo.phone || "",
          ...metadata,
        },
        receipt_email: contactInfo.email, // Email para enviar recibo do Stripe
      },
      {
        stripeAccount: stripeAccountId,
      }
    );

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error: any) {
    console.error("Erro em handleCreatePaymentIntent:", error.message);
    res.status(500).json({ error: { message: error.message } });
  }
};
