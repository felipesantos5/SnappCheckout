import mongoose, { Schema, Document, model, Model } from "mongoose";

export interface IPaypalBillingCycle extends Document {
  userId: Schema.Types.ObjectId;
  cycleStart: Date;
  cycleEnd: Date;
  totalPaypalRevenueInCents: number;
  feeAmountInCents: number;
  status: "pending" | "paid" | "waived";
  stripeSessionId: string;
  paidAt: Date | null;
}

const paypalBillingCycleSchema = new Schema<IPaypalBillingCycle>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    cycleStart: { type: Date, required: true },
    cycleEnd: { type: Date, required: true },
    totalPaypalRevenueInCents: { type: Number, required: true, default: 0 },
    feeAmountInCents: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ["pending", "paid", "waived"], default: "pending" },
    stripeSessionId: { type: String, default: "" },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const PaypalBillingCycle: Model<IPaypalBillingCycle> =
  mongoose.models.PaypalBillingCycle || model<IPaypalBillingCycle>("PaypalBillingCycle", paypalBillingCycleSchema);

export default PaypalBillingCycle;
