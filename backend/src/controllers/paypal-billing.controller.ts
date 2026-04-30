import { Request, Response } from "express";
import Stripe from "stripe";
import User from "../models/user.model";
import Sale from "../models/sale.model";
import PaypalBillingCycle from "../models/paypal-billing-cycle.model";
import mongoose from "mongoose";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-04-10" as any });
const ADMIN_URL = process.env.ADMIN_URL || "http://admin.snappcheckout.com";
const FEE_RATE = 0.03;

async function calcPaypalRevenue(userId: string, cycleStart: Date, cycleEnd: Date): Promise<number> {
  const result = await Sale.aggregate([
    {
      $match: {
        ownerId: new mongoose.Types.ObjectId(userId),
        paymentMethod: "paypal",
        status: "succeeded",
        createdAt: { $gte: cycleStart, $lte: cycleEnd },
      },
    },
    { $group: { _id: null, total: { $sum: "$totalAmountInCents" } } },
  ]);
  return result[0]?.total || 0;
}

export const getBillingStatus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado." });

    const billing = user.paypalBilling;

    // Se ciclo expirou e ainda não está bloqueado, calcula fee em tempo real
    let pendingFeeInCents = billing.pendingFeeInCents;
    const now = new Date();

    if (billing.currentCycleEnd && billing.currentCycleEnd < now && billing.status !== "blocked") {
      if (billing.currentCycleStart && billing.currentCycleEnd) {
        const revenue = await calcPaypalRevenue(userId, billing.currentCycleStart, billing.currentCycleEnd);
        pendingFeeInCents = Math.round(revenue * FEE_RATE);
      }
    }

    return res.json({
      status: billing.status,
      trialStartDate: billing.trialStartDate,
      currentCycleStart: billing.currentCycleStart,
      currentCycleEnd: billing.currentCycleEnd,
      lastPaymentDate: billing.lastPaymentDate,
      lastChargeAmountInCents: billing.lastChargeAmountInCents,
      pendingFeeInCents,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const initiatePayment = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado." });

    const billing = user.paypalBilling;
    if (!billing.currentCycleStart || !billing.currentCycleEnd) {
      return res.status(400).json({ error: "Nenhum ciclo ativo encontrado." });
    }

    const revenue = await calcPaypalRevenue(userId, billing.currentCycleStart, billing.currentCycleEnd);
    const feeInCents = Math.round(revenue * FEE_RATE);

    if (feeInCents < 50) {
      return res.status(400).json({ error: "Valor mínimo para cobrança não atingido." });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "brl",
            unit_amount: feeInCents,
            product_data: { name: "Taxa PayPal - 3%" },
          },
          quantity: 1,
        },
      ],
      success_url: `${ADMIN_URL}/settings?paypal_billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${ADMIN_URL}/settings?paypal_billing=cancelled`,
      metadata: {
        userId,
        cycleStart: billing.currentCycleStart.toISOString(),
        cycleEnd: billing.currentCycleEnd.toISOString(),
      },
      customer_email: user.email,
    });

    return res.json({ checkoutUrl: session.url });
  } catch (error: any) {
    console.error("[PaypalBilling] Erro ao criar sessão de pagamento:", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const confirmPayment = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { session_id } = req.body;

    if (!session_id) return res.status(400).json({ error: "session_id é obrigatório." });

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      return res.status(400).json({ error: "Pagamento ainda não confirmado." });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado." });

    const billing = user.paypalBilling;
    const cycleStart = billing.currentCycleStart!;
    const cycleEnd = billing.currentCycleEnd!;

    const revenue = await calcPaypalRevenue(userId, cycleStart, cycleEnd);
    const feeInCents = Math.round(revenue * FEE_RATE);

    // Cria registro do ciclo
    await PaypalBillingCycle.create({
      userId,
      cycleStart,
      cycleEnd,
      totalPaypalRevenueInCents: revenue,
      feeAmountInCents: feeInCents,
      status: "paid",
      stripeSessionId: session_id,
      paidAt: new Date(),
    });

    // Atualiza usuário: novo ciclo de 30 dias
    const newCycleStart = new Date();
    const newCycleEnd = new Date(newCycleStart.getTime() + 30 * 24 * 60 * 60 * 1000);

    user.paypalBilling.status = "active";
    user.paypalBilling.currentCycleStart = newCycleStart;
    user.paypalBilling.currentCycleEnd = newCycleEnd;
    user.paypalBilling.lastPaymentDate = new Date();
    user.paypalBilling.lastChargeAmountInCents = feeInCents;
    user.paypalBilling.pendingFeeInCents = 0;

    await user.save();

    return res.json({ message: "Pagamento confirmado. Novo ciclo iniciado." });
  } catch (error: any) {
    console.error("[PaypalBilling] Erro ao confirmar pagamento:", error.message);
    res.status(500).json({ error: error.message });
  }
};
