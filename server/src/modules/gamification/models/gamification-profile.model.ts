import mongoose, { Schema, Document } from "mongoose";

export interface IBadgeUnlocked {
  badgeId: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: Date;
}

export interface IPointHistory {
  action: string;
  points: number;
  description: string;
  timestamp: Date;
}

export interface IGamificationProfile extends Document {
  organizationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  points: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate?: Date;
  unlockedBadges: IBadgeUnlocked[];
  pointHistory: IPointHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const BadgeUnlockedSchema = new Schema<IBadgeUnlocked>(
  {
    badgeId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String, required: true },
    unlockedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const PointHistorySchema = new Schema<IPointHistory>(
  {
    action: { type: String, required: true },
    points: { type: Number, required: true },
    description: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const GamificationProfileSchema = new Schema<IGamificationProfile>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    points: { type: Number, required: true, default: 0 },
    level: { type: Number, required: true, default: 1 },
    currentStreak: { type: Number, required: true, default: 0 },
    longestStreak: { type: Number, required: true, default: 0 },
    lastActiveDate: { type: Date },
    unlockedBadges: { type: [BadgeUnlockedSchema], default: [] },
    pointHistory: { type: [PointHistorySchema], default: [] },
  },
  {
    timestamps: true,
  }
);

GamificationProfileSchema.index({ organizationId: 1, userId: 1 }, { unique: true });
GamificationProfileSchema.index({ organizationId: 1, points: -1 });

export const GamificationProfile = mongoose.model<IGamificationProfile>(
  "GamificationProfile",
  GamificationProfileSchema
);

export default GamificationProfile;
