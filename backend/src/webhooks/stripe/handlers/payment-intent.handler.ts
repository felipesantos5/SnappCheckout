// src/webhooks/stripe/handlers/payment-intent.handler.ts
import { Stripe } from "stripe";
import Sale from "../../../models/sale.model";
import Offer from "../../../models/offer.model";
import UpsellSession from "../../../models/upsell-session.model";
import { processUtmfyIntegration, sendPurchaseToUTMfyWebhook } from "../../../services/utmfy.service";
import stripe from "../../../lib/stripe";
import { sendAccessWebhook } from "../../../services/integration.service";
import { getCountryFromIP } from "../../../helper/getCountryFromIP";

/**
 * Helper: Extrai informações sobre o método de pagamento do Stripe
 * Suporta tanto `latest_charge` (API recente) quanto `charges.data[0]` (retrocompatibilidade)
 */
const extractPaymentMethodDetails = (paymentIntent: Stripe.PaymentIntent): {
  paymentMethodType: string;
  walletType: "apple_pay" | "google_pay" | "samsung_pay" | null;
} => {
  try {
    // Tenta latest_charge primeiro (API versions recentes), depois charges.data[0]
    const piAny = paymentIntent as any;
    const charge = piAny.latest_charge || piAny.charges?.data?.[0];
    if (!charge || !charge.payment_method_details) {
      return { paymentMethodType: "card", walletType: null };
    }

    const details = charge.payment_method_details;
    const type = details.type || "card"; // "card", "paypal", etc.

    // Se for cartão, verifica se foi usado via wallet
    let walletType: "apple_pay" | "google_pay" | "samsung_pay" | null = null;
    if (type === "card" && details.card?.wallet) {
      const walletTypeRaw = details.card.wallet.type;
      if (walletTypeRaw === "apple_pay" || walletTypeRaw === "google_pay" || walletTypeRaw === "samsung_pay") {
        walletType = walletTypeRaw;
      }
    }

    return { paymentMethodType: type, walletType };
  } catch (error) {
    console.error("❌ Erro ao extrair detalhes do método de pagamento:", error);
    return { paymentMethodType: "card", walletType: null };
  }
};

/**
 * Handler para quando um PaymentIntent é CRIADO
 * 1. Busca os dados da oferta usando o metadata
 * 2. Cria um registro de tentativa com status "pending"
 * 3. Este registro será atualizado quando o pagamento for concluído ou falhar
 */
