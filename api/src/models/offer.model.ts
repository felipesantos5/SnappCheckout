// src/models/offer.model.ts
import mongoose, { Schema, Document, model, Model } from "mongoose";

// --- NOVO ---
// Sub-documento para o produto (reutilizado)
// Isso define a "forma" de um produto que é salvo DENTRO da oferta
const productSubSchema = new Schema({
  name: { type: String, required: true },
  headline: { type: String, default: "" },
  description: { type: String, default: "" },
  imageUrl: { type: String, default: "" },
  priceInCents: { type: Number, required: true },
  compareAtPriceInCents: { type: Number, required: false },
});

export interface IProductSubDocument {
  _id?: string;
  name: string;
  headline?: string;
  description?: string;
  imageUrl?: string;
  priceInCents: number;
  compareAtPriceInCents?: number;
}

export interface IOffer extends Document {
  ownerId: Schema.Types.ObjectId;
  name: string;
  slug: string;
  bannerImageUrl?: string;
  currency: string;
  language: string;
  collectAddress: boolean;

  primaryColor: string;
  buttonColor: string;

  utmfyWebhookUrl?: string;
  upsellLink?: string;

  collectPhone: boolean;

  mainProduct: IProductSubDocument;
  orderBumps: IProductSubDocument[];
}

const offerSchema = new Schema<IOffer>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    utmfyWebhookUrl: {
      type: String,
      default: "",
    },
    upsellLink: {
      type: String,
      default: "",
    },
    bannerImageUrl: {
      type: String,
      default: "",
    },
    primaryColor: {
      type: String,
      default: "#374151",
    },
    buttonColor: {
      type: String,
      default: "#2563EB",
    },
    currency: {
      type: String,
      required: true,
      default: "brl",
    },
    language: {
      type: String,
      required: true,
      enum: ["pt", "en", "fr"],
      default: "pt",
    },
    collectAddress: {
      type: Boolean,
      default: false,
    },
    collectPhone: {
      type: Boolean,
      default: true,
    },

    // --- MUDANÇA PRINCIPAL ---
    // Agora esperamos o productSubSchema, não um ObjectId
    mainProduct: {
      type: productSubSchema,
      required: true,
    },
    orderBumps: [productSubSchema], // Um array de productSubSchema
  },
  { timestamps: true }
);

const Offer: Model<IOffer> = mongoose.models.Offer || model<IOffer>("Offer", offerSchema);

export default Offer;
