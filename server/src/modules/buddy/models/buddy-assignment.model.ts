import mongoose, { Schema, Document } from "mongoose";

export interface IBuddyChecklistItem {
  _id?: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  stage: "preboarding" | "day_1" | "week_1" | "month_1";
  completed: boolean;
  completedAt?: Date;
}

export interface IBuddyCheckinLog {
  scheduledAt?: Date;
  completedAt: Date;
  notes: string;
  rating?: number; // 1-5 rating
}

export interface IBuddyAssignment extends Document {
  organizationId: mongoose.Types.ObjectId;
  buddyUserId: mongoose.Types.ObjectId;
  newHireUserId: mongoose.Types.ObjectId;
  assignedBy: mongoose.Types.ObjectId;
  assignedAt: Date;
  status: "active" | "completed" | "reassigned";
  checklist: IBuddyChecklistItem[];
  checkins: IBuddyCheckinLog[];
  communicationLinks: {
    slackChannelUrl?: string;
    teamsUrl?: string;
    email?: string;
  };
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BuddyChecklistItemSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String },
  stage: {
    type: String,
    enum: ["preboarding", "day_1", "week_1", "month_1"],
    default: "day_1",
  },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date },
});

const BuddyCheckinLogSchema = new Schema({
  scheduledAt: { type: Date },
  completedAt: { type: Date, default: Date.now },
  notes: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5 },
});

const BuddyAssignmentSchema = new Schema<IBuddyAssignment>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    buddyUserId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    newHireUserId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    assignedBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    assignedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["active", "completed", "reassigned"],
      default: "active",
    },
    checklist: { type: [BuddyChecklistItemSchema], default: [] },
    checkins: { type: [BuddyCheckinLogSchema], default: [] },
    communicationLinks: {
      slackChannelUrl: { type: String },
      teamsUrl: { type: String },
      email: { type: String },
    },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

BuddyAssignmentSchema.index({ organizationId: 1, newHireUserId: 1 });
BuddyAssignmentSchema.index({ organizationId: 1, buddyUserId: 1 });

export const BuddyAssignment = mongoose.model<IBuddyAssignment>("BuddyAssignment", BuddyAssignmentSchema);
export default BuddyAssignment;
