// src/webhooks/paypal/paypal-webhook.controller.ts
import { Request, Response } from "express";
import { verifyPayPalWebhookSignature } from "./paypal-webhook.service";
import { handlePaymentCaptureCompleted, handlePaymentCaptureDenied, handlePaymentCaptureRefunded, handleVaultPaymentTokenCreated } from "./handlers/payment.handler";
import { paypalWebhookSemaphore } from "../../lib/semaphore";

/**
 * Controller principal do webhook do PayPal
 * Recebe eventos e roteia para os handlers apropriados
 */
export const handlePayPalWebhook = async (req: Request, res: Response) => {
  try {
    // 1. Obtém o body como string (veio como Buffer do express.raw)
    const rawBody = req.body instanceof Buffer ? req.body.toString("utf8") : JSON.stringify(req.body);

    // 2. Headers necessários para verificação da assinatura
    const webhookHeaders = {
      "paypal-auth-algo": req.headers["paypal-auth-algo"] as string,
      "paypal-cert-url": req.headers["paypal-cert-url"] as string,
      "paypal-transmission-id": req.headers["paypal-transmission-id"] as string,
      "paypal-transmission-sig": req.headers["paypal-transmission-sig"] as string,
      "paypal-transmission-time": req.headers["paypal-transmission-time"] as string,
    };

    // 3. Verifica a assinatura do webhook (opcional em sandbox, obrigatório em produção)
    const isValid = await verifyPayPalWebhookSignature(rawBody, webhookHeaders);

    if (!isValid) {
      console.error("❌ Assinatura do webhook PayPal inválida");
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    // 4. Parse do evento
    const event = JSON.parse(rawBody);
    const eventType = event.event_type;

    // 5. Roteia para o handler apropriado (com controle de concorrência)
    await paypalWebhookSemaphore.run(async () => {
      switch (eventType) {
        case "PAYMENT.CAPTURE.COMPLETED":
          await handlePaymentCaptureCompleted(event);
          break;

        case "PAYMENT.CAPTURE.DENIED":
          await handlePaymentCaptureDenied(event);
          break;

        case "PAYMENT.CAPTURE.REFUNDED":
          await handlePaymentCaptureRefunded(event);
          break;

        case "CHECKOUT.ORDER.APPROVED":
          // Ordem aprovada pelo cliente (não é pagamento ainda)
          break;

        case "VAULT.PAYMENT-TOKEN.CREATED":
          await handleVaultPaymentTokenCreated(event);
          break;

        default:
          break;
      }
    });

    // 6. Responde sucesso para o PayPal
    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error("❌ Erro no webhook PayPal:", error.message);
    // Retorna 200 mesmo em erro para evitar retentativas infinitas
    // O PayPal vai retentar se retornarmos 4xx ou 5xx
    res.status(200).json({ received: true, error: error.message });
  }
};
