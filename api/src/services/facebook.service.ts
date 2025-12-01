import crypto from "crypto";
import axios from "axios";

interface FacebookUserData {
  fbc?: string;
  fbp?: string;
  client_ip_address: string;
  client_user_agent: string;
  em?: string; // Email (hashed)
  ph?: string; // Phone (hashed)
  fn?: string; // First Name (hashed)
  ln?: string; // Last Name (hashed)
  ct?: string; // City (hashed)
  st?: string; // State (hashed)
  zp?: string; // Zip Code (hashed)
  country?: string; // Country (hashed)
}

interface FacebookEventPayload {
  event_name: "InitiateCheckout" | "Purchase";
  event_time: number;
  event_id?: string; // Para deduplicação entre Pixel e CAPI
  event_source_url?: string;
  action_source: "website";
  user_data: FacebookUserData;
  custom_data?: {
    currency?: string;
    value?: number;
    content_ids?: string[];
    content_type?: string;
    order_id?: string;
  };
}

/**
 * Normaliza e faz o Hash SHA256 de dados sensíveis conforme requisitos do Facebook
 */
const hashData = (data: string): string => {
  if (!data) return "";
  const normalized = data.trim().toLowerCase();
  return crypto.createHash("sha256").update(normalized).digest("hex");
};

/**
 * Envia evento para o Facebook Conversion API
 */
export const sendFacebookEvent = async (pixelId: string, accessToken: string, payload: FacebookEventPayload) => {
  if (!pixelId || !accessToken) {
    console.warn(`⚠️ Pixel ID ou Access Token ausente - Pixel: ${pixelId ? 'OK' : 'MISSING'}, Token: ${accessToken ? 'OK' : 'MISSING'}`);
    throw new Error('Pixel ID ou Access Token ausente');
  }

  const url = `https://graph.facebook.com/v19.0/${pixelId}/events`;

  const body = {
    data: [payload],
    access_token: accessToken,
    // test_event_code: "TEST12345" // Descomente para testar no gerenciador de eventos
  };

  try {
    console.log(`🔵 Enviando evento Facebook: ${payload.event_name} para pixel ${pixelId}`);
    console.log(`   - Event ID: ${payload.event_id || 'N/A'}`);
    console.log(`   - Valor: ${payload.custom_data?.value || 'N/A'} ${payload.custom_data?.currency || 'N/A'}`);
    console.log(`   - User Data: email=${!!payload.user_data.em}, phone=${!!payload.user_data.ph}, fbc=${!!payload.user_data.fbc}, fbp=${!!payload.user_data.fbp}`);

    const response = await axios.post(url, body, { timeout: 15000 });

    // Verifica se há warnings ou erros na resposta do Facebook
    if (response.data?.messages) {
      console.warn(`⚠️ Facebook retornou mensagens para pixel ${pixelId}:`, JSON.stringify(response.data.messages, null, 2));
    }

    console.log(`✅ Evento ${payload.event_name} enviado com sucesso para pixel ${pixelId} - Events Received: ${response.data?.events_received || 0}`);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.error?.message || error.message;
    const errorCode = error.response?.data?.error?.code;
    const errorType = error.response?.data?.error?.type;
    const errorSubcode = error.response?.data?.error?.error_subcode;

    console.error(`❌ Erro ao enviar evento ${payload.event_name} para pixel ${pixelId}:`);
    console.error(`   - Mensagem: ${errorMessage}`);
    if (errorCode) console.error(`   - Código: ${errorCode}`);
    if (errorType) console.error(`   - Tipo: ${errorType}`);
    if (errorSubcode) console.error(`   - Subcode: ${errorSubcode}`);
    console.error(`   - Status HTTP: ${error.response?.status || 'N/A'}`);

    // Log completo do payload apenas em caso de erro para debug
    console.error(`   - Payload enviado:`, JSON.stringify(payload, null, 2));

    throw new Error(`Facebook API Error [${pixelId}]: ${errorMessage}`);
  }
};

/**
 * Helper para criar o objeto user_data completo com todos os dados disponíveis
 */
export const createFacebookUserData = (
  ip: string,
  userAgent: string,
  email?: string,
  phone?: string,
  name?: string,
  fbc?: string,
  fbp?: string,
  city?: string,
  state?: string,
  zipCode?: string,
  country?: string
): FacebookUserData => {
  const userData: FacebookUserData = {
    client_ip_address: ip,
    client_user_agent: userAgent,
  };

  // Dados de identificação pessoal (hashados)
  if (email) userData.em = hashData(email);
  if (phone) userData.ph = hashData(phone.replace(/\D/g, "")); // Remove não-números antes do hash

  // Nome (separado em primeiro e último)
  if (name) {
    const names = name.trim().split(" ");
    if (names.length > 0) userData.fn = hashData(names[0]);
    if (names.length > 1) userData.ln = hashData(names[names.length - 1]);
  }

  // Cookies de identificação do Facebook (não hashados)
  if (fbc) userData.fbc = fbc;
  if (fbp) userData.fbp = fbp;

  // Dados de localização (hashados)
  if (city) userData.ct = hashData(city);
  if (state) userData.st = hashData(state);
  if (zipCode) userData.zp = hashData(zipCode.replace(/\D/g, "")); // Remove não-números antes do hash
  if (country) userData.country = hashData(country);

  return userData;
};
