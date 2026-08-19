import mongoose, { Schema, Document } from "mongoose";

export interface IBuddyProfile extends Document {
  organizationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  isAvailable: boolean;
  maxMentees: number;
  currentMenteeCount: number;
  skills: string[];
  department?: string;
  jobTitle?: string;
  bio?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BuddyProfileSchema = new Schema<IBuddyProfile>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User", unique: true },
    isAvailable: { type: Boolean, default: true },
    maxMentees: { type: Number, default: 3 },
    currentMenteeCount: { type: Number, default: 0 },
    skills: { type: [String], default: [] },
    department: { type: String },
    jobTitle: { type: String },
    bio: { type: String },
    notes: { type: String },
  },
  {
    timestamps: true,
  }
);

BuddyProfileSchema.index({ organizationId: 1, isAvailable: 1 });

export const BuddyProfile = mongoose.model<IBuddyProfile>("BuddyProfile", BuddyProfileSchema);
export default BuddyProfile;
