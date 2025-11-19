import { IUser } from "../models/user.model";
import Offer, { IOffer } from "../models/offer.model";
import stripe from "../lib/stripe";

export const getStripeAccountId = async (slug: string): Promise<string> => {
  // 1. Busca a oferta E o dono dela (com 'populate')
  const offer = await Offer.findOne({ slug }).populate("ownerId");
  if (!offer) {
    throw new Error(`Oferta com slug '${slug}' não encontrada.`);
  }

  // 2. Acessa o usuário (dono)
  const owner = offer.ownerId as unknown as IUser;
  if (!owner) {
    throw new Error(`Oferta '${slug}' não tem um dono (ownerId) associado.`);
  }

  // 3. Verifica se o dono TEM um ID do Stripe salvo
  if (!owner.stripeAccountId) {
    throw new Error(`O vendedor '${owner.email}' não conectou sua conta Stripe.`);
  }

  // 4. (Opcional, mas recomendado) Verifica se a conta pode receber pagamentos
  const account = await stripe.accounts.retrieve(owner.stripeAccountId);
  if (!account.charges_enabled) {
    throw new Error(`A conta de pagamento do vendedor ('${owner.email}') não está ativa ou não concluiu o cadastro.`);
  }

  // 5. Retorna o ID da conta conectada (ex: 'acct_...')
  return owner.stripeAccountId;
};
