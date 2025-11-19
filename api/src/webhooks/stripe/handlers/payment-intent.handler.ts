// src/webhooks/stripe/handlers/payment-intent.handler.ts
import { Stripe } from "stripe";
import Sale from "../../../models/sale.model";
import Offer from "../../../models/offer.model";
import { sendPurchaseToUTMfyWebhook } from "../../../services/utmfy.service";
import stripe from "../../../lib/stripe";

/**
 * Handler para quando um pagamento é aprovado
 * 1. Busca os dados da oferta usando o metadata
 * 2. Salva a venda no banco de dados
 * 3. Dispara notificação para API externa
 */
export const handlePaymentIntentSucceeded = async (paymentIntent: Stripe.PaymentIntent): Promise<void> => {
  try {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`💰 NOVA VENDA RECEBIDA!`);
    console.log(`${"=".repeat(80)}`);
    console.log(`🆔 Payment Intent ID: ${paymentIntent.id}`);

    // 1. Extrai dados básicos do metadata
    const metadata = paymentIntent.metadata || {};
    const offerSlug = metadata.offerSlug || metadata.originalOfferSlug;
    const isUpsell = metadata.isUpsell === "true";

    if (!offerSlug) {
      throw new Error("Metadata 'offerSlug' não encontrado.");
    }

    // 2. Busca a OFERTA e o DONO primeiro (Necessário para saber qual conta Stripe consultar)
    console.log(`\n🔍 BUSCANDO OFERTA: ${offerSlug}`);
    const offer = await Offer.findOne({ slug: offerSlug }).populate("ownerId");

    if (!offer) {
      throw new Error(`Oferta com slug '${offerSlug}' não encontrada`);
    }

    const owner = offer.ownerId as any;
    const stripeAccountId = owner.stripeAccountId; // <--- O ID da conta conectada

    if (!stripeAccountId) {
      throw new Error("Vendedor não possui conta Stripe conectada.");
    }

    // 3. Recuperação Robusta de Dados do Cliente (AGORA NO LUGAR CERTO)
    let customerEmail: string | null | undefined = metadata.customerEmail;
    let customerName: string | null | undefined = metadata.customerName;
    let customerPhone: string | null | undefined = metadata.customerPhone;

    // Se faltar nome ou email (comum no Upsell One-Click), busca na conta do vendedor
    if (!customerEmail || !customerName) {
      console.log("⚠️ Dados do cliente incompletos. Buscando na conta conectada do Stripe...");

      if (paymentIntent.customer) {
        const customerId = typeof paymentIntent.customer === "string" ? paymentIntent.customer : paymentIntent.customer.id;

        try {
          // CORREÇÃO PRINCIPAL AQUI: Adicionado { stripeAccount }
          const stripeCustomer = await stripe.customers.retrieve(customerId, {
            stripeAccount: stripeAccountId,
          });

          if (!stripeCustomer.deleted) {
            customerEmail = customerEmail || stripeCustomer.email;
            customerName = customerName || stripeCustomer.name;
            customerPhone = customerPhone || stripeCustomer.phone;
            console.log("✅ Dados do cliente recuperados do Stripe Connect.");
          }
        } catch (err: any) {
          console.error(`❌ Falha ao buscar cliente ${customerId} na conta ${stripeAccountId}:`, err.message);
        }
      }
    }

    // Fallbacks finais
    const finalCustomerName = customerName || "Cliente Não Identificado";
    const finalCustomerEmail = customerEmail || "email@nao.informado";

    // 4. Monta os itens da venda (Lógica Upsell vs Normal)
    const items: Array<{ _id?: string; name: string; priceInCents: number; isOrderBump: boolean; compareAtPriceInCents?: number }> = [];

    if (isUpsell) {
      console.log(`   ℹ️ Tipo de Venda: UPSELL (One Click)`);
      items.push({
        _id: undefined,
        name: offer.upsell?.name || metadata.productName || "Produto Upsell",
        priceInCents: paymentIntent.amount,
        compareAtPriceInCents: undefined,
        isOrderBump: false,
      });
    } else {
      console.log(`   ℹ️ Tipo de Venda: CHECKOUT PADRÃO`);
      items.push({
        _id: (offer.mainProduct as any)._id?.toString() || undefined,
        name: offer.mainProduct.name,
        priceInCents: offer.mainProduct.priceInCents,
        compareAtPriceInCents: offer.mainProduct.compareAtPriceInCents,
        isOrderBump: false,
      });

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
          });
        }
      }
    }

    // 5. Verifica duplicidade
    const existingSale = await Sale.findOne({ stripePaymentIntentId: paymentIntent.id });
    if (existingSale) {
      console.log(`⚠️ Venda já processada: ${existingSale._id}`);
      return;
    }

    // 6. Salva no Banco
    console.log(`\n💾 SALVANDO NO BANCO DE DADOS...`);
    const platformFeeInCents = paymentIntent.application_fee_amount || 0;

    const sale = await Sale.create({
      ownerId: offer.ownerId,
      offerId: offer._id,
      stripePaymentIntentId: paymentIntent.id,
      customerName: finalCustomerName, // Usa as variáveis finais tratadas
      customerEmail: finalCustomerEmail,
      totalAmountInCents: paymentIntent.amount,
      platformFeeInCents,
      status: "succeeded",
      items,
    });

    console.log(`✅ Venda salva: ${sale._id} | Cliente: ${finalCustomerName}`);

    // 7. Envia Webhook Externo (UTMfy)
    if (offer.utmfyWebhookUrl && offer.utmfyWebhookUrl.startsWith("http")) {
      // ... (Mantenha a lógica de envio para UTMfy igual à anterior, usando finalCustomerName/Email)
      // Vou resumir aqui para não ficar gigante, mas mantenha o bloco do UTMfy
      // Certifique-se de usar 'sale.customerName' ou 'finalCustomerName' no payload

      // Recalcula total original...
      let originalTotalInCents = 0;
      const quantity = parseInt(metadata.quantity || "1", 10);
      items.forEach((item) => {
        const price = item.compareAtPriceInCents && item.compareAtPriceInCents > item.priceInCents ? item.compareAtPriceInCents : item.priceInCents;
        if (item.isOrderBump) originalTotalInCents += price;
        else originalTotalInCents += price * (isUpsell ? 1 : quantity);
      });

      const utmfyProducts = items.map((i) => ({
        Id: i._id?.toString() || (offer._id as any).toString(),
        Name: i.name,
      }));

      await sendPurchaseToUTMfyWebhook(offer.utmfyWebhookUrl, {
        Id: crypto.randomUUID(),
        IsTest: !paymentIntent.livemode,
        Event: "Purchase_Order_Confirmed",
        CreatedAt: new Date().toISOString(),
        Data: {
          Products: utmfyProducts,
          Buyer: {
            Id: paymentIntent.customer?.toString() || crypto.randomUUID(),
            Email: sale.customerEmail,
            Name: sale.customerName,
            PhoneNumber: customerPhone || null,
          },
          Seller: { Id: (owner._id as any).toString(), Email: owner.email },
          Commissions: [
            { Value: sale.platformFeeInCents / 100, Source: "MARKETPLACE" },
            { Value: (sale.totalAmountInCents - sale.platformFeeInCents) / 100, Source: "PRODUCER" },
          ],
          Purchase: {
            PaymentId: crypto.randomUUID(),
            Recurrency: 1,
            PaymentDate: new Date(paymentIntent.created * 1000).toISOString(),
            OriginalPrice: { Value: originalTotalInCents / 100 },
            Price: { Value: sale.totalAmountInCents / 100 },
            Payment: { NumberOfInstallments: 1, PaymentMethod: "credit_card", InterestRateAmount: 0 },
          },
          Offer: {
            Id: (offer._id as any).toString(),
            Name: offer.name,
            Url: `${process.env.FRONTEND_URL || "https://checkout.abatools.pro"}/p/${offer.slug}`,
          },
          Utm: {
            UtmSource: metadata.utm_source || null,
            UtmMedium: metadata.utm_medium || null,
            UtmCampaign: metadata.utm_campaign || null,
            UtmTerm: metadata.utm_term || null,
            UtmContent: metadata.utm_content || null,
          },
          DeviceInfo: { UserAgent: metadata.userAgent || null, ip: metadata.ip || null },
        },
      });
    }

    console.log(`🎉 PROCESSAMENTO CONCLUÍDO!\n`);
  } catch (error: any) {
    console.error(`❌ ERRO: ${error.message}`);
    throw error;
  }
};
