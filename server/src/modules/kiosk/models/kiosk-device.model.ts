import mongoose, { Schema, Document } from "mongoose";
import { KioskDevice } from "../types/device.types.js";
import { KIOSK_DEVICE_STATUSES } from "../constants/device.constants.js";

/**
 * Interface representing the KioskDevice document in MongoDB.
 */
export interface IKioskDevice extends Omit<KioskDevice, "_id" | "organizationId" | "currentJourneyId" | "lastSeen" | "pairedAt" | "lastHeartbeatAt" | "deletedBy" | "deletedAt" | "siteId" | "deviceGroupId">, Document {
  organizationId: mongoose.Types.ObjectId;
  deviceId: string;
  hardwareGuid: string;
  /**
   * @deprecated Decoupled in favor of KioskDeviceAssignment (ADR-001, DEF-003). Kept for backward compatibility during migration.
   */
  currentJourneyId?: mongoose.Types.ObjectId;
  siteId?: mongoose.Types.ObjectId | string;
  deviceGroupId?: mongoose.Types.ObjectId | string;
  deviceType?: "wall_mount" | "countertop_tablet" | "floor_standing" | "desktop_terminal" | "rugged_handheld";
  lastSeen: Date;
  lastHeartbeatAt?: Date;
  pairedAt?: Date;
  paired?: boolean;
  tokenRef?: string;
  tokenExpiresAt?: Date;
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
  /**
   * @deprecated Relegated to optional diagnostic metadata; not used as security anchor or identity (ADR-003).
   */
  macAddress?: string;
}

const KioskTelemetrySchema = new Schema(
  {
    batteryLevel: { type: Number, min: 0, max: 1 },
    isCharging: { type: Boolean },
    storageUsedBytes: { type: Number },
    storageFreeBytes: { type: Number },
    appVersion: { type: String },
    networkLatencyMs: { type: Number }
  },
  { _id: false }
);

const KioskDeviceSchema = new Schema<IKioskDevice>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    deviceId: { type: String, required: true, trim: true },
    hardwareGuid: {
      type: String,
      required: true,
      trim: true,
      default: function (this: any) {
        return this.deviceId;
      }
    },
    name: { type: String, required: true, trim: true },
    location: { type: String, required: true },
    siteId: { type: Schema.Types.Mixed, default: null },
    deviceGroupId: { type: Schema.Types.Mixed, default: null },
    deviceType: {
      type: String,
      enum: ["wall_mount", "countertop_tablet", "floor_standing", "desktop_terminal", "rugged_handheld"]
    },
    status: {
      type: String,
      required: true,
      enum: KIOSK_DEVICE_STATUSES,
      default: "offline"
    },
    paired: { type: Boolean, default: true },
    tokenRef: { type: String },
    tokenExpiresAt: { type: Date },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
    lastSeen: { type: Date, required: true, default: Date.now },
    lastHeartbeatAt: { type: Date, default: Date.now },
    ipAddress: { type: String },
    /**
     * @deprecated Relegated to optional diagnostic metadata; not used as security anchor or identity (ADR-003).
     */
    macAddress: { type: String },
    pairedAt: { type: Date },
    /**
     * @deprecated Decoupled in favor of KioskDeviceAssignment (ADR-001, DEF-003). Kept for backward compatibility during migration.
     */
    currentJourneyId: { type: Schema.Types.ObjectId, ref: "KioskJourney" },
    currentContentVersion: { type: Number, required: true, default: 0 },
    telemetry: { type: KioskTelemetrySchema, required: true, default: {} }
  },
  {
    timestamps: true
  }
);

// Indexes
KioskDeviceSchema.index({ deviceId: 1 }, { unique: true });
KioskDeviceSchema.index({ hardwareGuid: 1 });
KioskDeviceSchema.index({ organizationId: 1 });
KioskDeviceSchema.index({ status: 1 });
KioskDeviceSchema.index({ lastSeen: -1 });

// Compound indexes
KioskDeviceSchema.index({ organizationId: 1, status: 1 });
KioskDeviceSchema.index({ organizationId: 1, isDeleted: 1 });
KioskDeviceSchema.index({ organizationId: 1, currentJourneyId: 1 });

export const KioskDeviceModel = mongoose.model<IKioskDevice>("KioskDevice", KioskDeviceSchema);
export default KioskDeviceModel;
