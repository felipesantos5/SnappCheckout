import mongoose, { Schema, Document, Model, model } from "mongoose";

export type EmailLogType = "purchase_confirmation" | "cart_abandonment";
export type EmailLogStatus = "sent" | "failed";

export interface IEmailLog extends Document {
  ownerId: mongoose.Types.ObjectId;
  offerId?: mongoose.Types.ObjectId;
  type: EmailLogType;
  to: string;
  customerName: string;
  subject: string;
  htmlContent: string;
  status: EmailLogStatus;
  errorMessage?: string;
  sentAt: Date;
}

const emailLogSchema = new Schema<IEmailLog>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    offerId: { type: Schema.Types.ObjectId, ref: "Offer", index: true },
    type: {
      type: String,
      enum: ["purchase_confirmation", "cart_abandonment"],
      required: true,
      index: true,
    },
    to: { type: String, required: true },
    customerName: { type: String, default: "" },
    subject: { type: String, required: true },
    htmlContent: { type: String, required: true },
    status: { type: String, enum: ["sent", "failed"], required: true, index: true },
    errorMessage: { type: String },
    sentAt: { type: Date, required: true, index: true },
  },
  { timestamps: false }
);

emailLogSchema.index({ ownerId: 1, sentAt: -1 });
emailLogSchema.index({ ownerId: 1, type: 1, sentAt: -1 });

const EmailLog: Model<IEmailLog> =
  mongoose.models.EmailLog || model<IEmailLog>("EmailLog", emailLogSchema);

export default EmailLog;
