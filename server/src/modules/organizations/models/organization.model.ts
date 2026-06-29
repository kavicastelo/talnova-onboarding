import mongoose, { Schema, Document } from "mongoose";

export interface IUploadReference {
  uploadId: mongoose.Types.ObjectId;
  fileName: string;
  publicUrl?: string;
}

export interface IDepartment {
  _id: mongoose.Types.ObjectId;
  name: string;
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
  description?: string;
  website?: string;
  industry?: string;
  size?: "1-10" | "11-50" | "51-250" | "251-1000" | "1000+";
  supportEmail?: string;
  status: "Active" | "Suspended";
  plan: "Starter" | "Growth" | "Enterprise";
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
    description: { type: String },
    website: { type: String },
    industry: { type: String },
    size: {
      type: String,
      enum: ["1-10", "11-50", "51-250", "251-1000", "1000+"],
    },
    supportEmail: { type: String, lowercase: true, trim: true },
    status: { type: String, enum: ["Active", "Suspended"], default: "Active" },
    plan: { type: String, enum: ["Starter", "Growth", "Enterprise"], default: "Starter" },
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
OrganizationSchema.index({ slug: 1 }, { unique: true });
OrganizationSchema.index({ name: 1 });
OrganizationSchema.index({ isDeleted: 1 });

export const Organization = mongoose.model<IOrganization>("Organization", OrganizationSchema);
export default Organization;
