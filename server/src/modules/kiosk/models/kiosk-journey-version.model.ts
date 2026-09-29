import mongoose, { Schema, Document } from "mongoose";
import {
  KioskStepMongooseSchema,
  KioskJourneySettingsMongooseSchema
} from "./kiosk-journey.model.js";
import { KioskJourneyVersion } from "../types/journey.types.js";
import AppError from "../../../common/errors/app-error.js";

/**
 * Interface representing the immutable KioskJourneyVersion snapshot document in MongoDB.
 */
export interface IKioskJourneyVersion
  extends Omit<
      KioskJourneyVersion,
      | "_id"
      | "journeyId"
      | "organizationId"
      | "publishedBy"
      | "publishedAt"
      | "createdAt"
      | "updatedAt"
    >,
    Document {
  journeyId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  publishedBy: mongoose.Types.ObjectId;
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const KioskJourneyVersionSchema = new Schema<IKioskJourneyVersion>(
  {
    journeyId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "KioskJourney"
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Organization"
    },
    version: {
      type: Number,
      required: true,
      min: 1
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String
    },
    languages: {
      type: [String],
      required: true
    },
    steps: {
      type: [KioskStepMongooseSchema],
      default: []
    },
    settings: {
      type: KioskJourneySettingsMongooseSchema,
      required: true
    },
    contentChecksum: {
      type: String,
      required: true
    },
    publishedBy: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User"
    },
    publishedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    status: {
      type: String,
      required: true,
      enum: ["published", "superseded", "revoked"],
      default: "published"
    },
    changelog: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

// Indexes
KioskJourneyVersionSchema.index({ journeyId: 1, version: 1 }, { unique: true });
KioskJourneyVersionSchema.index({ organizationId: 1, journeyId: 1, version: -1 });
KioskJourneyVersionSchema.index({ organizationId: 1, status: 1 });
KioskJourneyVersionSchema.index({ contentChecksum: 1 });

// Immutability hooks: prevent updates to existing documents
KioskJourneyVersionSchema.pre("save", function (next) {
  if (!this.isNew) {
    return next(
      new AppError(
        400,
        "IMMUTABLE_VERSION",
        "IMMUTABLE_VERSION: Published journey versions are strictly immutable and cannot be modified."
      )
    );
  }
  next();
});

const preventUpdate = function (this: any, next: (err?: any) => void) {
  if (this.getOptions?.()?.bypassImmutability) {
    return next();
  }
  return next(
    new AppError(
      400,
      "IMMUTABLE_VERSION",
      "IMMUTABLE_VERSION: Published journey versions are strictly immutable and cannot be modified."
    )
  );
};

const preventDelete = function (this: any, next: (err?: any) => void) {
  if (this.getOptions?.()?.bypassImmutability) {
    return next();
  }
  return next(
    new AppError(
      400,
      "IMMUTABLE_VERSION",
      "IMMUTABLE_VERSION: Published journey versions are strictly immutable and cannot be deleted."
    )
  );
};

// Intercept query-level mutations
KioskJourneyVersionSchema.pre("updateOne", preventUpdate);
KioskJourneyVersionSchema.pre("updateMany", preventUpdate);
KioskJourneyVersionSchema.pre("findOneAndUpdate", preventUpdate);
KioskJourneyVersionSchema.pre("replaceOne", preventUpdate);

// Intercept document-level and query-level deletions
KioskJourneyVersionSchema.pre(
  "deleteOne",
  { document: true, query: false },
  function (this: any, next: (err?: any) => void) {
    return next(
      new AppError(
        400,
        "IMMUTABLE_VERSION",
        "IMMUTABLE_VERSION: Published journey versions are strictly immutable and cannot be deleted."
      )
    );
  }
);
KioskJourneyVersionSchema.pre("deleteOne", { document: false, query: true }, preventDelete);
KioskJourneyVersionSchema.pre("deleteMany", preventDelete);
KioskJourneyVersionSchema.pre("findOneAndDelete", preventDelete);

export const KioskJourneyVersionModel = mongoose.model<IKioskJourneyVersion>(
  "KioskJourneyVersion",
  KioskJourneyVersionSchema
);
export default KioskJourneyVersionModel;
