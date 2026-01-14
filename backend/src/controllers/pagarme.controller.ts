// src/controllers/pagarme.controller.ts
import { Request, Response } from "express";
import Offer from "../models/offer.model";
import User from "../models/user.model";
import Sale from "../models/sale.model";
import { createPagarMeService } from "../services/pagarme.service";
import { decrypt } from "../helper/encryption";
import { getCountryFromIP } from "../helper/getCountryFromIP";

/**
 * Cria um pedido PIX via Pagar.me
 * POST /payments/pagarme/pix
 */
export const createPixPayment = async (req: Request, res: Response) => {
  try {
    const {
      offerSlug,
      selectedOrderBumps = [],
      quantity = 1,
      contactInfo,
      addressInfo,
      metadata,
    } = req.body;

    // Validações básicas
    if (!offerSlug) {
      return res.status(400).json({ error: { message: "Slug da oferta não fornecido" } });
    }

    // Valida contactInfo
    if (!contactInfo) {
      return res.status(400).json({
        error: { message: "Dados do cliente não fornecidos" },
      });
    }

    if (!contactInfo.name || !contactInfo.email) {
      return res.status(400).json({
        error: { message: "Nome e email são obrigatórios" },
      });
    }

    // Busca a oferta
    const offer = await Offer.findOne({ slug: offerSlug }).populate("ownerId");
    if (!offer) {
      return res.status(404).json({ error: { message: "Oferta não encontrada" } });
    }

    // Verifica se o PIX da Pagar.me está ativo
    if (!offer.pagarme_pix_enabled) {
      return res.status(400).json({
        error: { message: "PIX da Pagar.me não está ativo para esta oferta" },
      });
    }

    // Busca o usuário dono da oferta com as credenciais
    const user = await User.findById(offer.ownerId).select("+pagarme_api_key +pagarme_encryption_key");
    if (!user) {
      return res.status(404).json({ error: { message: "Usuário não encontrado" } });
    }

    // Verifica se o usuário tem credenciais configuradas
    if (!user.pagarme_api_key || !user.pagarme_encryption_key) {
      return res.status(400).json({
        error: { message: "Credenciais da Pagar.me não configuradas para este vendedor" },
      });
    }

    // Desencripta as credenciais
    let apiKey: string;
    let encryptionKey: string;

    try {
      apiKey = decrypt(user.pagarme_api_key);
      encryptionKey = decrypt(user.pagarme_encryption_key);
    } catch (error) {
      console.error("[Pagar.me Controller] Erro ao desencriptar credenciais:", error);
      return res.status(500).json({
        error: { message: "Erro ao processar credenciais do vendedor" },
      });
    }

    // Calcula o valor total
    const mainProductPrice = offer.mainProduct.priceInCents * quantity;
    let orderBumpsTotal = 0;
    const items = [
      {
        name: offer.mainProduct.name,
        quantity: quantity,
        amount: offer.mainProduct.priceInCents,
      },
    ];

    // Adiciona order bumps se houver
    if (selectedOrderBumps && selectedOrderBumps.length > 0) {
      for (const bumpId of selectedOrderBumps) {
        const bump = offer.orderBumps.find((b) => b._id?.toString() === bumpId);
        if (bump) {
          orderBumpsTotal += bump.priceInCents;
          items.push({
            name: bump.name,
            quantity: 1,
            amount: bump.priceInCents,
          });
        }
      }
    }

    const totalAmount = mainProductPrice + orderBumpsTotal;
    const platformFee = Math.round(totalAmount * 0.05); // 5% de taxa da plataforma

    // Obtém o IP do cliente
    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress || "";
    const country = await getCountryFromIP(clientIp);

    // Cria o serviço Pagar.me
    const pagarmeService = createPagarMeService(apiKey, encryptionKey);

    // Limpa o telefone e documento (remove formatação)
    const cleanPhone = contactInfo.phone ? contactInfo.phone.replace(/\D/g, "") : "";
    const cleanDocument = contactInfo.document ? contactInfo.document.replace(/\D/g, "") : "00000000000";

    // Cria o pedido PIX
    const pixOrder = await pagarmeService.createPixOrder({
      amount: totalAmount,
      customerName: contactInfo.name,
      customerEmail: contactInfo.email,
      customerDocument: cleanDocument,
      customerPhone: cleanPhone,
      offerId: String(offer._id),
      userId: String(user._id),
      items: items,
      expirationMinutes: 30, // 30 minutos para expiração
    });

    // Cria o registro de venda com status pending
    const saleItems = items.map((item) => ({
      name: item.name,
      priceInCents: item.amount * item.quantity,
      isOrderBump: item.name !== offer.mainProduct.name,
      customId: metadata?.customId || "",
    }));

    const sale = await Sale.create({
      ownerId: user._id,
      offerId: offer._id,
      stripePaymentIntentId: `pagarme_${pixOrder.orderId}`, // Usa um prefixo para diferenciar
      pagarme_order_id: pixOrder.orderId,
      pagarme_transaction_id: pixOrder.transactionId,
      customerName: contactInfo.name,
      customerEmail: contactInfo.email,
      ip: clientIp,
      country: country,
      totalAmountInCents: totalAmount,
      platformFeeInCents: platformFee,
      currency: offer.currency || "brl",
      status: "pending",
      paymentMethod: "pagarme",
      gateway: "pagarme",
      isUpsell: false,
      items: saleItems,
    });

    console.log(`[Pagar.me Controller] Venda criada: saleId=${sale._id}, orderId=${pixOrder.orderId}`);

    // Retorna os dados do PIX para o frontend
    res.status(200).json({
      success: true,
      saleId: sale._id,
      orderId: pixOrder.orderId,
      qrCode: pixOrder.qrCode,
      qrCodeUrl: pixOrder.qrCodeUrl,
      expiresAt: pixOrder.expiresAt,
      amount: totalAmount,
      currency: offer.currency || "brl",
    });
  } catch (error: any) {
    console.error("[Pagar.me Controller] Erro ao criar pagamento PIX:", error);
    res.status(500).json({
      error: { message: error.message || "Erro ao processar pagamento PIX" },
    });
  }
};

/**
 * Consulta o status de um pedido PIX
 * GET /payments/pagarme/order/:orderId
 */
export const getOrderStatus = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ error: { message: "ID do pedido não fornecido" } });
    }

    // Busca a venda pelo orderId
    const sale = await Sale.findOne({ pagarme_order_id: orderId }).populate("ownerId");
    if (!sale) {
      return res.status(404).json({ error: { message: "Pedido não encontrado" } });
    }

    // Busca o usuário com as credenciais
    const user = await User.findById(sale.ownerId).select("+pagarme_api_key +pagarme_encryption_key");
    if (!user || !user.pagarme_api_key || !user.pagarme_encryption_key) {
      return res.status(400).json({
        error: { message: "Credenciais da Pagar.me não encontradas" },
      });
    }

    // Desencripta as credenciais
    const apiKey = decrypt(user.pagarme_api_key);
    const encryptionKey = decrypt(user.pagarme_encryption_key);

    // Cria o serviço e consulta o pedido
    const pagarmeService = createPagarMeService(apiKey, encryptionKey);
    const orderDetails = await pagarmeService.getOrderDetails(orderId);

    res.status(200).json({
      success: true,
      orderId: orderDetails.id,
      status: orderDetails.status,
      amount: orderDetails.amount,
      saleStatus: sale.status,
    });
  } catch (error: any) {
    console.error("[Pagar.me Controller] Erro ao consultar status:", error);
    res.status(500).json({
      error: { message: error.message || "Erro ao consultar status do pedido" },
    });
  }
};
