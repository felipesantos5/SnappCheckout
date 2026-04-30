import AbandonedCart from "../models/abandoned-cart.model";
import Offer from "../models/offer.model";
import { sendCartAbandonmentEmail } from "../services/email.service";

const JOB_INTERVAL_MS = 60 * 60 * 1000;  // roda a cada 1 hora
const REMINDER_1_DELAY_MS = 30 * 60 * 1000; // 1º lembrete: 30 min após abandono
const REMINDER_2_DELAY_MS = 60 * 60 * 1000; // 2º lembrete: 1 hora após abandono

let jobInterval: ReturnType<typeof setInterval> | null = null;

// ──────────────────────────────────────────────────────────────
// ONDA 1 — 30 minutos após abandono
// ──────────────────────────────────────────────────────────────
async function processReminder1(): Promise<void> {
  const cutoff = new Date(Date.now() - REMINDER_1_DELAY_MS);

  const carts = await AbandonedCart.find({
    reminder1SentAt: null,
    convertedAt: null,
    createdAt: { $lte: cutoff },
  }).lean();

  if (carts.length === 0) return;

  for (const cart of carts) {
    const tag = `[Cart Abandonment][Wave 1][${cart._id}]`;
    try {
      const offer = await Offer.findOne({
        _id: cart.offerId,
        cartAbandonmentEnabled: true,
      })
        .select("name mainProduct currency language slug")
        .lean();

      if (!offer) continue;

      const baseUrl = (process.env.CHECKOUT_BASE_URL || "").replace(/\/$/, "");
      const checkoutUrl = `${baseUrl}/c/${offer.slug}`;

      await sendCartAbandonmentEmail({
        to: cart.customerEmail,
        customerName: cart.customerName || "",
        offerName: offer.name,
        productName: offer.mainProduct.name,
        priceInCents: offer.mainProduct.priceInCents,
        currency: offer.currency || "BRL",
        language: cart.visitorLanguage || offer.language || "pt",
        checkoutUrl,
        ownerId: cart.ownerId.toString(),
        offerId: cart.offerId.toString(),
      });

      const now = new Date();
      await AbandonedCart.updateOne(
        { _id: cart._id },
        { reminder1SentAt: now, emailSent: true, emailSentAt: now }
      );
    } catch (err: any) {
      console.error(`${tag} Erro ao enviar 1º lembrete para ${cart.customerEmail}: ${err.message}`);
    }
  }
}

// ──────────────────────────────────────────────────────────────
// ONDA 2 — 1 hora após abandono (somente quem recebeu a onda 1)
// ──────────────────────────────────────────────────────────────
async function processReminder2(): Promise<void> {
  const cutoff = new Date(Date.now() - REMINDER_2_DELAY_MS);

  const carts = await AbandonedCart.find({
    reminder1SentAt: { $ne: null },
    reminder2SentAt: null,
    convertedAt: null,
    createdAt: { $lte: cutoff },
  }).lean();

  if (carts.length === 0) return;

  for (const cart of carts) {
    const tag = `[Cart Abandonment][Wave 2][${cart._id}]`;
    try {
      const offer = await Offer.findOne({
        _id: cart.offerId,
        cartAbandonmentEnabled: true,
      })
        .select("name mainProduct currency language slug")
        .lean();

      if (!offer) continue;

      const baseUrl = (process.env.CHECKOUT_BASE_URL || "").replace(/\/$/, "");
      const checkoutUrl = `${baseUrl}/c/${offer.slug}`;

      await sendCartAbandonmentEmail({
        to: cart.customerEmail,
        customerName: cart.customerName || "",
        offerName: offer.name,
        productName: offer.mainProduct.name,
        priceInCents: offer.mainProduct.priceInCents,
        currency: offer.currency || "BRL",
        language: offer.language || "pt",
        checkoutUrl,
        ownerId: cart.ownerId.toString(),
        offerId: cart.offerId.toString(),
      });

      await AbandonedCart.updateOne(
        { _id: cart._id },
        { reminder2SentAt: new Date() }
      );
    } catch (err: any) {
      console.error(`${tag} Erro ao enviar 2º lembrete para ${cart.customerEmail}: ${err.message}`);
    }
  }
}

async function processAbandonedCarts(): Promise<void> {
  await processReminder1();
  await processReminder2();
}

export const startCartAbandonmentJob = (): void => {
  processAbandonedCarts().catch((err) => {
    console.error(`[Cart Abandonment] Erro no processamento inicial: ${err.message}`);
  });

  jobInterval = setInterval(() => {
    processAbandonedCarts().catch((err) => {
      console.error(`[Cart Abandonment] Erro no ciclo: ${err.message}`);
    });
  }, JOB_INTERVAL_MS);
};

export const stopCartAbandonmentJob = (): void => {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
  }
};
