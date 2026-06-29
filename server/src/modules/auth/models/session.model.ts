import mongoose, { Schema, Document } from "mongoose";

export interface ISession extends Document {
  userId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  tokenVersion: number;
  deviceInfo?: string;
  ipAddress?: string;
  isValid: boolean;
  lastActivityAt: Date;
  expiresAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    tokenVersion: { type: Number, default: 1, required: true },
    deviceInfo: { type: String },
    ipAddress: { type: String },
    isValid: { type: Boolean, default: true, required: true },
    lastActivityAt: { type: Date, default: Date.now, required: true },
    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: true,
  }
);

// TTL Index for automatic collection cleanup of expired sessions
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
SessionSchema.index({ userId: 1 });
SessionSchema.index({ organizationId: 1 });
SessionSchema.index({ organizationId: 1, isValid: 1 });

export const Session = mongoose.model<ISession>("Session", SessionSchema);
export default Session;