export const handlePaymentIntentCreated = async (paymentIntent: Stripe.PaymentIntent): Promise<void> => {
  try {
    const metadata = paymentIntent.metadata || {};
    const offerSlug = metadata.offerSlug || metadata.originalOfferSlug;
    const isUpsell = metadata.isUpsell === "true";

    // Se não tem offerSlug, pode ser um PaymentIntent não relacionado ao checkout
    if (!offerSlug) {
      return;
    }

    // 1. Busca Oferta e Dono PRIMEIRO (precisamos do stripeAccountId)
    const offer = await Offer.findOne({ slug: offerSlug }).populate("ownerId");
    if (!offer) {
      console.error(`❌ Oferta '${offerSlug}' não encontrada para PaymentIntent criado.`);
      return;
    }

    const owner = offer.ownerId as any;
    if (!owner.stripeAccountId) {
      console.error("❌ Vendedor sem conta Stripe conectada.");
      return;
    }

    // Expande o PaymentIntent para ter acesso aos detalhes do charge (incluindo wallet)
    try {
      const expandedPaymentIntent = await stripe.paymentIntents.retrieve(paymentIntent.id, {
        expand: ['latest_charge.payment_method_details'],
      }, {
        stripeAccount: owner.stripeAccountId,
      });
      paymentIntent = expandedPaymentIntent;
    } catch (expandError) {
      // Se falhar a expansão, continua com os dados básicos
      console.warn("⚠️ Não foi possível expandir PaymentIntent na criação:", expandError);
    }

    // 2. Idempotência (Evita duplicidade)
    const existingSale = await Sale.findOne({ stripePaymentIntentId: paymentIntent.id });
    if (existingSale) {
      return;
    }

    // 3. Recupera Dados do Cliente
    let customerEmail: string | null | undefined = metadata.customerEmail;
    let customerName: string | null | undefined = metadata.customerName;
    let customerPhone: string | null | undefined = metadata.customerPhone;

    if (!customerEmail || !customerName) {
      if (paymentIntent.customer) {
        const customerId = typeof paymentIntent.customer === "string" ? paymentIntent.customer : paymentIntent.customer.id;
        try {
          const stripeCustomer = await stripe.customers.retrieve(customerId, {
            stripeAccount: owner.stripeAccountId,
          });
          if (!stripeCustomer.deleted) {
            customerEmail = customerEmail || stripeCustomer.email;
            customerName = customerName || stripeCustomer.name;
            customerPhone = customerPhone || stripeCustomer.phone;
          }
        } catch (err) {
          console.error(`Erro ao buscar cliente Stripe:`, err);
        }
      }
    }

    const clientIp = metadata.ip || "";
    const countryCode = clientIp ? getCountryFromIP(clientIp) : "BR";

    const finalCustomerName = customerName || "Cliente Não Identificado";
    const finalCustomerEmail = customerEmail || "email@nao.informado";

    // 4. Monta Lista de Itens
    const items: Array<{
      _id?: string;
      name: string;
      priceInCents: number;
      isOrderBump: boolean;
      compareAtPriceInCents?: number;
      customId?: string;
    }> = [];

    if (isUpsell) {
      items.push({
        _id: undefined,
        name: offer.upsell?.name || metadata.productName || "Upsell",
        priceInCents: paymentIntent.amount,
        isOrderBump: false,
        customId: offer.upsell?.customId,
      });
    } else {
      // Produto Principal
      items.push({
        _id: (offer.mainProduct as any)._id?.toString(),
        name: offer.mainProduct.name,
        priceInCents: offer.mainProduct.priceInCents,
        compareAtPriceInCents: offer.mainProduct.compareAtPriceInCents,
        isOrderBump: false,
        customId: (offer.mainProduct as any).customId,
      });

      // Order Bumps
      const selectedOrderBumps = metadata.selectedOrderBumps ? JSON.parse(metadata.selectedOrderBumps) : [];
      for (const bumpId of selectedOrderBumps) {
        const bump = offer.orderBumps.find((b: any) => b?._id?.toString() === bumpId);
        if (bump) {
          items.push({
            _id: bump._id?.toString(),
            name: bump.name,
            priceInCents: bump.priceInCents,
            compareAtPriceInCents: bump.compareAtPriceInCents,
            isOrderBump: true,
            customId: (bump as any).customId,
          });
        }
      }
    }

    // 5. Cria Tentativa no Banco com status "pending"
    const sale = await Sale.create({
      ownerId: offer.ownerId,
      offerId: offer._id,
      abTestId: metadata.abTestId || null,
      stripePaymentIntentId: paymentIntent.id,
      customerName: finalCustomerName,
      customerEmail: finalCustomerEmail,

      ip: clientIp,
      country: countryCode,

      totalAmountInCents: paymentIntent.amount,
      platformFeeInCents: 0, // Será atualizado se aprovado
      currency: offer.currency || "brl",
      status: "pending", // Tentativa iniciada
      isUpsell: isUpsell,
      items,

      // UTM Tracking
      utm_source: metadata.utm_source || "",
      utm_medium: metadata.utm_medium || "",
      utm_campaign: metadata.utm_campaign || "",
      utm_term: metadata.utm_term || "",
      utm_content: metadata.utm_content || "",
    });
  } catch (error: any) {
    console.error(`❌ Erro ao registrar tentativa de compra: ${error.message}`);
    // Não relança o erro para não bloquear o webhook
  }
};

/**
 * Handler para quando um pagamento FALHA
 * 1. Busca os dados da oferta usando o metadata
 * 2. Salva a tentativa de venda com status "failed" no banco
 * 3. Registra o motivo da falha para análise
 */
