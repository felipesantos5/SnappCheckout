import AbandonedCart from "../models/abandoned-cart.model";
import Offer from "../models/offer.model";
import { sendCartAbandonmentEmail } from "../services/email.service";

const JOB_INTERVAL_MS = 15 * 60 * 1000; // roda a cada 15 minutos
const ABANDONMENT_DELAY_MS = 30 * 60 * 1000; // dispara 30 min após o abandono

let jobInterval: ReturnType<typeof setInterval> | null = null;

async function processAbandonedCarts(): Promise<void> {
  const cutoff = new Date(Date.now() - ABANDONMENT_DELAY_MS);

  const carts = await AbandonedCart.find({
    emailSent: false,
    convertedAt: null,
    createdAt: { $lte: cutoff },
  }).lean();

  if (carts.length === 0) return;

  for (const cart of carts) {
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
        { emailSent: true, emailSentAt: new Date() }
      );
    } catch (err: any) {
      console.error(`[Cart Abandonment] Erro ao processar ${cart._id}: ${err.message}`);
    }
  }
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
