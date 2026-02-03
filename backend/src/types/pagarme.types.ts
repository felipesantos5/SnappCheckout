// src/types/pagarme.types.ts

/**
 * Tipos e interfaces para integração com Pagar.me
 */

/**
 * Parâmetros para criação de pedido PIX
 */
export interface CreatePixOrderParams {
  amount: number; // Valor em centavos
  customerName: string;
  customerEmail: string;
  customerDocument: string; // CPF (apenas números)
  customerPhone?: string;
  offerId: string;
  userId: string;
  items: Array<{
    name: string;
    quantity: number;
    amount: number; // Valor unitário em centavos
  }>;
  expirationMinutes?: number; // Tempo de expiração do PIX (padrão: 30 minutos)
}

/**
 * Resposta da criação de pedido PIX
 */
export interface PixOrderResponse {
  orderId: string;
  transactionId: string;
  qrCode: string; // Código PIX "Copia e Cola"
  qrCodeUrl: string; // URL da imagem do QR Code
  expiresAt: string; // Data/hora de expiração
  amount: number;
  status: string;
}

/**
 * Detalhes de um pedido
 */
export interface OrderDetails {
  id: string;
  status: string;
  amount: number;
  currency: string;
  charges: Array<{
    id: string;
    status: string;
    amount: number;
    payment_method: string;
    last_transaction?: {
      id: string;
      status: string;
      qr_code?: string;
      qr_code_url?: string;
    };
  }>;
  customer: {
    name: string;
    email: string;
  };
  metadata?: Record<string, any>;
}

/**
 * Status possíveis de um pedido Pagar.me
 */
export type PagarMeOrderStatus = 
  | "pending"
  | "paid"
  | "canceled"
  | "failed"
  | "processing";

/**
 * Status possíveis de uma transação PIX
 */
export type PagarMePixStatus =
  | "pending"
  | "paid"
  | "expired"
  | "canceled";

/**
 * Evento de webhook Pagar.me
 */
export interface PagarMeWebhookEvent {
  id: string;
  type: string; // Ex: "order.paid"
  created_at: string;
  data: {
    id: string;
    status: string;
    amount: number;
    currency: string;
    metadata?: Record<string, any>;
    [key: string]: any;
  };
}

/**
 * Tipos de eventos de webhook suportados
 */
export type PagarMeWebhookEventType =
  | "order.paid"
  | "order.payment_failed"
  | "order.canceled"
  | "order.created";

/**
 * Payload do webhook UTMfy
 */
export interface UTMfyWebhookPayload {
  event: "sale.succeeded";
  gateway: "pagarme";
  sale_id: string;
  order_id: string;
  customer_name: string;
  customer_email: string;
  amount: number;
  currency: string;
  offer_slug: string;
  offer_name: string;
  items: Array<{
    name: string;
    priceInCents: number;
    isOrderBump: boolean;
  }>;
  created_at: Date;
}

/**
 * Payload do webhook Membership
 */
export interface MembershipWebhookPayload {
  event: "member.created";
  gateway: "pagarme";
  sale_id: string;
  order_id: string;
  customer_name: string;
  customer_email: string;
  offer_slug: string;
  offer_name: string;
  custom_id: string;
  created_at: Date;
}

/**
 * Configuração de credenciais Pagar.me
 */
export interface PagarMeCredentials {
  apiKey: string;
  encryptionKey: string;
}

/**
 * Resposta de validação de credenciais
 */
export interface CredentialsValidationResponse {
  valid: boolean;
  message?: string;
}

/**
 * Parâmetros para cálculo de receita
 */
export interface RevenueCalculationParams {
  userId: string;
  startDate: Date;
  endDate: Date;
  gateway?: "pagarme" | "stripe" | "paypal";
}

/**
 * Resposta de cálculo de receita
 */
export interface RevenueCalculationResponse {
  totalRevenue: number; // Em centavos
  totalSales: number;
  period: {
    start: Date;
    end: Date;
  };
  gateway: string;
}

/**
 * Erro da API Pagar.me
 */
export interface PagarMeAPIError {
  message: string;
  errors?: Record<string, string[]>;
  type?: string;
}

/**
 * Resposta padrão de sucesso
 */
export interface SuccessResponse<T = any> {
  success: true;
  data?: T;
  message?: string;
}

/**
 * Resposta padrão de erro
 */
export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: any;
  };
}

/**
 * Request body para criar pagamento PIX
 */
export interface CreatePixPaymentRequest {
  offerSlug: string;
  selectedOrderBumps?: string[];
  contactInfo: {
    name: string;
    email: string;
    document: string; // CPF
    phone?: string;
  };
  addressInfo?: {
    zipCode?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  metadata?: Record<string, any>;
}

/**
 * Response de criar pagamento PIX
 */
export interface CreatePixPaymentResponse extends SuccessResponse {
  saleId: string;
  orderId: string;
  qrCode: string;
  qrCodeUrl: string;
  expiresAt: string;
  amount: number;
  currency: string;
}

/**
 * Response de consultar status do pedido
 */
export interface GetOrderStatusResponse extends SuccessResponse {
  orderId: string;
  status: PagarMeOrderStatus;
  amount: number;
  saleStatus: "succeeded" | "pending" | "refunded" | "failed" | "abandoned";
}
