// src/webhooks/stripe/handlers/payment-intent.handler.ts
import { Stripe } from "stripe";
import Sale from "../../../models/sale.model";
import Offer from "../../../models/offer.model";
import { sendSaleToExternalAPI } from "../../../services/external-api.service";
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
    const items = [
      {
        name: offer.mainProduct.name,
        priceInCents: offer.mainProduct.priceInCents,
        isOrderBump: false,
      },
    ];
    console.log(`   ✓ Produto Principal: ${offer.mainProduct.name} - R$ ${(offer.mainProduct.priceInCents / 100).toFixed(2)}`);

    // Adiciona os order bumps selecionados
    for (const bumpId of selectedOrderBumps) {
      const bump = offer.orderBumps.find((b: any) => b._id.toString() === bumpId);
      if (bump) {
        items.push({
          name: bump.name,
          priceInCents: bump.priceInCents,
          isOrderBump: true,
        });
        console.log(`   ✓ Order Bump: ${bump.name} - R$ ${(bump.priceInCents / 100).toFixed(2)}`);
      }
    }

    // 4. Verifica se a venda já foi registrada (idempotência)
    // const existingSale = await Sale.findOne({ stripePaymentIntentId: paymentIntent.id });
    // if (existingSale) {
    //   console.log(`\n⚠️  VENDA DUPLICADA DETECTADA!`);
    //   console.log(`   Esta venda já foi processada anteriormente.`);
    //   console.log(`   ID da venda existente: ${existingSale._id}`);
    //   console.log(`${"=".repeat(80)}\n`);
    //   return;
    // }

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
        let id;
        if (item.isOrderBump) {
          // Tenta achar o ID do bump no array de order bumps
          // O '.find(b => b.name === item.name)' assume nomes únicos.
          const bump = offer.orderBumps.find((b) => b.name === item.name);
          id = (bump as any)?._id?.toString() || crypto.randomUUID(); // Usa o ID do bump ou gera um
        } else {
          // Para o produto principal, podemos usar o ID da própria oferta
          id = (offer._id as any)?.toString() || crypto.randomUUID();
        }
        return {
          Id: id,
          Name: item.name,
        };
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
            // PhoneNumber e Document não estão disponíveis no seu fluxo atual
          },
          Seller: {
            Id: owner._id.toString(),
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
            // 'AFFILIATE' não está disponível no seu fluxo atual
          ],
          Purchase: {
            PaymentId: sale.stripePaymentIntentId,
            Recurrency: 1, // Assumindo compra única
            PaymentDate: new Date(paymentIntent.created * 1000).toISOString(),
            OriginalPrice: {
              Value: sale.totalAmountInCents / 100,
            },
            Price: {
              Value: sale.totalAmountInCents / 100,
            },
            Payment: {
              NumberOfInstallments: 1, // Default. Obter isso do Stripe é complexo.
              PaymentMethod: paymentIntent.payment_method_types[0] || "unknown",
            },
          },
          Offer: {
            Id: (offer._id as any)?.toString() || crypto.randomUUID(),
            Name: offer.name,
            // Certifique-se de ter FRONTEND_URL no seu .env
            Url: `${process.env.FRONTEND_URL || "https://sua-url.com"}/p/${offer.slug}`,
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
