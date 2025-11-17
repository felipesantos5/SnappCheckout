// src/services/external-api.service.ts
import axios from "axios";
import { ISale } from "../models/sale.model";
import { IOffer } from "../models/offer.model";
import { IUser } from "../models/user.model";

/**
 * Interface para o payload que será enviado para a API externa
 * Customize conforme necessário
 */
interface ExternalAPIPayload {
  // Informações da venda
  saleId: string;
  stripePaymentIntentId: string;
  status: string;
  totalAmountInCents: number;
  platformFeeInCents: number;
  createdAt: Date;

  // Informações do cliente
  customer: {
    name: string;
    email: string;
  };

  // Informações do vendedor
  seller: {
    id: string;
    name: string;
    email: string;
    stripeAccountId: string;
  };

  // Informações da oferta
  offer: {
    id: string;
    name: string;
    slug: string;
  };

  // Itens comprados
  items: Array<{
    name: string;
    priceInCents: number;
    isOrderBump: boolean;
    _id?: string;
  }>;
}

/**
 * Envia os dados da venda para uma API externa
 * @param sale - O documento de venda do MongoDB
 * @param offer - A oferta relacionada (já populada com ownerId)
 */
export const sendSaleToExternalAPI = async (sale: ISale, offer: IOffer): Promise<void> => {
  // 1. Verifica se a URL da API externa está configurada
  const externalApiUrl = "https://api.utmify.com.br/webhooks/last-link?id=69164b11bcee7d9abeebd23d";

  if (!externalApiUrl) {
    console.log(`   ⚠️  EXTERNAL_API_URL não configurada. Disparo desabilitado.`);
    return;
  }

  // 2. Extrai informações do vendedor (owner)
  const owner = offer.ownerId as unknown as IUser;
  if (!owner) {
    throw new Error("Oferta não possui ownerId populado");
  }

  // 3. Monta o payload para envio
  const payload: ExternalAPIPayload = {
    // Venda
    saleId: (sale._id as any).toString(),
    stripePaymentIntentId: sale.stripePaymentIntentId,
    status: sale.status,
    totalAmountInCents: sale.totalAmountInCents,
    platformFeeInCents: sale.platformFeeInCents,
    createdAt: new Date(),

    // Cliente
    customer: {
      name: sale.customerName,
      email: sale.customerEmail,
    },

    // Vendedor
    seller: {
      id: (owner._id as any).toString(),
      name: owner.name,
      email: owner.email,
      stripeAccountId: owner.stripeAccountId || "",
    },

    // Oferta
    offer: {
      id: (offer._id as any).toString(),
      name: offer.name,
      slug: offer.slug,
    },

    // Itens
    items: sale.items.map((item) => ({
      name: item.name,
      priceInCents: item.priceInCents,
      isOrderBump: item.isOrderBump,
    })),
  };

  // 4. Faz a requisição POST para a API externa
  console.log(`   URL: ${externalApiUrl}`);
  console.log(`   Método: POST`);
  console.log(`   Timeout: 10s`);

  console.log(`\n📤 PAYLOAD SENDO ENVIADO:`);
  console.log(JSON.stringify(payload, null, 2));

  const headers: any = {
    "Content-Type": "application/json",
  };

  // Adiciona o API Key se estiver configurado

  try {
    const response = await axios.post(externalApiUrl, payload, {
      headers,
      timeout: 10000, // 10 segundos de timeout
    });

    console.log(`\n✅ RESPOSTA DA API EXTERNA:`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Data:`, JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    if (error.response) {
      // A API respondeu com erro
      console.error(`❌ API externa retornou erro:`, error.response.status, error.response.data);
      throw new Error(`API externa retornou ${error.response.status}: ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      // A requisição foi feita mas não houve resposta
      console.error(`❌ API externa não respondeu:`, error.message);
      throw new Error(`API externa não respondeu: ${error.message}`);
    } else {
      // Erro na configuração da requisição
      console.error(`❌ Erro ao configurar requisição:`, error.message);
      throw error;
    }
  }
};
