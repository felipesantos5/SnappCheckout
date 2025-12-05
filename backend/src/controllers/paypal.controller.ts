import { Request, Response } from "express";
import * as paypalService from "../services/paypal.service";
import Sale from "../models/sale.model";
import Offer from "../models/offer.model";
import User from "../models/user.model";

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
    res.status(500).json({ error: error.message });
  }
};

export const captureOrder = async (req: Request, res: Response) => {
  try {
    const { orderId, offerId, customerData } = req.body;

    if (!offerId) {
      return res.status(400).json({ error: "offerId é obrigatório." });
    }

    // Buscar a oferta para pegar o ownerId
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
      // SALVAR A VENDA NO BANCO DE DADOS AQUI
      // Adapte o Sale.create para aceitar 'paypal' como provider
      /*
      const newSale = new Sale({
         stripePaymentIntentId: `PAYPAL_${captureData.id}`, // Adaptação técnica
         status: "succeeded",
         ...outrosDados
      });
      await newSale.save();
      */

      res.json({ success: true, data: captureData });
    } else {
      res.status(400).json({ success: false, message: "Pagamento não concluído" });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
