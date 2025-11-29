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
  stripePaymentIntentId: string; // O ID do pagamento no Stripe (pi_...)

  customerName: string;
  customerEmail: string;

  ip?: string;
  country?: string;

  totalAmountInCents: number;
  platformFeeInCents: number;
  currency: string; // Moeda da transação (brl, usd, etc)

  status: "succeeded" | "pending" | "refunded" | "failed";
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

    stripePaymentIntentId: { type: String, required: true, unique: true, index: true },

    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true, index: true },

    ip: { type: String, default: "" },
    country: { type: String, default: "BR" },

    isUpsell: { type: Boolean, default: false },

    totalAmountInCents: { type: Number, required: true },
    platformFeeInCents: { type: Number, required: true },
    currency: { type: String, required: true, default: "brl" },

    status: {
      type: String,
      enum: ["succeeded", "pending", "refunded", "failed"],
      default: "pending",
    },

    failureReason: { type: String, default: "" },
    failureMessage: { type: String, default: "" },

    items: [saleItemSchema],
  },
  { timestamps: true }
);

const Sale: Model<ISale> = mongoose.models.Sale || model<ISale>("Sale", saleSchema);

export default Sale;
