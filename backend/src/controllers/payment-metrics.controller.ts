/**
 * Payment Metrics Controller
 * Retorna métricas agregadas por plataforma de pagamento (Stripe e PayPal)
 */

import { Request, Response } from "express";
import Sale from "../models/sale.model";
import User from "../models/user.model";
import mongoose from "mongoose";
import { convertToBRL } from "../services/currency-conversion.service";
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
    
    const isHourly = daysDiff <= 1.1; // Menos de 26 horas
    const isMonthly = daysDiff > 120; // Mais de 4 meses agrupa por mês para não quebrar o gráfico

    // Buscar todas as vendas aprovadas do usuário no período
    const sales = await Sale.find({
      ownerId: new mongoose.Types.ObjectId(ownerId),
      status: "succeeded",
      createdAt: { $gte: startDate, $lte: endDate },
    }).lean();

    // Agregar por plataforma
    const stripeMetrics: PaymentPlatformMetrics = {
      totalSales: 0,
      totalRevenue: 0,
      totalFees: 0,
    };

    const paypalMetrics: PaymentPlatformMetrics = {
      totalSales: 0,
      totalRevenue: 0,
      totalFees: 0,
    };

    const pagarmeMetrics: PaymentPlatformMetrics = {
      totalSales: 0,
      totalRevenue: 0,
      totalFees: 0,
    };

    // Mapa para dados do gráfico
    const chartMap = new Map<string, { stripe: number; paypal: number; pagarme: number; label: string }>();

    // Função auxiliar para gerar chave e label
    const formatKeyAndLabel = (dateInput: Date | string) => {
      const date = new Date(dateInput);
      if (isHourly) {
        const key = date.toISOString().slice(0, 13); // YYYY-MM-DDTHH
        const label = date.toLocaleTimeString("pt-BR", { 
          timeZone: "America/Sao_Paulo", 
          hour: "2-digit", 
          minute: "2-digit" 
        });
        return { key, label };
      } else if (isMonthly) {
        const brDate = new Date(date.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
        const year = brDate.getFullYear();
        const month = (brDate.getMonth() + 1).toString().padStart(2, "0");
        const key = `${year}-${month}`;
        const label = `${month}/${year}`;
        return { key, label };
      } else {
        const brDate = new Date(date.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
        const key = brDate.toISOString().split("T")[0];
        const day = brDate.getDate().toString().padStart(2, "0");
        const month = (brDate.getMonth() + 1).toString().padStart(2, "0");
        const label = `${day}/${month}`;
        return { key, label };
      }
    };

    // Inicializar chartMap com todas as datas do período
    let current = new Date(startDate);
    if (sales.length > 0 && new Date(sales[0].createdAt) > current) {
      current = new Date(sales[0].createdAt);
    }

    // Ajustar 'current' para o início do período (hora/dia/mês)
    if (isHourly) {
      current.setMinutes(0, 0, 0);
    } else if (!isMonthly) { // Diário
      current.setHours(0, 0, 0, 0);
    } else { // Mensal
      current.setDate(1);
      current.setHours(0, 0, 0, 0);
    }

    while (current <= endDate) {
      const { key, label } = formatKeyAndLabel(current);
      if (!chartMap.has(key)) {
        chartMap.set(key, { stripe: 0, paypal: 0, pagarme: 0, label });
      }

      // Incrementar 'current' com base na granularidade
      if (isHourly) {
        current.setHours(current.getHours() + 1);
      } else if (isMonthly) {
        current.setMonth(current.getMonth() + 1);
      } else {
        current.setDate(current.getDate() + 1);
      }
    }

    // Processar cada venda
    await Promise.all(
      sales.map(async (sale) => {
        const revenueInBRL = await convertToBRL(sale.totalAmountInCents, sale.currency || "BRL");
        const feesInBRL = await convertToBRL(sale.platformFeeInCents || 0, sale.currency || "BRL");
        const { key } = formatKeyAndLabel(sale.createdAt);

        if (sale.paymentMethod === "paypal") {
          paypalMetrics.totalSales += 1;
          paypalMetrics.totalRevenue += revenueInBRL;
          paypalMetrics.totalFees += feesInBRL;

          // Adicionar ao gráfico
          if (chartMap.has(key)) {
            chartMap.get(key)!.paypal += revenueInBRL / 100; // Converter para reais
          }
        } else if (sale.paymentMethod === "pagarme") {
          pagarmeMetrics.totalSales += 1;
          pagarmeMetrics.totalRevenue += revenueInBRL;
          pagarmeMetrics.totalFees += feesInBRL;

          // Adicionar ao gráfico
          if (chartMap.has(key)) {
            chartMap.get(key)!.pagarme += revenueInBRL / 100; // Converter para reais
          }
        } else {
          // Default: stripe
          stripeMetrics.totalSales += 1;
          stripeMetrics.totalRevenue += revenueInBRL;
          stripeMetrics.totalFees += feesInBRL;

          // Adicionar ao gráfico
          if (chartMap.has(key)) {
            chartMap.get(key)!.stripe += revenueInBRL / 100; // Converter para reais
          }
        }
      })
    );

    // Converter mapa para array ordenado
    const sortedKeys = Array.from(chartMap.keys()).sort();
    const chartData: ChartDataPoint[] = sortedKeys.map((key) => {
      const data = chartMap.get(key)!;
      return {
        date: data.label,
        stripe: Math.round(data.stripe * 100) / 100, // Arredondar para 2 casas
        paypal: Math.round(data.paypal * 100) / 100,
        pagarme: Math.round(data.pagarme * 100) / 100,
      };
    });

    // Buscar saldo do Stripe
    let stripePending = 0;
    let stripeAvailable = 0;

    try {
      const user = await User.findById(ownerId);
      if (user?.stripeAccountId) {
        const balance = await stripe.balance.retrieve({
          stripeAccount: user.stripeAccountId,
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
