import mongoose, { Schema, Document } from "mongoose";
import {
  KioskSession,
  KioskSessionStatus,
  KIOSK_SESSION_STATUSES,
  SUPERVISOR_WITNESS_METHODS,
  SupervisorWitnessMethod,
} from "../types/session.types.js";

/**
 * Interface representing the KioskSession document in MongoDB.
 */
export interface IKioskSession
  extends Omit<
      KioskSession,
      | "_id"
      | "organizationId"
      | "deviceId"
      | "journeyId"
      | "journeyVersionId"
      | "userId"
      | "startedAt"
      | "completedAt"
      | "createdAt"
      | "updatedAt"
      | "supervisorWitness"
    >,
    Document {
  organizationId: mongoose.Types.ObjectId;
  deviceId: mongoose.Types.ObjectId;
  journeyId: mongoose.Types.ObjectId;
  journeyVersionId?: mongoose.Types.ObjectId;
  versionNumber: number;
  userId?: mongoose.Types.ObjectId;
  sessionToken: string;
  status: KioskSessionStatus;
  startedAt: Date;
  completedAt?: Date;
  durationSeconds: number;
  currentStepId: string;
  completedStepIds: string[];
  ppeItemsVerified: string[];
  quizScore?: number;
  supervisorWitness?: {
    supervisorId: mongoose.Types.ObjectId;
    witnessedAt: Date;
    method: SupervisorWitnessMethod;
  };
  verificationChecksum?: string;
  isOfflineSync: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SupervisorWitnessSchema = new Schema(
  {
    supervisorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    witnessedAt: { type: Date, default: Date.now, required: true },
    method: {
      type: String,
      enum: SUPERVISOR_WITNESS_METHODS,
      required: true,
      default: "pin",
    },
  },
  { _id: false }
);

const KioskSessionSchema = new Schema<IKioskSession>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    deviceId: {
      type: Schema.Types.ObjectId,
      ref: "KioskDevice",
      required: true,
      index: true,
    },
    journeyId: {
      type: Schema.Types.ObjectId,
      ref: "KioskJourney",
      required: true,
      index: true,
    },
    journeyVersionId: {
      type: Schema.Types.ObjectId,
      ref: "KioskJourneyVersion",
    },
    versionNumber: {
      type: Number,
      required: true,
      default: 1,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    sessionToken: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      required: true,
      enum: KIOSK_SESSION_STATUSES,
      default: "active",
      index: true,
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
    durationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentStepId: {
      type: String,
      trim: true,
      default: "",
    },
    completedStepIds: {
      type: [String],
      default: [],
    },
    ppeItemsVerified: {
      type: [String],
      default: [],
    },
    quizScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    supervisorWitness: {
      type: SupervisorWitnessSchema,
    },
    verificationChecksum: {
      type: String,
      trim: true,
    },
    isOfflineSync: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes per ADR-001, ADR-007, and K-FND-003 requirements
KioskSessionSchema.index({ organizationId: 1, userId: 1, status: 1 });
KioskSessionSchema.index({ organizationId: 1, deviceId: 1, startedAt: -1 });
KioskSessionSchema.index({ organizationId: 1, journeyId: 1, status: 1 });
KioskSessionSchema.index({ sessionToken: 1 }, { unique: true, sparse: true });

export const KioskSessionModel = mongoose.model<IKioskSession>(
  "KioskSession",
  KioskSessionSchema
);

export default KioskSessionModel;
