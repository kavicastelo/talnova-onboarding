import mongoose, { Schema, Document } from "mongoose";

export interface ICalendarConnection extends Document {
  organizationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  provider: "google" | "outlook" | "ical";
  syncStatus: "connected" | "error" | "disconnected";
  timezone: string;
  icalToken: string;
  accessToken?: string;
  refreshToken?: string;
  calendarId?: string;
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CalendarConnectionSchema = new Schema<ICalendarConnection>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User", unique: true },
    provider: { type: String, enum: ["google", "outlook", "ical"], default: "ical" },
    syncStatus: { type: String, enum: ["connected", "error", "disconnected"], default: "connected" },
    timezone: { type: String, default: "UTC" },
    icalToken: { type: String, required: true, unique: true },
    accessToken: { type: String },
    refreshToken: { type: String },
    calendarId: { type: String },
    lastSyncedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

CalendarConnectionSchema.index({ organizationId: 1, userId: 1 });

export const CalendarConnection = mongoose.model<ICalendarConnection>("CalendarConnection", CalendarConnectionSchema);
export default CalendarConnection;
