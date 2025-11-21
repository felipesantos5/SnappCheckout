import mongoose, { Schema, Document, Model, model } from "mongoose";

export interface ICheckoutMetric extends Document {
  offerId: mongoose.Types.ObjectId;
  type: "view" | "initiate_checkout";
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

const checkoutMetricSchema = new Schema<ICheckoutMetric>(
  {
    offerId: {
      type: Schema.Types.ObjectId,
      ref: "Offer",
      required: true,
      index: true, // Indexado para consultas rápidas
    },
    type: {
      type: String,
      enum: ["view", "initiate_checkout"],
      required: true,
    },
    ip: { type: String, default: "" }, // Essencial para FB CAPI
    userAgent: { type: String, default: "" }, // Essencial para FB CAPI
  },
  { timestamps: { createdAt: true, updatedAt: false } } // Só precisamos da data de criação
);

// Expira documentos antigos automaticamente após 90 dias para economizar banco (Opcional, boas práticas)
// checkoutMetricSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

const CheckoutMetric: Model<ICheckoutMetric> = mongoose.models.CheckoutMetric || model<ICheckoutMetric>("CheckoutMetric", checkoutMetricSchema);

export default CheckoutMetric;
