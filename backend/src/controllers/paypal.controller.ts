import { Request, Response } from "express";
import * as paypalService from "../services/paypal.service";
import Sale from "../models/sale.model";
import Offer from "../models/offer.model";
import User from "../models/user.model";
import { sendAccessWebhook } from "../services/integration.service";
import { createFacebookUserData, sendFacebookEvent } from "../services/facebook.service";
import { getCountryFromIP } from "../helper/getCountryFromIP";

/**
 * Retorna o PayPal Client ID para uma oferta (público, usado pelo frontend SDK)
 */
export const getClientId = async (req: Request, res: Response) => {
  try {
    const { offerId } = req.params;

    if (!offerId) {
      return res.status(400).json({ error: "offerId é obrigatório." });
    }

    // Buscar a oferta
    const offer = await Offer.findById(offerId);

    if (!offer) {
      return res.status(404).json({ error: "Oferta não encontrada." });
    }

    if (!offer.paypalEnabled) {
      return res.status(403).json({ error: "PayPal não está habilitado para esta oferta." });
    }

    // Buscar as credenciais do PayPal do usuário (apenas o Client ID, que é público)
    const user = await User.findById(offer.ownerId);

    if (!user || !user.paypalClientId) {
      return res.status(400).json({ error: "Credenciais do PayPal não configuradas pelo vendedor." });
    }

    // Retorna apenas o Client ID (é seguro expor, pois é usado no script SDK do frontend)
    res.json({ clientId: user.paypalClientId });
  } catch (error: any) {
    console.error("Erro ao buscar PayPal Client ID:", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const createOrder = async (req: Request, res: Response) => {
  try {
    const { amount, currency, offerId } = req.body;

    if (!offerId) {
      return res.status(400).json({ error: "offerId é obrigatório." });
    }

    // Buscar a oferta para pegar o ownerId
    const offer = await Offer.findById(offerId);

    if (!offer) {
      return res.status(404).json({ error: "Oferta não encontrada." });
    }

    if (!offer.paypalEnabled) {
      return res.status(403).json({ error: "PayPal não está habilitado para esta oferta." });
    }

    // Buscar as credenciais do PayPal do usuário
    const user = await User.findById(offer.ownerId).select("+paypalClientSecret");

    if (!user || !user.paypalClientId || !user.paypalClientSecret) {
      return res.status(400).json({ error: "Credenciais do PayPal não configuradas." });
    }

    // DICA: O ideal é recalcular o 'amount' aqui no backend buscando a Offer pelo ID para segurança

    const order = await paypalService.createOrder(amount, currency, user.paypalClientId, user.paypalClientSecret);
    res.json(order);
  } catch (error: any) {
    console.error("Erro ao criar ordem PayPal:", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const captureOrder = async (req: Request, res: Response) => {
  try {
    const { orderId, offerId, customerData, abTestId, selectedOrderBumps, purchaseEventId } = req.body;

    if (!offerId) {
      return res.status(400).json({ error: "offerId é obrigatório." });
    }

    if (!orderId) {
      return res.status(400).json({ error: "orderId é obrigatório." });
    }

    // Buscar a oferta para pegar o ownerId e dados do produto
    const offer = await Offer.findById(offerId);

    if (!offer) {
      return res.status(404).json({ error: "Oferta não encontrada." });
    }

    // Buscar as credenciais do PayPal do usuário
    const user = await User.findById(offer.ownerId).select("+paypalClientSecret");

    if (!user || !user.paypalClientId || !user.paypalClientSecret) {
      return res.status(400).json({ error: "Credenciais do PayPal não configuradas." });
    }

    const captureData = await paypalService.captureOrder(orderId, user.paypalClientId, user.paypalClientSecret);

    if (captureData.status === "COMPLETED") {
      // Extrair valor capturado do PayPal
      const capturedAmount = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.amount;
      const amountInCents = capturedAmount ? Math.round(parseFloat(capturedAmount.value) * 100) : offer.mainProduct.priceInCents;

      // Obter IP do cliente
      const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "";
      const countryCode = clientIp ? getCountryFromIP(clientIp) : "BR";

      // Montar lista de itens (produto principal + order bumps)
      const items: Array<{
        _id?: string;
        name: string;
        priceInCents: number;
        isOrderBump: boolean;
        compareAtPriceInCents?: number;
        customId?: string;
      }> = [];

      // Produto Principal
      items.push({
        _id: (offer.mainProduct as any)._id?.toString(),
        name: offer.mainProduct.name,
        priceInCents: offer.mainProduct.priceInCents,
        compareAtPriceInCents: offer.mainProduct.compareAtPriceInCents,
        isOrderBump: false,
        customId: (offer.mainProduct as any).customId,
      });

      // Order Bumps (se houver)
      if (selectedOrderBumps && Array.isArray(selectedOrderBumps)) {
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

      // SALVAR A VENDA NO BANCO DE DADOS
      const newSale = new Sale({
        stripePaymentIntentId: `PAYPAL_${captureData.id}`, // Prefixo para identificar como PayPal
        offerId: offer._id,
        ownerId: offer.ownerId,
        abTestId: abTestId || null,
        status: "succeeded",
        totalAmountInCents: amountInCents,
        platformFeeInCents: 0,
        currency: (capturedAmount?.currency_code || offer.currency).toLowerCase(),
        customerEmail: customerData?.email || "",
        customerName: customerData?.name || "",
        customerPhone: customerData?.phone || "",
        paymentMethod: "paypal",
        ip: clientIp,
        country: countryCode,
        items,
      });

      await newSale.save();

      console.log(`✅ [PayPal] Venda ${newSale._id} salva com sucesso.`);

      // =================================================================
      // INTEGRAÇÕES EXTERNAS
      // =================================================================

      // A: Webhook de Área de Membros (Husky/MemberKit)
      try {
        console.log(`📤 [PayPal] Enviando webhook de acesso para Husky...`);
        await sendAccessWebhook(offer as any, newSale, items, customerData?.phone || "");
      } catch (webhookError: any) {
        console.error(`⚠️ [PayPal] Erro ao enviar webhook Husky:`, webhookError.message);
        // Não falha a transação por causa do webhook
      }

      // B: Facebook CAPI (Purchase Event)
      try {
        await sendFacebookPurchaseForPayPal(offer, newSale, items, clientIp, customerData, purchaseEventId);
      } catch (fbError: any) {
        console.error(`⚠️ [PayPal] Erro ao enviar evento Facebook:`, fbError.message);
      }

      res.json({ success: true, data: captureData, saleId: newSale._id });
    } else {
      res.status(400).json({ success: false, message: "Pagamento não concluído", status: captureData.status });
    }
  } catch (error: any) {
    console.error("Erro ao capturar ordem PayPal:", error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Envia evento Purchase para o Facebook CAPI após pagamento PayPal
 */
const sendFacebookPurchaseForPayPal = async (
  offer: any,
  sale: any,
  items: any[],
  clientIp: string,
  customerData: any,
  purchaseEventId?: string
): Promise<void> => {
  // Coletar todos os pixels
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

  if (pixels.length === 0) return;

  const totalValue = sale.totalAmountInCents / 100;

  const userData = createFacebookUserData(
    clientIp,
    "",
    customerData?.email || sale.customerEmail,
    customerData?.phone || "",
    customerData?.name || sale.customerName
  );

  // Usa purchaseEventId do frontend se disponível (para deduplicação com Pixel)
  // Fallback para o formato antigo se não receber do frontend
  const eventId = purchaseEventId || `paypal_purchase_${sale._id}`;

  const eventData = {
    event_name: "Purchase" as const,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: "website" as const,
    user_data: userData,
    custom_data: {
      currency: (sale.currency || "BRL").toUpperCase(),
      value: totalValue,
      order_id: String(sale._id),
      content_ids: items.map((i) => i._id || i.customId || "unknown"),
      content_type: "product",
    },
  };

  console.log(`🔵 [PayPal] Enviando Purchase para ${pixels.length} pixel(s) Facebook | Valor: ${totalValue}`);

  const results = await Promise.allSettled(
    pixels.map((pixel) =>
      sendFacebookEvent(pixel.pixelId, pixel.accessToken, eventData).catch((err) => {
        console.error(`❌ Erro Facebook pixel ${pixel.pixelId}:`, err);
        throw err;
      })
    )
  );

  const successful = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  console.log(`📊 [PayPal] Facebook Purchase: ${successful} sucesso, ${failed} falhas de ${pixels.length} pixels`);
};
