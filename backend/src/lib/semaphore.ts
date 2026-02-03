// src/lib/semaphore.ts
/**
 * Semaphore com timeout e limite de fila
 * Evita que webhooks travem indefinidamente ou acumulem sem limite
 */

export class Semaphore {
  private permits: number;
  private queue: Array<{ resolve: () => void; timer: ReturnType<typeof setTimeout> }> = [];
  private readonly maxQueueSize: number;
  private readonly acquireTimeoutMs: number;

  /**
   * @param permits - Número máximo de execuções simultâneas
   * @param maxQueueSize - Tamanho máximo da fila de espera (default: 100)
   * @param acquireTimeoutMs - Timeout para adquirir um permit (default: 30s)
   */
  constructor(permits: number, maxQueueSize = 100, acquireTimeoutMs = 30000) {
    this.permits = permits;
    this.maxQueueSize = maxQueueSize;
    this.acquireTimeoutMs = acquireTimeoutMs;
  }

  /**
   * Adquire um permit do semaphore
   * Aguarda se todos os permits estiverem em uso
   * Rejeita se a fila estiver cheia ou timeout expirar
   */
  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    // Rejeita se a fila atingiu o limite
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error(`Semaphore queue full (${this.maxQueueSize}). Rejecting request.`);
    }

    // Aguarda um permit com timeout
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        // Remove da fila se timeout expirar
        const index = this.queue.findIndex((item) => item.resolve === resolve);
        if (index !== -1) {
          this.queue.splice(index, 1);
        }
        reject(new Error(`Semaphore acquire timeout after ${this.acquireTimeoutMs}ms`));
      }, this.acquireTimeoutMs);

      this.queue.push({ resolve, timer });
    });
  }

  /**
   * Libera um permit de volta ao semaphore
   */
  release(): void {
    const next = this.queue.shift();
    if (next) {
      clearTimeout(next.timer);
      next.resolve();
    } else {
      this.permits++;
    }
  }

  /**
   * Executa uma função com controle de concorrência
   * Adquire permit antes de executar e libera depois
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * Retorna número de permits disponíveis
   */
  get available(): number {
    return this.permits;
  }

  /**
   * Retorna tamanho da fila de espera
   */
  get waiting(): number {
    return this.queue.length;
  }
}

// Semaphore global para webhooks do Stripe
// 10 concorrentes, fila max 100, timeout 30s
export const webhookSemaphore = new Semaphore(10, 100, 30000);

// Semaphore para webhooks do PayPal
export const paypalWebhookSemaphore = new Semaphore(10, 100, 30000);
