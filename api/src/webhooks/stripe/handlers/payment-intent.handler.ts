// src/webhooks/stripe/handlers/payment-intent.handler.ts
import { Stripe } from "stripe";
import Sale from "../../../models/sale.model";
import Offer from "../../../models/offer.model";
import { processUtmfyIntegration, sendPurchaseToUTMfyWebhook } from "../../../services/utmfy.service";
import stripe from "../../../lib/stripe";
import { sendAccessWebhook } from "../../../services/integration.service";
import { createFacebookUserData, sendFacebookEvent } from "../../../services/facebook.service";

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

    // Tenta pegar o país do cartão
    let countryCode = "BR";
    const intentWithCharges = paymentIntent as any;

    if (intentWithCharges.charges?.data?.[0]?.payment_method_details?.card?.country) {
      countryCode = intentWithCharges.charges.data[0].payment_method_details.card.country;
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
      if (offer.facebookPixelId && offer.facebookAccessToken) {
        const totalValue = paymentIntent.amount / 100; // Stripe usa centavos

        // Dados do Metadata (vindos do frontend)
        const userAgent = metadata.userAgent || "";
        const fbc = metadata.fbc;
        const fbp = metadata.fbp;

        const userData = createFacebookUserData(clientIp, userAgent, finalCustomerEmail, metadata.customerPhone, finalCustomerName, fbc, fbp);

        // Envia sem await bloqueante se preferir, ou com await protegido
        await sendFacebookEvent(offer.facebookPixelId, offer.facebookAccessToken, {
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          action_source: "website",
          user_data: userData,
          custom_data: {
            currency: offer.currency || "BRL",
            value: totalValue,
            order_id: String(sale._id), // ID único para deduplicação
            content_ids: items.map((i) => i._id || i.customId || "unknown"),
            content_type: "product",
          },
        });
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
