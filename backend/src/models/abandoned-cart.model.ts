import mongoose, { Schema, Document, Model, model } from "mongoose";

export interface IAbandonedCart extends Document {
  offerId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  customerEmail: string;
  customerName: string;
  // Legacy — mantido para compatibilidade com métricas existentes
  emailSent: boolean;
  emailSentAt?: Date;
  // Controle de lembretes
  reminder1SentAt?: Date; // 1º lembrete: 30 min após abandono
  reminder2SentAt?: Date; // 2º lembrete: 1 hora após abandono
  convertedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const abandonedCartSchema = new Schema<IAbandonedCart>(
  {
    offerId: { type: Schema.Types.ObjectId, ref: "Offer", required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    customerEmail: { type: String, required: true },
    customerName: { type: String, default: "" },
    emailSent: { type: Boolean, default: false, index: true },
    emailSentAt: { type: Date, default: null },
    reminder1SentAt: { type: Date, default: null },
    reminder2SentAt: { type: Date, default: null },
    convertedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

// Garante um único registro por email+oferta (upsert seguro)
abandonedCartSchema.index({ customerEmail: 1, offerId: 1 }, { unique: true });
// Índice para o job de disparo (wave 1 e wave 2)
abandonedCartSchema.index({ reminder1SentAt: 1, convertedAt: 1, createdAt: 1 });
abandonedCartSchema.index({ reminder2SentAt: 1, convertedAt: 1, createdAt: 1 });

const AbandonedCart: Model<IAbandonedCart> =
  mongoose.models.AbandonedCart || model<IAbandonedCart>("AbandonedCart", abandonedCartSchema);

export default AbandonedCart;
