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
    const { offerSlug, selectedOrderBumps, quantity, contactInfo, addressInfo, metadata } = req.body;

    const offer = await Offer.findOne({ slug: offerSlug });
    if (!offer) {
      return res.status(404).json({ error: { message: "Oferta não encontrada." } });
    }

    const stripeAccountId = await getStripeAccountId(offerSlug);
    const customerId = await getOrCreateCustomer(stripeAccountId, contactInfo.email, contactInfo.name, contactInfo.phone);
    const totalAmount = await calculateTotalAmount(offerSlug, selectedOrderBumps, quantity || 1);
    const applicationFee = Math.round(totalAmount * 0.05);

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totalAmount,
        currency: offer.currency || "brl",
        customer: customerId,
        setup_future_usage: "off_session",
        payment_method_types: ["card"],
        application_fee_amount: applicationFee,
        metadata: {
          offerSlug,
          selectedOrderBumps: JSON.stringify(selectedOrderBumps || []),
          customerEmail: contactInfo.email,
          customerName: contactInfo.name,
          customerPhone: contactInfo.phone || "",
          // Adiciona dados de endereço se disponíveis
          ...(addressInfo && {
            addressZipCode: addressInfo.zipCode || "",
            addressStreet: addressInfo.street || "",
            addressNumber: addressInfo.number || "",
            addressComplement: addressInfo.complement || "",
            addressNeighborhood: addressInfo.neighborhood || "",
            addressCity: addressInfo.city || "",
            addressState: addressInfo.state || "",
            addressCountry: addressInfo.country || "",
          }),
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
    if (!paymentIntentId || !offerSlug) return res.status(400).json({ error: "Dados insuficientes." });

    const stripeAccountId = await getStripeAccountId(offerSlug);
    const offer = await Offer.findOne({ slug: offerSlug });
    if (!offer) return res.status(404).json({ error: "Oferta não encontrada." });

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, { stripeAccount: stripeAccountId });

    if (paymentIntent.status !== "succeeded") return res.status(400).json({ error: "Pagamento não confirmado." });
    if (!paymentIntent.customer || !paymentIntent.payment_method) return res.status(400).json({ error: "Método de pagamento ausente." });

    const token = uuidv4();

    await UpsellSession.create({
      token,
      accountId: stripeAccountId,
      customerId: paymentIntent.customer as string,
      paymentMethodId: paymentIntent.payment_method as string,
      offerId: offer._id,
    });

    // Constrói a URL de redirecionamento
    const separator = offer.upsell?.redirectUrl.includes("?") ? "&" : "?";
    const redirectUrl = `${offer.upsell?.redirectUrl}${separator}token=${token}`;

    res.status(200).json({ token, redirectUrl });
  } catch (error: any) {
    res.status(500).json({ error: { message: "Falha ao gerar link." } });
  }
};

export const handleRefuseUpsell = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: "Token inválido." });

    const session: any = await UpsellSession.findOne({ token }).populate("offerId");
    if (!session) return res.status(403).json({ success: false, message: "Sessão expirada." });

    const offer = session.offerId as IOffer;
    await UpsellSession.deleteOne({ token });

    const redirectUrl = offer.thankYouPageUrl && offer.thankYouPageUrl.trim() !== "" ? offer.thankYouPageUrl : null;

    res.status(200).json({ success: true, message: "Oferta recusada.", redirectUrl });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const handleOneClickUpsell = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) throw new Error("Token inválido.");

    const session: any = await UpsellSession.findOne({ token }).populate("offerId");
    if (!session) return res.status(403).json({ success: false, message: "Sessão expirada ou token já usado." });

    const offer = session.offerId as IOffer;

    // 1. Validação de Upsell Ativo
    if (!offer?.upsell?.enabled) {
      return res.status(400).json({ success: false, message: "Upsell não está ativo nesta oferta." });
    }

    // 2. Validação de Valor (CRÍTICO PARA EVITAR ERRO DO STRIPE)
    const amountToCharge = offer.upsell.price;

    if (!amountToCharge || amountToCharge < 50) {
      // Stripe exige mínimo de 50 centavos (na maioria das moedas)
      console.error(`Erro Upsell: Valor inválido (${amountToCharge}) para a oferta ${offer.name}`);
      return res.status(400).json({ success: false, message: "Configuração de preço inválida para este Upsell." });
    }

    const applicationFee = Math.round(amountToCharge * 0.05);

    // 3. Processamento
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountToCharge,
        currency: offer.currency || "brl",
        customer: session.customerId,
        payment_method: session.paymentMethodId,
        off_session: true,
        confirm: true,
        application_fee_amount: applicationFee,
        description: `Upsell: ${offer.upsell.name}`,
        metadata: {
          isUpsell: "true",
          originalOfferSlug: offer.slug,
          originalSessionToken: token,
        },
      },
      { stripeAccount: session.accountId }
    );

    if (paymentIntent.status === "succeeded") {
      await UpsellSession.deleteOne({ token });

      const redirectUrl = offer.thankYouPageUrl && offer.thankYouPageUrl.trim() !== "" ? offer.thankYouPageUrl : null;

      res.status(200).json({ success: true, message: "Compra realizada com sucesso!", redirectUrl });
    } else {
      res.status(400).json({ success: false, message: "Pagamento recusado pelo banco.", status: paymentIntent.status });
    }
  } catch (error: any) {
    console.error("Erro handleOneClickUpsell:", error);
    const errorMessage = error.raw ? error.raw.message : error.message;
    res.status(500).json({ success: false, message: errorMessage || "Erro interno ao processar upsell." });
  }
};
