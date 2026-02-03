/**
 * Health Check Controller
 *
 * Endpoint para monitoramento de saúde do sistema
 * Especialmente focado em validar que pagamentos podem ser processados
 */

import { Request, Response } from "express";
import mongoose from "mongoose";
import stripe from "../lib/stripe";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  checks: {
    database: {
      status: "up" | "down";
      responseTime?: number;
      error?: string;
    };
    stripe: {
      status: "up" | "down";
      responseTime?: number;
      error?: string;
    };
    payments: {
      status: "operational" | "degraded" | "down";
      canProcessPayments: boolean;
    };
  };
  uptime: number;
}

export const handleHealthCheck = async (req: Request, res: Response) => {
  const startTime = Date.now();
  const health: HealthStatus = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: "up" },
      stripe: { status: "up" },
      payments: { status: "operational", canProcessPayments: true },
    },
    uptime: process.uptime(),
  };

  // 1. Verifica MongoDB
  const dbStart = Date.now();
  try {
    await mongoose.connection.db?.admin().ping();
    health.checks.database.status = "up";
    health.checks.database.responseTime = Date.now() - dbStart;
  } catch (error: any) {
    health.checks.database.status = "down";
    health.checks.database.error = error.message;
    health.status = "unhealthy";
    health.checks.payments.canProcessPayments = false;
  }

  // 2. Verifica Stripe API
  const stripeStart = Date.now();
  try {
    // Tenta listar balance (operação leve que valida a API key)
    await stripe.balance.retrieve();
    health.checks.stripe.status = "up";
    health.checks.stripe.responseTime = Date.now() - stripeStart;
  } catch (error: any) {
    health.checks.stripe.status = "down";
    health.checks.stripe.error = error.message;
    health.status = health.status === "unhealthy" ? "unhealthy" : "degraded";
    health.checks.payments.canProcessPayments = false;
  }

  // 3. Avalia status de pagamentos
  if (!health.checks.payments.canProcessPayments) {
    health.checks.payments.status = "down";
  } else if (
    health.checks.database.responseTime! > 1000 ||
    health.checks.stripe.responseTime! > 2000
  ) {
    health.checks.payments.status = "degraded";
    health.status = "degraded";
  }

  // IMPORTANTE: Para auto-heal funcionar, degraded também deve retornar erro
  // healthy = 200, degraded = 503, unhealthy = 503
  const statusCode = health.status === "healthy" ? 200 : 503;

  res.status(statusCode).json(health);
};

/**
 * Endpoint simplificado apenas para validar se o sistema consegue processar pagamentos
 */
export const handlePaymentReadiness = async (req: Request, res: Response) => {
  try {
    // Verifica requisitos mínimos para processar pagamentos
    const isDbConnected = mongoose.connection.readyState === 1;

    let isStripeOk = false;
    try {
      await stripe.balance.retrieve();
      isStripeOk = true;
    } catch {
      isStripeOk = false;
    }

    const canProcessPayments = isDbConnected && isStripeOk;

    if (canProcessPayments) {
      res.status(200).json({
        ready: true,
        message: "Sistema pronto para processar pagamentos",
      });
    } else {
      res.status(503).json({
        ready: false,
        message: "Sistema não pode processar pagamentos no momento",
        issues: {
          database: !isDbConnected,
          stripe: !isStripeOk,
        },
      });
    }
  } catch (error: any) {
    res.status(503).json({
      ready: false,
      message: error.message,
    });
  }
};
