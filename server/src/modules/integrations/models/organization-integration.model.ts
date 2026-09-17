import mongoose, { Schema, Document } from "mongoose";

export type IntegrationType = "ai" | "email";
export type IntegrationStatus = "not_configured" | "configured" | "valid" | "invalid" | "disabled";

export interface IOrganizationIntegration extends Document {
  organizationId: mongoose.Types.ObjectId;
  type: IntegrationType;
  provider: string; // "openai" | "azure_openai" | "anthropic" | "gemini" | "custom" | "smtp" | "resend" | "sendgrid"
  name?: string;
  status: IntegrationStatus;
  encryptedConfig?: string;
  publicConfig: Record<string, any>;
  lastValidatedAt?: Date;
  validationError?: string;
  enabled: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationIntegrationSchema = new Schema<IOrganizationIntegration>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Organization",
      index: true,
    },
    type: {
      type: String,
      enum: ["ai", "email"],
      required: true,
    },
    provider: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["not_configured", "configured", "valid", "invalid", "disabled"],
      default: "not_configured",
    },
    encryptedConfig: {
      type: String,
      default: "",
    },
    publicConfig: {
      type: Schema.Types.Mixed,
      default: {},
    },
    lastValidatedAt: {
      type: Date,
    },
    validationError: {
      type: String,
      default: "",
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index: only 1 AI integration and 1 Email integration per organization
OrganizationIntegrationSchema.index({ organizationId: 1, type: 1 }, { unique: true });

export const OrganizationIntegration =
  (mongoose.models.OrganizationIntegration as mongoose.Model<IOrganizationIntegration>) ||
  mongoose.model<IOrganizationIntegration>(
    "OrganizationIntegration",
    OrganizationIntegrationSchema,
    "organization_integrations"
  );

export default OrganizationIntegration;
