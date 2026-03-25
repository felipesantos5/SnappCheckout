// src/controllers/payment.controller.ts
import { Request, Response } from "express";
import Offer, { IOffer } from "../models/offer.model";
import Sale from "../models/sale.model";
import stripe from "../lib/stripe";
import UpsellSession from "../models/upsell-session.model";
import { v4 as uuidv4 } from "uuid";
import { getOrCreateCustomer } from "../helper/getOrCreateCustomer";
import { calculateTotalAmount } from "../helper/calculateTotalAmount";
import { getStripeAccountId } from "../helper/getStripeAccountId";
import { getUpsellSteps, buildUpsellRedirectUrl } from "../helper/getUpsellSteps";

export const handleCreatePaymentIntent = async (req: Request, res: Response) => {
  try {
    const { offerSlug, selectedOrderBumps, contactInfo, addressInfo, metadata } = req.body;

    const offer = await Offer.findOne({ slug: offerSlug });
    if (!offer) {
      return res.status(404).json({ error: { message: "Oferta não encontrada." } });
    }

    const stripeAccountId = await getStripeAccountId(offerSlug);
    const customerId = await getOrCreateCustomer(stripeAccountId, contactInfo.email, contactInfo.name, contactInfo.phone);
    const totalAmount = await calculateTotalAmount(offerSlug, selectedOrderBumps);
    const applicationFee = Math.round(totalAmount * 0.05);

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totalAmount,
        currency: offer.currency || "brl",
        customer: customerId,
        setup_future_usage: "off_session",
        payment_method_types: ["card"],
        application_fee_amount: applicationFee,
        description: offer.name, // Passa o nome da oferta padrão
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
    console.log(`🔵 [UpsellToken] Iniciando geração de token | offerSlug: ${offerSlug} | paymentIntentId: ${paymentIntentId}`);

    if (!paymentIntentId || !offerSlug) {
      console.warn(`⚠️ [UpsellToken] Dados insuficientes | paymentIntentId: ${paymentIntentId} | offerSlug: ${offerSlug}`);
      return res.status(400).json({ error: "Dados insuficientes." });
    }

    const stripeAccountId = await getStripeAccountId(offerSlug);
    const offer = await Offer.findOne({ slug: offerSlug });
    if (!offer) {
      console.warn(`⚠️ [UpsellToken] Oferta não encontrada | slug: ${offerSlug}`);
      return res.status(404).json({ error: "Oferta não encontrada." });
    }

    console.log(`🔵 [UpsellToken] Oferta encontrada: "${offer.name}" | stripeAccountId: ${stripeAccountId}`);

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, { stripeAccount: stripeAccountId });

    console.log(`🔵 [UpsellToken] PaymentIntent status: ${paymentIntent.status} | customer: ${paymentIntent.customer} | payment_method: ${paymentIntent.payment_method}`);

    if (paymentIntent.status !== "succeeded") {
      console.warn(`⚠️ [UpsellToken] Pagamento não confirmado | status: ${paymentIntent.status}`);
      return res.status(400).json({ error: "Pagamento não confirmado." });
    }
    if (!paymentIntent.customer || !paymentIntent.payment_method) {
      console.warn(`⚠️ [UpsellToken] Método de pagamento ausente | customer: ${paymentIntent.customer} | payment_method: ${paymentIntent.payment_method}`);
      return res.status(400).json({ error: "Método de pagamento ausente." });
    }

    const token = uuidv4();

    // Extrai informações do cliente do metadata para persistir no upsell
    const metadata = paymentIntent.metadata || {};
    const ip = metadata.ip || "";
    const customerName = metadata.customerName || "";
    const customerEmail = metadata.customerEmail || "";
    const customerPhone = metadata.customerPhone || "";

    // Busca a Sale original para vincular ao upsell (consolidação de Facebook Purchase)
    const originalSale = await Sale.findOne({ stripePaymentIntentId: paymentIntentId });
    console.log(`🔵 [UpsellToken] Sale original: ${originalSale?._id || "NÃO ENCONTRADA (webhook pode não ter chegado ainda)"}`);

    const steps = getUpsellSteps(offer);
    console.log(`🔵 [UpsellToken] Steps do funil: ${steps.length} passos | Steps: ${JSON.stringify(steps.map((s, i) => ({ index: i, name: s.name, price: s.price, isDownsell: s.isDownsell, redirectUrl: s.redirectUrl?.substring(0, 60) })))}`);

    if (steps.length === 0) {
      console.warn(`⚠️ [UpsellToken] Nenhum upsell configurado para oferta "${offer.name}"`);
      return res.status(400).json({ error: "Nenhum upsell configurado." });
    }

    await UpsellSession.create({
      token,
      accountId: stripeAccountId,
      customerId: paymentIntent.customer as string,
      paymentMethodId: paymentIntent.payment_method as string,
      offerId: offer._id,
      paymentMethod: "stripe", // Stripe one-click upsell
      ip, // Salva IP para manter localização correta
      customerName,
      customerEmail,
      customerPhone,
      originalSaleId: originalSale?._id || null,
      currentStepIndex: 0,
    });

    // Constrói a URL de redirecionamento para o primeiro passo
    const redirectUrl = buildUpsellRedirectUrl(steps[0].redirectUrl, token);

    console.log(`✅ [UpsellToken] Token gerado com sucesso | token: ${token} | redirectUrl: ${redirectUrl} | customer: ${customerEmail} | paymentMethod: ${paymentIntent.payment_method}`);

    res.status(200).json({ token, redirectUrl });
  } catch (error: any) {
    console.error(`❌ [UpsellToken] Erro ao gerar token:`, error.message, error.stack);
    res.status(500).json({ error: { message: "Falha ao gerar link." } });
  }
};

