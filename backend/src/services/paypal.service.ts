import axios from "axios";
import { getAxiosConfig } from "../lib/http-client";

const PAYPAL_API_URL = process.env.PAYPAL_API_URL || "https://api-m.sandbox.paypal.com";
const PAYPAL_TIMEOUT = 30000; // 30 segundos

// Gera o token de acesso (OAuth 2.0)
const generateAccessToken = async (clientId: string, clientSecret: string) => {
  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const response = await axios.post(`${PAYPAL_API_URL}/v1/oauth2/token`, "grant_type=client_credentials", {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      ...getAxiosConfig(PAYPAL_TIMEOUT),
    });
    return response.data.access_token;
  } catch (error: any) {
    console.error(`[PayPal] Failed to generate access token:`, error.response?.data || error.message);
    throw new Error(`Falha na autenticação PayPal: ${error.response?.data?.error_description || error.message}`);
  }
};

// Cria uma ordem de pagamento
export const createOrder = async (amount: number, currency: string, clientId: string, clientSecret: string, enableVault: boolean = false) => {
  // Validação
  if (!amount || amount <= 0) {
    throw new Error("Valor inválido para o pedido");
  }

  if (!currency) {
    throw new Error("Moeda não especificada");
  }

  // PayPal exige currency_code em uppercase
  const currencyCode = currency.toUpperCase();

  // Converte centavos para valor decimal (PayPal usa 10.00, não 1000)
  const valueFormatted = (amount / 100).toFixed(2);

  try {
    const accessToken = await generateAccessToken(clientId, clientSecret);

    const orderPayload: any = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currencyCode,
            value: valueFormatted,
          },
        },
      ],
    };

    // NOTA: Quando usamos JS SDK Buttons, NÃO enviamos payment_source na criação da ordem.
    // O vault é habilitado via parâmetro na URL do SDK (&vault=true) e via
    // createOrder attributes no componente frontend.
    // Enviar payment_source aqui causa conflito: PayPal retorna PAYER_ACTION_REQUIRED
    // com redirect URL em vez de um order ID que o SDK popup consegue processar.

    const response = await axios.post(
      `${PAYPAL_API_URL}/v2/checkout/orders`,
      orderPayload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        ...getAxiosConfig(PAYPAL_TIMEOUT),
      }
    );
    return response.data;
  } catch (error: any) {
    // Extrair detalhes do erro do PayPal para debugging
    if (error.response?.data) {
      const paypalError = error.response.data;
      console.error("[PayPal] API Error:", JSON.stringify(paypalError, null, 2));

      // Formatar mensagem de erro amigável
      const details = paypalError.details?.[0];
      const description = details?.description || paypalError.message || "Erro desconhecido do PayPal";

      throw new Error(`PayPal: ${description} (${currencyCode})`);
    }
    throw error;
  }
};

// Captura o pagamento após aprovação do usuário
export const captureOrder = async (orderId: string, clientId: string, clientSecret: string) => {
  const accessToken = await generateAccessToken(clientId, clientSecret);
  const response = await axios.post(
    `${PAYPAL_API_URL}/v2/checkout/orders/${orderId}/capture`,
    {},
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      ...getAxiosConfig(PAYPAL_TIMEOUT),
    }
  );
  return response.data;
};

