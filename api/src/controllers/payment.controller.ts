// src/controllers/payment.controller.ts
import { Request, Response } from "express";
import Offer, { IOffer } from "../models/offer.model";
import stripe from "../lib/stripe";
import UpsellSession from "../models/upsell-session.model";
import { v4 as uuidv4 } from "uuid";
import { getOrCreateCustomer } from "../helper/getOrCreateCustomer";
import { calculateTotalAmount } from "../helper/calculateTotalAmount";
import { getStripeAccountId } from "../helper/getStripeAccountId";

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

    // Recupera a oferta para salvar o ID na sessão
    const offer = await Offer.findOne({ slug: offerSlug });
    if (!offer) {
      return res.status(404).json({ error: "Oferta não encontrada." });
    }

    // Busca o PaymentIntent para garantir que o pagamento ocorreu e temos o método
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      stripeAccount: stripeAccountId,
    });

    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({ error: "Pagamento original não confirmado." });
    }

    if (!paymentIntent.customer || !paymentIntent.payment_method) {
      return res.status(400).json({ error: "Cliente ou método de pagamento não identificados." });
    }

    const token = uuidv4();

    // Salvamos o offerId para saber qual produto de upsell cobrar depois
    await UpsellSession.create({
      token,
      accountId: stripeAccountId,
      customerId: paymentIntent.customer as string,
      paymentMethodId: paymentIntent.payment_method as string,
      offerId: offer._id, // IMPORTANTE: Vínculo com a oferta original
    });

    // Retorna o token e a URL de redirecionamento já montada
    const redirectUrl = `${offer.upsell?.redirectUrl}?token=${token}`;

    res.status(200).json({ token, redirectUrl });
  } catch (error: any) {
    console.error("Erro generateUpsellToken:", error);
    res.status(500).json({ error: { message: "Falha ao gerar link de upsell." } });
  }
};

export const handleOneClickUpsell = async (req: Request, res: Response) => {
  try {
    // O cliente só precisa mandar o token. O preço e o produto vêm do banco.
    const { token } = req.body;

    if (!token) {
      throw new Error("Token de sessão inválido.");
    }

    // 1. Busca a sessão válida e popula a oferta para pegarmos o preço
    // Nota: Precisa garantir que no UpsellSession você tenha ref: 'Offer' no campo offerId
    const session: any = await UpsellSession.findOne({ token }).populate("offerId");

    if (!session) {
      return res.status(403).json({ success: false, message: "Sessão expirada ou inválida." });
    }

    const offer = session.offerId as IOffer;

    // 2. Validações de segurança
    if (!offer || !offer.upsell || !offer.upsell.enabled) {
      return res.status(400).json({ success: false, message: "Upsell não está ativo para esta oferta." });
    }

    // 3. Define o valor a ser cobrado com base na configuração do banco (Seguro)
    const amountToCharge = offer.upsell.price; // Já deve estar em centavos
    const applicationFee = Math.round(amountToCharge * 0.05); // Sua taxa de plataforma

    // 4. Cria e Confirma o pagamento Off-Session (One Click)
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountToCharge,
        currency: offer.currency || "brl",
        customer: session.customerId,
        payment_method: session.paymentMethodId,
        off_session: true, // Importante para cobrança sem interação
        confirm: true, // Tenta cobrar imediatamente
        application_fee_amount: applicationFee,
        description: `Upsell: ${offer.upsell.name}`,
        metadata: {
          isUpsell: "true",
          originalOfferSlug: offer.slug,
          productName: offer.upsell.name,
          originalSessionToken: token,
        },
      },
      { stripeAccount: session.accountId }
    );

    if (paymentIntent.status === "succeeded") {
      // Opcional: Queimar o token para evitar cobrança duplicada acidental
      await UpsellSession.deleteOne({ token });

      res.status(200).json({ success: true, message: "Upsell comprado com sucesso!" });
    } else {
      // Casos onde o banco pede autenticação 3DS (raro em upsell imediato, mas possível)
      res.status(400).json({
        success: false,
        message: "Não foi possível cobrar automaticamente.",
        status: paymentIntent.status,
      });
    }
  } catch (error: any) {
    console.error("Erro OneClickUpsell:", error.message);
    // Tratamento específico para erros do Stripe (ex: cartão recusado)
    const errorMessage = error.raw ? error.raw.message : error.message;
    res.status(500).json({ success: false, message: errorMessage });
  }
};
