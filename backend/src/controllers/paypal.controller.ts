import { Request, Response } from "express";
import * as paypalService from "../services/paypal.service";
import Sale from "../models/sale.model";
import Offer from "../models/offer.model";
import User from "../models/user.model";
import UpsellSession from "../models/upsell-session.model";
import { v4 as uuidv4 } from "uuid";
import { sendAccessWebhook } from "../services/integration.service";
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

    // Habilita vault apenas se a oferta tiver upsell ativo E o PayPal One-Click estiver habilitado
    const enableVault = offer.upsell?.enabled === true && offer.upsell?.paypalOneClickEnabled === true;


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

    let captureData: any;
    try {
      captureData = await paypalService.captureOrder(orderId, user.paypalClientId, user.paypalClientSecret);
    } catch (captureError: any) {
      console.error(`❌ [PayPal] Falha ao capturar ordem ${orderId}:`, captureError.message);
      return res.status(500).json({ error: captureError.message });
    }

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
        // Facebook Purchase consolidado: envia após 10 minutos para agrupar com upsell
        facebookPurchaseSendAfter: new Date(Date.now() + 10 * 60 * 1000),
        items,

        // UTM Tracking
        utm_source: customerData?.utm_source || "",
        utm_medium: customerData?.utm_medium || "",
        utm_campaign: customerData?.utm_campaign || "",
        utm_term: customerData?.utm_term || "",
        utm_content: customerData?.utm_content || "",
      });

      // CRÍTICO: O pagamento já foi capturado pelo PayPal. Se o save falhar,
      // o dinheiro saiu mas a venda não foi registrada. Tentamos até 3 vezes.
      let saleSaved = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await newSale.save();
          saleSaved = true;
          break;
        } catch (saveError: any) {
          console.error(`❌ [PayPal] Tentativa ${attempt}/3 de salvar venda falhou:`, saveError.message);
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }

      if (!saleSaved) {
        // Log crítico com todos os dados para recuperação manual
        console.error(`🚨 [PayPal] CRÍTICO: Pagamento capturado (${captureData.id}) mas venda NÃO foi salva!`, {
          paypalOrderId: captureData.id,
          offerId: (offer._id as any).toString(),
          ownerId: offer.ownerId,
          amountInCents,
          customerEmail: customerData?.email,
          customerName: customerData?.name,
        });
        // Retorna sucesso ao cliente mesmo assim (o dinheiro já saiu)
        // A venda precisará ser reconciliada manualmente
        return res.json({
          success: true,
          data: captureData,
          saleId: null,
          upsellToken: null,
          upsellRedirectUrl: offer.thankYouPageUrl || null,
        });
      }

      // =================================================================
      // INTEGRAÇÕES EXTERNAS
      // =================================================================

      // Marca tentativa de integração
      newSale.integrationsLastAttempt = new Date();

      // A: Webhook de Área de Membros (Husky/MemberKit)
      try {
        await sendAccessWebhook(offer as any, newSale, items, customerData?.phone || "");
        newSale.integrationsHuskySent = true;
      } catch (webhookError: any) {
        console.error(`⚠️ [PayPal] Erro ao enviar webhook Husky:`, webhookError.message);
        newSale.integrationsHuskySent = false;
      }

      // B: Facebook CAPI (Purchase) - NÃO envia imediatamente
      // O evento Purchase será enviado consolidado pelo job (facebook-purchase.job.ts)
      // após a janela de 10 minutos, agrupando valor do produto principal + order bumps + upsell

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
            utm_source: newSale.utm_source,
            utm_medium: newSale.utm_medium,
            utm_campaign: newSale.utm_campaign,
            utm_term: newSale.utm_term,
            utm_content: newSale.utm_content,
            userAgent: customerData?.userAgent,
          }
        );
        newSale.integrationsUtmfySent = true;
      } catch (utmfyError: any) {
        console.error(`⚠️ [PayPal] Erro ao enviar webhook UTMfy:`, utmfyError.message);
        newSale.integrationsUtmfySent = false;
      }

      // Salva as flags de integração (não-crítico, não deve impedir resposta)
      try {
        await newSale.save();
      } catch (flagSaveError: any) {
        console.error(`⚠️ [PayPal] Erro ao salvar flags de integração:`, flagSaveError.message);
      }

      // D: Verificar se tem upsell habilitado e vault disponível
      let upsellToken: string | null = null;
      let upsellRedirectUrl: string | null = null;


      if (offer.upsell?.enabled) {
        // Verifica se o PayPal One-Click está habilitado para esta oferta
        if (offer.upsell.paypalOneClickEnabled) {
          // Extrai vault_id e customer_id do PayPal (se disponível)
          const paymentSource = captureData.payment_source?.paypal;
          const vaultData = paymentSource?.attributes?.vault;
          let vaultId = vaultData?.id;
          let paypalCustomerId = vaultData?.customer?.id;
          const vaultStatus = vaultData?.status;


          // Se temos vault_id e customer_id, cria sessão de upsell one-click
          if (vaultId && paypalCustomerId) {

            const token = uuidv4();

            try {
              await UpsellSession.create({
                token,
                accountId: user.paypalClientId,
                customerId: paypalCustomerId,
                paymentMethodId: vaultId,
                offerId: offer._id,
                paymentMethod: "paypal",
                ip: clientIp,
                customerName: customerData?.name || "",
                customerEmail: customerData?.email || "",
                customerPhone: customerData?.phone || "",
                paypalVaultId: vaultId,
                paypalCustomerId: paypalCustomerId,
                originalSaleId: newSale._id,
                // Pass UTMs to the upsell session
                utm_source: newSale.utm_source,
                utm_medium: newSale.utm_medium,
                utm_campaign: newSale.utm_campaign,
                utm_term: newSale.utm_term,
                utm_content: newSale.utm_content,
              });

              const separator = offer.upsell.redirectUrl.includes("?") ? "&" : "?";
              upsellRedirectUrl = `${offer.upsell.redirectUrl}${separator}token=${token}&payment_method=paypal&offerId=${offer._id}`;
              upsellToken = token;

            } catch (upsellError: any) {
              console.error(`⚠️ [PayPal] Erro ao criar sessão de upsell:`, upsellError.message);
              // Se falhar, redireciona sem token (checkout normal)
              if (offer.upsell.redirectUrl) {
                const sep = offer.upsell.redirectUrl.includes("?") ? "&" : "?";
                upsellRedirectUrl = `${offer.upsell.redirectUrl}${sep}payment_method=paypal&offerId=${offer._id}`;
              }
            }
          } else {
            // Vault não disponível - redireciona para upsell sem one-click
            console.warn(`⚠️ [PayPal] Vault não disponível. Redirecionando para upsell sem one-click.`);
            
            if (offer.upsell.redirectUrl) {
              const sep = offer.upsell.redirectUrl.includes("?") ? "&" : "?";
              upsellRedirectUrl = `${offer.upsell.redirectUrl}${sep}payment_method=paypal&offerId=${offer._id}`;
            }
          }
        } else {
          // PayPal One-Click desabilitado - usa fluxo normal
          
          if (offer.upsell.fallbackCheckoutUrl) {
            upsellRedirectUrl = offer.upsell.fallbackCheckoutUrl;
          } else if (offer.upsell.redirectUrl) {
            const sep = offer.upsell.redirectUrl.includes("?") ? "&" : "?";
            upsellRedirectUrl = `${offer.upsell.redirectUrl}${sep}payment_method=paypal&offerId=${offer._id}`;
          }
        }
      }

      // Fallback para Thank You Page se não tiver upsell configurado
      if (!upsellRedirectUrl) {
        upsellRedirectUrl = offer.thankYouPageUrl && offer.thankYouPageUrl.trim() !== "" ? offer.thankYouPageUrl : null;
      }

      const redirectType = upsellToken ? "UPSELL (one-click)" : (upsellRedirectUrl && upsellRedirectUrl !== offer.thankYouPageUrl ? "UPSELL (sem one-click)" : "Thank You Page");

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
 * Processar PayPal One-Click Upsell usando vault_id
 */