export const handlePaymentIntentFailed = async (paymentIntent: Stripe.PaymentIntent): Promise<void> => {
  try {
    const metadata = paymentIntent.metadata || {};
    const offerSlug = metadata.offerSlug || metadata.originalOfferSlug;
    const isUpsell = metadata.isUpsell === "true";

    if (!offerSlug) {
      console.error("❌ Metadata 'offerSlug' não encontrado no pagamento falhado.");
      return;
    }

    // 1. Busca Oferta e Dono PRIMEIRO (precisamos do stripeAccountId)
    const offer = await Offer.findOne({ slug: offerSlug }).populate("ownerId");
    if (!offer) {
      console.error(`❌ Oferta '${offerSlug}' não encontrada para pagamento falhado.`);
      return;
    }

    const owner = offer.ownerId as any;
    if (!owner.stripeAccountId) {
      console.error("❌ Vendedor sem conta Stripe conectada.");
      return;
    }

    // Expande o PaymentIntent para ter acesso aos detalhes do charge (incluindo wallet)
    try {
      const expandedPaymentIntent = await stripe.paymentIntents.retrieve(paymentIntent.id, {
        expand: ['latest_charge.payment_method_details'],
      }, {
        stripeAccount: owner.stripeAccountId,
      });
      paymentIntent = expandedPaymentIntent;
    } catch (expandError) {
      // Se falhar a expansão, continua com os dados básicos
      console.warn("⚠️ Não foi possível expandir PaymentIntent falhado:", expandError);
    }

    // 2. Recupera Dados do Cliente
    let customerEmail: string | null | undefined = metadata.customerEmail;
    let customerName: string | null | undefined = metadata.customerName;
    let customerPhone: string | null | undefined = metadata.customerPhone;

    if (!customerEmail || !customerName) {
      if (paymentIntent.customer) {
        const customerId = typeof paymentIntent.customer === "string" ? paymentIntent.customer : paymentIntent.customer.id;
        try {
          const stripeCustomer = await stripe.customers.retrieve(customerId, {
            stripeAccount: owner.stripeAccountId,
          });
          if (!stripeCustomer.deleted) {
            customerEmail = customerEmail || stripeCustomer.email;
            customerName = customerName || stripeCustomer.name;
            customerPhone = customerPhone || stripeCustomer.phone;
          }
        } catch (err) {
          console.error(`Erro ao buscar cliente Stripe:`, err);
        }
      }
    }

    const clientIp = metadata.ip || "";

    // Detecta o país - suporta latest_charge e charges
    let countryCode = "BR";
    const failedPiAny = paymentIntent as any;
    const failedCharge = failedPiAny.latest_charge || failedPiAny.charges?.data?.[0];
    if (failedCharge?.payment_method_details?.card?.country) {
      countryCode = failedCharge.payment_method_details.card.country;
    } else if (clientIp) {
      countryCode = getCountryFromIP(clientIp);
    }

    const finalCustomerName = customerName || "Cliente Não Identificado";
    const finalCustomerEmail = customerEmail || "email@nao.informado";

    // 3. Monta Lista de Itens
    const items: Array<{
      _id?: string;
      name: string;
      priceInCents: number;
      isOrderBump: boolean;
      compareAtPriceInCents?: number;
      customId?: string;
    }> = [];

    if (isUpsell) {
      items.push({
        _id: undefined,
        name: offer.upsell?.name || metadata.productName || "Upsell",
        priceInCents: paymentIntent.amount,
        isOrderBump: false,
        customId: offer.upsell?.customId,
      });
    } else {
      // Produto Principal
      items.push({
        _id: (offer.mainProduct as any)._id?.toString(),
        name: offer.mainProduct.name,
        priceInCents: offer.mainProduct.priceInCents,
        compareAtPriceInCents: offer.mainProduct.compareAtPriceInCents,
        isOrderBump: false,
        customId: (offer.mainProduct as any).customId,
      });

      // Order Bumps
      const selectedOrderBumps = metadata.selectedOrderBumps ? JSON.parse(metadata.selectedOrderBumps) : [];
      for (const bumpId of selectedOrderBumps) {
        const bump = offer.orderBumps.find((b: any) => b?._id?.toString() === bumpId);
        if (bump) {
          items.push({
            _id: bump._id?.toString(),
            name: bump.name,
            priceInCents: bump.priceInCents,
            compareAtPriceInCents: bump.compareAtPriceInCents,
            isOrderBump: true,
            customId: (bump as any).customId,
          });
        }
      }
    }

    // 4. Extrai informações do erro
    const lastPaymentError = paymentIntent.last_payment_error;
    const failureReason = lastPaymentError?.code || paymentIntent.cancellation_reason || "unknown";
    const failureMessage = lastPaymentError?.message || "Pagamento recusado";

    // 5. Idempotência (Evita duplicidade)
    const existingSale = await Sale.findOne({ stripePaymentIntentId: paymentIntent.id });
    if (existingSale) {
      // Se já existe, apenas atualiza o status se ainda não estava como failed
      if (existingSale.status !== "failed") {
        existingSale.status = "failed";
        existingSale.failureReason = failureReason;
        existingSale.failureMessage = failureMessage;
        await existingSale.save();
      }
      return;
    }

    // 6. Salva Tentativa de Venda no Banco com status "failed"
    const sale = await Sale.create({
      ownerId: offer.ownerId,
      offerId: offer._id,
      stripePaymentIntentId: paymentIntent.id,
      customerName: finalCustomerName,
      customerEmail: finalCustomerEmail,

      ip: clientIp,
      country: countryCode,

      totalAmountInCents: paymentIntent.amount,
      platformFeeInCents: 0, // Sem fee pois não foi aprovado
      currency: offer.currency || "brl",
      status: "failed",
      failureReason: failureReason,
      failureMessage: failureMessage,
      isUpsell: isUpsell,
      items,

      // UTM Tracking
      utm_source: metadata.utm_source || "",
      utm_medium: metadata.utm_medium || "",
      utm_campaign: metadata.utm_campaign || "",
      utm_term: metadata.utm_term || "",
      utm_content: metadata.utm_content || "",
    });
  } catch (error: any) {
    console.error(`❌ Erro ao processar pagamento falhado: ${error.message}`);
    // Não relança o erro para não fazer o Stripe retentar
  }
};

