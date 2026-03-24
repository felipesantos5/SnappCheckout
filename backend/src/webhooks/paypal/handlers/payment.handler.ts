// src/webhooks/paypal/handlers/payment.handler.ts
import Sale from "../../../models/sale.model";
import Offer from "../../../models/offer.model";
import User from "../../../models/user.model";
import UpsellSession from "../../../models/upsell-session.model";
import { sendAccessWebhook } from "../../../services/integration.service";
import { getCountryFromIP } from "../../../helper/getCountryFromIP";
import { v4 as uuidv4 } from "uuid";

interface PayPalCaptureResource {
  id: string;
  status: string;
  amount: {
    currency_code: string;
    value: string;
  };
  custom_id?: string; // Usamos para passar o offerId
  invoice_id?: string;
  supplementary_data?: {
    related_ids?: {
      order_id?: string;
    };
  };
}

interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource: PayPalCaptureResource;
  create_time: string;
}

/**
 * Handler para PAYMENT.CAPTURE.COMPLETED
 * Chamado quando um pagamento PayPal é capturado com sucesso
 */
export const handlePaymentCaptureCompleted = async (event: PayPalWebhookEvent): Promise<void> => {
  try {
    const capture = event.resource;
    const captureId = capture.id;
    const paypalOrderId = capture.supplementary_data?.related_ids?.order_id;

    // 1. Verificar idempotência - evita processar o mesmo pagamento duas vezes
    const existingSale = await Sale.findOne({
      $or: [{ stripePaymentIntentId: `PAYPAL_${captureId}` }, { stripePaymentIntentId: `PAYPAL_${paypalOrderId}` }],
    });

    if (existingSale) {
      // Se a venda existe mas integrações falharam, tenta reenviar TODAS as integrações
      if (existingSale.status === "succeeded") {
        await retryAllIntegrations(existingSale);
      }
      return;
    }

    // 2. Buscar a venda pendente pelo PayPal Order ID
    // O captureOrder já cria a Sale, então buscamos ela
    const pendingSale = await Sale.findOne({
      stripePaymentIntentId: { $regex: `PAYPAL_`, $options: "i" },
      status: "succeeded",
      createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }, // Últimos 5 minutos
    })
      .sort({ createdAt: -1 })
      .populate("offerId");

    if (pendingSale) {
      // Buscar oferta para enviar webhook
      const offer = await Offer.findById(pendingSale.offerId);

      if (offer) {
        // Montar items para o webhook
        const items = pendingSale.items || [
          {
            _id: (offer.mainProduct as any)._id?.toString(),
            name: offer.mainProduct.name,
            priceInCents: offer.mainProduct.priceInCents,
            isOrderBump: false,
            customId: (offer.mainProduct as any).customId,
          },
        ];

        // Enviar webhook para área de membros (Husky)
        await sendAccessWebhook(offer as any, pendingSale, items, "");

        // Facebook CAPI (Purchase) - NÃO envia imediatamente
        // O evento Purchase será enviado consolidado pelo job (facebook-purchase.job.ts)
      }

      return;
    }
  } catch (error: any) {
    console.error(`❌ [PayPal] Erro ao processar PAYMENT.CAPTURE.COMPLETED:`, error.message);
    throw error;
  }
};

/**
 * Handler para PAYMENT.CAPTURE.DENIED
 * Chamado quando um pagamento PayPal é negado
 */
export const handlePaymentCaptureDenied = async (event: PayPalWebhookEvent): Promise<void> => {
  try {
    const capture = event.resource;

    // Buscar e atualizar a venda se existir
    const sale = await Sale.findOne({
      stripePaymentIntentId: { $regex: `PAYPAL_`, $options: "i" },
      createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) }, // Últimos 30 minutos
    }).sort({ createdAt: -1 });

    if (sale && sale.status !== "failed") {
      sale.status = "failed";
      sale.failureReason = "payment_denied";
      sale.failureMessage = "Pagamento PayPal negado";
      await sale.save();
    }
  } catch (error: any) {
    console.error(`❌ [PayPal] Erro ao processar PAYMENT.CAPTURE.DENIED:`, error.message);
  }
};

/**
 * Handler para PAYMENT.CAPTURE.REFUNDED
 * Chamado quando um pagamento PayPal é reembolsado
 */
export const handlePaymentCaptureRefunded = async (event: PayPalWebhookEvent): Promise<void> => {
  try {
    const capture = event.resource;

    // Buscar a venda pelo ID do PayPal
    const sale = await Sale.findOne({
      stripePaymentIntentId: { $regex: `PAYPAL_`, $options: "i" },
    });

    if (sale) {
      sale.status = "refunded";
      await sale.save();
    }
  } catch (error: any) {
    console.error(`❌ [PayPal] Erro ao processar PAYMENT.CAPTURE.REFUNDED:`, error.message);
  }
};

/**
 * Handler para VAULT.PAYMENT-TOKEN.CREATED
 * Fallback assíncrono: quando o vault retorna status APPROVED na captura,
 * o PayPal envia este webhook quando o token fica disponível.
 * Atualiza a UpsellSession se ela foi criada sem vault_id.
 */
