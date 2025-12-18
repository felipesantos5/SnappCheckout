// src/lib/http-client.ts
/**
 * HTTP Client com timeout configurável para evitar travamentos
 * em requisições para APIs externas (UTMfy, PayPal, Facebook, etc.)
 */

// Timeout padrão de 30 segundos
const DEFAULT_TIMEOUT = 30000;

/**
 * Fetch com timeout integrado usando AbortController
 * Evita que requisições fiquem pendentes indefinidamente
 *
 * @param url - URL para fazer a requisição
 * @param options - Opções do fetch + timeout customizado
 * @returns Promise<Response>
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error(`Request timeout após ${timeout}ms: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Configuração de timeout para axios
 * Use esta configuração ao criar instâncias do axios
 */
export const axiosDefaultConfig = {
  timeout: DEFAULT_TIMEOUT,
};

/**
 * Helper para criar config do axios com timeout
 */
export function getAxiosConfig(customTimeout?: number) {
  return {
    timeout: customTimeout || DEFAULT_TIMEOUT,
  };
}
