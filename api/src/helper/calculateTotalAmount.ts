import * as offerService from "../services/offer.service";

export const calculateTotalAmount = async (slug: string, bumpIds: string[], quantity: number): Promise<number> => {
  const offer = await offerService.getOfferBySlug(slug);
  if (!offer) {
    throw new Error("Oferta não encontrada para cálculo.");
  }

  // Validação da quantidade
  const qty = Math.max(1, quantity || 1);

  // O TOTAL É CALCULADO COM A QUANTIDADE DO PRODUTO PRINCIPAL
  let totalAmount = offer.mainProduct.priceInCents * qty;

  // Adiciona os bumps (bumps não são multiplicados pela quantidade)
  if (bumpIds && bumpIds.length > 0) {
    for (const bumpId of bumpIds) {
      // --- CORREÇÃO AQUI ---
      // Usamos b._id.toString() para garantir que a comparação funcione
      // O ?. evita erro se o bump estiver mal formatado no banco
      const bump = offer.orderBumps.find((b: any) => b._id?.toString() === bumpId);

      if (bump) {
        totalAmount += bump.priceInCents;
      }
    }
  }

  return totalAmount;
};
