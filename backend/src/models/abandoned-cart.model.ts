import mongoose, { Schema, Document, Model, model } from "mongoose";

export interface IAbandonedCart extends Document {
  offerId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  customerEmail: string;
  customerName: string;
  emailSent: boolean;
  emailSentAt?: Date;
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
    convertedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

// Garante um único registro por email+oferta (upsert seguro)
abandonedCartSchema.index({ customerEmail: 1, offerId: 1 }, { unique: true });
// Índice para o job de disparo
abandonedCartSchema.index({ emailSent: 1, convertedAt: 1, createdAt: 1 });

const AbandonedCart: Model<IAbandonedCart> =
  mongoose.models.AbandonedCart || model<IAbandonedCart>("AbandonedCart", abandonedCartSchema);

export default AbandonedCart;
