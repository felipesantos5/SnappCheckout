import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import Sale from "../models/sale.model";
import User from "../models/user.model";
import Offer from "../models/offer.model";
import CheckoutMetric from "../models/checkout-metric.model";
import { getExchangeRates } from "../services/currency-conversion.service";

const JWT_SECRET = process.env.JWT_SECRET!;

export const superAdminLogin = async (req: Request, res: Response) => {
  const { password } = req.body;
  const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;

  if (!SUPER_ADMIN_PASSWORD || !password || password !== SUPER_ADMIN_PASSWORD) {
    // Deliberate delay to slow brute force attempts
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return res.status(401).json({ error: "Senha incorreta." });
  }

  const token = jwt.sign({ role: "superadmin" }, JWT_SECRET, { expiresIn: "8h" });
  return res.json({ token });
};

// Builds a MongoDB $switch expression that multiplies amountExpr by the BRL rate for each currency
function buildBRLConvertExpr(amountExpr: string, rates: Record<string, number>) {
  return {
    $multiply: [
      amountExpr,
      {
        $switch: {
          branches: Object.entries(rates)
            .filter(([cur]) => cur !== "BRL")
            .map(([cur, rate]) => ({
              case: { $eq: [{ $toUpper: "$currency" }, cur] },
              then: rate,
            })),
          default: 1.0,
        },
      },
    ],
  };
}

function buildDateMatch(startDate?: string, endDate?: string): Record<string, unknown> {
  const match: Record<string, unknown> = { status: "succeeded" };
  if (startDate || endDate) {
    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);
    match.createdAt = dateFilter;
  }
  return match;
}

export const getSuperAdminStats = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const revenueMatch = buildDateMatch(startDate, endDate);
    const rates = await getExchangeRates();

    const [revenueAgg, todayAccesses, usersCount] = await Promise.all([
      Sale.aggregate([
        { $match: revenueMatch },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: buildBRLConvertExpr("$totalAmountInCents", rates) },
            totalPlatformFee: { $sum: buildBRLConvertExpr("$platformFeeInCents", rates) },
          },
        },
      ]),
      CheckoutMetric.countDocuments({ type: "view", createdAt: { $gte: today, $lt: tomorrow } }),
      User.countDocuments(),
    ]);

    return res.json({
      totalRevenue: Math.round(revenueAgg[0]?.totalRevenue ?? 0),
      totalPlatformFee: Math.round(revenueAgg[0]?.totalPlatformFee ?? 0),
      todayCheckoutAccesses: todayAccesses,
      usersCount,
    });
  } catch (err) {
    console.error("[SuperAdmin] getSuperAdminStats error:", err);
    return res.status(500).json({ error: "Erro interno." });
  }
};

export const getSuperAdminUsers = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const periodMatch = buildDateMatch(startDate, endDate);
    const rates = await getExchangeRates();

    const [users, offersByUser, periodSales] = await Promise.all([
      User.find().select("name email createdAt platformFeePercent").lean(),
      Offer.aggregate([{ $group: { _id: "$ownerId", count: { $sum: 1 } } }]),
      Sale.aggregate([
        { $match: periodMatch },
        {
          $group: {
            _id: "$ownerId",
            totalRevenue: { $sum: buildBRLConvertExpr("$totalAmountInCents", rates) },
          },
        },
      ]),
    ]);

    const offersMap = new Map(offersByUser.map((o) => [o._id.toString(), o.count as number]));
    const salesMap = new Map(periodSales.map((s) => [s._id.toString(), Math.round(s.totalRevenue as number)]));

    const result = users.map((user) => {
      const id = (user._id as { toString(): string }).toString();
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        createdAt: (user as unknown as { createdAt: Date }).createdAt,
        platformFeePercent: (user as any).platformFeePercent ?? 3,
        offersCount: offersMap.get(id) ?? 0,
        totalRevenue: salesMap.get(id) ?? 0,
      };
    });

    result.sort((a, b) => b.totalRevenue - a.totalRevenue);

    return res.json(result);
  } catch (err) {
    console.error("[SuperAdmin] getSuperAdminUsers error:", err);
    return res.status(500).json({ error: "Erro interno." });
  }
};

export const updateUserFee = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { platformFeePercent } = req.body;

    if (platformFeePercent == null || platformFeePercent < 0 || platformFeePercent > 100) {
      return res.status(400).json({ error: "platformFeePercent deve ser entre 0 e 100." });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { platformFeePercent },
      { new: true }
    ).select("name email platformFeePercent");

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    return res.json({ _id: user._id, name: user.name, email: user.email, platformFeePercent: user.platformFeePercent });
  } catch (err) {
    console.error("[SuperAdmin] updateUserFee error:", err);
    return res.status(500).json({ error: "Erro interno." });
  }
};
