// src/webhooks/pagarme/pagarme-webhook.controller.ts
import { Request, Response } from "express";
import { handlePagarMeEvent } from "./handlers";

/**
 * Controller principal para webhooks da Pagar.me
 * Endpoint: POST /webhooks/pagarme
 */
export const handlePagarMeWebhook = async (req: Request, res: Response) => {
  try {
    const webhookData = req.body;

    // Log do webhook recebido

    // A Pagar.me envia o tipo de evento no campo "type"
    const eventType = webhookData.type;
    const eventData = webhookData.data || webhookData;

    if (!eventType) {
      console.warn("[Pagar.me Webhook] Webhook sem tipo de evento");
      return res.status(400).json({ error: "Tipo de evento não fornecido" });
    }

    // Processa o evento de forma assíncrona
    // Respondemos 200 OK imediatamente para evitar timeout
    res.status(200).json({ received: true });

    // Processa o evento em background
    try {
      await handlePagarMeEvent(eventType, eventData);
    } catch (error: any) {
      console.error(`[Pagar.me Webhook] Erro ao processar evento ${eventType}:`, error);
      // Não re-throw aqui pois já respondemos 200 OK
    }
  } catch (error: any) {
    console.error("[Pagar.me Webhook] Erro ao processar webhook:", error);
    
    // Se ainda não respondemos, retorna erro
    if (!res.headersSent) {
      res.status(500).json({ error: "Erro ao processar webhook" });
    }
  }
};
