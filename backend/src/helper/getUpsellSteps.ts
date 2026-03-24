import { IOffer } from "../models/offer.model";

export interface UpsellStep {
  name: string;
  price: number;
  redirectUrl: string;
  customId?: string;
  fallbackCheckoutUrl?: string;
}

/**
 * Retorna os passos do funil de upsell de uma oferta.
 * Compatível com ofertas antigas (campos flat) e novas (steps array).
 */
export function getUpsellSteps(offer: IOffer): UpsellStep[] {
  if (!offer.upsell?.enabled) return [];

  // Novo formato: steps array
  if (offer.upsell.steps && offer.upsell.steps.length > 0) {
    return offer.upsell.steps;
  }

  // Formato antigo: campos flat → converte para array de 1 step
  if (offer.upsell.name || offer.upsell.redirectUrl) {
    return [
      {
        name: offer.upsell.name,
        price: offer.upsell.price,
        redirectUrl: offer.upsell.redirectUrl,
        customId: offer.upsell.customId,
        fallbackCheckoutUrl: offer.upsell.fallbackCheckoutUrl,
      },
    ];
  }

  return [];
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
