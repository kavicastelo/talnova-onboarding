import mongoose, { Schema, Document } from "mongoose";

export interface ISSORoleMapping {
  idpGroup: string;
  role: "admin" | "manager" | "employee";
}

export interface ISSOConfig extends Document {
  organizationId: mongoose.Types.ObjectId;
  provider: "okta" | "azure_ad" | "google_workspace" | "custom_saml" | "custom_oidc";
  domains: string[];
  issuerUrl?: string;
  clientId?: string;
  clientSecret?: string;
  ssoUrl?: string;
  certificate?: string;
  enforceSSO: boolean;
  defaultRole: "admin" | "manager" | "employee";
  roleMappings: ISSORoleMapping[];
  status: "active" | "disabled";
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SSORoleMappingSchema = new Schema<ISSORoleMapping>(
  {
    idpGroup: { type: String, required: true },
    role: { type: String, enum: ["admin", "manager", "employee"], default: "employee" },
  },
  { _id: false }
);

const SSOConfigSchema = new Schema<ISSOConfig>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: "Organization", unique: true },
    provider: {
      type: String,
      enum: ["okta", "azure_ad", "google_workspace", "custom_saml", "custom_oidc"],
      default: "okta",
    },
    domains: { type: [String], default: [] },
    issuerUrl: { type: String },
    clientId: { type: String },
    clientSecret: { type: String },
    ssoUrl: { type: String },
    certificate: { type: String },
    enforceSSO: { type: Boolean, default: false },
    defaultRole: { type: String, enum: ["admin", "manager", "employee"], default: "employee" },
    roleMappings: { type: [SSORoleMappingSchema], default: [] },
    status: { type: String, enum: ["active", "disabled"], default: "active" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
  }
);

SSOConfigSchema.index({ domains: 1 });

export const SSOConfig = mongoose.model<ISSOConfig>("SSOConfig", SSOConfigSchema);
export default SSOConfig;
