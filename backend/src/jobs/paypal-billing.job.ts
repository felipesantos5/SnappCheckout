import User from "../models/user.model";
import Sale from "../models/sale.model";
import PaypalBillingCycle from "../models/paypal-billing-cycle.model";
import mongoose from "mongoose";

const JOB_INTERVAL_MS = 60 * 60 * 1000; // 1 hora
const FEE_RATE = 0.03;

const processPaypalBilling = async (): Promise<void> => {
  try {
    const now = new Date();

    // Busca users com ciclo expirado e status ativo ou trial
    const users = await User.find({
      "paypalBilling.currentCycleEnd": { $lt: now },
      "paypalBilling.status": { $in: ["trial", "active"] },
      paypalClientId: { $exists: true, $ne: "" },
    });

    if (users.length === 0) return;

    for (const user of users) {
      try {
        const billing = user.paypalBilling;
        const cycleStart = billing.currentCycleStart!;
        const cycleEnd = billing.currentCycleEnd!;

        const result = await Sale.aggregate([
          {
            $match: {
              ownerId: new mongoose.Types.ObjectId((user._id as any).toString()),
              paymentMethod: "paypal",
              status: "succeeded",
              createdAt: { $gte: cycleStart, $lte: cycleEnd },
            },
          },
          { $group: { _id: null, total: { $sum: "$totalAmountInCents" } } },
        ]);

        const revenue = result[0]?.total || 0;
        const feeInCents = Math.round(revenue * FEE_RATE);

        if (revenue === 0) {
          // Auto-renova sem cobrança
          const newCycleStart = new Date();
          const newCycleEnd = new Date(newCycleStart.getTime() + 30 * 24 * 60 * 60 * 1000);

          await PaypalBillingCycle.create({
            userId: user._id,
            cycleStart,
            cycleEnd,
            totalPaypalRevenueInCents: 0,
            feeAmountInCents: 0,
            status: "waived",
            stripeSessionId: "",
            paidAt: null,
          });

          user.paypalBilling.status = "active";
          user.paypalBilling.currentCycleStart = newCycleStart;
          user.paypalBilling.currentCycleEnd = newCycleEnd;
          user.paypalBilling.pendingFeeInCents = 0;
          await user.save();
        } else {
          // Bloqueia e registra taxa pendente
          user.paypalBilling.status = "blocked";
          user.paypalBilling.pendingFeeInCents = feeInCents;
          await user.save();
        }
      } catch (error: any) {
        console.error(`[PaypalBillingJob] Erro ao processar user ${user._id}:`, error.message);
      }
    }

    // Migração: users com paypalClientId mas sem trialStartDate
    await User.updateMany(
      {
        paypalClientId: { $exists: true, $ne: "" },
        "paypalBilling.trialStartDate": null,
      },
      {
        $set: {
          "paypalBilling.trialStartDate": now,
          "paypalBilling.status": "trial",
          "paypalBilling.currentCycleStart": now,
          "paypalBilling.currentCycleEnd": new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      }
    );
  } catch (error: any) {
    console.error("[PaypalBillingJob] Erro no ciclo:", error.message);
  }
};

let jobInterval: ReturnType<typeof setInterval> | null = null;

export const startPaypalBillingJob = (): void => {
  processPaypalBilling().catch((err) => {
    console.error("[PaypalBillingJob] Erro na execução inicial:", err.message);
  });

  jobInterval = setInterval(() => {
    processPaypalBilling().catch((err) => {
      console.error("[PaypalBillingJob] Erro no ciclo:", err.message);
    });
  }, JOB_INTERVAL_MS);
};

export const stopPaypalBillingJob = (): void => {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
  }
};
