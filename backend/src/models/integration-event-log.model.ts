import mongoose, { Schema, Document, Model, model } from "mongoose";

export type IntegrationEventType =
  | "membership_webhook"
  | "generic_webhook"
  | "utmfy"
  | "facebook_capi";

export type IntegrationEventStatus = "success" | "failed";

export interface IIntegrationEventLog extends Document {
  ownerId: mongoose.Types.ObjectId;
  offerId?: mongoose.Types.ObjectId;
  saleId?: mongoose.Types.ObjectId;
  type: IntegrationEventType;
  event: string;
  status: IntegrationEventStatus;
  destinationUrl?: string;
  payload?: string;
  responseStatus?: number;
  errorMessage?: string;
  customerEmail?: string;
  customerName?: string;
  sentAt: Date;
}

const integrationEventLogSchema = new Schema<IIntegrationEventLog>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    offerId: { type: Schema.Types.ObjectId, ref: "Offer", index: true },
    saleId: { type: Schema.Types.ObjectId, ref: "Sale", index: true },
    type: {
      type: String,
      enum: ["membership_webhook", "generic_webhook", "utmfy", "facebook_capi"],
      required: true,
      index: true,
    },
    event: { type: String, required: true },
    status: { type: String, enum: ["success", "failed"], required: true, index: true },
    destinationUrl: { type: String },
    payload: { type: String },
    responseStatus: { type: Number },
    errorMessage: { type: String },
    customerEmail: { type: String },
    customerName: { type: String },
    sentAt: { type: Date, required: true, index: true },
  },
  { timestamps: false }
);

integrationEventLogSchema.index({ ownerId: 1, sentAt: -1 });
integrationEventLogSchema.index({ ownerId: 1, type: 1, sentAt: -1 });

const IntegrationEventLog: Model<IIntegrationEventLog> =
  mongoose.models.IntegrationEventLog ||
  model<IIntegrationEventLog>("IntegrationEventLog", integrationEventLogSchema);

export default IntegrationEventLog;
