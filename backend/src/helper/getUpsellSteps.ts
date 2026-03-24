import { IOffer } from "../models/offer.model";

export interface UpsellStep {
  name: string;
  price: number;
  redirectUrl: string;
  customId?: string;
  fallbackCheckoutUrl?: string;
  acceptNextStep?: number | null;
  declineNextStep?: number | null;
}

/**
 * Retorna os passos do funil de upsell de uma oferta.
 * Sempre inclui o upsell #1 (campos flat) como step 0, seguido dos steps adicionais.
 * Compatível com ofertas antigas (só campos flat) e novas (flat + steps array).
 */
export function getUpsellSteps(offer: IOffer): UpsellStep[] {
  if (!offer.upsell?.enabled) return [];

  const allSteps: UpsellStep[] = [];

  // Step 0: upsell #1 (campos flat)
  if (offer.upsell.name || offer.upsell.redirectUrl) {
    allSteps.push({
      name: offer.upsell.name,
      price: offer.upsell.price,
      redirectUrl: offer.upsell.redirectUrl,
      customId: offer.upsell.customId,
      fallbackCheckoutUrl: offer.upsell.fallbackCheckoutUrl,
      acceptNextStep: offer.upsell.acceptNextStep ?? null,
      declineNextStep: offer.upsell.declineNextStep ?? null,
    });
  }

  // Steps adicionais (upsell #2, #3, downsells, etc.)
  if (offer.upsell.steps && offer.upsell.steps.length > 0) {
    allSteps.push(...offer.upsell.steps);
  }

  return allSteps;
}

/**
 * Constrói a URL de redirecionamento para um passo do upsell, incluindo token e parâmetros adicionais.
 */
export function buildUpsellRedirectUrl(
  stepRedirectUrl: string,
  token: string,
  extraParams?: Record<string, string>
): string {
  const separator = stepRedirectUrl.includes("?") ? "&" : "?";
  const params = new URLSearchParams({ token, ...extraParams });
  return `${stepRedirectUrl}${separator}${params.toString()}`;
}