/**
 * Handler para quando um pagamento é aprovado
 * 1. Busca os dados da oferta usando o metadata
 * 2. Salva a venda no banco de dados
 * 3. Dispara notificação para API externa
 */
export const handlePaymentIntentSucceeded = async (paymentIntent: Stripe.PaymentIntent): Promise<void> => {
  const paymentIntentId = paymentIntent.id;

  try {
    const metadata = paymentIntent.metadata || {};
    const offerSlug = metadata.offerSlug || metadata.originalOfferSlug;
    const isUpsell = metadata.isUpsell === "true";


    if (!offerSlug) {
      console.error(`❌ [Stripe] Metadata 'offerSlug' não encontrado no PaymentIntent ${paymentIntentId}`);
      throw new Error("Metadata 'offerSlug' não encontrado.");
    }

    // 1. Busca Oferta e Dono PRIMEIRO (precisamos do stripeAccountId para expandir o PaymentIntent)
    const offer = await Offer.findOne({ slug: offerSlug }).populate("ownerId");
    if (!offer) {
      console.error(`❌ [Stripe] Oferta '${offerSlug}' não encontrada`);
      throw new Error(`Oferta '${offerSlug}' não encontrada.`);
    }

    const owner = offer.ownerId as any;
    if (!owner.stripeAccountId) {
      console.error(`❌ [Stripe] Vendedor ${owner._id} sem conta Stripe conectada`);
      throw new Error("Vendedor sem conta Stripe conectada.");
    }

    // Expande o PaymentIntent para ter acesso aos detalhes do charge (incluindo wallet)
    // IMPORTANTE: Usa stripeAccount porque o PaymentIntent foi criado na conta conectada
    try {
      const expandedPaymentIntent = await stripe.paymentIntents.retrieve(paymentIntent.id, {
        expand: ['latest_charge.payment_method_details'],
      }, {
        stripeAccount: owner.stripeAccountId,
      });
      paymentIntent = expandedPaymentIntent;
    } catch (expandError: any) {
      console.warn(`⚠️ [Stripe] Não foi possível expandir PaymentIntent: ${expandError.message}. Continuando com dados básicos.`);
    }

    // 2. Recupera Dados do Cliente (Fallback seguro para One-Click)
    let customerEmail: string | null | undefined = metadata.customerEmail;
    let customerName: string | null | undefined = metadata.customerName;
    let customerPhone: string | null | undefined = metadata.customerPhone;

    if (!customerEmail || !customerName) {
      if (paymentIntent.customer) {
        const customerId = typeof paymentIntent.customer === "string" ? paymentIntent.customer : paymentIntent.customer.id;
        try {
          const stripeCustomer = await stripe.customers.retrieve(customerId, {
            stripeAccount: owner.stripeAccountId,
          });
          if (!stripeCustomer.deleted) {
            customerEmail = customerEmail || stripeCustomer.email;
            customerName = customerName || stripeCustomer.name;
            customerPhone = customerPhone || stripeCustomer.phone;
          }
        } catch (err) {
          console.error(`Erro ao buscar cliente Stripe:`, err);
        }
      }
    }

    const clientIp = metadata.ip || "";

    // Detecta o país (prioridade: cartão > IP > fallback BR)
    let countryCode = "BR";
    const piAny = paymentIntent as any;

    // 1. Tenta pegar do cartão (mais preciso) - suporta latest_charge e charges
    const chargeForCountry = piAny.latest_charge || piAny.charges?.data?.[0];
    if (chargeForCountry?.payment_method_details?.card?.country) {
      countryCode = chargeForCountry.payment_method_details.card.country;
    } else if (clientIp) {
      // 2. Fallback: detecta pelo IP
      countryCode = getCountryFromIP(clientIp);
    }

    const finalCustomerName = customerName || "Cliente Não Identificado";
    const finalCustomerEmail = customerEmail || "email@nao.informado";

    // 3. Monta Lista de Itens (com Custom ID)
    const items: Array<{
      _id?: string;
      name: string;
      priceInCents: number;
      isOrderBump: boolean;
      compareAtPriceInCents?: number;
      customId?: string;
    }> = [];

    if (isUpsell) {
      items.push({
        _id: undefined,
        name: offer.upsell?.name || metadata.productName || "Upsell",
        priceInCents: paymentIntent.amount,
        isOrderBump: false,
        customId: offer.upsell?.customId,
      });
    } else {
      // Produto Principal
      items.push({
        _id: (offer.mainProduct as any)._id?.toString(),
        name: offer.mainProduct.name,
        priceInCents: offer.mainProduct.priceInCents,
        compareAtPriceInCents: offer.mainProduct.compareAtPriceInCents,
        isOrderBump: false,
        customId: (offer.mainProduct as any).customId,
      });

      // Order Bumps
      const selectedOrderBumps = metadata.selectedOrderBumps ? JSON.parse(metadata.selectedOrderBumps) : [];
      for (const bumpId of selectedOrderBumps) {
        const bump = offer.orderBumps.find((b: any) => b?._id?.toString() === bumpId);
        if (bump) {
          items.push({
            _id: bump._id?.toString(),
            name: bump.name,
            priceInCents: bump.priceInCents,
            compareAtPriceInCents: bump.compareAtPriceInCents,
            isOrderBump: true,
            customId: (bump as any).customId,
          });
        }
      }
    }

    // 4. Extrair detalhes do método de pagamento
    const { paymentMethodType, walletType } = extractPaymentMethodDetails(paymentIntent);

    // 5. Busca registro existente (criado por payment_intent.created)
    let sale = await Sale.findOne({ stripePaymentIntentId: paymentIntent.id });

    if (sale) {

      // Se já existe com status succeeded, não processa novamente
      if (sale.status === "succeeded") {
        return;
      }


      // Atualiza o registro existente (que estava pending)
      sale.status = "succeeded";
      sale.platformFeeInCents = paymentIntent.application_fee_amount || 0;
      sale.customerName = finalCustomerName;
      sale.customerEmail = finalCustomerEmail;
      sale.ip = clientIp;
      sale.country = countryCode;
      sale.items = items;
      sale.paymentMethodType = paymentMethodType;
      sale.walletType = walletType;

      // UTM Tracking
      sale.utm_source = metadata.utm_source || sale.utm_source || "";
      sale.utm_medium = metadata.utm_medium || sale.utm_medium || "";
      sale.utm_campaign = metadata.utm_campaign || sale.utm_campaign || "";
      sale.utm_term = metadata.utm_term || sale.utm_term || "";
      sale.utm_content = metadata.utm_content || sale.utm_content || "";

      // Facebook Purchase consolidado: configura envio agendado ou vincula ao parent
      if (isUpsell) {
        // Busca a UpsellSession para obter o originalSaleId
        const originalSessionToken = metadata.originalSessionToken;
        if (originalSessionToken) {
          const upsellSession = await UpsellSession.findOne({ token: originalSessionToken });
          if (upsellSession?.originalSaleId) {
            sale.parentSaleId = upsellSession.originalSaleId;
          }
        }
      } else {
        // Venda principal: agenda envio do Facebook Purchase para daqui a 10 minutos
        sale.facebookPurchaseSendAfter = new Date(Date.now() + 10 * 60 * 1000);
      }

      await sale.save();
    } else {

      // 6. Cria nova venda se não existir (fallback para compatibilidade)
      // Resolve parentSaleId para upsells e facebookPurchaseSendAfter para vendas normais
      let parentSaleId = null;
      let facebookPurchaseSendAfter = null;

      if (isUpsell) {
        const originalSessionToken = metadata.originalSessionToken;
        if (originalSessionToken) {
          const upsellSession = await UpsellSession.findOne({ token: originalSessionToken });
          if (upsellSession?.originalSaleId) {
            parentSaleId = upsellSession.originalSaleId;
          }
        }
      } else {
        facebookPurchaseSendAfter = new Date(Date.now() + 10 * 60 * 1000);
      }

      sale = await Sale.create({
        ownerId: offer.ownerId,
        offerId: offer._id,
        abTestId: metadata.abTestId || null, // A/B test tracking
        stripePaymentIntentId: paymentIntent.id,
        customerName: finalCustomerName,
        customerEmail: finalCustomerEmail,

        ip: clientIp,
        country: countryCode,

        totalAmountInCents: paymentIntent.amount,
        platformFeeInCents: paymentIntent.application_fee_amount || 0,
        currency: offer.currency || "brl",
        status: "succeeded",
        isUpsell: isUpsell,
        parentSaleId,
        facebookPurchaseSendAfter,
        items,
        paymentMethodType,
        walletType,

        // UTM Tracking
        utm_source: metadata.utm_source || "",
        utm_medium: metadata.utm_medium || "",
        utm_campaign: metadata.utm_campaign || "",
        utm_term: metadata.utm_term || "",
        utm_content: metadata.utm_content || "",
      });

    }

    // =================================================================
    // 6. Integrações Externas
    // =================================================================


    // Marca tentativa de integração
    sale.integrationsLastAttempt = new Date();

    // A: Facebook CAPI (Purchase) - NÃO envia imediatamente
    // O evento Purchase será enviado consolidado pelo job (facebook-purchase.job.ts)
    // após a janela de 10 minutos, agrupando valor do produto principal + order bumps + upsell

    // B: Webhook de Área de Membros (Husky/MemberKit)
    try {
      await sendAccessWebhook(offer as any, sale, items, customerPhone || "");
      sale.integrationsHuskySent = true;
    } catch (huskyError: any) {
      console.error(`⚠️ [Stripe] Erro ao enviar webhook Husky (Venda salva normalmente):`, huskyError.message);
      console.error(`⚠️ [Stripe] Stack trace Husky:`, huskyError.stack);
      sale.integrationsHuskySent = false;
    }

    // C: Webhook de Rastreamento (UTMfy)
    try {
      await processUtmfyIntegration(offer as any, sale, items, paymentIntent, metadata);
      sale.integrationsUtmfySent = true;
    } catch (utmfyError: any) {
      console.error(`⚠️ [Stripe] Erro ao enviar webhook UTMfy (Venda salva normalmente):`, utmfyError.message);
      console.error(`⚠️ [Stripe] Stack trace UTMfy:`, utmfyError.stack);
      sale.integrationsUtmfySent = false;
    }

    // Salva as flags de integração
    await sale.save();

  } catch (error: any) {
    console.error(`❌ [Stripe] ERRO CRÍTICO ao processar payment_intent.succeeded ${paymentIntentId}:`);
    console.error(`❌ [Stripe] Mensagem: ${error.message}`);
    console.error(`❌ [Stripe] Stack trace:`, error.stack);

    // Aqui relançamos o erro APENAS se for falha crítica de banco/stripe
    // Para que o Stripe tente enviar o webhook novamente.
    throw error;
  }
};

/**
 * Handler para quando um pagamento é REEMBOLSADO
 * 1. Busca a venda pelo stripePaymentIntentId (obtido do charge.payment_intent)
 * 2. Atualiza o status da venda para "refunded" no banco de dados
 */
export const handleChargeRefunded = async (charge: Stripe.Charge): Promise<void> => {
  try {
    const paymentIntentId = typeof charge.payment_intent === "string" 
      ? charge.payment_intent 
      : charge.payment_intent?.id;

    if (!paymentIntentId) {
      console.error("❌ [Refund] PaymentIntent ID não encontrado no charge.");
      return;
    }

    // Busca a venda correspondente ao PaymentIntent
    const sale = await Sale.findOne({ stripePaymentIntentId: paymentIntentId });

    if (!sale) {
      return;
    }

    if (sale.status === "refunded") {
      return;
    }

    // Atualiza o status
    sale.status = "refunded";
    await sale.save();
  } catch (error: any) {
    console.error(`❌ [Refund] Erro ao processar reembolso: ${error.message}`);
  }
};
