// src/models/sale.model.ts
import mongoose, { Schema, Document, model, Model } from "mongoose";

// Interface para os itens comprados (produto + bumps)
interface ISaleItem {
  name: string;
  priceInCents: number;
  isOrderBump: boolean;
  _id?: string;
  customId?: string;
}

// Interface para o documento de Venda
export interface ISale extends Document {
  ownerId: Schema.Types.ObjectId; // O vendedor (dono da oferta)
  offerId: Schema.Types.ObjectId; // A oferta usada
  abTestId?: Schema.Types.ObjectId; // O teste A/B (se aplicável)
  stripePaymentIntentId: string; // O ID do pagamento no Stripe (pi_...)

  customerName: string;
  customerEmail: string;
  customerPhone?: string;

  ip?: string;
  country?: string;
  userAgent?: string;

  // Dados do Facebook para CAPI (Conversion API)
  fbc?: string; // Cookie _fbc do Facebook
  fbp?: string; // Cookie _fbp do Facebook
  addressCity?: string;
  addressState?: string;
  addressZipCode?: string;
  addressCountry?: string;

  totalAmountInCents: number;
  platformFeeInCents: number;
  currency: string; // Moeda da transação (brl, usd, etc)

  status: "succeeded" | "pending" | "refunded" | "failed" | "abandoned";
  paymentMethod?: "stripe" | "paypal" | "pagarme"; // Método de pagamento usado
  gateway?: "stripe" | "paypal" | "pagarme"; // Gateway de pagamento (alias para paymentMethod)
  paymentMethodType?: string; // Tipo específico: "card", "paypal", "pix", etc.
  walletType?: "apple_pay" | "google_pay" | "samsung_pay" | null; // Tipo de wallet se aplicável

  // Campos específicos do Pagar.me
  pagarme_order_id?: string; // ID do pedido na Pagar.me
  pagarme_transaction_id?: string; // ID da transação PIX na Pagar.me
  
  failureReason?: string; // Motivo da falha (código de erro do Stripe)
  failureMessage?: string; // Mensagem de erro legível
  isUpsell: boolean;
  items: ISaleItem[]; // O que foi comprado
  createdAt: Date;
}

const saleItemSchema = new Schema<ISaleItem>(
  {
    name: { type: String, required: true },
    priceInCents: { type: Number, required: true },
    isOrderBump: { type: Boolean, default: false },
    customId: { type: String, default: "" },
  },
  { _id: true }
);

const saleSchema = new Schema<ISale>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    offerId: { type: Schema.Types.ObjectId, ref: "Offer", required: true },
    abTestId: { type: Schema.Types.ObjectId, ref: "ABTest", default: null },

    stripePaymentIntentId: { type: String, required: true, unique: true, index: true },

    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true, index: true },
    customerPhone: { type: String, default: "" },

    ip: { type: String, default: "" },
    country: { type: String, default: "BR" },
    userAgent: { type: String, default: "" },

    // Dados do Facebook para CAPI (Conversion API)
    fbc: { type: String, default: "" },
    fbp: { type: String, default: "" },
    addressCity: { type: String, default: "" },
    addressState: { type: String, default: "" },
    addressZipCode: { type: String, default: "" },
    addressCountry: { type: String, default: "" },

    isUpsell: { type: Boolean, default: false },

    totalAmountInCents: { type: Number, required: true },
    platformFeeInCents: { type: Number, required: true },
    currency: { type: String, required: true, default: "brl" },

    status: {
      type: String,
      enum: ["succeeded", "pending", "refunded", "failed", "abandoned"],
      default: "pending",
      index: true,
    },

    paymentMethod: {
      type: String,
      enum: ["stripe", "paypal", "pagarme"],
      default: "stripe",
    },

    gateway: {
      type: String,
      enum: ["stripe", "paypal", "pagarme"],
      default: "stripe",
    },

    paymentMethodType: {
      type: String,
      default: "",
    },

    walletType: {
      type: String,
      enum: ["apple_pay", "google_pay", "samsung_pay", null],
      default: null,
    },

    // Campos específicos do Pagar.me
    pagarme_order_id: {
      type: String,
      default: "",
      index: true,
    },
    pagarme_transaction_id: {
      type: String,
      default: "",
    },

    failureReason: { type: String, default: "" },
    failureMessage: { type: String, default: "" },

    items: [saleItemSchema],
  },
  { timestamps: true }
);

saleSchema.index({ offerId: 1, status: 1, createdAt: -1 });

const Sale: Model<ISale> = mongoose.models.Sale || model<ISale>("Sale", saleSchema);

export default Sale;
