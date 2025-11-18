// src/webhooks/stripe/handlers/payment-intent.handler.ts
import { Stripe } from "stripe";
import Sale from "../../../models/sale.model";
import Offer from "../../../models/offer.model";
import { sendPurchaseToUTMfyWebhook } from "../../../services/utmfy.service";

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
    const metadata = paymentIntent.metadata;
    console.log(`\n📋 METADADOS RECEBIDOS:`);
    console.log(JSON.stringify(metadata, null, 2));

    const offerSlug = metadata.offerSlug;
    const customerEmail = metadata.customerEmail;
    const customerName = metadata.customerName;
    const selectedOrderBumps = metadata.selectedOrderBumps ? JSON.parse(metadata.selectedOrderBumps) : [];
    const customerPhone = metadata.customerPhone;
    const quantity = parseInt(metadata.quantity || "1", 10);
    // const customerDocument = metadata.customerDocument;

    if (!offerSlug) {
      throw new Error("Metadata 'offerSlug' não encontrado no PaymentIntent");
    }

    console.log(`\n🔍 BUSCANDO OFERTA: ${offerSlug}`);

    // 2. Busca a oferta completa
    const offer = await Offer.findOne({ slug: offerSlug }).populate("ownerId");
    if (!offer) {
      throw new Error(`Oferta com slug '${offerSlug}' não encontrada`);
    }

    // Extrai informações do vendedor
    const owner = offer.ownerId as any;
    console.log(`\n👤 VENDEDOR IDENTIFICADO:`);
    console.log(`   Nome: ${owner.name}`);
    console.log(`   Email: ${owner.email}`);
    console.log(`   ID: ${owner._id}`);
    console.log(`   Stripe Account: ${owner.stripeAccountId || "N/A"}`);

    console.log(`\n🛒 OFERTA:`);
    console.log(`   Nome: ${offer.name}`);
    console.log(`   Slug: ${offer.slug}`);
    console.log(`   ID: ${offer._id}`);

    // 3. Monta a lista de itens comprados
    console.log(`\n📦 ITENS DA COMPRA:`);
    const items: Array<{ _id?: string; name: string; priceInCents: number; isOrderBump: boolean; compareAtPriceInCents?: number }> = [
      {
        _id: (offer.mainProduct as any)._id?.toString() || undefined,
        name: offer.mainProduct.name,
        priceInCents: offer.mainProduct.priceInCents,
        compareAtPriceInCents: offer.mainProduct.compareAtPriceInCents,
        isOrderBump: false,
      },
    ];
    console.log(`   ✓ Produto Principal: ${offer.mainProduct.name} - R$ ${(offer.mainProduct.priceInCents / 100).toFixed(2)}`);

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

    // 4. Verifica se a venda já foi registrada (idempotência)
    const existingSale = await Sale.findOne({ stripePaymentIntentId: paymentIntent.id });
    if (existingSale) {
      console.log(`\n⚠️  VENDA DUPLICADA DETECTADA!`);
      console.log(`   Esta venda já foi processada anteriormente.`);
      console.log(`   ID da venda existente: ${existingSale._id}`);
      console.log(`${"=".repeat(80)}\n`);
      return;
    }

    // 5. Calcula a taxa da plataforma (já vem do application_fee_amount)
    const platformFeeInCents = paymentIntent.application_fee_amount || 0;

    console.log(`\n💰 VALORES:`);
    console.log(`   Total da venda: R$ ${(paymentIntent.amount / 100).toFixed(2)}`);
    console.log(`   Taxa da plataforma (5%): R$ ${(platformFeeInCents / 100).toFixed(2)}`);
    console.log(`   Valor do vendedor: R$ ${((paymentIntent.amount - platformFeeInCents) / 100).toFixed(2)}`);

    // 6. Cria o registro da venda no banco
    console.log(`\n💾 SALVANDO NO BANCO DE DADOS...`);
    const sale = await Sale.create({
      ownerId: offer.ownerId,
      offerId: offer._id,
      stripePaymentIntentId: paymentIntent.id,
      customerName,
      customerEmail,
      totalAmountInCents: paymentIntent.amount,
      platformFeeInCents,
      status: "succeeded",
      items,
    });

    console.log(`✅ Venda salva com sucesso!`);
    console.log(`   ID da venda: ${sale._id}`);

    // 7. Dispara para API externa
    console.log(`\n📡 ENVIANDO PARA API EXTERNA...`);
    if (offer.utmfyWebhookUrl && offer.utmfyWebhookUrl.startsWith("http")) {
      console.log(`\n📤 ENVIANDO PARA WEBHOOK UTMFY (V2)...`);

      // Mapeia os produtos (usando a variável 'items' que já foi construída)
      const utmfyProducts = items.map((item) => {
        let id = item._id ? item._id.toString() : crypto.randomUUID();

        // Fallback para produto principal sem _id (caso raro)
        if (!item.isOrderBump && !item._id) {
          id = (offer._id as any)?.toString() || crypto.randomUUID();
        }

        return {
          Id: id,
          Name: item.name,
        };
      });

      let originalTotalInCents = 0;

      // 1. Pega o item principal (que é afetado pela quantidade)
      const mainItem = items.find((item) => !item.isOrderBump);
      if (mainItem) {
        const mainItemOriginalPrice =
          mainItem.compareAtPriceInCents && mainItem.compareAtPriceInCents > mainItem.priceInCents
            ? mainItem.compareAtPriceInCents
            : mainItem.priceInCents;
        originalTotalInCents += mainItemOriginalPrice * quantity;
      }

      // 2. Adiciona os bumps (não afetados pela quantidade)
      items
        .filter((item) => item.isOrderBump)
        .forEach((bump) => {
          const bumpOriginalPrice =
            bump.compareAtPriceInCents && bump.compareAtPriceInCents > bump.priceInCents ? bump.compareAtPriceInCents : bump.priceInCents;
          originalTotalInCents += bumpOriginalPrice;
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
            // Document: customerDocument || null,
          },
          Seller: {
            Id: (owner._id as any).toString(),
            Email: owner.email,
          },
          Commissions: [
            {
              Value: sale.platformFeeInCents / 100,
              Source: "MARKETPLACE",
            },
            {
              Value: (sale.totalAmountInCents - sale.platformFeeInCents) / 100,
              Source: "PRODUCER",
            },
          ],
          Purchase: {
            PaymentId: sale.stripePaymentIntentId,
            Recurrency: 1,
            PaymentDate: new Date(paymentIntent.created * 1000).toISOString(),
            OriginalPrice: {
              Value: originalTotalInCents / 100,
            },
            Price: {
              Value: sale.totalAmountInCents / 100,
            },
            Payment: {
              NumberOfInstallments: 1,
              PaymentMethod: paymentIntent.payment_method_types[0] || "unknown",
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

      console.log("nosso payload para testes");
      console.dir(utmfyPayload, { depth: null, colors: true });

      // Envia para o webhook
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
    console.error(`Stack: ${error.stack}`);
    console.error(`${"=".repeat(80)}\n`);
    throw error; // Re-lança o erro para que o Stripe tente novamente
  }
};
