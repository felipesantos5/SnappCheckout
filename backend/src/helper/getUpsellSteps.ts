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

interface RawDownsell {
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

interface RawStep {
  name: string;
  price: number;
  redirectUrl: string;
  customId?: string;
  fallbackCheckoutUrl?: string;
  downsell?: RawDownsell;
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

  if ((offer.upsell.name || offer.upsell.redirectUrl) && offer.upsell.redirectUrl?.trim()) {
    rawSteps.push({
      name: offer.upsell.name,
      price: offer.upsell.price,
      redirectUrl: offer.upsell.redirectUrl,
      customId: offer.upsell.customId,
      fallbackCheckoutUrl: offer.upsell.fallbackCheckoutUrl,
      downsell: offer.upsell.downsell?.name || offer.upsell.downsell?.redirectUrl
        ? {
            name: offer.upsell.downsell.name,
            price: offer.upsell.downsell.price,
            redirectUrl: offer.upsell.downsell.redirectUrl,
            customId: offer.upsell.downsell.customId,
            fallbackCheckoutUrl: offer.upsell.downsell.fallbackCheckoutUrl,
            downsell: offer.upsell.downsell.downsell?.name || offer.upsell.downsell.downsell?.redirectUrl
              ? {
                  name: offer.upsell.downsell.downsell.name,
                  price: offer.upsell.downsell.downsell.price,
                  redirectUrl: offer.upsell.downsell.downsell.redirectUrl,
                  customId: offer.upsell.downsell.downsell.customId,
                  fallbackCheckoutUrl: offer.upsell.downsell.downsell.fallbackCheckoutUrl,
                }
              : undefined,
          }
        : undefined,
    });
  }

  if (offer.upsell.steps && offer.upsell.steps.length > 0) {
    for (const step of offer.upsell.steps) {
      // Ignora steps sem redirectUrl (dados incompletos/vazios)
      if (!step.redirectUrl || step.redirectUrl.trim() === "") {
        continue;
      }
      rawSteps.push({
        name: step.name,
        price: step.price,
        redirectUrl: step.redirectUrl,
        customId: step.customId,
        fallbackCheckoutUrl: step.fallbackCheckoutUrl,
        downsell: step.downsell?.name || step.downsell?.redirectUrl
          ? {
              name: step.downsell.name,
              price: step.downsell.price,
              redirectUrl: step.downsell.redirectUrl,
              customId: step.downsell.customId,
              fallbackCheckoutUrl: step.downsell.fallbackCheckoutUrl,
              downsell: step.downsell.downsell?.name || step.downsell.downsell?.redirectUrl
                ? {
                    name: step.downsell.downsell.name,
                    price: step.downsell.downsell.price,
                    redirectUrl: step.downsell.downsell.redirectUrl,
                    customId: step.downsell.downsell.customId,
                    fallbackCheckoutUrl: step.downsell.downsell.fallbackCheckoutUrl,
                  }
                : undefined,
            }
          : undefined,
      });
    }
  }

  if (rawSteps.length === 0) return [];

  // 2. Primeira passagem: calcula os índices expandidos
  const expandedPositions: { upsellIndex: number; downsellIndex: number | null; nestedDownsellIndex: number | null }[] = [];
  let pos = 0;
  for (const step of rawSteps) {
    const upsellIdx = pos;
    pos++;
    let downsellIdx: number | null = null;
    let nestedDownsellIdx: number | null = null;
    if (step.downsell) {
      downsellIdx = pos;
      pos++;
      if (step.downsell.downsell) {
        nestedDownsellIdx = pos;
        pos++;
      }
    }
    expandedPositions.push({ upsellIndex: upsellIdx, downsellIndex: downsellIdx, nestedDownsellIndex: nestedDownsellIdx });
  }

  // 3. Segunda passagem: constrói o array expandido com navegação
  const expanded: UpsellStep[] = [];

  for (let i = 0; i < rawSteps.length; i++) {
    const step = rawSteps[i];
    const positions = expandedPositions[i];
    const hasDownsell = positions.downsellIndex !== null;
    const hasNestedDownsell = positions.nestedDownsellIndex !== null;

    // Próximo upsell após este (pula downsells se existirem)
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
        declineNextStep: hasNestedDownsell ? positions.nestedDownsellIndex! : nextUpsellIndex,
      });

      // Downsell aninhado (downsell do downsell)
      if (step.downsell.downsell && hasNestedDownsell) {
        expanded.push({
          name: step.downsell.downsell.name,
          price: step.downsell.downsell.price,
          redirectUrl: step.downsell.downsell.redirectUrl,
          customId: step.downsell.downsell.customId,
          fallbackCheckoutUrl: step.downsell.downsell.fallbackCheckoutUrl,
          isDownsell: true,
          acceptNextStep: nextUpsellIndex,
          declineNextStep: nextUpsellIndex,
        });
      }
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
  if (!stepRedirectUrl || stepRedirectUrl.trim() === "") {
    throw new Error("redirectUrl do step de upsell não está configurada.");
  }
  const separator = stepRedirectUrl.includes("?") ? "&" : "?";
  const params = new URLSearchParams({ token, ...extraParams });
  return `${stepRedirectUrl}${separator}${params.toString()}`;
}
