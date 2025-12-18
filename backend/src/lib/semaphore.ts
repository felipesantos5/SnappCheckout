// src/lib/semaphore.ts
/**
 * Semaphore para limitar concorrência de operações
 * Evita que muitos webhooks processem simultaneamente
 * e esgotem o pool de conexões do MongoDB
 */

export class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  /**
   * Adquire um permit do semaphore
   * Aguarda se todos os permits estiverem em uso
   */
  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    // Aguarda um permit ficar disponível
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  /**
   * Libera um permit de volta ao semaphore
   */
  release(): void {
    const next = this.queue.shift();
    if (next) {
      // Passa o permit para o próximo na fila
      next();
    } else {
      // Sem ninguém esperando, devolve o permit
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
// Limita a 10 webhooks processando simultaneamente
export const webhookSemaphore = new Semaphore(10);

// Semaphore para webhooks do PayPal
export const paypalWebhookSemaphore = new Semaphore(10);
