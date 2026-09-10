import mongoose, { Schema, Document } from "mongoose";

export interface IUploadReference {
  uploadId: mongoose.Types.ObjectId;
  fileName: string;
  publicUrl?: string;
}

export interface IDepartment {
  _id: mongoose.Types.ObjectId;
  name: string;
  code?: string;
  description?: string;
  color?: string;
  active: boolean;
}

export interface ITeam {
  _id: mongoose.Types.ObjectId;
  departmentId?: mongoose.Types.ObjectId;
  name: string;
  active: boolean;
}

export interface IJobTitle {
  _id: mongoose.Types.ObjectId;
  title: string;
  active: boolean;
}

export interface ILocation {
  _id: mongoose.Types.ObjectId;
  name: string;
  city: string;
  country: string;
  timezone: string;
}

export interface IOrganization extends Document {
  name: string;
  slug: string;
  domain?: string;
  description?: string;
  website?: string;
  industry?: string;
  size?: "1-10" | "11-50" | "51-250" | "251-1000" | "1000+";
  supportEmail?: string;
  status: "Active" | "Suspended";
  plan: "Starter" | "Growth" | "Professional" | "Enterprise";
  subscription?: {
    plan?: string;
    status?: string;
    seatLimit?: number;
    billingCycle?: string;
    renewsAt?: Date;
  };
  limits?: {
    maxUsers?: number;
    maxStorageGb?: number;
  };
  branding: {
    logo?: IUploadReference;
    favicon?: IUploadReference;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
  workspace: {
    timezone: string;
    locale: string;
    dateFormat: string;
    firstDayOfWeek: number;
  };
  departments: IDepartment[];
  categories: string[];
  teams: ITeam[];
  jobTitles: IJobTitle[];
  locations: ILocation[];
  notificationSettings: {
    assignmentEmail: boolean;
    reminderEmail: boolean;
    weeklyDigest: boolean;
  };
  securitySettings: {
    allowPasswordLogin: boolean;
    enforceMfa: boolean;
    sessionTimeout: number; // in seconds
  };
  analytics: {
    totalEmployees: number;
    activeEmployees: number;
    journeys: number;
    completionRate: number;
  };
  certificate?: {
    template: "classic" | "modern" | "minimalist";
    signatureUrl?: string;
    signatoryName?: string;
    signatoryTitle?: string;
  };
  ssoConfig?: {
    enabled: boolean;
    provider?: string;
    domain?: string;
    domains?: string[];
    entryPoint?: string;
    ssoUrl?: string;
    issuerId?: string;
    issuerUrl?: string;
    certificate?: string;
    enforceSSO?: boolean;
    status?: "active" | "disabled";
  };
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const UploadReferenceSchema = new Schema({
  uploadId: { type: Schema.Types.ObjectId, required: true },
  fileName: { type: String, required: true },
  publicUrl: { type: String },
});

const DepartmentSchema = new Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, trim: true },
  description: { type: String },
  color: { type: String },
  active: { type: Boolean, default: true },
});

const TeamSchema = new Schema({
  departmentId: { type: Schema.Types.ObjectId },
  name: { type: String, required: true, trim: true },
  active: { type: Boolean, default: true },
});

const JobTitleSchema = new Schema({
  title: { type: String, required: true, trim: true },
  active: { type: Boolean, default: true },
});

const LocationSchema = new Schema({
  name: { type: String, required: true, trim: true },
  city: { type: String, required: true },
  country: { type: String, required: true },
  timezone: { type: String, required: true },
});

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    domain: { type: String, lowercase: true, trim: true },
    description: { type: String },
    website: { type: String },
    industry: { type: String },
    size: {
      type: String,
      enum: ["1-10", "11-50", "51-250", "251-1000", "1000+"],
    },
    supportEmail: { type: String, lowercase: true, trim: true },
    status: { type: String, enum: ["Active", "Suspended"], default: "Active" },
    plan: { type: String, enum: ["Starter", "Growth", "Professional", "Enterprise"], default: "Starter" },
    subscription: {
      plan: { type: String, default: "Starter" },
      status: { type: String, default: "active" },
      seatLimit: { type: Number, default: 50 },
      billingCycle: { type: String, default: "monthly" },
      renewsAt: { type: Date }
    },
    limits: {
      maxUsers: { type: Number, default: 50 },
      maxStorageGb: { type: Number, default: 10 }
    },
    branding: {
      logo: { type: UploadReferenceSchema },
      favicon: { type: UploadReferenceSchema },
      primaryColor: { type: String, default: "#4F46E5" },
      secondaryColor: { type: String, default: "#10B981" },
      accentColor: { type: String, default: "#F59E0B" },
    },
    workspace: {
      timezone: { type: String, default: "UTC" },
      locale: { type: String, default: "en-US" },
      dateFormat: { type: String, default: "YYYY-MM-DD" },
      firstDayOfWeek: { type: Number, default: 0 },
    },
    departments: { type: [DepartmentSchema], default: [] },
    categories: { type: [String], default: ["Engineering", "Sales", "General"] },
    teams: { type: [TeamSchema], default: [] },
    jobTitles: { type: [JobTitleSchema], default: [] },
    locations: { type: [LocationSchema], default: [] },
    notificationSettings: {
      assignmentEmail: { type: Boolean, default: true },
      reminderEmail: { type: Boolean, default: true },
      weeklyDigest: { type: Boolean, default: true },
    },
    securitySettings: {
      allowPasswordLogin: { type: Boolean, default: true },
      enforceMfa: { type: Boolean, default: false },
      sessionTimeout: { type: Number, default: 3600 },
    },
    analytics: {
      totalEmployees: { type: Number, default: 0 },
      activeEmployees: { type: Number, default: 0 },
      journeys: { type: Number, default: 0 },
      completionRate: { type: Number, default: 0 },
    },
    certificate: {
      template: { type: String, enum: ["classic", "modern", "minimalist"], default: "classic" },
      signatureUrl: { type: String },
      signatoryName: { type: String },
      signatoryTitle: { type: String },
    },
    ssoConfig: {
      enabled: { type: Boolean, default: false },
      provider: { type: String, default: "okta" },
      domain: { type: String },
      domains: { type: [String], default: [] },
      entryPoint: { type: String },
      ssoUrl: { type: String },
      issuerId: { type: String },
      issuerUrl: { type: String },
      certificate: { type: String },
      enforceSSO: { type: Boolean, default: false },
      status: { type: String, enum: ["active", "disabled"], default: "disabled" },
    },
    createdBy: { type: Schema.Types.ObjectId, required: true },
    updatedBy: { type: Schema.Types.ObjectId },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId },
  },
  {
    timestamps: true,
  }
);

// Indexes
OrganizationSchema.index({ name: 1 });
OrganizationSchema.index({ isDeleted: 1 });

export const Organization = mongoose.model<IOrganization>("Organization", OrganizationSchema);
export default Organization;
