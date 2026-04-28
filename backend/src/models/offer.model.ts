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

export type LayoutType = 'classic' | 'modern' | 'minimal' | 'hubla';
export type PaymentType = 'one_time' | 'subscription';
export type SubscriptionInterval = 'day' | 'week' | 'month' | 'year';

export interface IOffer extends Document {
  ownerId: Schema.Types.ObjectId;
  name: string;
  slug: string;
  layoutType: LayoutType;
  customDomain?: string; // Domínio customizado (ex: checkout.cliente.com.br)
  bannerImageUrl?: string;
  secondaryBannerImageUrl?: string;
  currency: string;
  language: string;
  collectAddress: boolean;
  cartAbandonmentEnabled?: boolean;
  thankYouPageUrl?: string;
  backRedirectUrl?: string; // URL para redirecionar quando o cliente tentar voltar
  autoNotifications?: {
    enabled: boolean;
    genderFilter: 'all' | 'male' | 'female';
    region: 'pt' | 'en' | 'es' | 'fr';
    intervalSeconds: number;
    soundEnabled: boolean;
  };
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
    fallbackCheckoutUrl?: string;
    customId?: string;
    downsell?: {
      name: string;
      price: number;
      redirectUrl: string;
      customId?: string;
      fallbackCheckoutUrl?: string;
      downsell?: {
        name: string;
        price: number;
        redirectUrl: string;
        customId?: string;
        fallbackCheckoutUrl?: string;
      };
    };
    paypalOneClickEnabled?: boolean;
    steps?: Array<{
      name: string;
      price: number;
      redirectUrl: string;
      customId?: string;
      fallbackCheckoutUrl?: string;
      downsell?: {
        name: string;
        price: number;
        redirectUrl: string;
        customId?: string;
        fallbackCheckoutUrl?: string;
        downsell?: {
          name: string;
          price: number;
          redirectUrl: string;
          customId?: string;
          fallbackCheckoutUrl?: string;
        };
      };
    }>;
  };

  membershipWebhook?: {
    enabled: boolean;
    url: string;
    authToken: string;
  };
  customId?: string;
  collectPhone: boolean;
  collectDocument: boolean; // <-- NOVO: Controla se CPF/CNPJ deve ser coletado
  paypalEnabled: boolean;
  pagarme_pix_enabled: boolean; // <-- NOVO: Controla se PIX da Pagar.me está ativo
  stripe_card_enabled: boolean; // <-- NOVO: Controla se Cartão de Crédito (Stripe) está ativo

  mainProduct: IProductSubDocument;
  orderBumps: IProductSubDocument[];

  checkoutStarted: number; // Contador de checkouts iniciados
  archived: boolean; // Se a oferta está arquivada
  isActive: boolean; // Se a oferta está ativa (pode ser acessada no checkout)
  group?: string; // Novo: campo para organizar ofertas em grupos
  categoryId?: Schema.Types.ObjectId; // Novo: referência ao model de Categoria/Pasta

  emailNotification?: {
    enabled: boolean;
    subject?: string;
    heading?: string;
    body?: string;
    imageUrl?: string;
    pdfUrl?: string;
  };

  paymentType: PaymentType;
  subscriptionInterval: SubscriptionInterval;

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
    layoutType: {
      type: String,
      enum: ['classic', 'modern', 'minimal', 'hubla'],
      default: 'classic',
    },
    customDomain: {
      type: String,
      unique: true,
      sparse: true, // Permite múltiplos nulls
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
      fallbackCheckoutUrl: { type: String, default: "" },
      customId: { type: String, default: "" },
      downsell: {
        name: { type: String, default: "" },
        price: { type: Number, default: 0 },
        redirectUrl: { type: String, default: "" },
        customId: { type: String, default: "" },
        fallbackCheckoutUrl: { type: String, default: "" },
        downsell: {
          name: { type: String, default: "" },
          price: { type: Number, default: 0 },
          redirectUrl: { type: String, default: "" },
          customId: { type: String, default: "" },
          fallbackCheckoutUrl: { type: String, default: "" },
        },
      },
      paypalOneClickEnabled: { type: Boolean, default: false },
      steps: {
        type: [
          {
            name: { type: String, default: "" },
            price: { type: Number, default: 0 },
            redirectUrl: { type: String, default: "" },
            customId: { type: String, default: "" },
            fallbackCheckoutUrl: { type: String, default: "" },
            downsell: {
              name: { type: String, default: "" },
              price: { type: Number, default: 0 },
              redirectUrl: { type: String, default: "" },
              customId: { type: String, default: "" },
              fallbackCheckoutUrl: { type: String, default: "" },
              downsell: {
                name: { type: String, default: "" },
                price: { type: Number, default: 0 },
                redirectUrl: { type: String, default: "" },
                customId: { type: String, default: "" },
                fallbackCheckoutUrl: { type: String, default: "" },
              },
            },
          },
        ],
        default: [],
      },
    },
    thankYouPageUrl: {
      type: String,
      default: "",
    },
    backRedirectUrl: {
      type: String,
      default: "",
    },
    autoNotifications: {
      enabled: { type: Boolean, default: false },
      genderFilter: { type: String, enum: ['all', 'male', 'female'], default: 'all' },
      region: { type: String, enum: ['pt', 'en', 'es', 'fr'], default: 'pt' },
      intervalSeconds: { type: Number, default: 10 },
      soundEnabled: { type: Boolean, default: true },
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
      enum: ["pt", "en", "fr", "es", "de", "it"],
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
    collectDocument: {
      type: Boolean,
      default: false,
    },
    cartAbandonmentEnabled: {
      type: Boolean,
      default: false,
    },
    paypalEnabled: {
      type: Boolean,
      default: false,
    },
    pagarme_pix_enabled: {
      type: Boolean,
      default: false,
    },
    stripe_card_enabled: {
      type: Boolean,
      default: true,
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
    archived: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    group: {
      type: String,
      default: "",
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      index: true,
    },
    emailNotification: {
      enabled: { type: Boolean, default: false },
      subject: { type: String, default: "" },
      heading: { type: String, default: "" },
      body: { type: String, default: "" },
      imageUrl: { type: String, default: "" },
      pdfUrl: { type: String, default: "" },
    },
    paymentType: {
      type: String,
      enum: ['one_time', 'subscription'],
      default: 'one_time',
    },
    subscriptionInterval: {
      type: String,
      enum: ['day', 'week', 'month', 'year'],
      default: 'month',
    },
  },
  { timestamps: true }
);

offerSchema.pre("save", function (next) {
  if (this.customDomain === "") {
    this.customDomain = undefined;
  }
  next();
});

offerSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() as Record<string, unknown>;
  if (update && update["customDomain"] === "") {
    update["customDomain"] = undefined;
  }
  next();
});

const Offer: Model<IOffer> = mongoose.models.Offer || model<IOffer>("Offer", offerSchema);

export default Offer;
