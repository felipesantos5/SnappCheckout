import { Stripe } from "stripe";
import { IOffer } from "../models/offer.model";
import { ISale } from "../models/sale.model";
import User from "../models/user.model";
import { sendPurchaseConfirmationEmail } from "./email.service";
import { sendAccessWebhook, sendGenericWebhook } from "./integration.service";
import { processUtmfyIntegration } from "./utmfy.service";

type SaleIntegrationItem = {
  _id?: string;
  name: string;
  priceInCents: number;
  isOrderBump: boolean;
  compareAtPriceInCents?: number;
  customId?: string;
};

type DispatchSubscriptionSaleIntegrationsParams = {
  offer: IOffer;
  sale: ISale;
  items: SaleIntegrationItem[];
  paymentIntent: Stripe.PaymentIntent;
  metadata: Record<string, any>;
  customerPhone?: string;
};

const getOfferOwnerId = (offer: IOffer): string => {
  const owner = (offer as any).ownerId;
  return (owner?._id || owner)?.toString();
};

export const dispatchSubscriptionSaleIntegrations = async ({
  offer,
  sale,
  items,
  paymentIntent,
  metadata,
  customerPhone = "",
}: DispatchSubscriptionSaleIntegrationsParams): Promise<void> => {
  sale.integrationsLastAttempt = new Date();

  try {
    await sendAccessWebhook(offer as any, sale, items, customerPhone || sale.customerPhone || "");
    sale.integrationsHuskySent = true;
  } catch (error: any) {
    console.error(`[Subscription] Erro ao enviar webhook de acesso: ${error.message}`);
    sale.integrationsHuskySent = false;
  }

  try {
    await processUtmfyIntegration(offer as any, sale, items, paymentIntent, metadata);
    sale.integrationsUtmfySent = true;
  } catch (error: any) {
    console.error(`[Subscription] Erro ao enviar UTMfy: ${error.message}`);
    sale.integrationsUtmfySent = false;
  }

  try {
    await sendGenericWebhook(offer as any, sale);
    sale.integrationsGenericWebhookSent = true;
  } catch (error: any) {
    console.error(`[Subscription] Erro ao enviar webhook genérico: ${error.message}`);
    sale.integrationsGenericWebhookSent = false;
  }

  try {
    const emailConfig = (offer as any).emailNotification;
    if (emailConfig?.enabled && sale.customerEmail && sale.customerEmail !== "email@nao.informado") {
      const ownerId = getOfferOwnerId(offer);
      const vendorUser = await User.findById(ownerId).select("+smtpPass");

      if (vendorUser?.smtpHost && vendorUser?.smtpUser && vendorUser?.smtpPass) {
        const mainItem = items.find((item) => !item.isOrderBump) || items[0];

        await sendPurchaseConfirmationEmail({
          smtp: {
            host: vendorUser.smtpHost,
            port: vendorUser.smtpPort || 587,
            user: vendorUser.smtpUser,
            pass: vendorUser.smtpPass,
            fromEmail: vendorUser.smtpFromEmail || vendorUser.smtpUser,
            fromName: vendorUser.smtpFromName || offer.name,
          },
          to: sale.customerEmail,
          customerName: sale.customerName,
          offerName: offer.name,
          productName: mainItem?.name || offer.mainProduct.name,
          totalAmountInCents: sale.totalAmountInCents,
          currency: offer.currency || "brl",
          language: offer.language || "pt",
          subject: emailConfig.subject || undefined,
          heading: emailConfig.heading || undefined,
          body: emailConfig.body || undefined,
          imageUrl: emailConfig.imageUrl || undefined,
          pdfUrl: emailConfig.pdfUrl || undefined,
          ownerId,
          offerId: (offer._id as any).toString(),
        });
      }
    }
  } catch (error: any) {
    console.error(`[Subscription] Erro ao enviar email de confirmação: ${error.message}`);
  }

  await sale.save();
};
