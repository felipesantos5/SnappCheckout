import axios from "axios";

const PAYPAL_API_URL = process.env.PAYPAL_API_URL || "https://api-m.sandbox.paypal.com";

// Gera o token de acesso (OAuth 2.0)
const generateAccessToken = async (clientId: string, clientSecret: string) => {
  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const response = await axios.post(`${PAYPAL_API_URL}/v1/oauth2/token`, "grant_type=client_credentials", {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    return response.data.access_token;
  } catch (error: any) {
    console.error(`[PayPal] Failed to generate access token:`, error.response?.data || error.message);
    throw new Error(`Falha na autenticação PayPal: ${error.response?.data?.error_description || error.message}`);
  }
};

// Cria uma ordem de pagamento
export const createOrder = async (amount: number, currency: string, clientId: string, clientSecret: string) => {
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

  console.log(`[PayPal] Creating order: amount=${amount} (${valueFormatted}), currency=${currencyCode}`);

  try {
    const accessToken = await generateAccessToken(clientId, clientSecret);
    const response = await axios.post(
      `${PAYPAL_API_URL}/v2/checkout/orders`,
      {
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: currencyCode,
              value: valueFormatted,
            },
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
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
    }
  );
  return response.data;
};
