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

    // Se vault estiver habilitado, adiciona configuração para salvar método de pagamento
    if (enableVault) {
      orderPayload.payment_source = {
        paypal: {
          attributes: {
            vault: {
              store_in_vault: "ON_SUCCESS",
              usage_type: "MERCHANT",
              customer_type: "CONSUMER",
            },
          },
        },
      };
    }

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
          attributes: {
            customer: {
              id: paypalCustomerId,
            },
          },
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

      const details = paypalError.details?.[0];
      const description = details?.description || paypalError.message || "Erro ao processar pagamento com vault";

      throw new Error(`PayPal: ${description}`);
    }
    throw error;
  }
};
