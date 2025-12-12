// src/webhooks/paypal/paypal-webhook.service.ts
import axios from "axios";

const PAYPAL_API_URL = process.env.PAYPAL_API_URL || "https://api-m.sandbox.paypal.com";
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || "";

interface WebhookHeaders {
  "paypal-auth-algo": string;
  "paypal-cert-url": string;
  "paypal-transmission-id": string;
  "paypal-transmission-sig": string;
  "paypal-transmission-time": string;
}

/**
 * Gera um token de acesso OAuth para a API do PayPal
 * Usa as credenciais da plataforma (não do vendedor)
 */
const generatePlatformAccessToken = async (): Promise<string> => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais do PayPal da plataforma não configuradas");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await axios.post(`${PAYPAL_API_URL}/v1/oauth2/token`, "grant_type=client_credentials", {
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  return response.data.access_token;
};

/**
 * Verifica a assinatura do webhook do PayPal
 * https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature
 */
export const verifyPayPalWebhookSignature = async (rawBody: string, headers: WebhookHeaders): Promise<boolean> => {
  // Se não tiver WEBHOOK_ID configurado, pula a verificação (útil para desenvolvimento)
  if (!PAYPAL_WEBHOOK_ID) {
    console.warn("⚠️ PAYPAL_WEBHOOK_ID não configurado. Pulando verificação de assinatura.");
    return true;
  }

  // Se não tiver todos os headers necessários, falha
  if (
    !headers["paypal-auth-algo"] ||
    !headers["paypal-cert-url"] ||
    !headers["paypal-transmission-id"] ||
    !headers["paypal-transmission-sig"] ||
    !headers["paypal-transmission-time"]
  ) {
    console.error("❌ Headers do webhook PayPal incompletos");
    return false;
  }

  try {
    const accessToken = await generatePlatformAccessToken();

    const verificationPayload = {
      auth_algo: headers["paypal-auth-algo"],
      cert_url: headers["paypal-cert-url"],
      transmission_id: headers["paypal-transmission-id"],
      transmission_sig: headers["paypal-transmission-sig"],
      transmission_time: headers["paypal-transmission-time"],
      webhook_id: PAYPAL_WEBHOOK_ID,
      webhook_event: JSON.parse(rawBody),
    };

    const response = await axios.post(`${PAYPAL_API_URL}/v1/notifications/verify-webhook-signature`, verificationPayload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const verificationStatus = response.data.verification_status;
    console.log(`🔐 [PayPal] Verificação de assinatura: ${verificationStatus}`);

    return verificationStatus === "SUCCESS";
  } catch (error: any) {
    console.error("❌ Erro ao verificar assinatura do webhook PayPal:", error.response?.data || error.message);
    // Em caso de erro na verificação, retornamos false para segurança
    return false;
  }
};

/**
 * Busca detalhes de uma ordem do PayPal
 */
export const getPayPalOrderDetails = async (orderId: string, clientId: string, clientSecret: string): Promise<any> => {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const tokenResponse = await axios.post(`${PAYPAL_API_URL}/v1/oauth2/token`, "grant_type=client_credentials", {
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const accessToken = tokenResponse.data.access_token;

  const orderResponse = await axios.get(`${PAYPAL_API_URL}/v2/checkout/orders/${orderId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  return orderResponse.data;
};
