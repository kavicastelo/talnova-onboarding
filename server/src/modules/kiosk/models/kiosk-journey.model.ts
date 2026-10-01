import mongoose, { Schema, Document } from "mongoose";
import { KioskJourney } from "../types/journey.types.js";

/**
 * Interface representing the KioskJourney document in MongoDB.
 */
export interface IKioskJourney extends Omit<KioskJourney, "_id" | "organizationId" | "createdBy" | "updatedBy" | "createdAt" | "updatedAt">, Document {
  organizationId: mongoose.Types.ObjectId;
  journeyCode?: string;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export const LocalizedMediaReferenceMongooseSchema = new Schema(
  {
    uploadId: { type: Schema.Types.ObjectId, ref: "Upload" },
    textValue: { type: String },
    audioUploadId: { type: Schema.Types.ObjectId, ref: "Upload" },
    embedUrl: { type: String }
  },
  { _id: false }
);

export const KioskBlockMongooseSchema = new Schema(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    order: { type: Number, required: true },
    mediaReferences: {
      type: Map,
      of: LocalizedMediaReferenceMongooseSchema,
      default: {}
    },
    settings: { type: Schema.Types.Mixed, default: {} }
  },
  { _id: false }
);

export const KioskHotspotMongooseSchema = new Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    radius: { type: Number, required: true },
    actionStepId: { type: String, required: true }
  },
  { _id: false }
);

export const KioskQuizQuestionMongooseSchema = new Schema(
  {
    id: { type: String, required: true },
    question: { type: String, required: true },
    options: { type: [String], required: true },
    correctOptionIndex: { type: Number, required: true },
    explanation: { type: String }
  },
  { _id: false }
);

export const KioskQuizConfigMongooseSchema = new Schema(
  {
    passingScore: { type: Number, required: true, default: 80 },
    questions: { type: [KioskQuizQuestionMongooseSchema], default: [] }
  },
  { _id: false }
);

export const KioskInteractionMongooseSchema = new Schema(
  {
    type: { type: String, required: true },
    holdDurationMs: { type: Number },
    hotspots: { type: [KioskHotspotMongooseSchema], default: [] },
    correctStepId: { type: String },
    incorrectStepId: { type: String },
    ppeItems: { type: [String], default: [] },
    quiz: { type: KioskQuizConfigMongooseSchema },
    requireSupervisorWitness: { type: Boolean, default: false }
  },
  { _id: false }
);

export const KioskStepMongooseSchema = new Schema(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    order: { type: Number, required: true },
    blocks: { type: [KioskBlockMongooseSchema], default: [] },
    interaction: { type: KioskInteractionMongooseSchema, required: true },
    quiz: { type: KioskQuizConfigMongooseSchema },
    requireSupervisorWitness: { type: Boolean, default: false }
  },
  { _id: false }
);

export const KioskJourneySecuritySettingsMongooseSchema = new Schema(
  {
    protectionType: { type: String, required: true, default: "none" },
    pinCode: { type: String },
    expiresAt: { type: Date },
    requireSupervisorWitness: { type: Boolean, default: false }
  },
  { _id: false }
);

export const KioskJourneySettingsMongooseSchema = new Schema(
  {
    autoPlay: { type: Boolean, required: true, default: false },
    loopForever: { type: Boolean, required: true, default: false },
    idleTimeoutSeconds: { type: Number, required: true, default: 60 },
    autoReturnHome: { type: Boolean, required: true, default: true },
    hideNavigation: { type: Boolean, required: true, default: false },
    disableExit: { type: Boolean, required: true, default: true },
    security: { type: KioskJourneySecuritySettingsMongooseSchema, required: true },
    requireSupervisorWitness: { type: Boolean, default: false }
  },
  { _id: false }
);

export const KioskJourneySchedulingSettingsMongooseSchema = new Schema(
  {
    publishAt: { type: Date },
    expiresAt: { type: Date }
  },
  { _id: false }
);

export const KioskPublishingSettingsMongooseSchema = new Schema(
  {
    status: {
      type: String,
      required: true,
      enum: ["draft", "published", "archived", "scheduled"],
      default: "draft"
    },
    version: { type: Number, required: true, default: 1 },
    publishedAt: { type: Date },
    scheduling: { type: KioskJourneySchedulingSettingsMongooseSchema }
  },
  { _id: false }
);

const KioskJourneySchema = new Schema<IKioskJourney>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    journeyCode: { type: String, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    languages: { type: [String], required: true },
    steps: { type: [KioskStepMongooseSchema], default: [] },
    settings: { type: KioskJourneySettingsMongooseSchema, required: true },
    publishing: { type: KioskPublishingSettingsMongooseSchema, required: true },
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
KioskJourneySchema.index({ journeyCode: 1 });

// Compound indexes
KioskJourneySchema.index({ organizationId: 1, isDeleted: 1 });
KioskJourneySchema.index({ organizationId: 1, journeyCode: 1 });
KioskJourneySchema.index({ organizationId: 1, "publishing.status": 1 });
KioskJourneySchema.index({ organizationId: 1, createdAt: -1 });

export const KioskJourneyModel = mongoose.model<IKioskJourney>("KioskJourney", KioskJourneySchema);
export default KioskJourneyModel;
