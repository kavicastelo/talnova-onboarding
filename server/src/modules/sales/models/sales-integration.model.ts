import mongoose, { Schema, Document } from "mongoose";

export interface ISalesIntegration extends Document {
  category: "email" | "whatsapp" | "ai" | "webhook";
  provider: "ses" | "sendgrid" | "smtp" | "meta_whatsapp" | "twilio_whatsapp" | "openai" | "gemini" | "generic_webhook";
  name: string;
  enabled: boolean;
  status: "not_configured" | "configured" | "valid" | "invalid";
  publicConfig: Record<string, any>;
  encryptedSecrets: Map<string, string>;
  lastValidatedAt?: Date;
  validationError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SalesIntegrationSchema = new Schema<ISalesIntegration>(
  {
    category: {
      type: String,
      enum: ["email", "whatsapp", "ai", "webhook"],
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ["ses", "sendgrid", "smtp", "meta_whatsapp", "twilio_whatsapp", "openai", "gemini", "generic_webhook"],
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["not_configured", "configured", "valid", "invalid"],
      default: "not_configured",
      index: true,
    },
    publicConfig: { type: Schema.Types.Mixed, default: {} },
    encryptedSecrets: { type: Map, of: String, default: {} },
    lastValidatedAt: { type: Date },
    validationError: { type: String },
  },
  {
    timestamps: true,
  }
);

SalesIntegrationSchema.index({ category: 1, provider: 1 }, { unique: true });

export const SalesIntegration = mongoose.model<ISalesIntegration>("SalesIntegration", SalesIntegrationSchema);
export default SalesIntegration;
