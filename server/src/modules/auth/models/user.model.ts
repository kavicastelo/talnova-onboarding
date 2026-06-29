import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  organizationId: mongoose.Types.ObjectId;
  auth: {
    email: string;
    passwordHash: string;
    emailVerified: boolean;
    lastLoginAt?: Date;
    passwordChangedAt?: Date;
  };
  profile: {
    firstName: string;
    lastName: string;
    fullName: string;
    avatar?: {
      uploadId: mongoose.Types.ObjectId;
      fileName: string;
      publicUrl?: string;
    };
    phone?: string;
    location?: string;
    timezone?: string;
  };
  employment: {
    employeeId?: string;
    departmentId?: mongoose.Types.ObjectId;
    teamId?: mongoose.Types.ObjectId;
    jobTitleId?: mongoose.Types.ObjectId;
    managerId?: mongoose.Types.ObjectId;
    employmentType: "full_time" | "part_time" | "contractor" | "intern";
    hireDate?: Date;
    status: "invited" | "active" | "onboarding" | "inactive";
  };
  permissions: {
    role: "owner" | "admin" | "manager" | "employee" | "super_admin";
    customRoles: string[];
  };
  preferences: {
    language: string;
    theme: "light" | "dark" | "system";
    emailNotifications: boolean;
  };
  statistics: {
    assignedJourneys: number;
    completedJourneys: number;
    certificates: number;
    completionRate: number;
  };
  security: {
    mfaEnabled: boolean;
    failedLoginAttempts: number;
    lockedUntil?: Date;
    lastPasswordReset?: Date;
    passwordResetToken?: string;
    passwordResetExpires?: Date;
  };
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
}

const UserSchema = new Schema<IUser>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    auth: {
      email: { type: String, required: true, unique: true, lowercase: true, trim: true },
      passwordHash: { type: String, required: true },
      emailVerified: { type: Boolean, default: false },
      lastLoginAt: { type: Date },
      passwordChangedAt: { type: Date },
    },
    profile: {
      firstName: { type: String, required: true, trim: true },
      lastName: { type: String, required: true, trim: true },
      fullName: { type: String, required: true, trim: true },
      avatar: {
        uploadId: { type: Schema.Types.ObjectId },
        fileName: { type: String },
        publicUrl: { type: String },
      },
      phone: { type: String },
      location: { type: String },
      timezone: { type: String },
    },
    employment: {
      employeeId: { type: String },
      departmentId: { type: Schema.Types.ObjectId },
      teamId: { type: Schema.Types.ObjectId },
      jobTitleId: { type: Schema.Types.ObjectId },
      managerId: { type: Schema.Types.ObjectId },
      employmentType: {
        type: String,
        enum: ["full_time", "part_time", "contractor", "intern"],
        default: "full_time",
      },
      hireDate: { type: Date },
      status: {
        type: String,
        enum: ["invited", "active", "onboarding", "inactive"],
        default: "invited",
      },
    },
    permissions: {
      role: {
        type: String,
        enum: ["owner", "admin", "manager", "employee", "super_admin"],
        default: "employee",
      },
      customRoles: { type: [String], default: [] },
    },
    preferences: {
      language: { type: String, default: "en" },
      theme: { type: String, enum: ["light", "dark", "system"], default: "system" },
      emailNotifications: { type: Boolean, default: true },
    },
    statistics: {
      assignedJourneys: { type: Number, default: 0 },
      completedJourneys: { type: Number, default: 0 },
      certificates: { type: Number, default: 0 },
      completionRate: { type: Number, default: 0 },
    },
    security: {
      mfaEnabled: { type: Boolean, default: false },
      failedLoginAttempts: { type: Number, default: 0 },
      lockedUntil: { type: Date },
      lastPasswordReset: { type: Date },
      passwordResetToken: { type: String },
      passwordResetExpires: { type: Date },
    },
    createdBy: { type: Schema.Types.ObjectId },
    updatedBy: { type: Schema.Types.ObjectId },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to populate full name and clean up strings
UserSchema.pre<IUser>("validate", function (next) {
  this.profile.fullName = `${this.profile.firstName} ${this.profile.lastName}`.trim();
  next();
});

// Configure Indexes
UserSchema.index({ "auth.email": 1 }, { unique: true });
UserSchema.index({ organizationId: 1 });
UserSchema.index({ "employment.departmentId": 1 });
UserSchema.index({ "employment.teamId": 1 });
UserSchema.index({ "employment.managerId": 1 });
UserSchema.index({ "permissions.role": 1 });
UserSchema.index({ "employment.status": 1 });
UserSchema.index({ isDeleted: 1 });

// Compound Indexes
UserSchema.index({ organizationId: 1, isDeleted: 1 });
UserSchema.index({ organizationId: 1, "auth.email": 1 });
UserSchema.index({ organizationId: 1, "permissions.role": 1 });

export const User = mongoose.model<IUser>("User", UserSchema);
export default User;
