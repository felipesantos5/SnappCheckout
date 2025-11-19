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
    console.log(`💵 Valor Total: R$ ${(paymentIntent.amount / 100).toFixed(2)}`);
    console.log(`📅 Data/Hora: ${new Date().toLocaleString("pt-BR")}`);

    // 1. Extrai metadados
    const metadata = paymentIntent.metadata || {};
    console.log(`\n📋 METADADOS RECEBIDOS:`);
    console.log(JSON.stringify(metadata, null, 2));

    // --- CORREÇÃO 1: Suporte a Upsell e Fallback de Slug ---
    // O Upsell pode mandar 'offerSlug' ou 'originalOfferSlug' dependendo da implementação
    const offerSlug = metadata.offerSlug || metadata.originalOfferSlug;
    const isUpsell = metadata.isUpsell === "true";

    if (!offerSlug) {
      throw new Error("Metadata 'offerSlug' (ou originalOfferSlug) não encontrado no PaymentIntent");
    }

    // --- CORREÇÃO 2: Recuperação Robusta de Dados do Cliente ---
    // Se for Upsell One-Click, o metadata pode não ter nome/email. Buscamos no Stripe.
    let customerEmail: string | null | undefined = metadata.customerEmail;
    let customerName: string | null | undefined = metadata.customerName;
    let customerPhone: string | null | undefined = metadata.customerPhone;

    if (!customerEmail || !customerName) {
      console.log("⚠️ Dados do cliente ausentes no metadata. Buscando no Stripe...");
      if (paymentIntent.customer) {
        const customerId = typeof paymentIntent.customer === "string" ? paymentIntent.customer : paymentIntent.customer.id;

        try {
          const stripeCustomer = await stripe.customers.retrieve(customerId);
          if (!stripeCustomer.deleted) {
            customerEmail = customerEmail || stripeCustomer.email;
            customerName = customerName || stripeCustomer.name;
            customerPhone = customerPhone || stripeCustomer.phone;
          }
        } catch (err) {
          console.error("Erro ao buscar cliente no Stripe:", err);
        }
      }
    }

    // Fallbacks finais para evitar erro de validação do Mongoose
    customerName = customerName || "Cliente Não Identificado";
    customerEmail = customerEmail || "email@nao.informado";

    console.log(`\n🔍 BUSCANDO OFERTA: ${offerSlug}`);

    // 2. Busca a oferta completa
    const offer = await Offer.findOne({ slug: offerSlug }).populate("ownerId");
    if (!offer) {
      throw new Error(`Oferta com slug '${offerSlug}' não encontrada`);
    }

    // Extrai informações do vendedor
    const owner = offer.ownerId as any;

    // 3. Monta a lista de itens comprados
    console.log(`\n📦 ITENS DA COMPRA:`);
    const items: Array<{ _id?: string; name: string; priceInCents: number; isOrderBump: boolean; compareAtPriceInCents?: number }> = [];

    // --- CORREÇÃO 3: Lógica diferente para Upsell vs Venda Normal ---
    if (isUpsell) {
      // SE FOR UPSELL: O item é o produto de upsell configurado na oferta
      console.log(`   ℹ️ Tipo de Venda: UPSELL (One Click)`);

      items.push({
        // Tenta pegar ID se existir, senão undefined
        _id: undefined,
        name: offer.upsell?.name || metadata.productName || "Produto Upsell",
        priceInCents: paymentIntent.amount, // O valor pago é o valor do item
        compareAtPriceInCents: undefined,
        isOrderBump: false, // Para fins de relatório, é o item principal DESTA transação
      });

      console.log(`   ✓ Produto Upsell: ${items[0].name} - R$ ${(items[0].priceInCents / 100).toFixed(2)}`);
    } else {
      // SE FOR VENDA NORMAL (Checkout padrão)
      console.log(`   ℹ️ Tipo de Venda: CHECKOUT PADRÃO`);

      items.push({
        _id: (offer.mainProduct as any)._id?.toString() || undefined,
        name: offer.mainProduct.name,
        priceInCents: offer.mainProduct.priceInCents,
        compareAtPriceInCents: offer.mainProduct.compareAtPriceInCents,
        isOrderBump: false,
      });
      console.log(`   ✓ Produto Principal: ${offer.mainProduct.name} - R$ ${(offer.mainProduct.priceInCents / 100).toFixed(2)}`);

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
          console.log(`   ✓ Order Bump: ${bump.name} - R$ ${(bump.priceInCents / 100).toFixed(2)}`);
        }
      }
    }

    // 4. Verifica se a venda já foi registrada (idempotência)
    const existingSale = await Sale.findOne({ stripePaymentIntentId: paymentIntent.id });
    if (existingSale) {
      console.log(`\n⚠️  VENDA DUPLICADA DETECTADA!`);
      return;
    }

    // 5. Calcula a taxa da plataforma
    const platformFeeInCents = paymentIntent.application_fee_amount || 0;

    // 6. Cria o registro da venda no banco
    console.log(`\n💾 SALVANDO NO BANCO DE DADOS...`);
    const sale = await Sale.create({
      ownerId: offer.ownerId,
      offerId: offer._id,
      stripePaymentIntentId: paymentIntent.id,
      customerName, // Agora garantido que não é null
      customerEmail,
      totalAmountInCents: paymentIntent.amount,
      platformFeeInCents,
      status: "succeeded",
      items,
    });

    console.log(`✅ Venda salva com sucesso! ID: ${sale._id}`);

    // 7. Dispara para API externa (UTMfy)
    console.log(`\n📡 ENVIANDO PARA API EXTERNA...`);
    if (offer.utmfyWebhookUrl && offer.utmfyWebhookUrl.startsWith("http")) {
      const quantity = parseInt(metadata.quantity || "1", 10);

      // Mapeia os produtos
      const utmfyProducts = items.map((item) => {
        let id = item._id ? item._id.toString() : crypto.randomUUID();
        // Fallback para produto principal sem _id
        if (!item.isOrderBump && !item._id) {
          id = (offer._id as any)?.toString() || crypto.randomUUID();
        }
        return { Id: id, Name: item.name };
      });

      let originalTotalInCents = 0;

      // Cálculo correto do preço original para enviar ao webhook
      // Se for Upsell, o item principal é o Upsell
      items.forEach((item) => {
        const price = item.compareAtPriceInCents && item.compareAtPriceInCents > item.priceInCents ? item.compareAtPriceInCents : item.priceInCents;

        // Se for order bump, soma 1x. Se for principal, multiplica pela qtd (se não for upsell)
        if (item.isOrderBump) {
          originalTotalInCents += price;
        } else {
          // Upsell geralmente é qtd 1, checkout normal pode ter qtd > 1
          originalTotalInCents += price * (isUpsell ? 1 : quantity);
        }
      });

      // Constrói o payload
      const utmfyPayload = {
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
          Seller: {
            Id: (owner._id as any).toString(),
            Email: owner.email,
          },
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
            Payment: {
              NumberOfInstallments: 1,
              PaymentMethod: "credit_card",
              InterestRateAmount: 0,
            },
          },
          Offer: {
            Id: (offer._id as any)?.toString() || crypto.randomUUID(),
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
          DeviceInfo: {
            UserAgent: metadata.userAgent || null,
            ip: metadata.ip || null,
          },
        },
      };

      await sendPurchaseToUTMfyWebhook(offer.utmfyWebhookUrl, utmfyPayload);
    }

    console.log(`\n${"=".repeat(80)}`);
    console.log(`🎉 VENDA PROCESSADA COM SUCESSO!`);
    console.log(`${"=".repeat(80)}\n`);
  } catch (error: any) {
    console.error(`\n${"=".repeat(80)}`);
    console.error(`❌ ERRO AO PROCESSAR VENDA!`);
    console.error(`${"=".repeat(80)}`);
    console.error(`Erro: ${error.message}`);
    // console.error(`Stack: ${error.stack}`); // Opcional para limpar log
    console.error(`${"=".repeat(80)}\n`);
    throw error;
  }
};
