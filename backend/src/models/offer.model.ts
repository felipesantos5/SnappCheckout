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
  customId: { type: String, default: "" },
});

export interface IProductSubDocument {
  _id?: string;
  name: string;
  headline?: string;
  description?: string;
  imageUrl?: string;
  priceInCents: number;
  compareAtPriceInCents?: number;
  customId?: string;
}

export interface IOffer extends Document {
  ownerId: Schema.Types.ObjectId;
  name: string;
  slug: string;
  bannerImageUrl?: string;
  secondaryBannerImageUrl?: string;
  currency: string;
  language: string;
  collectAddress: boolean;
  thankYouPageUrl?: string;
  primaryColor: string;
  buttonColor: string;
  backgroundColor: string;
  textColor: string;

  facebookPixelId?: string; // Mantido para retrocompatibilidade
  facebookAccessToken?: string; // Mantido para retrocompatibilidade
  facebookPixels?: Array<{ pixelId: string; accessToken: string }>; // Novo: array de pixels

  utmfyWebhookUrl?: string; // Mantido para retrocompatibilidade
  utmfyWebhookUrls?: string[]; // Novo: array de URLs
  upsell?: {
    enabled: boolean;
    name: string;
    price: number;
    redirectUrl: string;
    customId?: string;
  };

  membershipWebhook?: {
    enabled: boolean;
    url: string;
    authToken: string;
  };
  customId?: string;
  collectPhone: boolean;
  paypalEnabled: boolean;

  mainProduct: IProductSubDocument;
  orderBumps: IProductSubDocument[];

  checkoutStarted: number; // Contador de checkouts iniciados

  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
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
    facebookPixelId: {
      type: String,
      default: "",
      trim: true,
    },
    facebookAccessToken: {
      type: String,
      default: "",
      trim: true,
    },
    facebookPixels: {
      type: [
        {
          pixelId: { type: String, required: true },
          accessToken: { type: String, required: true },
        },
      ],
      default: [],
    },
    utmfyWebhookUrl: {
      type: String,
      default: "",
    },
    utmfyWebhookUrls: {
      type: [String],
      default: [],
    },
    upsell: {
      enabled: { type: Boolean, default: false },
      name: { type: String, default: "" },
      price: { type: Number, default: 0 },
      redirectUrl: { type: String, default: "" },
      customId: { type: String, default: "" },
    },
    thankYouPageUrl: {
      type: String,
      default: "",
    },
    bannerImageUrl: {
      type: String,
      default: "",
    },
    secondaryBannerImageUrl: {
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
    backgroundColor: {
      type: String,
      default: "#ffffff",
    },
    textColor: {
      type: String,
      default: "#0a0a0a",
    },
    currency: {
      type: String,
      required: true,
      default: "brl",
    },
    language: {
      type: String,
      required: true,
      enum: ["pt", "en", "fr", "es"],
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
    paypalEnabled: {
      type: Boolean,
      default: false,
    },
    mainProduct: {
      type: productSubSchema,
      required: true,
    },
    orderBumps: [productSubSchema],
    membershipWebhook: {
      enabled: { type: Boolean, default: false },
      url: { type: String, default: "" },
      authToken: { type: String, default: "" },
    },
    customId: { type: String, default: "" },
    checkoutStarted: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const Offer: Model<IOffer> = mongoose.models.Offer || model<IOffer>("Offer", offerSchema);

export default Offer;
