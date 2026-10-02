import mongoose, { Schema, Document } from "mongoose";

/**
 * K-ANA-001: Operational Kiosk Device Telemetry Time-Series Model
 *
 * Dedicated collection for high-frequency hardware health pings (battery, storage, latency, screen)
 * decoupled from product UX analytics and legal compliance records.
 * Features an automatic 30-day TTL index (2,592,000 seconds) for rolling operational retention.
 */

export interface IKioskDeviceTelemetry extends Document {
  organizationId: mongoose.Types.ObjectId;
  deviceId: mongoose.Types.ObjectId;
  hardwareGuid: string;
  batteryLevel?: number;
  isCharging?: boolean;
  storageUsedBytes?: number;
  storageFreeBytes?: number;
  storageTotalBytes?: number;
  networkLatencyMs?: number;
  screenResolution?: string;
  orientation?: string;
  appVersion?: string;
  contentVersion?: number;
  ipAddress?: string;
  recordedAt: Date;
  createdAt: Date;
}

const KioskDeviceTelemetrySchema = new Schema<IKioskDeviceTelemetry>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true
    },
    deviceId: {
      type: Schema.Types.ObjectId,
      ref: "KioskDevice",
      required: true,
      index: true
    },
    hardwareGuid: {
      type: String,
      required: true,
      index: true
    },
    batteryLevel: { type: Number, min: 0, max: 100 },
    isCharging: { type: Boolean },
    storageUsedBytes: { type: Number, min: 0 },
    storageFreeBytes: { type: Number, min: 0 },
    storageTotalBytes: { type: Number, min: 0 },
    networkLatencyMs: { type: Number, min: 0 },
    screenResolution: { type: String },
    orientation: { type: String },
    appVersion: { type: String },
    contentVersion: { type: Number, default: 1 },
    ipAddress: { type: String },
    recordedAt: { type: Date, default: Date.now },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false,
    collection: "kiosk_device_telemetry"
  }
);

// TTL index for automatic 30-day purging
KioskDeviceTelemetrySchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Compound indexes for diagnostic inspection & fleet dashboards
KioskDeviceTelemetrySchema.index({ organizationId: 1, deviceId: 1, createdAt: -1 });
KioskDeviceTelemetrySchema.index({ hardwareGuid: 1, createdAt: -1 });
KioskDeviceTelemetrySchema.index({ organizationId: 1, createdAt: -1 });

export const KioskDeviceTelemetryModel = mongoose.model<IKioskDeviceTelemetry>(
  "KioskDeviceTelemetry",
  KioskDeviceTelemetrySchema
);

export default KioskDeviceTelemetryModel;
