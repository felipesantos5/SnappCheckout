import axios from "axios";

const PAYPAL_API_URL = process.env.PAYPAL_API_URL || "https://api-m.sandbox.paypal.com";

// Gera o token de acesso (OAuth 2.0)
const generateAccessToken = async (clientId: string, clientSecret: string) => {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await axios.post(`${PAYPAL_API_URL}/v1/oauth2/token`, "grant_type=client_credentials", {
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  return response.data.access_token;
};

// Cria uma ordem de pagamento
export const createOrder = async (amount: number, currency: string, clientId: string, clientSecret: string) => {
  const accessToken = await generateAccessToken(clientId, clientSecret);
  const response = await axios.post(
    `${PAYPAL_API_URL}/v2/checkout/orders`,
    {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: (amount / 100).toFixed(2), // PayPal usa formato 10.00, não centavos
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
