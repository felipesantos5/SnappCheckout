// src/services/pagarme.service.ts
import axios, { AxiosError } from "axios";
import { getAxiosConfig } from "../lib/http-client";
import Sale from "../models/sale.model";
import { Schema } from "mongoose";

// URL base da API Pagar.me v5
const PAGARME_API_URL = process.env.PAGARME_API_URL || "https://api.pagar.me/core/v5";
const PAGARME_TIMEOUT = 30000; // 30 segundos

/**
 * Interface para os parâmetros de criação de pedido PIX
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
 * Interface para a resposta da criação de pedido PIX
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
 * Interface para detalhes de um pedido
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
 * Classe de serviço para integração com Pagar.me
 */
export class PagarMeService {
  private apiKey: string;
  private encryptionKey: string;

  constructor(apiKey: string, encryptionKey: string) {
    if (!apiKey || !encryptionKey) {
      throw new Error("Credenciais da Pagar.me não fornecidas");
    }
    this.apiKey = apiKey;
    this.encryptionKey = encryptionKey;
  }

  /**
   * Gera os headers de autenticação para a API
   */
  private getHeaders(): Record<string, string> {
    // A API v5 da Pagar.me usa Basic Auth com a API Key como username
    const auth = Buffer.from(`${this.apiKey}:`).toString("base64");
    
    return {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Formata o CPF removendo caracteres não numéricos
   */
  private formatDocument(document: string): string {
    return document.replace(/\D/g, "");
  }

  /**
   * Formata o telefone no padrão esperado pela Pagar.me
   */
  private formatPhone(phone?: string): { country_code: string; area_code: string; number: string } | undefined {
    if (!phone) {
      return undefined;
    }

    const cleaned = phone.replace(/\D/g, "");
    
    // Assume formato brasileiro: +55 (XX) XXXXX-XXXX ou +55 (XX) XXXX-XXXX
    if (cleaned.length >= 10) {
      const countryCode = cleaned.startsWith("55") ? "55" : "55";
      const withoutCountry = cleaned.startsWith("55") ? cleaned.slice(2) : cleaned;
      const areaCode = withoutCountry.slice(0, 2);
      const number = withoutCountry.slice(2);

      return {
        country_code: countryCode,
        area_code: areaCode,
        number: number,
      };
    }

    return undefined;
  }

  /**
   * Cria um pedido PIX na Pagar.me
   */
  async createPixOrder(params: CreatePixOrderParams): Promise<PixOrderResponse> {
    const {
      amount,
      customerName,
      customerEmail,
      customerDocument,
      customerPhone,
      offerId,
      userId,
      items,
      expirationMinutes = 30,
    } = params;

    // Validações
    if (amount <= 0) {
      throw new Error("Valor do pedido deve ser maior que zero");
    }

    if (!customerName || !customerEmail || !customerDocument) {
      throw new Error("Dados do cliente incompletos");
    }

    const document = this.formatDocument(customerDocument);
    if (document.length !== 11 && document.length !== 14) {
      throw new Error("CPF/CNPJ inválido");
    }


    try {
      // Monta o payload conforme a API v5 da Pagar.me
      const payload = {
        customer: {
          name: customerName,
          email: customerEmail,
          document: document,
          type: document.length === 11 ? "individual" : "company",
          ...(customerPhone && { phones: { mobile_phone: this.formatPhone(customerPhone) } }),
        },
        items: items.map((item) => ({
          amount: item.amount,
          description: item.name,
          quantity: item.quantity,
        })),
        payments: [
          {
            payment_method: "pix",
            pix: {
              expires_in: expirationMinutes * 60, // Converte minutos para segundos
            },
          },
        ],
        metadata: {
          offer_id: offerId,
          user_id: userId,
          integration: "snappcheckout",
        },
      };

      const response = await axios.post(`${PAGARME_API_URL}/orders`, payload, {
        headers: this.getHeaders(),
        ...getAxiosConfig(PAGARME_TIMEOUT),
      });

      const data = response.data;

      // Extrai os dados do PIX da resposta
      const charge = data.charges?.[0];
      if (!charge) {
        throw new Error("Resposta da Pagar.me não contém charge");
      }

      const lastTransaction = charge.last_transaction;
      if (!lastTransaction || !lastTransaction.qr_code) {
        throw new Error("Resposta da Pagar.me não contém dados do PIX");
      }


      return {
        orderId: data.id,
        transactionId: lastTransaction.id,
        qrCode: lastTransaction.qr_code,
        qrCodeUrl: lastTransaction.qr_code_url || "",
        expiresAt: lastTransaction.expires_at || "",
        amount: data.amount,
        status: data.status,
      };
    } catch (error: any) {
      console.error("[Pagar.me] Erro ao criar pedido PIX:", error.response?.data || error.message);

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;
        const errorData = axiosError.response?.data;

        if (errorData?.errors) {
          const errorMessages = Object.values(errorData.errors).flat().join(", ");
          throw new Error(`Pagar.me: ${errorMessages}`);
        }

        if (errorData?.message) {
          throw new Error(`Pagar.me: ${errorData.message}`);
        }
      }

      throw new Error(`Falha ao criar pedido PIX: ${error.message}`);
    }
  }

  /**
   * Consulta os detalhes de um pedido
   */
  async getOrderDetails(orderId: string): Promise<OrderDetails> {
    if (!orderId) {
      throw new Error("ID do pedido não fornecido");
    }


    try {
      const response = await axios.get(`${PAGARME_API_URL}/orders/${orderId}`, {
        headers: this.getHeaders(),
        ...getAxiosConfig(PAGARME_TIMEOUT),
      });

      return response.data;
    } catch (error: any) {
      console.error("[Pagar.me] Erro ao consultar pedido:", error.response?.data || error.message);

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;
        const errorData = axiosError.response?.data;

        if (errorData?.message) {
          throw new Error(`Pagar.me: ${errorData.message}`);
        }
      }

      throw new Error(`Falha ao consultar pedido: ${error.message}`);
    }
  }

  /**
   * Calcula a receita total de vendas confirmadas via Pagar.me em um período
   */
  async calculateRevenue(userId: string, startDate: Date, endDate: Date): Promise<number> {
    try {

      const sales = await Sale.find({
        ownerId: new Schema.Types.ObjectId(userId),
        gateway: "pagarme",
        status: "succeeded",
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      }).select("totalAmountInCents");

      const totalRevenue = sales.reduce((sum, sale) => sum + sale.totalAmountInCents, 0);

      return totalRevenue;
    } catch (error: any) {
      console.error("[Pagar.me] Erro ao calcular receita:", error.message);
      throw new Error(`Falha ao calcular receita: ${error.message}`);
    }
  }

  /**
   * Verifica se as credenciais são válidas fazendo uma requisição de teste
   */
  async validateCredentials(): Promise<boolean> {
    try {
      // Tenta fazer uma requisição simples para validar as credenciais
      await axios.get(`${PAGARME_API_URL}/orders?page=1&size=1`, {
        headers: this.getHeaders(),
        ...getAxiosConfig(PAGARME_TIMEOUT),
      });

      return true;
    } catch (error: any) {
      console.error("[Pagar.me] Credenciais inválidas:", error.response?.data || error.message);
      return false;
    }
  }
}

/**
 * Factory function para criar uma instância do serviço
 */
export const createPagarMeService = (apiKey: string, encryptionKey: string): PagarMeService => {
  return new PagarMeService(apiKey, encryptionKey);
};
