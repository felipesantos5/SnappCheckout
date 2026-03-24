import { IOffer } from "../models/offer.model";

export interface UpsellStep {
  name: string;
  price: number;
  redirectUrl: string;
  customId?: string;
  fallbackCheckoutUrl?: string;
  acceptNextStep?: number | null;
  declineNextStep?: number | null;
  isDownsell?: boolean;
}

interface RawStep {
  name: string;
  price: number;
  redirectUrl: string;
  customId?: string;
  fallbackCheckoutUrl?: string;
  downsell?: {
    name: string;
    price: number;
    redirectUrl: string;
    customId?: string;
    fallbackCheckoutUrl?: string;
  };
}

/**
 * Retorna os passos expandidos do funil de upsell.
 * Cada upsell que tem downsell gera 2 entradas no array:
 *   [upsell, downsell, upsell2, downsell2, upsell3, ...]
 *
 * Lógica de navegação:
 *   - Aceitar upsell N → pula downsell, vai pro próximo upsell
 *   - Recusar upsell N → vai pro downsell (se existir), senão próximo upsell
 *   - Aceitar/Recusar downsell → vai pro próximo upsell
 */
export function getUpsellSteps(offer: IOffer): UpsellStep[] {
  if (!offer.upsell?.enabled) return [];

  // 1. Coleta todos os raw steps (upsell #1 flat + steps adicionais)
  const rawSteps: RawStep[] = [];

  if (offer.upsell.name || offer.upsell.redirectUrl) {
    rawSteps.push({
      name: offer.upsell.name,
      price: offer.upsell.price,
      redirectUrl: offer.upsell.redirectUrl,
      customId: offer.upsell.customId,
      fallbackCheckoutUrl: offer.upsell.fallbackCheckoutUrl,
      downsell: offer.upsell.downsell?.name || offer.upsell.downsell?.redirectUrl
        ? offer.upsell.downsell
        : undefined,
    });
  }

  if (offer.upsell.steps && offer.upsell.steps.length > 0) {
    for (const step of offer.upsell.steps) {
      rawSteps.push({
        ...step,
        downsell: step.downsell?.name || step.downsell?.redirectUrl
          ? step.downsell
          : undefined,
      });
    }
  }

  if (rawSteps.length === 0) return [];

  // 2. Primeira passagem: calcula os índices expandidos
  //    Para saber o tamanho total e posições antes de construir
  const expandedPositions: { upsellIndex: number; downsellIndex: number | null }[] = [];
  let pos = 0;
  for (const step of rawSteps) {
    const upsellIdx = pos;
    pos++;
    let downsellIdx: number | null = null;
    if (step.downsell) {
      downsellIdx = pos;
      pos++;
    }
    expandedPositions.push({ upsellIndex: upsellIdx, downsellIndex: downsellIdx });
  }
  const totalLength = pos;

  // 3. Segunda passagem: constrói o array expandido com navegação
  const expanded: UpsellStep[] = [];

  for (let i = 0; i < rawSteps.length; i++) {
    const step = rawSteps[i];
    const positions = expandedPositions[i];
    const hasDownsell = positions.downsellIndex !== null;

    // Próximo upsell após este (pula o downsell se existir)
    const nextUpsellIndex = i + 1 < rawSteps.length
      ? expandedPositions[i + 1].upsellIndex
      : -1; // -1 = thank you page

    // Upsell entry
    expanded.push({
      name: step.name,
      price: step.price,
      redirectUrl: step.redirectUrl,
      customId: step.customId,
      fallbackCheckoutUrl: step.fallbackCheckoutUrl,
      isDownsell: false,
      acceptNextStep: nextUpsellIndex,
      declineNextStep: hasDownsell ? positions.downsellIndex! : nextUpsellIndex,
    });

    // Downsell entry (se existir)
    if (step.downsell && hasDownsell) {
      expanded.push({
        name: step.downsell.name,
        price: step.downsell.price,
        redirectUrl: step.downsell.redirectUrl,
        customId: step.downsell.customId,
        fallbackCheckoutUrl: step.downsell.fallbackCheckoutUrl,
        isDownsell: true,
        acceptNextStep: nextUpsellIndex,
        declineNextStep: nextUpsellIndex,
      });
    }
  }

  return expanded;
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
