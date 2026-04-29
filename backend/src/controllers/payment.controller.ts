// src/controllers/payment.controller.ts
import { Request, Response } from "express";
import Offer, { IOffer } from "../models/offer.model";
import Sale from "../models/sale.model";
import AbandonedCart from "../models/abandoned-cart.model";
import stripe from "../lib/stripe";
import UpsellSession from "../models/upsell-session.model";
import { v4 as uuidv4 } from "uuid";
import { getOrCreateCustomer } from "../helper/getOrCreateCustomer";
import { calculateTotalAmount } from "../helper/calculateTotalAmount";
import { getStripeAccountId } from "../helper/getStripeAccountId";
import { getUpsellSteps, buildUpsellRedirectUrl } from "../helper/getUpsellSteps";

export const handleCreatePaymentIntent = async (req: Request, res: Response) => {
  try {
    const { offerSlug, selectedOrderBumps, contactInfo, addressInfo, metadata, couponCode } = req.body;

    const offer = await Offer.findOne({ slug: offerSlug });
    if (!offer) {
      return res.status(404).json({ error: { message: "Oferta não encontrada." } });
    }

    const stripeAccountId = await getStripeAccountId(offerSlug);
    const customerId = await getOrCreateCustomer(stripeAccountId, contactInfo.email, contactInfo.name, contactInfo.phone);
    let totalAmount = await calculateTotalAmount(offerSlug, selectedOrderBumps);

    // Aplica desconto do cupom (validado server-side)
    if (couponCode && offer.coupons?.enabled && offer.coupons.codes.length) {
      const coupon = offer.coupons.codes.find(
        (c) => c.code.toLowerCase() === String(couponCode).trim().toLowerCase()
      );
      if (coupon) {
        const discount = Math.floor(totalAmount * (coupon.discountPercent / 100));
        totalAmount = Math.max(totalAmount - discount, 50); // mínimo 50 centavos
      }
    }

    const applicationFee = Math.round(totalAmount * 0.05);

    const sharedMetadata: Record<string, string> = {
      offerSlug,
      selectedOrderBumps: JSON.stringify(selectedOrderBumps || []),
      customerEmail: contactInfo.email,
      customerName: contactInfo.name,
      customerPhone: contactInfo.phone || "",
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
    };

    // --- ASSINATURA ---
    if (offer.paymentType === "subscription") {
      const interval = offer.subscriptionInterval || "month";

      const stripeProduct = await stripe.products.create(
        { name: offer.name },
        { stripeAccount: stripeAccountId }
      );

      const subscription = await stripe.subscriptions.create(
        {
          customer: customerId,
          items: [
            {
              price_data: {
                currency: (offer.currency || "brl").toLowerCase(),
                product: stripeProduct.id,
                unit_amount: totalAmount,
                recurring: { interval },
              } as any,
            },
          ],
          payment_behavior: "default_incomplete",
          payment_settings: { payment_method_types: ["card"], save_default_payment_method: "on_subscription" },
          application_fee_percent: 5,
          metadata: sharedMetadata,
          expand: ["latest_invoice.payment_intent"],
        },
        { stripeAccount: stripeAccountId }
      );

      let invoice = subscription.latest_invoice as any;
      console.log("[subscription] latest_invoice type:", typeof invoice, "value:", typeof invoice === "string" ? invoice : invoice?.id);

      // Se latest_invoice veio como string (não expandido), busca explicitamente
      if (typeof invoice === "string") {
        invoice = await stripe.invoices.retrieve(invoice, { expand: ["payment_intent"] } as any, { stripeAccount: stripeAccountId });
        console.log("[subscription] invoice retrieved, payment_intent type:", typeof invoice?.payment_intent, "value:", typeof invoice?.payment_intent === "string" ? invoice.payment_intent : invoice?.payment_intent?.id);
      }

      let pi = invoice?.payment_intent as any;

      // Se o payment_intent veio como string (não expandido), busca explicitamente
      if (typeof pi === "string") {
        console.log("[subscription] fetching PI explicitly:", pi);
        pi = await stripe.paymentIntents.retrieve(pi, { stripeAccount: stripeAccountId });
      }

      console.log("[subscription] pi id:", pi?.id, "has client_secret:", !!pi?.client_secret);

      if (!pi?.client_secret) {
        console.error("[subscription] PI debug - invoice:", JSON.stringify(invoice?.id), "pi:", JSON.stringify(pi));
        return res.status(500).json({ error: { message: "Falha ao criar assinatura: PaymentIntent não encontrado." } });
      }

      // Atualiza metadata do PI para que o webhook existente funcione normalmente
      await stripe.paymentIntents.update(
        pi.id,
        { metadata: { ...sharedMetadata, stripeSubscriptionId: subscription.id } },
        { stripeAccount: stripeAccountId }
      );

      return res.status(200).json({ clientSecret: pi.client_secret });
    }

    // --- PAGAMENTO ÚNICO (fluxo original, sem alterações) ---
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totalAmount,
        currency: offer.currency || "brl",
        customer: customerId,
        setup_future_usage: "off_session",
        payment_method_types: ["card"],
        application_fee_amount: applicationFee,
        description: offer.name,
        metadata: sharedMetadata,
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
    const offer = await Offer.findOne({ slug: offerSlug });
    if (!offer) {
      return res.status(404).json({ error: "Oferta não encontrada." });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, { stripeAccount: stripeAccountId });

    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({ error: "Pagamento não confirmado." });
    }
    if (!paymentIntent.customer || !paymentIntent.payment_method) {
      return res.status(400).json({ error: "Método de pagamento ausente." });
    }

    const token = uuidv4();

    const metadata = paymentIntent.metadata || {};
    const ip = metadata.ip || "";
    const customerName = metadata.customerName || "";
    const customerEmail = metadata.customerEmail || "";
    const customerPhone = metadata.customerPhone || "";

    const originalSale = await Sale.findOne({ stripePaymentIntentId: paymentIntentId });

    const steps = getUpsellSteps(offer);

    if (steps.length === 0) {
      return res.status(400).json({ error: "Nenhum upsell configurado." });
    }

    await UpsellSession.create({
      token,
      accountId: stripeAccountId,
      customerId: paymentIntent.customer as string,
      paymentMethodId: paymentIntent.payment_method as string,
      offerId: offer._id,
      paymentMethod: "stripe",
      ip,
      customerName,
      customerEmail,
      customerPhone,
      originalSaleId: originalSale?._id || null,
      currentStepIndex: 0,
    });

    const redirectUrl = buildUpsellRedirectUrl(steps[0].redirectUrl, token);

    res.status(200).json({ token, redirectUrl });
  } catch (error: any) {
    console.error(`Erro ao gerar token de upsell:`, error.message);
    res.status(500).json({ error: { message: "Falha ao gerar link." } });
  }
};

