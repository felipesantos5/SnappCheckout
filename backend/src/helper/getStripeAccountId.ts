import { IUser } from "../models/user.model";
import Offer, { IOffer } from "../models/offer.model";
import stripe from "../lib/stripe";

export interface OwnerPaymentInfo {
  stripeAccountId: string;
  platformFeePercent: number;
}

export const getStripeAccountId = async (slug: string): Promise<string> => {
  const info = await getOwnerPaymentInfo(slug);
  return info.stripeAccountId;
};

export const getOwnerPaymentInfo = async (slug: string): Promise<OwnerPaymentInfo> => {
  const offer = await Offer.findOne({ slug }).populate("ownerId");
  if (!offer) {
    throw new Error(`Oferta com slug '${slug}' não encontrada.`);
  }

  const owner = offer.ownerId as unknown as IUser;
  if (!owner) {
    throw new Error(`Oferta '${slug}' não tem um dono (ownerId) associado.`);
  }

  if (!owner.stripeAccountId) {
    throw new Error(`O vendedor '${owner.email}' não conectou sua conta Stripe.`);
  }

  const account = await stripe.accounts.retrieve(owner.stripeAccountId);
  if (!account.charges_enabled) {
    throw new Error(`A conta de pagamento do vendedor ('${owner.email}') não está ativa ou não concluiu o cadastro.`);
  }

  return {
    stripeAccountId: owner.stripeAccountId,
    platformFeePercent: owner.platformFeePercent ?? 3,
  };
};
