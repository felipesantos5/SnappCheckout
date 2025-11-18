// api/src/models/upsell-session.model.ts
import mongoose, { Schema, Document, model } from "mongoose";

export interface IUpsellSession extends Document {
  token: string;
  accountId: string;
  customerId: string;
  paymentMethodId: string;
  createdAt: Date;
}

const upsellSessionSchema = new Schema<IUpsellSession>(
  {
    token: { type: String, required: true, unique: true, index: true },
    accountId: { type: String, required: true },
    customerId: { type: String, required: true },
    paymentMethodId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 3600 }, // Expira em 1h (3600s)
  },
  { timestamps: true }
);

export default model<IUpsellSession>("UpsellSession", upsellSessionSchema);
