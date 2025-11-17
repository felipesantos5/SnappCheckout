// src/models/sale.model.ts
import mongoose, { Schema, Document, model, Model } from "mongoose";

// Interface para os itens comprados (produto + bumps)
interface ISaleItem {
  name: string;
  priceInCents: number;
  isOrderBump: boolean;
  _id?: string;
}

// Interface para o documento de Venda
export interface ISale extends Document {
  ownerId: Schema.Types.ObjectId; // O vendedor (dono da oferta)
  offerId: Schema.Types.ObjectId; // A oferta usada
  stripePaymentIntentId: string; // O ID do pagamento no Stripe (pi_...)

  customerName: string;
  customerEmail: string;

  totalAmountInCents: number;
  platformFeeInCents: number;

  status: "succeeded" | "pending" | "refunded";

  items: ISaleItem[]; // O que foi comprado
}

const saleItemSchema = new Schema<ISaleItem>(
  {
    name: { type: String, required: true },
    priceInCents: { type: Number, required: true },
    isOrderBump: { type: Boolean, default: false },
  },
  { _id: false }
);

const saleSchema = new Schema<ISale>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    offerId: { type: Schema.Types.ObjectId, ref: "Offer", required: true },

    stripePaymentIntentId: { type: String, required: true, unique: true, index: true },

    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true, index: true },

    totalAmountInCents: { type: Number, required: true },
    platformFeeInCents: { type: Number, required: true },

    status: {
      type: String,
      enum: ["succeeded", "pending", "refunded"],
      default: "pending",
    },

    items: [saleItemSchema],
  },
  { timestamps: true }
);

const Sale: Model<ISale> = mongoose.models.Sale || model<ISale>("Sale", saleSchema);

export default Sale;
