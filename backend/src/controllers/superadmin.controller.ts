import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import Sale from "../models/sale.model";
import User from "../models/user.model";
import Offer from "../models/offer.model";
import CheckoutMetric from "../models/checkout-metric.model";

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

export const getSuperAdminStats = async (_req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [revenueAgg, todayAccesses, usersCount] = await Promise.all([
      Sale.aggregate([
        { $match: { status: "succeeded" } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalAmountInCents" },
            totalPlatformFee: { $sum: "$platformFeeInCents" },
          },
        },
      ]),
      CheckoutMetric.countDocuments({ type: "view", createdAt: { $gte: today, $lt: tomorrow } }),
      User.countDocuments(),
    ]);

    return res.json({
      totalRevenue: revenueAgg[0]?.totalRevenue ?? 0,
      totalPlatformFee: revenueAgg[0]?.totalPlatformFee ?? 0,
      todayCheckoutAccesses: todayAccesses,
      usersCount,
    });
  } catch (err) {
    console.error("[SuperAdmin] getSuperAdminStats error:", err);
    return res.status(500).json({ error: "Erro interno." });
  }
};

export const getSuperAdminUsers = async (_req: Request, res: Response) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [users, offersByUser, allTimeSales, weeklySales] = await Promise.all([
      User.find().select("name email createdAt").lean(),
      Offer.aggregate([{ $group: { _id: "$ownerId", count: { $sum: 1 } } }]),
      Sale.aggregate([
        { $match: { status: "succeeded" } },
        { $group: { _id: "$ownerId", totalRevenue: { $sum: "$totalAmountInCents" } } },
      ]),
      Sale.aggregate([
        { $match: { status: "succeeded", createdAt: { $gte: sevenDaysAgo } } },
        { $group: { _id: "$ownerId", weeklyRevenue: { $sum: "$totalAmountInCents" } } },
      ]),
    ]);

    const offersMap = new Map(offersByUser.map((o) => [o._id.toString(), o.count as number]));
    const salesMap = new Map(allTimeSales.map((s) => [s._id.toString(), s.totalRevenue as number]));
    const weeklyMap = new Map(weeklySales.map((s) => [s._id.toString(), s.weeklyRevenue as number]));

    const result = users.map((user) => {
      const id = (user._id as { toString(): string }).toString();
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        createdAt: (user as unknown as { createdAt: Date }).createdAt,
        offersCount: offersMap.get(id) ?? 0,
        totalRevenue: salesMap.get(id) ?? 0,
        weeklyRevenue: weeklyMap.get(id) ?? 0,
      };
    });

    // Sort by total revenue desc
    result.sort((a, b) => b.totalRevenue - a.totalRevenue);

    return res.json(result);
  } catch (err) {
    console.error("[SuperAdmin] getSuperAdminUsers error:", err);
    return res.status(500).json({ error: "Erro interno." });
  }
};
