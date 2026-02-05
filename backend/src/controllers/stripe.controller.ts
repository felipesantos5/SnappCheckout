// src/controllers/stripe.controller.ts
import { Request, Response } from "express";
import User, { IUser } from "../models/user.model";
import stripe from "../lib/stripe";
import Offer from "../models/offer.model";
import Sale from "../models/sale.model";
import { Stripe } from "stripe";
import * as stripeService from "../services/stripe.service";
import { sendAccessWebhook } from "../services/integration.service";
import { createFacebookUserData, sendFacebookEvent } from "../services/facebook.service";
import { processUtmfyIntegration } from "../services/utmfy.service";

// !! IMPORTANTE !!
// Altere estas URLs para as rotas do seu frontend (dashboard-admin)
// O usuário será enviado para cá DEPOIS de terminar o onboarding do Stripe.
const STRIPE_ONBOARDING_RETURN_URL = "https://admin.snappcheckout.com/dashboard/stripe-return";
const STRIPE_ONBOARDING_REFRESH_URL = "https://admin.snappcheckout.com/dashboard/stripe-refresh";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Dispara todas as integrações (Facebook, Husky, UTMfy)
 */
async function dispatchIntegrations(
  offer: any,
  sale: any,
  items: any[],
  paymentIntent: Stripe.PaymentIntent,
  metadata: any
): Promise<void> {
  console.log(`🔵 [Stripe] Iniciando disparos de integrações para venda ${sale._id}`);

  sale.integrationsLastAttempt = new Date();

  // A: Facebook CAPI
  try {
    console.log(`🔵 [Stripe] Enviando para Facebook CAPI...`);

    const pixels: Array<{ pixelId: string; accessToken: string }> = [];

    if (offer.facebookPixels && offer.facebookPixels.length > 0) {
      pixels.push(...offer.facebookPixels);
    }

    if (offer.facebookPixelId && offer.facebookAccessToken) {
      const alreadyExists = pixels.some((p) => p.pixelId === offer.facebookPixelId);
      if (!alreadyExists) {
        pixels.push({
          pixelId: offer.facebookPixelId,
          accessToken: offer.facebookAccessToken,
        });
      }
    }

    if (pixels.length > 0) {
      const totalValue = paymentIntent.amount / 100;

      const userData = createFacebookUserData(
        metadata.ip || "",
        metadata.userAgent || "",
        sale.customerEmail,
        metadata.customerPhone || "",
        sale.customerName,
        metadata.fbc,
        metadata.fbp,
        metadata.addressCity,
        metadata.addressState,
        metadata.addressZipCode,
        metadata.addressCountry
      );

      const eventData = {
        event_name: "Purchase" as const,
        event_time: Math.floor(Date.now() / 1000),
        event_id: metadata.purchaseEventId || `stripe_purchase_${sale._id}`,
        action_source: "website" as const,
        user_data: userData,
        custom_data: {
          currency: (offer.currency || "BRL").toUpperCase(),
          value: totalValue,
          order_id: String(sale._id),
          content_ids: items.map((i) => i._id || i.customId || "unknown"),
          content_type: "product",
        },
      };

      const results = await Promise.allSettled(
        pixels.map((pixel) =>
          sendFacebookEvent(pixel.pixelId, pixel.accessToken, eventData).catch((err) => {
            console.error(`❌ [Stripe] Erro Facebook pixel ${pixel.pixelId}:`, err);
            throw err;
          })
        )
      );

      const successful = results.filter((r) => r.status === "fulfilled").length;
      if (successful > 0) {
        sale.integrationsFacebookSent = true;
        console.log(`✅ [Stripe] Facebook enviado com sucesso para ${successful}/${pixels.length} pixels`);
      } else {
        sale.integrationsFacebookSent = false;
      }
    }
  } catch (error: any) {
    console.error(`⚠️ [Stripe] Erro Facebook (venda salva):`, error.message);
    sale.integrationsFacebookSent = false;
  }

  // B: Husky/Área de Membros
  try {
    console.log(`🔵 [Stripe] Enviando para Husky...`);
    await sendAccessWebhook(offer, sale, items, metadata.customerPhone || "");
    sale.integrationsHuskySent = true;
    console.log(`✅ [Stripe] Husky enviado com sucesso`);
  } catch (error: any) {
    console.error(`⚠️ [Stripe] Erro Husky (venda salva):`, error.message);
    sale.integrationsHuskySent = false;
  }

  // C: UTMfy
  try {
    console.log(`🔵 [Stripe] Enviando para UTMfy...`);
    await processUtmfyIntegration(offer, sale, items, paymentIntent, metadata);
    sale.integrationsUtmfySent = true;
    console.log(`✅ [Stripe] UTMfy enviado com sucesso`);
  } catch (error: any) {
    console.error(`⚠️ [Stripe] Erro UTMfy (venda salva):`, error.message);
    sale.integrationsUtmfySent = false;
  }

  // Salva flags
  await sale.save();
  console.log(`📊 [Stripe] Integrações: Facebook=${sale.integrationsFacebookSent}, Husky=${sale.integrationsHuskySent}, UTMfy=${sale.integrationsUtmfySent}`);
}

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
  const sig = req.headers["stripe-signature"] as string;
  const rawBody = req.body;

  // Modo desenvolvimento: permite pular validação
  const isDevelopment = process.env.NODE_ENV === "development" || process.env.SKIP_WEBHOOK_VALIDATION === "true";

  if (!webhookSecret && !isDevelopment) {
    console.error("❌ [Stripe Webhook] STRIPE_WEBHOOK_SECRET não está configurado no .env");
    return res.status(500).send("Webhook não configurado.");
  }

  let event: Stripe.Event;

  try {
    // Validação de assinatura (pula em desenvolvimento se necessário)
    if (isDevelopment && !webhookSecret) {
      console.warn("⚠️ [Stripe Webhook] MODO DEV: Pulando validação de assinatura (NÃO USE EM PRODUÇÃO!)");
      event = req.body as Stripe.Event;
    } else {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret!);
    }

    console.log(`📥 [Stripe Webhook] Evento recebido: ${event.type} (ID: ${event.id})`);
  } catch (err: any) {
    console.error(`❌ [Stripe Webhook] Erro na verificação da assinatura: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 2. Processa os eventos
  try {
    switch (event.type) {
      // --- CASO 1: VENDA BEM-SUCEDIDA ---
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const metadata = paymentIntent.metadata || {};

        console.log(`✅ [Stripe] Pagamento aprovado: ${paymentIntent.id}`);
        console.log(`📋 [Stripe] Metadata recebido:`, {
          offerSlug: metadata.offerSlug,
          customerEmail: metadata.customerEmail,
          customerName: metadata.customerName,
          isUpsell: metadata.isUpsell,
        });

        // Suporte a metadata NOVO (offerSlug) e ANTIGO (platformOfferId)
        const offerSlug = metadata.offerSlug || metadata.originalOfferSlug;
        const customerEmail = metadata.customerEmail;
        const customerName = metadata.customerName;
        const customerPhone = metadata.customerPhone;
        const isUpsell = metadata.isUpsell === "true";

        if (!offerSlug) {
          console.error(`❌ [Stripe] Metadata 'offerSlug' não encontrado no PaymentIntent ${paymentIntent.id}`);
          console.error(`❌ [Stripe] Metadata completo:`, metadata);
          // Responde 200 para não retentar (erro de dados, não de processamento)
          return res.status(200).json({ received: true, warning: "offerSlug não encontrado" });
        }

        // Idempotência: Verifica se a venda já existe
        console.log(`🔍 [Stripe] Verificando se venda já existe: ${paymentIntent.id}`);
        const existingSale = await Sale.findOne({ stripePaymentIntentId: paymentIntent.id });

        if (existingSale) {
          console.log(`⚠️ [Stripe] Venda ${paymentIntent.id} já existe (ID: ${existingSale._id}, Status: ${existingSale.status})`);

          // Se estava pending, atualiza para succeeded
          if (existingSale.status === "pending") {
            console.log(`🔄 [Stripe] Atualizando venda de pending para succeeded`);
            existingSale.status = "succeeded";
            existingSale.platformFeeInCents = paymentIntent.application_fee_amount || 0;
            await existingSale.save();
            console.log(`✅ [Stripe] Venda ${existingSale._id} atualizada para succeeded`);

            // Dispara integrações se ainda não foram enviadas
            if (!existingSale.integrationsFacebookSent || !existingSale.integrationsHuskySent || !existingSale.integrationsUtmfySent) {
              console.log(`🔄 [Stripe] Disparando integrações faltantes...`);
              const offer = await Offer.findById(existingSale.offerId).populate("ownerId");
              if (offer) {
                await dispatchIntegrations(offer, existingSale, existingSale.items || [], paymentIntent, metadata);
              }
            }
          }

          // Responde 200 OK para o Stripe
          return res.status(200).json({ received: true });
        }

        // Busca a oferta pelo SLUG
        console.log(`🔍 [Stripe] Buscando oferta: ${offerSlug}`);
        const offer = await Offer.findOne({ slug: offerSlug }).populate("ownerId");

        if (!offer) {
          console.error(`❌ [Stripe] Oferta '${offerSlug}' não encontrada no banco de dados`);
          // Responde 200 para não retentar (erro de dados, não de processamento)
          return res.status(200).json({ received: true, warning: "Oferta não encontrada" });
        }

        console.log(`✅ [Stripe] Oferta encontrada: ${offer.name} (ID: ${offer._id})`);

        // Monta lista de itens (produto principal + order bumps)
        console.log(`📦 [Stripe] Montando lista de itens (isUpsell: ${isUpsell})`);
        const items = [];

        if (isUpsell) {
          // Upsell: apenas um item
          items.push({
            name: offer.upsell?.name || metadata.productName || "Upsell",
            priceInCents: paymentIntent.amount,
            isOrderBump: false,
            customId: offer.upsell?.customId,
          });
          console.log(`📦 [Stripe] Item upsell adicionado: ${items[0].name}`);
        } else {
          // Produto principal
          items.push({
            _id: (offer.mainProduct as any)._id?.toString(),
            name: offer.mainProduct.name,
            priceInCents: offer.mainProduct.priceInCents,
            isOrderBump: false,
            customId: (offer.mainProduct as any).customId,
          });
          console.log(`📦 [Stripe] Produto principal adicionado: ${offer.mainProduct.name}`);

          // Order Bumps selecionados
          const selectedOrderBumps = metadata.selectedOrderBumps ? JSON.parse(metadata.selectedOrderBumps) : [];
          console.log(`📦 [Stripe] Order bumps selecionados: ${selectedOrderBumps.length}`);

          for (const bumpId of selectedOrderBumps) {
            const bump = offer.orderBumps.find((b: any) => b?._id?.toString() === bumpId);
            if (bump) {
              items.push({
                _id: bump._id?.toString(),
                name: bump.name,
                priceInCents: bump.priceInCents,
                isOrderBump: true,
                customId: (bump as any).customId,
              });
              console.log(`📦 [Stripe] Order bump adicionado: ${bump.name}`);
            }
          }
        }

        console.log(`📦 [Stripe] Total de itens: ${items.length}`);

        // Cria a venda no banco de dados
        console.log(`💾 [Stripe] Criando venda no banco de dados...`);
        const newSale = new Sale({
          ownerId: offer.ownerId,
          offerId: offer._id,
          abTestId: metadata.abTestId || null,
          stripePaymentIntentId: paymentIntent.id,
          customerName: customerName || "Cliente Não Identificado",
          customerEmail: customerEmail || "email@nao.informado",
          customerPhone: customerPhone || "",
          ip: metadata.ip || "",
          country: metadata.country || "BR",
          userAgent: metadata.userAgent || "",
          fbc: metadata.fbc || "",
          fbp: metadata.fbp || "",
          addressCity: metadata.addressCity || "",
          addressState: metadata.addressState || "",
          addressZipCode: metadata.addressZipCode || "",
          addressCountry: metadata.addressCountry || "",
          totalAmountInCents: paymentIntent.amount,
          platformFeeInCents: paymentIntent.application_fee_amount || 0,
          currency: paymentIntent.currency || offer.currency || "brl",
          status: "succeeded",
          paymentMethod: "stripe",
          gateway: "stripe",
          isUpsell: isUpsell,
          items: items,

          // UTM Tracking
          utm_source: metadata.utm_source || "",
          utm_medium: metadata.utm_medium || "",
          utm_campaign: metadata.utm_campaign || "",
          utm_term: metadata.utm_term || "",
          utm_content: metadata.utm_content || "",
        });

        await newSale.save();
        console.log(`✅ [Stripe] Venda criada com sucesso: ${newSale._id}`);

        // Dispara integrações (Facebook, Husky, UTMfy)
        console.log(`🚀 [Stripe] Iniciando disparos de integrações...`);
        await dispatchIntegrations(offer, newSale, items, paymentIntent, metadata);

        console.log(`✅ [Stripe] Processamento do webhook concluído com sucesso`);
        break;
      }

      // --- CASO 2: CANCELAMENTO (REEMBOLSO) ---
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string;

        console.log(`💸 [Stripe] Processando reembolso: ${charge.id}`);

        // Encontre a venda original e atualize seu status
        const sale = await Sale.findOne({ stripePaymentIntentId: paymentIntentId });
        if (sale) {
          sale.status = "refunded";
          await sale.save();
          console.log(`✅ [Stripe] Venda ${sale._id} marcada como reembolsada`);
        } else {
          console.warn(`⚠️ [Stripe] Venda não encontrada para reembolso: ${paymentIntentId}`);
        }
        break;
      }

      default:
        console.log(`ℹ️ [Stripe] Evento não tratado: ${event.type}`);
    }

    // Responde 200 OK para o Stripe
    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error(`❌ [Stripe] ERRO CRÍTICO ao processar webhook ${event.type}:`, error);
    console.error(`❌ [Stripe] Mensagem:`, error.message);
    console.error(`❌ [Stripe] Stack:`, error.stack);

    // Retorna 500 para o Stripe retentar
    return res.status(500).json({ error: "Falha no processamento do webhook" });
  }
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
