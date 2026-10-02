import mongoose, { Document, Schema } from "mongoose";

export interface IKioskPairingCode extends Document {
  code: string;
  organizationId: mongoose.Types.ObjectId;
  deviceId?: string;
  createdBy?: mongoose.Types.ObjectId;
  expiresAt: Date;
  attemptsCount: number;
  consumed: boolean;
  consumedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const KioskPairingCodeSchema = new Schema<IKioskPairingCode>(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true
    },
    deviceId: {
      type: String,
      trim: true,
      index: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    attemptsCount: {
      type: Number,
      default: 0
    },
    consumed: {
      type: Boolean,
      default: false,
      index: true
    },
    consumedAt: {
      type: Date
    }
  },
  {
    timestamps: true,
    collection: "kiosk_pairing_codes"
  }
);

// MongoDB TTL auto-expiry index (15 minutes based on expiresAt timestamp)
KioskPairingCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound indexes for atomic single-use retrieval and organization queries
KioskPairingCodeSchema.index({ code: 1, consumed: 1, expiresAt: 1 });
KioskPairingCodeSchema.index({ organizationId: 1, createdAt: -1 });

export const KioskPairingCodeModel =
  mongoose.models.KioskPairingCode ||
  mongoose.model<IKioskPairingCode>("KioskPairingCode", KioskPairingCodeSchema);
