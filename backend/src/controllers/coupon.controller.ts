import { Request, Response } from "express";
import Offer from "../models/offer.model";

export const validateCoupon = async (req: Request, res: Response) => {
  try {
    const { offerSlug, code } = req.body;

    if (!offerSlug || !code) {
      return res.status(400).json({ valid: false, message: "Dados insuficientes." });
    }

    const offer = await Offer.findOne({ slug: offerSlug });
    if (!offer) {
      return res.status(404).json({ valid: false, message: "Oferta nao encontrada." });
    }

    if (!offer.coupons?.enabled || !offer.coupons.codes.length) {
      return res.status(200).json({ valid: false, message: "Cupons nao disponiveis para esta oferta." });
    }

    const match = offer.coupons.codes.find(
      (c) => c.code.toLowerCase() === String(code).trim().toLowerCase()
    );

    if (!match) {
      return res.status(200).json({ valid: false, message: "Cupom invalido." });
    }

    const basePrice = offer.mainProduct.priceInCents;
    const discountAmountInCents = Math.floor(basePrice * (match.discountPercent / 100));

    return res.status(200).json({
      valid: true,
      discountPercent: match.discountPercent,
      discountAmountInCents,
    });
  } catch (error: any) {
    return res.status(500).json({ valid: false, message: error.message });
  }
};
