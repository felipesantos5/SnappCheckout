// src/webhooks/stripe/handlers/payment-intent.handler.ts
import { Stripe } from "stripe";
import Sale from "../../../models/sale.model";
import Offer from "../../../models/offer.model";
import { processUtmfyIntegration, sendPurchaseToUTMfyWebhook } from "../../../services/utmfy.service";
import stripe from "../../../lib/stripe";
import { sendAccessWebhook } from "../../../services/integration.service";
import { createFacebookUserData, sendFacebookEvent } from "../../../services/facebook.service";
import { getCountryFromIP } from "../../../helper/getCountryFromIP";

/**
 * Handler para quando um pagamento é aprovado
 * 1. Busca os dados da oferta usando o metadata
 * 2. Salva a venda no banco de dados
 * 3. Dispara notificação para API externa
 */
export const handlePaymentIntentSucceeded = async (paymentIntent: Stripe.PaymentIntent): Promise<void> => {
  try {
    const metadata = paymentIntent.metadata || {};
    const offerSlug = metadata.offerSlug || metadata.originalOfferSlug;
    const isUpsell = metadata.isUpsell === "true";

    if (!offerSlug) throw new Error("Metadata 'offerSlug' não encontrado.");

    // 1. Busca Oferta e Dono
    // Precisamos dos campos do Facebook também
    const offer = await Offer.findOne({ slug: offerSlug }).populate("ownerId");
    if (!offer) throw new Error(`Oferta '${offerSlug}' não encontrada.`);

    const owner = offer.ownerId as any;
    if (!owner.stripeAccountId) throw new Error("Vendedor sem conta Stripe conectada.");

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
    const intentWithCharges = paymentIntent as any;

    // 1. Tenta pegar do cartão (mais preciso)
    if (intentWithCharges.charges?.data?.[0]?.payment_method_details?.card?.country) {
      countryCode = intentWithCharges.charges.data[0].payment_method_details.card.country;
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

    // 4. Idempotência (Evita duplicidade)
    const existingSale = await Sale.findOne({ stripePaymentIntentId: paymentIntent.id });
    if (existingSale) return;

    // 5. Salva Venda no Banco
    const sale = await Sale.create({
      ownerId: offer.ownerId,
      offerId: offer._id,
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
      items,
    });

    console.log(`✅ Venda ${sale._id} salva com sucesso.`);

    // =================================================================
    // 6. Integrações Externas
    // =================================================================

    // A: FACEBOOK CAPI (PURCHASE) - BLINDADO COM TRY/CATCH
    // Se der erro aqui, NÃO trava o resto do código
    try {
      // Coletar todos os pixels (novo array + campos antigos para retrocompatibilidade)
      const pixels: Array<{ pixelId: string; accessToken: string }> = [];

      // Adiciona pixels do novo array
      if (offer.facebookPixels && offer.facebookPixels.length > 0) {
        pixels.push(...offer.facebookPixels);
      }

      // Adiciona pixel antigo se existir e não estiver no array novo (retrocompatibilidade)
      if (offer.facebookPixelId && offer.facebookAccessToken) {
        const alreadyExists = pixels.some(p => p.pixelId === offer.facebookPixelId);
        if (!alreadyExists) {
          pixels.push({
            pixelId: offer.facebookPixelId,
            accessToken: offer.facebookAccessToken,
          });
        }
      }

      if (pixels.length > 0) {
        const totalValue = paymentIntent.amount / 100; // Stripe usa centavos

        // Dados do Metadata (vindos do frontend)
        const userAgent = metadata.userAgent || "";
        const fbc = metadata.fbc;
        const fbp = metadata.fbp;

        // Dados de endereço (quando disponíveis)
        const city = metadata.addressCity;
        const state = metadata.addressState;
        const zipCode = metadata.addressZipCode;
        const country = metadata.addressCountry;

        // Cria user_data com TODOS os dados disponíveis
        const userData = createFacebookUserData(
          clientIp,
          userAgent,
          finalCustomerEmail,
          customerPhone || metadata.customerPhone,
          finalCustomerName,
          fbc,
          fbp,
          city,
          state,
          zipCode,
          country
        );

        console.log(`🔵 Enviando evento Facebook Purchase para ${pixels.length} pixel(s) com dados completos:`, {
          hasEmail: !!userData.em,
          hasPhone: !!userData.ph,
          hasName: !!(userData.fn && userData.ln),
          hasFbc: !!userData.fbc,
          hasFbp: !!userData.fbp,
          hasCity: !!userData.ct,
          hasState: !!userData.st,
          hasZipCode: !!userData.zp,
          hasCountry: !!userData.country,
          hasEventId: !!metadata.purchaseEventId,
          eventId: metadata.purchaseEventId,
        });

        const eventData = {
          event_name: "Purchase" as const,
          event_time: Math.floor(Date.now() / 1000),
          event_id: metadata.purchaseEventId, // event_id do frontend para deduplicação
          action_source: "website" as const,
          user_data: userData,
          custom_data: {
            currency: offer.currency || "BRL",
            value: totalValue,
            order_id: String(sale._id), // ID único para deduplicação
            content_ids: items.map((i) => i._id || i.customId || "unknown"),
            content_type: "product",
          },
        };

        // Envia evento Purchase para todos os pixels em paralelo
        await Promise.all(
          pixels.map(pixel => sendFacebookEvent(pixel.pixelId, pixel.accessToken, eventData))
        );
      }
    } catch (fbError: any) {
      console.error("⚠️ Falha no envio ao Facebook (Venda salva normalmente):", fbError.message);
    }

    // B: Webhook de Área de Membros (Husky/MemberKit)
    await sendAccessWebhook(offer as any, sale, items, customerPhone || "");

    // C: Webhook de Rastreamento (UTMfy)
    await processUtmfyIntegration(offer as any, sale, items, paymentIntent, metadata);
  } catch (error: any) {
    console.error(`❌ Erro ao processar venda: ${error.message}`);
    // Aqui relançamos o erro APENAS se for falha crítica de banco/stripe
    // Para que o Stripe tente enviar o webhook novamente.
    throw error;
  }
};
