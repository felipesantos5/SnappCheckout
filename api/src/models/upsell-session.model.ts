// api/src/models/upsell-session.model.ts
import mongoose, { Schema, Document, model } from "mongoose";

export interface IUpsellSession extends Document {
  token: string;
  accountId: string;
  customerId: string;
  paymentMethodId: string;
  offerId: mongoose.Schema.Types.ObjectId;
  createdAt: Date;
}

const upsellSessionSchema = new Schema<IUpsellSession>(
  {
    token: { type: String, required: true, unique: true, index: true },
    accountId: { type: String, required: true },
    customerId: { type: String, required: true },
    paymentMethodId: { type: String, required: true },
    offerId: { type: Schema.Types.ObjectId, ref: "Offer", required: true },
  },
  { timestamps: true }
);

export default model<IUpsellSession>("UpsellSession", upsellSessionSchema);
