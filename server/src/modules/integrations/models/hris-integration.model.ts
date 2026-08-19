import mongoose, { Schema, Document } from "mongoose";

export interface IFieldMapping {
  externalField: string;
  internalField: string; // e.g. 'email', 'firstName', 'lastName', 'department', 'jobTitle'
}

export interface IHRISIntegration extends Document {
  organizationId: mongoose.Types.ObjectId;
  provider: "bamboohr" | "workday" | "rippling" | "personio" | "custom_webhook";
  name: string;
  status: "active" | "disabled" | "error";
  apiKey?: string;
  apiSecret?: string;
  webhookSecret?: string;
  subdomain?: string;
  baseUrl?: string;
  fieldMappings: IFieldMapping[];
  conflictPolicy: "hris_wins" | "local_wins";
  autoProvisionJourneys: boolean;
  syncFrequencyMinutes: number;
  lastSyncedAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FieldMappingSchema = new Schema<IFieldMapping>(
  {
    externalField: { type: String, required: true },
    internalField: { type: String, required: true },
  },
  { _id: false }
);

const HRISIntegrationSchema = new Schema<IHRISIntegration>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    provider: {
      type: String,
      enum: ["bamboohr", "workday", "rippling", "personio", "custom_webhook"],
      required: true,
    },
    name: { type: String, required: true },
    status: { type: String, enum: ["active", "disabled", "error"], default: "active" },
    apiKey: { type: String },
    apiSecret: { type: String },
    webhookSecret: { type: String },
    subdomain: { type: String },
    baseUrl: { type: String },
    fieldMappings: {
      type: [FieldMappingSchema],
      default: [
        { externalField: "work_email", internalField: "email" },
        { externalField: "first_name", internalField: "firstName" },
        { externalField: "last_name", internalField: "lastName" },
        { externalField: "department", internalField: "department" },
        { externalField: "job_title", internalField: "jobTitle" },
      ],
    },
    conflictPolicy: { type: String, enum: ["hris_wins", "local_wins"], default: "hris_wins" },
    autoProvisionJourneys: { type: Boolean, default: true },
    syncFrequencyMinutes: { type: Number, default: 60 },
    lastSyncedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
  },
  {
    timestamps: true,
  }
);

HRISIntegrationSchema.index({ organizationId: 1, provider: 1 });

export const HRISIntegration = mongoose.model<IHRISIntegration>("HRISIntegration", HRISIntegrationSchema);
export default HRISIntegration;
