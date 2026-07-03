import mongoose, { Schema, Document } from "mongoose";

/**
 * Translation status lifecycle:
 *
 *   DRAFT → AI_GENERATED → UNDER_REVIEW → APPROVED
 *                                         ↓ (source changes)
 *                                      OUTDATED
 *
 * Only APPROVED is served to production users.
 * OUTDATED remains visible to editors — still shows old text until re-approved.
 * Do NOT delete OUTDATED records; they preserve translation history.
 */
export type TranslationStatus =
  | "DRAFT"
  | "AI_GENERATED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "OUTDATED";

/**
 * Polymorphic Translation record.
 *
 * One record per (entityType, entityId, field, language) tuple.
 *
 * Design principles:
 * - Domain models are the source of truth. This model only decorates them.
 * - entityType is an open string — no enum. Adding a new entity type
 *   requires zero code changes.
 * - field is an open string — e.g. "title", "description", "body".
 *   Multiple fields per entity are stored as separate records.
 * - sourceVersion tracks the English source version at translation time.
 *   When English changes, sourceVersion is bumped and non-English
 *   translations are marked OUTDATED automatically.
 */
export interface ITranslation extends Document {
  /** Domain model name, e.g. "journey", "article", "lesson" */
  entityType: string;
  /** ObjectId of the domain document */
  entityId: mongoose.Types.ObjectId;
  /** Field being translated, e.g. "title", "description", "body" */
  field: string;
  /** ISO 639-1 language code: en | si | ta | fi */
  language: string;
  /** The translated text value */
  value: string;
  status: TranslationStatus;
  /** Version of the English source when this translation was created */
  sourceVersion: number;
  /** Own version counter — incremented on each update */
  version: number;
  translatedBy?: mongoose.Types.ObjectId;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TranslationSchema = new Schema<ITranslation>(
  {
    entityType: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    field: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    language: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    value: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["DRAFT", "AI_GENERATED", "UNDER_REVIEW", "APPROVED", "OUTDATED"],
      default: "DRAFT",
    },
    sourceVersion: {
      type: Number,
      default: 1,
    },
    version: {
      type: Number,
      default: 1,
    },
    translatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
  },
  { timestamps: true }
);

// Primary uniqueness constraint: one translation per field per language per entity
TranslationSchema.index(
  { entityType: 1, entityId: 1, field: 1, language: 1 },
  { unique: true, name: "translation_entity_field_lang_unique" }
);

// Admin list queries
TranslationSchema.index({ entityType: 1, status: 1 });
TranslationSchema.index({ entityId: 1, language: 1 });
TranslationSchema.index({ language: 1, status: 1 });
TranslationSchema.index({ entityType: 1, entityId: 1 });

export const Translation = mongoose.model<ITranslation>(
  "Translation",
  TranslationSchema,
  "i18nTranslations"
);
export default Translation;