export const handleVaultPaymentTokenCreated = async (event: any): Promise<void> => {
  try {
    const resource = event.resource;
    const vaultId = resource?.id;
    const paypalCustomerId = resource?.customer?.id;

    if (!vaultId || !paypalCustomerId) {
      console.warn(`⚠️ [PayPal Vault Webhook] Token ou customer_id ausente no evento`);
      return;
    }


    // Busca uma venda recente do PayPal para este customer (últimos 10 minutos)
    // para associar ao upsell se necessário
    const recentSale = await Sale.findOne({
      stripePaymentIntentId: { $regex: /^PAYPAL_/ },
      paymentMethod: "paypal",
      status: "succeeded",
      createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) },
    })
      .sort({ createdAt: -1 })
      .populate("offerId");

    if (!recentSale) {
      return;
    }

    const offer = recentSale.offerId as any;
    if (!offer?.upsell?.enabled) {
      return;
    }

    // Verifica se já existe uma UpsellSession para esta venda
    const existingSession = await UpsellSession.findOne({
      offerId: offer._id,
      paymentMethod: "paypal",
      customerEmail: recentSale.customerEmail,
      createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) },
    });

    if (existingSession) {
      // Atualiza a sessão existente com os dados do vault se estiverem faltando
      if (!existingSession.paypalVaultId) {
        existingSession.paypalVaultId = vaultId;
        existingSession.paypalCustomerId = paypalCustomerId;
        existingSession.paymentMethodId = vaultId;
        existingSession.customerId = paypalCustomerId;
        await existingSession.save();
      } else {
      }
      return;
    }

    // Se não existe UpsellSession, cria uma nova (caso o polling tenha falhado)
    const owner = await User.findById(offer.ownerId);
    if (!owner?.paypalClientId) {
      console.warn(`⚠️ [PayPal Vault Webhook] Vendedor sem PayPal configurado`);
      return;
    }

    const token = uuidv4();
    await UpsellSession.create({
      token,
      accountId: owner.paypalClientId,
      customerId: paypalCustomerId,
      paymentMethodId: vaultId,
      offerId: offer._id,
      paymentMethod: "paypal",
      ip: recentSale.ip || "",
      customerName: recentSale.customerName || "",
      customerEmail: recentSale.customerEmail || "",
      customerPhone: recentSale.customerPhone || "",
      paypalVaultId: vaultId,
      paypalCustomerId: paypalCustomerId,
    });

    // Nota: o cliente já foi redirecionado sem upsell neste ponto,
    // mas a sessão fica disponível caso o parceiro tenha lógica de retry
  } catch (error: any) {
    console.error(`❌ [PayPal Vault Webhook] Erro:`, error.message);
  }
};

/**
 * NOVA FUNÇÃO: Tenta reenviar TODAS as integrações (Facebook, Husky, UTMfy)
 * caso alguma tenha falhado anteriormente
 */
const retryAllIntegrations = async (sale: any): Promise<void> => {
  try {
    const offer = await Offer.findById(sale.offerId).populate("ownerId");
    if (!offer) {
      console.warn(`⚠️ [PayPal Webhook] Oferta ${sale.offerId} não encontrada para reprocessamento`);
      return;
    }

    const items = sale.items || [
      {
        _id: (offer.mainProduct as any)._id?.toString(),
        name: offer.mainProduct.name,
        priceInCents: offer.mainProduct.priceInCents,
        isOrderBump: false,
        customId: (offer.mainProduct as any).customId,
      },
    ];

    // Marca tentativa de reprocessamento
    sale.integrationsLastAttempt = new Date();

    // A: Reenvia para Husky (área de membros) se não foi enviado ainda
    if (!sale.integrationsHuskySent) {
      try {
        await sendAccessWebhook(offer as any, sale, items, sale.customerPhone || "");
        sale.integrationsHuskySent = true;
      } catch (error: any) {
        console.error(`❌ [PayPal Webhook] Erro ao reenviar webhook Husky:`, error.message);
      }
    }

    // B: Facebook CAPI (Purchase) - NÃO reenvia aqui
    // O evento Purchase será enviado consolidado pelo job (facebook-purchase.job.ts)

    // C: Reenvia para UTMfy se não foi enviado ainda
    if (!sale.integrationsUtmfySent) {
      try {

        // Importar função de reprocessamento do UTMfy
        const { processUtmfyIntegrationForPayPal } = await import("../../../services/utmfy.service");

        await processUtmfyIntegrationForPayPal(
          offer as any,
          sale,
          items,
          sale.stripePaymentIntentId.replace("PAYPAL_", ""), // Remove prefixo para obter order ID
          {
            email: sale.customerEmail,
            name: sale.customerName,
            phone: sale.customerPhone,
          },
          {
            ip: sale.ip,
            userAgent: sale.userAgent,
            utm_source: (sale as any).utm_source,
            utm_medium: (sale as any).utm_medium,
            utm_campaign: (sale as any).utm_campaign,
            utm_term: (sale as any).utm_term,
            utm_content: (sale as any).utm_content,
          }
        );
        sale.integrationsUtmfySent = true;
      } catch (error: any) {
        console.error(`❌ [PayPal Webhook] Erro ao reenviar webhook UTMfy:`, error.message);
      }
    }

    // Salva as flags de integração
    await sale.save();
  } catch (error: any) {
    console.error(`❌ [PayPal Webhook] Erro ao reprocessar integrações:`, error.message);
  }
};