export const handlePayPalOneClickUpsell = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;


    if (!token) {
      console.error(`❌ [PayPal Upsell] Token não fornecido no body da requisição`);
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

    // 6. Validar se o vault token ainda existe (pode ter expirado ou sido deletado)
    try {
      const tokenValidation = await paypalService.getVaultTokenByCustomerId(
        session.paypalCustomerId,
        user.paypalClientId,
        user.paypalClientSecret
      );
      
      if (!tokenValidation || tokenValidation.id !== session.paypalVaultId) {
        console.error(`❌ [PayPal Upsell] Vault token ${session.paypalVaultId} não encontrado ou inválido`);
        return res.status(400).json({ 
          success: false, 
          message: "Token de pagamento expirado. Por favor, refaça o pagamento." 
        });
      }
      
    } catch (validationError: any) {
      console.error(`⚠️ [PayPal Upsell] Erro ao validar vault token:`, validationError.message);
      // Continua mesmo com erro de validação (pode ser problema temporário da API)
    }


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
        parentSaleId: session.originalSaleId || null, // Vincula ao sale original para consolidar Facebook Purchase
        items,

        // UTM Tracking (Extract from session meta if available or body)
        utm_source: session.utm_source || req.body.utm_source || "",
        utm_medium: session.utm_medium || req.body.utm_medium || "",
        utm_campaign: session.utm_campaign || req.body.utm_campaign || "",
        utm_term: session.utm_term || req.body.utm_term || "",
        utm_content: session.utm_content || req.body.utm_content || "",
      });

      await newSale.save();

      // =================================================================
      // 8. INTEGRAÇÕES EXTERNAS (mesmo padrão do captureOrder)
      // =================================================================
      newSale.integrationsLastAttempt = new Date();

      // A: Facebook CAPI (Purchase) - NÃO envia imediatamente
      // O evento Purchase será consolidado pelo job (facebook-purchase.job.ts)
      // junto com a venda original (parentSaleId)

      // B: Webhook de Área de Membros (Husky/MemberKit)
      try {
        await sendAccessWebhook(offer as any, newSale, items, session.customerPhone || "");
        newSale.integrationsHuskySent = true;
      } catch (huskyError: any) {
        console.error(`⚠️ [PayPal Upsell] Erro ao enviar webhook Husky:`, huskyError.message);
        newSale.integrationsHuskySent = false;
      }

      // C: Webhook de Rastreamento (UTMfy)
      try {
        await processUtmfyIntegrationForPayPal(
          offer as any,
          newSale,
          items,
          captureData.id,
          {
            email: session.customerEmail,
            name: session.customerName,
            phone: session.customerPhone,
          },
          { 
            ip: session.ip || "",
            utm_source: newSale.utm_source,
            utm_medium: newSale.utm_medium,
            utm_campaign: newSale.utm_campaign,
            utm_term: newSale.utm_term,
            utm_content: newSale.utm_content,
          }
        );
        newSale.integrationsUtmfySent = true;
      } catch (utmfyError: any) {
        console.error(`⚠️ [PayPal Upsell] Erro ao enviar webhook UTMfy:`, utmfyError.message);
        newSale.integrationsUtmfySent = false;
      }

      // Salva flags de integração
      await newSale.save();

      // 9. Deletar sessão de upsell (token usado)
      await UpsellSession.deleteOne({ token });

      // 10. Redirecionar para Thank You Page
      const redirectUrl = offer.thankYouPageUrl && offer.thankYouPageUrl.trim() !== "" ? offer.thankYouPageUrl : null;


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
    const { token, offerId } = req.body;
    let redirectUrl = null;

    if (token) {
      const session: any = await UpsellSession.findOne({ token }).populate("offerId");

      if (session) {
        const offer = session.offerId as any;
        redirectUrl = offer.thankYouPageUrl && offer.thankYouPageUrl.trim() !== "" ? offer.thankYouPageUrl : null;
        
        // Deletar sessão
        await UpsellSession.deleteOne({ token });
      } else {
        console.warn(`⚠️ [PayPal Upsell] Sessão não encontrada ao recusar (token: ${token})`);
      }
    } 

    // Se não encontrou URL via sessão, tenta via offerId direto
    if (!redirectUrl && offerId) {
      try {
        const offer = await Offer.findById(offerId);
        if (offer && offer.thankYouPageUrl) {
          redirectUrl = offer.thankYouPageUrl;
        }
      } catch (err) {
        console.error(`❌ [PayPal Upsell] Erro ao buscar offerId ${offerId}:`, err);
      }
    }

    // Mesmo que não tenha token ou sessão, retornamos sucesso para o usuário seguir
    return res.status(200).json({
      success: true,
      message: "Oferta recusada.",
      redirectUrl: redirectUrl,
    });
  } catch (error: any) {
    console.error("❌ [PayPal Upsell] Erro silencioso ao recusar:", error);
    // Sempre retorna sucesso no refuse para não travar o fluxo do cliente
    return res.status(200).json({
      success: true,
      redirectUrl: null,
    });
  }
};