export const handleRefuseUpsell = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    console.log(`🔴 [UpsellRefuse] Requisição recebida | token: ${token || "VAZIO"}`);

    if (!token) return res.status(400).json({ success: false, message: "Token inválido." });

    const session: any = await UpsellSession.findOne({ token }).populate("offerId");
    if (!session) {
      console.warn(`⚠️ [UpsellRefuse] Sessão NÃO encontrada | token: ${token}`);
      return res.status(403).json({ success: false, message: "Sessão expirada." });
    }

    const offer = session.offerId as IOffer;
    const steps = getUpsellSteps(offer);
    const currentStep = steps[session.currentStepIndex];

    console.log(`🔴 [UpsellRefuse] Recusando step | oferta: "${offer?.name}" | currentStepIndex: ${session.currentStepIndex} | stepName: "${currentStep?.name}" | isDownsell: ${currentStep?.isDownsell} | customer: ${session.customerEmail}`);

    // Determina próximo step: usa declineNextStep configurado, senão avança linear
    const declineNextStep = currentStep?.declineNextStep;
    const nextStepIndex = (declineNextStep !== undefined && declineNextStep !== null)
      ? declineNextStep
      : session.currentStepIndex + 1;

    console.log(`🔴 [UpsellRefuse] Navegação | declineNextStep: ${declineNextStep} | nextStepIndex: ${nextStepIndex} | totalSteps: ${steps.length}`);

    // Se há próximo passo válido no funil, avança para ele
    if (nextStepIndex >= 0 && nextStepIndex < steps.length) {
      const nextStep = steps[nextStepIndex];

      // Valida se o próximo step tem redirectUrl antes de redirecionar
      if (!nextStep.redirectUrl || nextStep.redirectUrl.trim() === "") {
        console.warn(`⚠️ [UpsellRefuse] Próximo step (${nextStepIndex}) sem redirectUrl! Finalizando funil. | stepName: "${nextStep.name}"`);
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
      console.log(`🔴 [UpsellRefuse] Avançando para próximo step | nextStepIndex: ${nextStepIndex} | nextStepName: "${nextStep.name}" | redirectUrl: ${redirectUrl}`);
      return res.status(200).json({ success: true, message: "Oferta recusada.", redirectUrl });
    }

    // Último passo: deleta sessão e vai para thank you page
    await UpsellSession.deleteOne({ token });
    const redirectUrl = offer.thankYouPageUrl && offer.thankYouPageUrl.trim() !== "" ? offer.thankYouPageUrl : null;

    console.log(`🔴 [UpsellRefuse] Funil finalizado (recusa) | thankYouPageUrl: ${redirectUrl || "NÃO CONFIGURADA"} | customer: ${session.customerEmail}`);
    res.status(200).json({ success: true, message: "Oferta recusada.", redirectUrl });
  } catch (error: any) {
    console.error(`❌ [UpsellRefuse] Erro:`, error.message, error.stack);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const handleOneClickUpsell = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    console.log(`🟡 [OneClickUpsell] Requisição recebida | token: ${token || "VAZIO"}`);

    if (!token) throw new Error("Token inválido.");

    const session: any = await UpsellSession.findOne({ token }).populate("offerId");
    if (!session) {
      console.warn(`⚠️ [OneClickUpsell] Sessão NÃO encontrada | token: ${token} | Possíveis causas: expirou (TTL 30min), já foi usado, ou token inválido`);
      return res.status(403).json({ success: false, message: "Sessão expirada ou token já usado." });
    }

    const offer = session.offerId as IOffer;
    console.log(`🟡 [OneClickUpsell] Sessão encontrada | oferta: "${offer?.name}" | slug: ${offer?.slug} | paymentMethod: ${session.paymentMethod} | customerId: ${session.customerId} | paymentMethodId: ${session.paymentMethodId} | currentStepIndex: ${session.currentStepIndex} | sessionCreatedAt: ${session.createdAt} | customerEmail: ${session.customerEmail}`);

    // 1. Validação de Upsell Ativo
    if (!offer?.upsell?.enabled) {
      console.warn(`⚠️ [OneClickUpsell] Upsell DESABILITADO na oferta "${offer?.name}" | upsell config: ${JSON.stringify(offer?.upsell)}`);
      return res.status(400).json({ success: false, message: "Upsell não está ativo nesta oferta." });
    }

    const steps = getUpsellSteps(offer);
    const currentStep = steps[session.currentStepIndex];

    console.log(`🟡 [OneClickUpsell] Funil de steps: ${steps.length} total | currentStepIndex: ${session.currentStepIndex} | currentStep: ${JSON.stringify(currentStep ? { name: currentStep.name, price: currentStep.price, isDownsell: currentStep.isDownsell, acceptNextStep: currentStep.acceptNextStep, declineNextStep: currentStep.declineNextStep } : "NULL")}`);

    if (!currentStep) {
      console.warn(`⚠️ [OneClickUpsell] Step inválido | index: ${session.currentStepIndex} | totalSteps: ${steps.length}`);
      return res.status(400).json({ success: false, message: "Passo de upsell inválido." });
    }

    // NOVO: Verificar se o pagamento foi feito com PayPal (ou outro método não-Stripe)
    if (session.paymentMethod !== "stripe") {
      console.log(`🟡 [OneClickUpsell] Método não-Stripe detectado: ${session.paymentMethod} | Redirecionando para fallback`);
      const fallbackUrl = currentStep.fallbackCheckoutUrl;
      if (fallbackUrl && fallbackUrl.trim() !== "") {
        await UpsellSession.deleteOne({ token });
        return res.status(200).json({
          success: true,
          message: "Redirecionando para checkout alternativo...",
          redirectUrl: fallbackUrl,
        });
      } else {
        console.warn(`⚠️ [OneClickUpsell] Sem fallbackCheckoutUrl configurado para método ${session.paymentMethod}`);
        return res.status(400).json({
          success: false,
          message: "One-click upsell não disponível para este método de pagamento. Configure um link de checkout alternativo.",
        });
      }
    }

    // 2. Validação de Valor (CRÍTICO PARA EVITAR ERRO DO STRIPE)
    const amountToCharge = currentStep.price;

    if (!amountToCharge || amountToCharge < 50) {
      console.error(`❌ [OneClickUpsell] Valor inválido | amount: ${amountToCharge} | oferta: "${offer.name}" | step: ${session.currentStepIndex} | stepName: "${currentStep.name}"`);
      return res.status(400).json({ success: false, message: "Configuração de preço inválida para este Upsell." });
    }

    const applicationFee = Math.round(amountToCharge * 0.05);

    console.log(`🟡 [OneClickUpsell] Criando PaymentIntent off_session | amount: ${amountToCharge} | currency: ${offer.currency || "brl"} | customer: ${session.customerId} | paymentMethod: ${session.paymentMethodId} | stripeAccount: ${session.accountId} | applicationFee: ${applicationFee} | stepName: "${currentStep.name}"`);

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

    console.log(`🟡 [OneClickUpsell] PaymentIntent criado | id: ${paymentIntent.id} | status: ${paymentIntent.status} | amount: ${paymentIntent.amount}`);

    if (paymentIntent.status === "succeeded") {
      // Determina próximo step: usa acceptNextStep configurado, senão avança linear
      const acceptNextStep = currentStep?.acceptNextStep;
      const nextStepIndex = (acceptNextStep !== undefined && acceptNextStep !== null)
        ? acceptNextStep
        : session.currentStepIndex + 1;

      console.log(`🟡 [OneClickUpsell] Pagamento SUCESSO | acceptNextStep: ${acceptNextStep} | nextStepIndex: ${nextStepIndex} | totalSteps: ${steps.length}`);

      // Se há próximo passo válido no funil, avança
      if (nextStepIndex >= 0 && nextStepIndex < steps.length) {
        const nextStep = steps[nextStepIndex];

        // Valida se o próximo step tem redirectUrl antes de redirecionar
        if (!nextStep.redirectUrl || nextStep.redirectUrl.trim() === "") {
          console.warn(`⚠️ [OneClickUpsell] Próximo step (${nextStepIndex}) sem redirectUrl! Finalizando funil. | stepName: "${nextStep.name}"`);
          await UpsellSession.deleteOne({ token });
          const redirectUrl = offer.thankYouPageUrl && offer.thankYouPageUrl.trim() !== "" ? offer.thankYouPageUrl : null;
          return res.status(200).json({ success: true, message: "Compra realizada com sucesso!", redirectUrl });
        }

        session.currentStepIndex = nextStepIndex;
        await session.save();

        const redirectUrl = buildUpsellRedirectUrl(nextStep.redirectUrl, token);
        console.log(`✅ [OneClickUpsell] Avançando para próximo step | nextStepIndex: ${nextStepIndex} | nextStepName: "${nextStep.name}" | redirectUrl: ${redirectUrl}`);
        return res.status(200).json({ success: true, message: "Compra realizada com sucesso!", redirectUrl });
      }

      // Último passo: deleta sessão e vai para thank you page
      await UpsellSession.deleteOne({ token });
      const redirectUrl = offer.thankYouPageUrl && offer.thankYouPageUrl.trim() !== "" ? offer.thankYouPageUrl : null;

      console.log(`✅ [OneClickUpsell] Último passo concluído | thankYouPageUrl: ${redirectUrl || "NÃO CONFIGURADA"} | customer: ${session.customerEmail}`);
      res.status(200).json({ success: true, message: "Compra realizada com sucesso!", redirectUrl });
    } else {
      console.warn(`⚠️ [OneClickUpsell] Pagamento NÃO succeeded | status: ${paymentIntent.status} | id: ${paymentIntent.id} | customer: ${session.customerEmail}`);
      res.status(400).json({ success: false, message: "Pagamento recusado pelo banco.", status: paymentIntent.status });
    }
  } catch (error: any) {
    const stripeCode = error.code || error.raw?.code || "N/A";
    const stripeDeclineCode = error.raw?.decline_code || error.decline_code || "N/A";
    const stripeType = error.type || error.raw?.type || "N/A";
    console.error(`❌ [OneClickUpsell] ERRO | type: ${stripeType} | code: ${stripeCode} | decline_code: ${stripeDeclineCode} | message: ${error.raw?.message || error.message}`, error.stack);
    const errorMessage = error.raw ? error.raw.message : error.message;
    res.status(500).json({ success: false, message: errorMessage || "Erro interno ao processar upsell." });
  }
};