// Busca payment tokens de um customer no PayPal Vault (API v3)
// Usado quando o vault retorna status APPROVED (assíncrono) em vez de VAULTED
export const getCustomerPaymentTokens = async (
  paypalCustomerId: string,
  clientId: string,
  clientSecret: string
): Promise<{ id: string; customer: { id: string } } | null> => {
  try {
    const accessToken = await generateAccessToken(clientId, clientSecret);

    const response = await axios.get(
      `${PAYPAL_API_URL}/v3/vault/payment-tokens?customer_id=${paypalCustomerId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        ...getAxiosConfig(PAYPAL_TIMEOUT),
      }
    );

    const tokens = response.data?.payment_tokens;
    if (tokens && tokens.length > 0) {
      // Retorna o token mais recente
      const latest = tokens[0];
      return {
        id: latest.id,
        customer: { id: latest.customer?.id || paypalCustomerId },
      };
    }

    return null;
  } catch (error: any) {
    console.warn(`⚠️ [PayPal Vault] Erro ao buscar payment tokens: ${error.response?.data?.message || error.message}`);
    return null;
  }
};

// Polling: aguarda o vault token ficar disponível com exponential backoff
// Quando vault.status é APPROVED, o token pode levar alguns segundos para ficar disponível
export const waitForVaultToken = async (
  paypalCustomerId: string,
  clientId: string,
  clientSecret: string,
  maxAttempts: number = 5,
  baseIntervalMs: number = 2000
): Promise<{ id: string; customer: { id: string } } | null> => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`🔵 [PayPal Vault] Polling tentativa ${attempt}/${maxAttempts} para customer ${paypalCustomerId}...`);

    const token = await getCustomerPaymentTokens(paypalCustomerId, clientId, clientSecret);
    if (token) {
      console.log(`✅ [PayPal Vault] Token encontrado via polling: ${token.id}`);
      return token;
    }

    if (attempt < maxAttempts) {
      // Exponential backoff: 2s, 3s, 4.5s, 6.75s
      const waitTime = baseIntervalMs * Math.pow(1.5, attempt - 1);
      console.log(`⏳ [PayPal Vault] Aguardando ${Math.round(waitTime)}ms antes da próxima tentativa...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  console.warn(`⚠️ [PayPal Vault] Token não encontrado após ${maxAttempts} tentativas de polling`);
  return null;
};

// Cria e captura uma ordem usando vault_id (para one-click upsell)
export const createAndCaptureOrderWithVault = async (
  amount: number,
  currency: string,
  vaultId: string,
  paypalCustomerId: string,
  clientId: string,
  clientSecret: string
) => {
  // Validação
  if (!amount || amount <= 0) {
    throw new Error("Valor inválido para o pedido");
  }

  if (!vaultId || !paypalCustomerId) {
    throw new Error("Vault ID e Customer ID são obrigatórios");
  }

  const currencyCode = currency.toUpperCase();
  const valueFormatted = (amount / 100).toFixed(2);

  try {
    const accessToken = await generateAccessToken(clientId, clientSecret);

    // Cria ordem com vault_id (método salvo)
    // Docs: https://developer.paypal.com/docs/checkout/save-payment-methods/purchase-later/payment-tokens-api/paypal/
    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currencyCode,
            value: valueFormatted,
          },
        },
      ],
      payment_source: {
        paypal: {
          vault_id: vaultId,
        },
      },
    };

    console.log(`🔵 [PayPal Vault] Criando ordem com vault_id: ${vaultId}`);

    const response = await axios.post(
      `${PAYPAL_API_URL}/v2/checkout/orders`,
      orderPayload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        ...getAxiosConfig(PAYPAL_TIMEOUT),
      }
    );

    const order = response.data;
    console.log(`✅ [PayPal Vault] Ordem criada: ${order.id}, status: ${order.status}`);

    // Se a ordem foi criada e aprovada automaticamente, captura
    if (order.status === "APPROVED") {
      console.log(`🔵 [PayPal Vault] Capturando ordem ${order.id}...`);
      const captureResponse = await axios.post(
        `${PAYPAL_API_URL}/v2/checkout/orders/${order.id}/capture`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          ...getAxiosConfig(PAYPAL_TIMEOUT),
        }
      );

      console.log(`✅ [PayPal Vault] Ordem capturada com sucesso`);
      return captureResponse.data;
    }

    // Se não foi aprovada automaticamente, retorna a ordem criada
    return order;
  } catch (error: any) {
    if (error.response?.data) {
      const paypalError = error.response.data;
      console.error("[PayPal Vault] API Error:", JSON.stringify(paypalError, null, 2));
      console.error("[PayPal Vault] Request payload:", JSON.stringify({ vaultId, paypalCustomerId, amount, currency: currencyCode }, null, 2));

      const details = paypalError.details?.[0];
      const issue = details?.issue || "";
      const description = details?.description || paypalError.message || "Erro ao processar pagamento com vault";

      // Traduz erros comuns do PayPal
      if (issue === "INVALID_VAULT_ID" || paypalError.name === "INVALID_REQUEST") {
        throw new Error("Token de pagamento expirado ou inválido. Por favor, refaça o pagamento.");
      }

      throw new Error(`PayPal: ${description}`);
    }
    throw error;
  }
};

/**
 * Busca vault token diretamente pelo customer_id como fallback
 * Útil quando o vault.id não está disponível na resposta do capture
 */
export const getVaultTokenByCustomerId = async (
  paypalCustomerId: string,
  clientId: string,
  clientSecret: string
): Promise<{ id: string; customer: { id: string } } | null> => {
  console.log(`🔵 [PayPal Vault] Buscando token para customer ${paypalCustomerId}...`);
  
  try {
    const token = await getCustomerPaymentTokens(paypalCustomerId, clientId, clientSecret);
    if (token) {
      console.log(`✅ [PayPal Vault] Token encontrado: ${token.id}`);
      return token;
    }
    
    console.warn(`⚠️ [PayPal Vault] Nenhum token encontrado para customer ${paypalCustomerId}`);
    return null;
  } catch (error: any) {
    console.error(`❌ [PayPal Vault] Erro ao buscar token:`, error.message);
    return null;
  }
};
