/**
 * Payment Metrics Controller
 * Retorna métricas agregadas por plataforma de pagamento (Stripe e PayPal)
 * Otimizado: Usa MongoDB aggregation + convertToBRLSync (sem await em loops)
 */

import { Request, Response } from "express";
import Sale from "../models/sale.model";
import User from "../models/user.model";
import mongoose from "mongoose";
import { convertToBRLSync } from "../services/currency-conversion.service";
import stripe from "../lib/stripe";

interface PaymentPlatformMetrics {
  totalSales: number;
  totalRevenue: number; // em centavos BRL
  totalFees: number; // em centavos BRL
}

interface ChartDataPoint {
  date: string;
  stripe: number;
  paypal: number;
  pagarme: number;
}

interface PaymentMetricsResponse {
  stripe: PaymentPlatformMetrics & {
    pending: number; // saldo pendente (centavos)
    available: number; // saldo disponível (centavos)
  };
  paypal: PaymentPlatformMetrics;
  pagarme: PaymentPlatformMetrics;
  chart: ChartDataPoint[];
  period: {
    startDate: string;
    endDate: string;
  };
}

export const handleGetPaymentMetrics = async (req: Request, res: Response) => {
  try {
    const ownerId = req.userId!;

    // Parâmetros de filtro
    const startDateParam = req.query.startDate as string | undefined;
    const endDateParam = req.query.endDate as string | undefined;
    const daysParam = req.query.days ? parseInt(req.query.days as string) : 30;

    let startDate: Date;
    let endDate: Date;

    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
    } else {
      endDate = new Date();
      startDate = new Date();
      if (daysParam === 1) {
        startDate.setHours(0, 0, 0, 0);
      } else {
        startDate.setDate(startDate.getDate() - daysParam);
        startDate.setHours(0, 0, 0, 0);
      }
    }

    // Determinar granularidade
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const isHourly = daysDiff <= 1.1;
    const isMonthly = daysDiff > 120;

    // Formato de agrupamento para MongoDB
    let dateFormat: string;
    if (isHourly) {
      dateFormat = "%Y-%m-%dT%H";
    } else if (isMonthly) {
      dateFormat = "%Y-%m";
    } else {
      dateFormat = "%Y-%m-%d";
    }

    const baseMatch = {
      ownerId: new mongoose.Types.ObjectId(ownerId),
      status: "succeeded",
      createdAt: { $gte: startDate, $lte: endDate },
    };

    // Todas as aggregations em paralelo
    const [platformAgg, chartAgg, user] = await Promise.all([
      // Métricas por plataforma + moeda
      Sale.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: {
              gateway: { $ifNull: ["$paymentMethod", "stripe"] },
              currency: "$currency",
            },
            totalRevenue: { $sum: "$totalAmountInCents" },
            totalFees: { $sum: { $ifNull: ["$platformFeeInCents", 0] } },
            count: { $sum: 1 },
          },
        },
      ]),

      // Dados do gráfico por data + gateway + moeda
      Sale.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: dateFormat, date: "$createdAt", timezone: "America/Sao_Paulo" } },
              gateway: { $ifNull: ["$paymentMethod", "stripe"] },
              currency: "$currency",
            },
            revenue: { $sum: "$totalAmountInCents" },
          },
        },
        { $sort: { "_id.date": 1 } },
      ]),

      // Busca user para saldo Stripe
      User.findById(ownerId).lean(),
    ]);

    // Processar métricas por plataforma (síncrono)
    const stripeMetrics: PaymentPlatformMetrics = { totalSales: 0, totalRevenue: 0, totalFees: 0 };
    const paypalMetrics: PaymentPlatformMetrics = { totalSales: 0, totalRevenue: 0, totalFees: 0 };
    const pagarmeMetrics: PaymentPlatformMetrics = { totalSales: 0, totalRevenue: 0, totalFees: 0 };

    for (const entry of platformAgg) {
      const currency = entry._id.currency || "BRL";
      const revenueBRL = convertToBRLSync(entry.totalRevenue, currency);
      const feesBRL = convertToBRLSync(entry.totalFees, currency);

      const target = entry._id.gateway === "paypal" ? paypalMetrics
        : entry._id.gateway === "pagarme" ? pagarmeMetrics
        : stripeMetrics;

      target.totalSales += entry.count;
      target.totalRevenue += revenueBRL;
      target.totalFees += feesBRL;
    }

    // Processar gráfico
    const formatKeyAndLabel = (dateKey: string) => {
      if (isHourly) {
        const date = new Date(dateKey + ":00:00");
        const label = date.toLocaleTimeString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          hour: "2-digit",
          minute: "2-digit"
        });
        return { key: dateKey, label };
      } else if (isMonthly) {
        const [year, month] = dateKey.split("-");
        return { key: dateKey, label: `${month}/${year}` };
      } else {
        const parts = dateKey.split("-");
        return { key: dateKey, label: `${parts[2]}/${parts[1]}` };
      }
    };

    // Inicializar chartMap com todas as datas do período
    const chartMap = new Map<string, { stripe: number; paypal: number; pagarme: number; label: string }>();

    let currentDate = new Date(startDate);
    if (isHourly) currentDate.setMinutes(0, 0, 0);
    else if (isMonthly) { currentDate.setDate(1); currentDate.setHours(0, 0, 0, 0); }
    else currentDate.setHours(0, 0, 0, 0);

    while (currentDate <= endDate) {
      const brDate = new Date(currentDate.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      let key: string;
      let label: string;

      if (isHourly) {
        const y = brDate.getFullYear();
        const m = (brDate.getMonth() + 1).toString().padStart(2, "0");
        const d = brDate.getDate().toString().padStart(2, "0");
        const h = brDate.getHours().toString().padStart(2, "0");
        key = `${y}-${m}-${d}T${h}`;
        const fkl = formatKeyAndLabel(key);
        label = fkl.label;
      } else if (isMonthly) {
        const y = brDate.getFullYear();
        const m = (brDate.getMonth() + 1).toString().padStart(2, "0");
        key = `${y}-${m}`;
        label = `${m}/${y}`;
      } else {
        const y = brDate.getFullYear();
        const m = (brDate.getMonth() + 1).toString().padStart(2, "0");
        const d = brDate.getDate().toString().padStart(2, "0");
        key = `${y}-${m}-${d}`;
        label = `${d}/${m}`;
      }

      if (!chartMap.has(key)) {
        chartMap.set(key, { stripe: 0, paypal: 0, pagarme: 0, label });
      }

      if (isHourly) currentDate.setHours(currentDate.getHours() + 1);
      else if (isMonthly) currentDate.setMonth(currentDate.getMonth() + 1);
      else currentDate.setDate(currentDate.getDate() + 1);
    }

    // Preencher com dados reais
    for (const entry of chartAgg) {
      const key = entry._id.date;
      if (chartMap.has(key)) {
        const data = chartMap.get(key)!;
        const amountBRL = convertToBRLSync(entry.revenue, entry._id.currency || "BRL") / 100;
        const gateway = entry._id.gateway || "stripe";
        if (gateway === "paypal") data.paypal += amountBRL;
        else if (gateway === "pagarme") data.pagarme += amountBRL;
        else data.stripe += amountBRL;
      }
    }

    // Converter para array ordenado
    const sortedKeys = Array.from(chartMap.keys()).sort();
    const chartData: ChartDataPoint[] = sortedKeys.map((key) => {
      const data = chartMap.get(key)!;
      return {
        date: data.label,
        stripe: Math.round(data.stripe * 100) / 100,
        paypal: Math.round(data.paypal * 100) / 100,
        pagarme: Math.round(data.pagarme * 100) / 100,
      };
    });

    // Buscar saldo do Stripe
    let stripePending = 0;
    let stripeAvailable = 0;

    try {
      if (user && (user as any).stripeAccountId) {
        const balance = await stripe.balance.retrieve({
          stripeAccount: (user as any).stripeAccountId,
        });

        if (balance.pending && balance.pending.length > 0) {
          stripePending = balance.pending[0].amount;
        }
        if (balance.available && balance.available.length > 0) {
          stripeAvailable = balance.available[0].amount;
        }
      }
    } catch (stripeError) {
      console.error("Erro ao buscar saldo Stripe:", stripeError);
    }

    const response: PaymentMetricsResponse = {
      stripe: {
        ...stripeMetrics,
        pending: stripePending,
        available: stripeAvailable,
      },
      paypal: paypalMetrics,
      pagarme: pagarmeMetrics,
      chart: chartData,
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Erro ao buscar métricas de pagamento:", error);
    res.status(500).json({ error: { message: (error as Error).message } });
  }
};
