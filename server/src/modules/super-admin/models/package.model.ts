import mongoose, { Schema, Document } from "mongoose";

export interface IPackageFeature {
  featureKey: string;
  name: string;
  module: "learning" | "operations" | "compliance" | "people" | "intelligence" | "enterprise";
  description?: string;
  enabled: boolean;
  isAddOn: boolean;
  addOnPriceMonthly?: number;
  addOnPriceAnnual?: number;
}

export interface IPackage extends Document {
  name: string;
  slug: string;
  description: string;
  badge?: string;
  tier: "free" | "standard" | "custom" | "enterprise";
  isPublic: boolean;
  isDefault: boolean;
  status: "active" | "archived" | "draft";
  billing: {
    basePriceMonthly: number;
    basePriceAnnual: number;
    currency: string;
  };
  limits: {
    maxUsers: number;
    maxStorageGb: number;
    maxJourneys?: number;
    maxKiosks?: number;
    aiTokenMonthlyLimit?: number;
  };
  features: IPackageFeature[];
  metadata?: Record<string, any>;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PackageFeatureSchema = new Schema<IPackageFeature>(
  {
    featureKey: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    module: {
      type: String,
      enum: ["learning", "operations", "compliance", "people", "intelligence", "enterprise"],
      required: true,
      default: "operations",
    },
    description: { type: String, default: "" },
    enabled: { type: Boolean, default: false },
    isAddOn: { type: Boolean, default: false },
    addOnPriceMonthly: { type: Number, default: 0, min: 0 },
    addOnPriceAnnual: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const PackageSchema = new Schema<IPackage>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, default: "", trim: true },
    badge: { type: String, default: "", trim: true },
    tier: {
      type: String,
      enum: ["free", "standard", "custom", "enterprise"],
      default: "standard",
    },
    isPublic: { type: Boolean, default: true, index: true },
    isDefault: { type: Boolean, default: false, index: true },
    status: {
      type: String,
      enum: ["active", "archived", "draft"],
      default: "active",
      index: true,
    },
    billing: {
      basePriceMonthly: { type: Number, default: 0, min: 0 },
      basePriceAnnual: { type: Number, default: 0, min: 0 },
      currency: { type: String, default: "USD", uppercase: true },
    },
    limits: {
      maxUsers: { type: Number, default: 25, min: 1 },
      maxStorageGb: { type: Number, default: 10, min: 1 },
      maxJourneys: { type: Number, default: 10, min: 0 },
      maxKiosks: { type: Number, default: 5, min: 0 },
      aiTokenMonthlyLimit: { type: Number, default: 500000, min: 0 },
    },
    features: [PackageFeatureSchema],
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    collection: "packages",
  }
);

PackageSchema.index({ status: 1, isPublic: 1 });

const Package = (mongoose.models.Package as mongoose.Model<IPackage>) ||
  mongoose.model<IPackage>("Package", PackageSchema);

export { Package, Package as PackageModel };
export default Package;
