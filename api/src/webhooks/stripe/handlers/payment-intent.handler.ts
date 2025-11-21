// src/webhooks/stripe/handlers/payment-intent.handler.ts
import { Stripe } from "stripe";
import Sale from "../../../models/sale.model";
import Offer from "../../../models/offer.model";
import { processUtmfyIntegration, sendPurchaseToUTMfyWebhook } from "../../../services/utmfy.service";
import stripe from "../../../lib/stripe";
import { sendAccessWebhook } from "../../../services/integration.service";

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

    // Tenta pegar o país do cartão (mais preciso para bandeira)
    let countryCode = "BR";

    // CORREÇÃO AQUI: Usamos (paymentIntent as any) para acessar 'charges' sem erro de TS
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
      status: "succeeded",
      isUpsell: isUpsell,
      items,
    });

    console.log(`✅ Venda ${sale._id} salva com sucesso.`);

    // 6. Integrações Externas
    // A: Webhook de Área de Membros (Husky/MemberKit) - Usa customId
    await sendAccessWebhook(offer as any, sale, items, customerPhone || "");

    // B: Webhook de Rastreamento (UTMfy) - Usa lógica refatorada no Service
    await processUtmfyIntegration(offer as any, sale, items, paymentIntent, metadata);
  } catch (error: any) {
    console.error(`❌ Erro ao processar venda: ${error.message}`);
    throw error; // Relança para o Stripe tentar novamente
  }
};
