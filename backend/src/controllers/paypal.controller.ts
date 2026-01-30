import { Request, Response } from "express";
import * as paypalService from "../services/paypal.service";
import Sale from "../models/sale.model";
import Offer from "../models/offer.model";
import User from "../models/user.model";
import UpsellSession from "../models/upsell-session.model";
import { v4 as uuidv4 } from "uuid";
import { sendAccessWebhook } from "../services/integration.service";
import { createFacebookUserData, sendFacebookEvent } from "../services/facebook.service";
import { getCountryFromIP } from "../helper/getCountryFromIP";
import { processUtmfyIntegrationForPayPal } from "../services/utmfy.service";

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

    // Habilita vault se a oferta tiver upsell ativo
    const enableVault = offer.upsell?.enabled === true;

    console.log(`🔵 [PayPal] Criando ordem com vault ${enableVault ? "HABILITADO" : "DESABILITADO"}`);

    const order = await paypalService.createOrder(amount, currency, user.paypalClientId, user.paypalClientSecret, enableVault);
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

      // SALVAR A VENDA NO BANCO DE DADOS (com dados do Facebook para CAPI)
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
        userAgent: customerData?.userAgent || "",
        // Dados do Facebook para CAPI
        fbc: customerData?.fbc,
        fbp: customerData?.fbp,
        addressCity: customerData?.addressCity,
        addressState: customerData?.addressState,
        addressZipCode: customerData?.addressZipCode,
        addressCountry: customerData?.addressCountry,
        items,
      });

      await newSale.save();

      // =================================================================
      // INTEGRAÇÕES EXTERNAS
      // =================================================================

      // A: Webhook de Área de Membros (Husky/MemberKit)
      try {
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

      // C: Webhook de Rastreamento (UTMfy)
      try {
        await processUtmfyIntegrationForPayPal(
          offer as any,
          newSale,
          items,
          captureData.id, // PayPal Order ID como identificador
          {
            email: customerData?.email,
            name: customerData?.name,
            phone: customerData?.phone,
          },
          {
            ip: clientIp,
            // UTMs podem vir do frontend se forem passados no customerData
            utm_source: customerData?.utm_source,
            utm_medium: customerData?.utm_medium,
            utm_campaign: customerData?.utm_campaign,
            utm_term: customerData?.utm_term,
            utm_content: customerData?.utm_content,
            userAgent: customerData?.userAgent,
          }
        );
      } catch (utmfyError: any) {
        console.error(`⚠️ [PayPal] Erro ao enviar webhook UTMfy:`, utmfyError.message);
        // Não falha a transação por causa do webhook
      }

      // D: Verificar se tem upsell habilitado e vault disponível
      let upsellToken: string | null = null;
      let upsellRedirectUrl: string | null = null;

      // Extrai vault_id e customer_id do PayPal (se disponível)
      const paymentSource = captureData.payment_source?.paypal;
      const vaultId = paymentSource?.attributes?.vault?.id;
      const paypalCustomerId = paymentSource?.attributes?.vault?.customer?.id;

      if (offer.upsell?.enabled && vaultId && paypalCustomerId) {
        console.log(`🔵 [PayPal] Vault detectado! vault_id: ${vaultId}, customer_id: ${paypalCustomerId}`);

        // Gera token de upsell
        const token = uuidv4();

        // Salva sessão de upsell com dados do PayPal Vault
        await UpsellSession.create({
          token,
          accountId: user.paypalClientId, // Usamos o clientId como accountId
          customerId: paypalCustomerId, // ID do cliente no PayPal
          paymentMethodId: vaultId, // ID do vault token
          offerId: offer._id,
          paymentMethod: "paypal",
          ip: clientIp,
          customerName: customerData?.name || "",
          customerEmail: customerData?.email || "",
          customerPhone: customerData?.phone || "",
          // Campos específicos do PayPal
          paypalVaultId: vaultId,
          paypalCustomerId: paypalCustomerId,
        });

        // Constrói URL de redirecionamento para upsell
        const separator = offer.upsell.redirectUrl.includes("?") ? "&" : "?";
        upsellRedirectUrl = `${offer.upsell.redirectUrl}${separator}token=${token}`;
        upsellToken = token;

        console.log(`✅ [PayPal] Token de upsell gerado: ${token}`);
      } else if (offer.upsell?.enabled && !vaultId) {
        console.warn(`⚠️ [PayPal] Upsell habilitado mas vault_id não encontrado na resposta do PayPal`);
      }

      // Fallback para Thank You Page se não tiver upsell
      if (!upsellRedirectUrl) {
        upsellRedirectUrl = offer.thankYouPageUrl && offer.thankYouPageUrl.trim() !== "" ? offer.thankYouPageUrl : null;
      }

      console.log(`✅ [PayPal] Venda finalizada - ${upsellToken ? "redirecionando para UPSELL" : "redirecionando para Thank You Page"}`);

      res.json({
        success: true,
        data: captureData,
        saleId: newSale._id,
        upsellToken,
        upsellRedirectUrl,
      });
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

  // Dados do usuário com todos os parâmetros necessários para o Facebook
  const userData = createFacebookUserData(
    clientIp,
    customerData?.userAgent || "",
    customerData?.email || sale.customerEmail,
    customerData?.phone || "",
    customerData?.name || sale.customerName,
    customerData?.fbc, // Cookie _fbc do Facebook
    customerData?.fbp, // Cookie _fbp do Facebook
    customerData?.addressCity,
    customerData?.addressState,
    customerData?.addressZipCode,
    customerData?.addressCountry
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
  console.log(`   - User Data: email=${!!userData.em}, phone=${!!userData.ph}, fbc=${!!userData.fbc}, fbp=${!!userData.fbp}, userAgent=${!!userData.client_user_agent}`);
  console.log(`   - Event Data Completo:`, JSON.stringify(eventData, null, 2));

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

/**
 * Processar PayPal One-Click Upsell usando vault_id
 */
export const handlePayPalOneClickUpsell = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: "Token inválido." });
    }

    // Busca sessão de upsell
    const session: any = await UpsellSession.findOne({ token }).populate("offerId");

    if (!session) {
      return res.status(403).json({ success: false, message: "Sessão expirada ou token já usado." });
    }

    const offer = session.offerId as any;

    // 1. Validar se upsell está ativo
    if (!offer?.upsell?.enabled) {
      return res.status(400).json({ success: false, message: "Upsell não está ativo nesta oferta." });
    }

    // 2. Validar se é PayPal
    if (session.paymentMethod !== "paypal") {
      return res.status(400).json({ success: false, message: "Método de pagamento incompatível." });
    }

    // 3. Validar vault_id e customer_id
    if (!session.paypalVaultId || !session.paypalCustomerId) {
      return res.status(400).json({ success: false, message: "Dados de vault não encontrados." });
    }

    // 4. Validar valor do upsell
    const amountToCharge = offer.upsell.price;

    if (!amountToCharge || amountToCharge < 50) {
      console.error(`❌ [PayPal Upsell] Valor inválido (${amountToCharge}) para a oferta ${offer.name}`);
      return res.status(400).json({ success: false, message: "Configuração de preço inválida para este Upsell." });
    }

    // 5. Buscar credenciais do PayPal
    const user = await User.findById(offer.ownerId).select("+paypalClientSecret");

    if (!user || !user.paypalClientId || !user.paypalClientSecret) {
      return res.status(400).json({ success: false, message: "Credenciais do PayPal não configuradas." });
    }

    console.log(`🔵 [PayPal Upsell] Processando upsell com vault_id: ${session.paypalVaultId}`);

    // 6. Criar e capturar ordem usando vault_id
    const captureData = await paypalService.createAndCaptureOrderWithVault(
      amountToCharge,
      offer.currency || "brl",
      session.paypalVaultId,
      session.paypalCustomerId,
      user.paypalClientId,
      user.paypalClientSecret
    );

    if (captureData.status === "COMPLETED") {
      // 7. Salvar venda do upsell
      const capturedAmount = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.amount;
      const amountInCents = capturedAmount ? Math.round(parseFloat(capturedAmount.value) * 100) : amountToCharge;

      const items = [
        {
          name: offer.upsell.name,
          priceInCents: amountToCharge,
          isOrderBump: false,
          customId: offer.upsell.customId,
        },
      ];

      const newSale = new Sale({
        stripePaymentIntentId: `PAYPAL_UPSELL_${captureData.id}`,
        offerId: offer._id,
        ownerId: offer.ownerId,
        status: "succeeded",
        totalAmountInCents: amountInCents,
        platformFeeInCents: 0,
        currency: (capturedAmount?.currency_code || offer.currency).toLowerCase(),
        customerEmail: session.customerEmail || "",
        customerName: session.customerName || "",
        customerPhone: session.customerPhone || "",
        paymentMethod: "paypal",
        ip: session.ip || "",
        country: session.ip ? getCountryFromIP(session.ip) : "BR",
        isUpsell: true,
        items,
      });

      await newSale.save();

      // 8. Deletar sessão de upsell (token usado)
      await UpsellSession.deleteOne({ token });

      // 9. Redirecionar para Thank You Page
      const redirectUrl = offer.thankYouPageUrl && offer.thankYouPageUrl.trim() !== "" ? offer.thankYouPageUrl : null;

      console.log(`✅ [PayPal Upsell] Compra concluída com sucesso`);

      res.status(200).json({
        success: true,
        message: "Compra realizada com sucesso!",
        redirectUrl,
      });
    } else {
      console.error(`❌ [PayPal Upsell] Pagamento não concluído: ${captureData.status}`);
      res.status(400).json({
        success: false,
        message: "Pagamento recusado. Tente novamente.",
        status: captureData.status,
      });
    }
  } catch (error: any) {
    console.error("❌ [PayPal Upsell] Erro:", error);
    const errorMessage = error.message || "Erro interno ao processar upsell.";
    res.status(500).json({ success: false, message: errorMessage });
  }
};

/**
 * Recusar PayPal Upsell
 */
export const handlePayPalUpsellRefuse = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: "Token inválido." });
    }

    const session: any = await UpsellSession.findOne({ token }).populate("offerId");

    if (!session) {
      return res.status(403).json({ success: false, message: "Sessão expirada." });
    }

    const offer = session.offerId as any;

    // Deletar sessão
    await UpsellSession.deleteOne({ token });

    const redirectUrl = offer.thankYouPageUrl && offer.thankYouPageUrl.trim() !== "" ? offer.thankYouPageUrl : null;

    console.log(`✅ [PayPal Upsell] Oferta recusada`);

    res.status(200).json({
      success: true,
      message: "Oferta recusada.",
      redirectUrl,
    });
  } catch (error: any) {
    console.error("❌ [PayPal Upsell] Erro ao recusar:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
