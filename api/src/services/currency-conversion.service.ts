// src/services/currency-conversion.service.ts
import "dotenv/config";

/**
 * Taxas de conversão de moeda
 * Em produção, isso deveria vir de uma API externa como:
 * - https://exchangerate-api.com/
 * - https://www.exchangerate-api.com/
 * - https://fixer.io/
 */

interface ExchangeRates {
  [key: string]: number;
}

// Cache de taxas de câmbio (atualizado periodicamente)
let cachedRates: ExchangeRates = {
  USD: 5.0, // 1 USD = 5.0 BRL (padrão)
  EUR: 5.5, // 1 EUR = 5.5 BRL (padrão)
  GBP: 6.5, // 1 GBP = 6.5 BRL (padrão)
  BRL: 1.0, // 1 BRL = 1.0 BRL
};

let lastUpdate: Date | null = null;
const CACHE_DURATION_MS = 1000 * 60 * 60; // 1 hora

/**
 * Busca taxas de câmbio atualizadas de uma API externa
 */
async function fetchExchangeRates(): Promise<void> {
  try {
    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    const apiUrl = process.env.EXCHANGE_RATE_API_URL || "https://api.exchangerate-api.com/v4/latest/BRL";

    // Se tiver API key configurada, usa API com chave
    let url = apiUrl;
    if (apiKey && !apiUrl.includes("exchangerate-api.com/v4")) {
      // Para APIs que requerem chave (como fixer.io)
      url = `https://api.exchangerate.host/latest?base=BRL&access_key=${apiKey}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Exchange Rate API retornou ${response.status}`);
    }

    const data = await response.json();

    // Formato da resposta varia por API, adapte conforme necessário
    if (data.rates) {
      // Converte as taxas para BRL como base
      // Ex: se USD/BRL = 5.0, então para converter USD->BRL multiplicamos por 5.0
      const rates = data.rates;

      // Se a API retorna com BRL como base, as taxas já estão corretas
      // Caso contrário, precisamos inverter
      if (data.base === "BRL") {
        cachedRates = {
          BRL: 1.0,
          USD: rates.USD ? 1 / rates.USD : cachedRates.USD,
          EUR: rates.EUR ? 1 / rates.EUR : cachedRates.EUR,
          GBP: rates.GBP ? 1 / rates.GBP : cachedRates.GBP,
        };
      } else {
        // Se a base for outra moeda (ex: USD), calculamos a taxa para BRL
        const brlRate = rates.BRL || 1;
        cachedRates = {
          BRL: 1.0,
          USD: brlRate / (rates.USD || 1),
          EUR: brlRate / (rates.EUR || 1),
          GBP: brlRate / (rates.GBP || 1),
        };
      }

      lastUpdate = new Date();
      // console.log("✅ Taxas de câmbio atualizadas:", cachedRates);
    }
  } catch (error) {
    console.error("❌ Erro ao buscar taxas de câmbio, usando valores em cache:", error);
    // Continua usando valores em cache
  }
}

/**
 * Retorna as taxas de câmbio, atualizando se necessário
 */
async function getExchangeRates(): Promise<ExchangeRates> {
  const now = new Date();

  // Atualiza se nunca foi atualizado ou se passou do tempo de cache
  if (!lastUpdate || now.getTime() - lastUpdate.getTime() > CACHE_DURATION_MS) {
    await fetchExchangeRates();
  }

  return cachedRates;
}

/**
 * Converte um valor de uma moeda para BRL
 *
 * @param amountInCents - Valor em centavos na moeda original
 * @param fromCurrency - Código da moeda de origem (USD, EUR, BRL, etc.)
 * @returns Valor em centavos em BRL
 */
export async function convertToBRL(amountInCents: number, fromCurrency: string): Promise<number> {
  const currency = fromCurrency.toUpperCase();

  // Se já é BRL, retorna o mesmo valor
  if (currency === "BRL") {
    return amountInCents;
  }

  // Obtém taxas atualizadas
  const rates = await getExchangeRates();

  // Obtém a taxa de conversão
  const rate = rates[currency];

  if (!rate) {
    console.warn(`⚠️  Taxa de conversão não encontrada para ${currency}, usando taxa padrão de 5.0`);
    // Taxa padrão genérica
    return Math.round(amountInCents * 5.0);
  }

  // Converte para BRL
  const brlAmountInCents = Math.round(amountInCents * rate);

  return brlAmountInCents;
}

/**
 * Converte um valor em centavos para a unidade principal (reais)
 *
 * @param amountInCents - Valor em centavos
 * @returns Valor em reais
 */
export function centsToUnits(amountInCents: number): number {
  return amountInCents / 100;
}

/**
 * Inicializa o serviço de conversão (busca taxas na primeira vez)
 */
export async function initializeCurrencyService(): Promise<void> {
  await fetchExchangeRates();
}
