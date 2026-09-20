import mongoose, { Schema, Document } from "mongoose";

export interface IFeatureFlag extends Document {
  key: string;
  name: string;
  description: string;
  isEnabled: boolean;
  environment: "all" | "production" | "staging" | "development";
  targetAudience: "global" | "organizations" | "roles" | "percentage";
  targetOrganizationIds: mongoose.Types.ObjectId[];
  excludedOrganizationIds: mongoose.Types.ObjectId[];
  targetRoles: ("owner" | "admin" | "hr_admin" | "manager" | "employee" | "it_admin" | "super_admin")[];
  rolloutPercentage: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Virtual accessors
  enabled: boolean;
  rolloutPct: number;
  // Instance methods
  isOrgTargeted(orgId: string | mongoose.Types.ObjectId): boolean;
}

const FeatureFlagSchema = new Schema<IFeatureFlag>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    isEnabled: {
      type: Boolean,
      default: false,
    },
    environment: {
      type: String,
      enum: ["all", "production", "staging", "development"],
      default: "all",
    },
    targetAudience: {
      type: String,
      enum: ["global", "organizations", "roles", "percentage"],
      default: "global",
    },
    targetOrganizationIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Organization",
      },
    ],
    excludedOrganizationIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Organization",
      },
    ],
    targetRoles: [
      {
        type: String,
        enum: ["owner", "admin", "hr_admin", "manager", "employee", "it_admin", "super_admin"],
      },
    ],
    rolloutPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 100,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: "feature_flags",
  }
);

// Indexes
FeatureFlagSchema.index({ targetOrganizationIds: 1 });
FeatureFlagSchema.index({ excludedOrganizationIds: 1 });
FeatureFlagSchema.index({ isDeleted: 1 });

// Virtuals for backward compatibility with legacy consumers
FeatureFlagSchema.virtual("enabled")
  .get(function () {
    return this.isEnabled;
  })
  .set(function (val: boolean) {
    this.isEnabled = val;
  });

FeatureFlagSchema.virtual("rolloutPct")
  .get(function () {
    return this.rolloutPercentage;
  })
  .set(function (val: number) {
    this.rolloutPercentage = val;
  });

FeatureFlagSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.enabled = ret.isEnabled;
    ret.rolloutPct = ret.rolloutPercentage;
    return ret;
  },
});

FeatureFlagSchema.set("toObject", {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.enabled = ret.isEnabled;
    ret.rolloutPct = ret.rolloutPercentage;
    return ret;
  },
});

// Helper instance method for organization targeting with deny precedence
FeatureFlagSchema.methods.isOrgTargeted = function (orgId: string | mongoose.Types.ObjectId): boolean {
  const orgStr = orgId.toString();

  // 1. Excluded takes strict precedence (deny dominates)
  if (this.excludedOrganizationIds?.some((id: any) => (id._id || id).toString() === orgStr)) {
    return false;
  }

  // 2. Targeted overrides allow specific access even if global is disabled
  if (this.targetOrganizationIds?.some((id: any) => (id._id || id).toString() === orgStr)) {
    return true;
  }

  // 3. Fallback to global enablement & rollout
  if (!this.isEnabled) {
    return false;
  }

  if (this.targetAudience === "organizations") {
    // Only organizations in targetOrganizationIds are enabled
    return false;
  }

  if (this.rolloutPercentage === 0) {
    return false;
  }

  return true;
};

export const FeatureFlag = mongoose.model<IFeatureFlag>("FeatureFlag", FeatureFlagSchema);
export default FeatureFlag;
