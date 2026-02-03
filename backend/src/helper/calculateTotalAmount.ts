import * as offerService from "../services/offer.service";

export const calculateTotalAmount = async (slug: string, bumpIds: string[]): Promise<number> => {
  const offer = await offerService.getOfferBySlug(slug);
  if (!offer) {
    throw new Error("Oferta não encontrada para cálculo.");
  }

  // Quantidade sempre é 1
  let totalAmount = offer.mainProduct.priceInCents;

  // Adiciona os bumps
  if (bumpIds && bumpIds.length > 0) {
    for (const bumpId of bumpIds) {
      const bump = offer.orderBumps.find((b: any) => b._id?.toString() === bumpId);

      if (bump) {
        totalAmount += bump.priceInCents;
      }
    }
  }

  return totalAmount;
};
