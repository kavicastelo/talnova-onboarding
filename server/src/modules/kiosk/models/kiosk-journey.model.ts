import mongoose, { Schema, Document } from "mongoose";
import { KioskJourney } from "../types/journey.types.js";

/**
 * Interface representing the KioskJourney document in MongoDB.
 */
export interface IKioskJourney extends Omit<KioskJourney, "_id" | "organizationId" | "createdBy" | "updatedBy" | "createdAt" | "updatedAt">, Document {
  organizationId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LocalizedMediaReferenceSchema = new Schema(
  {
    uploadId: { type: Schema.Types.ObjectId, ref: "Upload" },
    textValue: { type: String },
    audioUploadId: { type: Schema.Types.ObjectId, ref: "Upload" },
    embedUrl: { type: String }
  },
  { _id: false }
);

const KioskBlockSchema = new Schema(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    order: { type: Number, required: true },
    mediaReferences: {
      type: Map,
      of: LocalizedMediaReferenceSchema,
      default: {}
    },
    settings: { type: Schema.Types.Mixed, default: {} }
  },
  { _id: false }
);

const KioskHotspotSchema = new Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    radius: { type: Number, required: true },
    actionStepId: { type: String, required: true }
  },
  { _id: false }
);

const KioskInteractionSchema = new Schema(
  {
    type: { type: String, required: true },
    holdDurationMs: { type: Number },
    hotspots: { type: [KioskHotspotSchema], default: [] },
    correctStepId: { type: String },
    incorrectStepId: { type: String }
  },
  { _id: false }
);

const KioskStepSchema = new Schema(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    order: { type: Number, required: true },
    blocks: { type: [KioskBlockSchema], default: [] },
    interaction: { type: KioskInteractionSchema, required: true }
  },
  { _id: false }
);

const KioskJourneySecuritySettingsSchema = new Schema(
  {
    protectionType: { type: String, required: true, default: "none" },
    pinCode: { type: String },
    expiresAt: { type: Date }
  },
  { _id: false }
);

const KioskJourneySettingsSchema = new Schema(
  {
    autoPlay: { type: Boolean, required: true, default: false },
    loopForever: { type: Boolean, required: true, default: false },
    idleTimeoutSeconds: { type: Number, required: true, default: 60 },
    autoReturnHome: { type: Boolean, required: true, default: true },
    hideNavigation: { type: Boolean, required: true, default: false },
    disableExit: { type: Boolean, required: true, default: true },
    security: { type: KioskJourneySecuritySettingsSchema, required: true }
  },
  { _id: false }
);

const KioskPublishingSettingsSchema = new Schema(
  {
    status: {
      type: String,
      required: true,
      enum: ["draft", "published", "archived"],
      default: "draft"
    },
    version: { type: Number, required: true, default: 1 },
    publishedAt: { type: Date }
  },
  { _id: false }
);

const KioskJourneySchema = new Schema<IKioskJourney>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    languages: { type: [String], required: true },
    steps: { type: [KioskStepSchema], default: [] },
    settings: { type: KioskJourneySettingsSchema, required: true },
    publishing: { type: KioskPublishingSettingsSchema, required: true },
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    isDeleted: { type: Boolean, required: true, default: false },
    deletedAt: { type: Date }
  },
  {
    timestamps: true
  }
);

// Indexes
KioskJourneySchema.index({ organizationId: 1 });
KioskJourneySchema.index({ "publishing.status": 1 });
KioskJourneySchema.index({ createdBy: 1 });

// Compound indexes
KioskJourneySchema.index({ organizationId: 1, isDeleted: 1 });
KioskJourneySchema.index({ organizationId: 1, "publishing.status": 1 });
KioskJourneySchema.index({ organizationId: 1, createdAt: -1 });

export const KioskJourneyModel = mongoose.model<IKioskJourney>("KioskJourney", KioskJourneySchema);
export default KioskJourneyModel;