export const handleRefuseUpsell = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) return res.status(400).json({ success: false, message: "Token inválido." });

    const session: any = await UpsellSession.findOne({ token }).populate("offerId");
    if (!session) {
      return res.status(403).json({ success: false, message: "Sessão expirada." });
    }

    const offer = session.offerId as IOffer;
    const steps = getUpsellSteps(offer);
    const currentStep = steps[session.currentStepIndex];

    const declineNextStep = currentStep?.declineNextStep;
    const nextStepIndex = (declineNextStep !== undefined && declineNextStep !== null)
      ? declineNextStep
      : session.currentStepIndex + 1;

    if (nextStepIndex >= 0 && nextStepIndex < steps.length) {
      const nextStep = steps[nextStepIndex];

      if (!nextStep.redirectUrl || nextStep.redirectUrl.trim() === "") {
        await UpsellSession.deleteOne({ token });
        const redirectUrl = offer.thankYouPageUrl && offer.thankYouPageUrl.trim() !== "" ? offer.thankYouPageUrl : null;
        return res.status(200).json({ success: true, message: "Oferta recusada.", redirectUrl });
      }

      session.currentStepIndex = nextStepIndex;
      await session.save();

      const extraParams: Record<string, string> = {};
      if (session.paymentMethod === "paypal") {
        extraParams.payment_method = "paypal";
        extraParams.offerId = (offer._id as any).toString();
      }

      const redirectUrl = buildUpsellRedirectUrl(nextStep.redirectUrl, token, extraParams);
      return res.status(200).json({ success: true, message: "Oferta recusada.", redirectUrl });
    }

    await UpsellSession.deleteOne({ token });
    const redirectUrl = offer.thankYouPageUrl && offer.thankYouPageUrl.trim() !== "" ? offer.thankYouPageUrl : null;
    res.status(200).json({ success: true, message: "Oferta recusada.", redirectUrl });
  } catch (error: any) {
    console.error(`Erro ao recusar upsell:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Registra ou atualiza um carrinho abandonado.
 * Chamado pelo checkout quando o cliente preenche o email mas não paga.
 */
export const handleTrackCart = async (req: Request, res: Response) => {
  try {
    const { offerSlug, email, name } = req.body;

    if (!offerSlug || !email) {
      return res.status(400).json({ error: "offerSlug e email são obrigatórios." });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const offer = await Offer.findOne({ slug: offerSlug }).select("_id ownerId cartAbandonmentEnabled").lean();
    if (!offer) {
      return res.status(404).json({ error: "Oferta não encontrada." });
    }

    if (!offer.cartAbandonmentEnabled) {
      // Oferta sem abandono habilitado — aceita silenciosamente
      return res.status(200).json({ ok: true });
    }

    const tag = `[Cart Abandonment][Track]`;
    console.log(`${tag} Email capturado — oferta: ${offerSlug} | email: ${normalizedEmail}`);

    // Upsert: cria ou atualiza (preservando o createdAt original para não resetar a fila)
    const result = await AbandonedCart.findOneAndUpdate(
      { customerEmail: normalizedEmail, offerId: offer._id },
      {
        $setOnInsert: {
          customerEmail: normalizedEmail,
          offerId: offer._id,
          ownerId: offer.ownerId,
          customerName: name || "",
          emailSent: false,
          reminder1SentAt: null,
          reminder2SentAt: null,
          convertedAt: null,
        },
        $set: {
          ...(name ? { customerName: name } : {}),
        },
      },
      { upsert: true, new: true }
    );

    const isNew = result.createdAt.getTime() === result.updatedAt.getTime();
    console.log(`${tag} Carrinho ${isNew ? "criado" : "já existente"} — id: ${result._id} | email: ${normalizedEmail}`);

    res.status(200).json({ ok: true });
  } catch (error: any) {
    // Ignora erros de duplicate key (E11000) — significa que o registro já existe
    if (error.code === 11000) {
      return res.status(200).json({ ok: true });
    }
    console.error(`[Cart Abandonment][Track] Erro ao registrar carrinho: ${error.message}`);
    res.status(500).json({ error: "Erro interno." });
  }
};

export const handleOneClickUpsell = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) throw new Error("Token inválido.");

    const session: any = await UpsellSession.findOne({ token }).populate("offerId");
    if (!session) {
      return res.status(403).json({ success: false, message: "Sessão expirada ou token já usado." });
    }

    const offer = session.offerId as IOffer;

    if (!offer?.upsell?.enabled) {
      return res.status(400).json({ success: false, message: "Upsell não está ativo nesta oferta." });
    }

    const steps = getUpsellSteps(offer);
    const currentStep = steps[session.currentStepIndex];

    if (!currentStep) {
      return res.status(400).json({ success: false, message: "Passo de upsell inválido." });
    }

    if (session.paymentMethod !== "stripe") {
      const fallbackUrl = currentStep.fallbackCheckoutUrl;
      if (fallbackUrl && fallbackUrl.trim() !== "") {
        await UpsellSession.deleteOne({ token });
        return res.status(200).json({
          success: true,
          message: "Redirecionando para checkout alternativo...",
          redirectUrl: fallbackUrl,
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "One-click upsell não disponível para este método de pagamento. Configure um link de checkout alternativo.",
        });
      }
    }

    const amountToCharge = currentStep.price;

    if (!amountToCharge || amountToCharge < 50) {
      return res.status(400).json({ success: false, message: "Configuração de preço inválida para este Upsell." });
    }

    const applicationFee = Math.round(amountToCharge * 0.05);

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountToCharge,
        currency: offer.currency || "brl",
        customer: session.customerId,
        payment_method: session.paymentMethodId,
        off_session: true,
        confirm: true,
        application_fee_amount: applicationFee,
        description: `Upsell: ${currentStep.name}`,
        metadata: {
          isUpsell: "true",
          upsellStepIndex: String(session.currentStepIndex),
          originalOfferSlug: offer.slug,
          originalSessionToken: token,
          ip: session.ip || "",
          customerName: session.customerName || "",
          customerEmail: session.customerEmail || "",
          customerPhone: session.customerPhone || "",
        },
      },
      { stripeAccount: session.accountId }
    );

    if (paymentIntent.status === "succeeded") {
      const acceptNextStep = currentStep?.acceptNextStep;
      const nextStepIndex = (acceptNextStep !== undefined && acceptNextStep !== null)
        ? acceptNextStep
        : session.currentStepIndex + 1;

      if (nextStepIndex >= 0 && nextStepIndex < steps.length) {
        const nextStep = steps[nextStepIndex];

        if (!nextStep.redirectUrl || nextStep.redirectUrl.trim() === "") {
          await UpsellSession.deleteOne({ token });
          const redirectUrl = offer.thankYouPageUrl && offer.thankYouPageUrl.trim() !== "" ? offer.thankYouPageUrl : null;
          return res.status(200).json({ success: true, message: "Compra realizada com sucesso!", redirectUrl });
        }

        session.currentStepIndex = nextStepIndex;
        await session.save();

        const redirectUrl = buildUpsellRedirectUrl(nextStep.redirectUrl, token);
        return res.status(200).json({ success: true, message: "Compra realizada com sucesso!", redirectUrl });
      }

      await UpsellSession.deleteOne({ token });
      const redirectUrl = offer.thankYouPageUrl && offer.thankYouPageUrl.trim() !== "" ? offer.thankYouPageUrl : null;
      res.status(200).json({ success: true, message: "Compra realizada com sucesso!", redirectUrl });
    } else {
      res.status(400).json({ success: false, message: "Pagamento recusado pelo banco.", status: paymentIntent.status });
    }
  } catch (error: any) {
    const errorMessage = error.raw ? error.raw.message : error.message;
    console.error(`Erro no one-click upsell:`, errorMessage);
    res.status(500).json({ success: false, message: errorMessage || "Erro interno ao processar upsell." });
  }
};
