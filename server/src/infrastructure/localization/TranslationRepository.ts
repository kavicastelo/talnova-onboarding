import mongoose from "mongoose";
import {
  Translation,
  ITranslation,
  TranslationStatus,
} from "../../modules/localization/models/translation.model.js";

export interface TranslationFilter {
  entityType?: string;
  entityId?: string | mongoose.Types.ObjectId;
  field?: string;
  language?: string;
  status?: TranslationStatus | TranslationStatus[];
}

/**
 * TranslationRepository
 *
 * Single point of database access for all translation operations.
 * Business services and LocalizationService use ONLY this repository
 * to query the Translation collection — never the model directly.
 *
 * This keeps the DB schema change surface contained: if the schema changes,
 * only this file needs updating.
 */
export class TranslationRepository {
  private buildEntityId(id: string | mongoose.Types.ObjectId): mongoose.Types.ObjectId {
    return new mongoose.Types.ObjectId(id.toString());
  }

  /**
   * Find a single APPROVED translation.
   */
  async findApproved(
    entityType: string,
    entityId: string | mongoose.Types.ObjectId,
    field: string,
    language: string
  ): Promise<ITranslation | null> {
    return Translation.findOne({
      entityType: entityType.toLowerCase(),
      entityId: this.buildEntityId(entityId),
      field: field.toLowerCase(),
      language: language.toLowerCase(),
      status: "APPROVED",
    }).lean() as Promise<ITranslation | null>;
  }

  /**
   * Find ALL translations for an entity (any status) — admin use.
   */
  async findAllForEntity(
    entityType: string,
    entityId: string | mongoose.Types.ObjectId
  ): Promise<ITranslation[]> {
    const docs = await Translation.find({
      entityType: entityType.toLowerCase(),
      entityId: this.buildEntityId(entityId),
    })
      .sort({ field: 1, language: 1 })
      .lean();
    return docs as unknown as ITranslation[];
  }

  /**
   * Find all translations for an entity in a specific language.
   */
  async findForEntityAndLanguage(
    entityType: string,
    entityId: string | mongoose.Types.ObjectId,
    language: string
  ): Promise<ITranslation[]> {
    const docs = await Translation.find({
      entityType: entityType.toLowerCase(),
      entityId: this.buildEntityId(entityId),
      language: language.toLowerCase(),
    }).lean();
    return docs as unknown as ITranslation[];
  }

  /**
   * Upsert a single translation record.
   * Returns the updated document.
   */
  async upsert(
    entityType: string,
    entityId: string | mongoose.Types.ObjectId,
    field: string,
    language: string,
    data: {
      value: string;
      status?: TranslationStatus;
      sourceVersion?: number;
      translatedBy?: string | mongoose.Types.ObjectId;
    }
  ): Promise<ITranslation> {
    const filter = {
      entityType: entityType.toLowerCase(),
      entityId: this.buildEntityId(entityId),
      field: field.toLowerCase(),
      language: language.toLowerCase(),
    };

    const update = {
      $set: {
        value: data.value,
        ...(data.status && { status: data.status }),
        ...(data.sourceVersion !== undefined && { sourceVersion: data.sourceVersion }),
        ...(data.translatedBy && {
          translatedBy: new mongoose.Types.ObjectId(data.translatedBy.toString()),
        }),
      },
      $inc: { version: 1 },
    };

    const result = await Translation.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
    });

    return result! as ITranslation;
  }

  /**
   * Approve a translation — marks it APPROVED and records approver.
   */
  async approve(
    entityType: string,
    entityId: string | mongoose.Types.ObjectId,
    field: string,
    language: string,
    approverId: string | mongoose.Types.ObjectId
  ): Promise<ITranslation | null> {
    const doc = await Translation.findOneAndUpdate(
      {
        entityType: entityType.toLowerCase(),
        entityId: this.buildEntityId(entityId),
        field: field.toLowerCase(),
        language: language.toLowerCase(),
      },
      {
        $set: {
          status: "APPROVED" as TranslationStatus,
          approvedBy: new mongoose.Types.ObjectId(approverId.toString()),
          approvedAt: new Date(),
        },
      },
      { new: true }
    );
    return doc as ITranslation | null;
  }

  /**
   * Mark all non-English translations for an entity+field as OUTDATED.
   * Called when the English source content changes.
   */
  async markOutdated(
    entityType: string,
    entityId: string | mongoose.Types.ObjectId,
    field: string
  ): Promise<void> {
    await Translation.updateMany(
      {
        entityType: entityType.toLowerCase(),
        entityId: this.buildEntityId(entityId),
        field: field.toLowerCase(),
        language: { $ne: "en" },
        status: { $in: ["APPROVED", "UNDER_REVIEW", "AI_GENERATED"] as TranslationStatus[] },
      },
      {
        $set: { status: "OUTDATED" as TranslationStatus },
      }
    );
  }

  /**
   * Admin: list entities with missing translations for a given language.
   */
  async findMissing(
    entityType: string,
    language: string,
    fields: string[]
  ): Promise<Array<{ entityId: mongoose.Types.ObjectId; field: string }>> {
    // Find (entityId, field) pairs that have an English record but lack the target language
    const englishDocs = await Translation.find({
      entityType: entityType.toLowerCase(),
      language: "en",
      field: { $in: fields.map((f) => f.toLowerCase()) },
    })
      .select("entityId field")
      .lean();

    const results: Array<{ entityId: mongoose.Types.ObjectId; field: string }> = [];

    for (const doc of englishDocs) {
      const existing = await Translation.findOne({
        entityType: entityType.toLowerCase(),
        entityId: (doc as any).entityId,
        field: (doc as any).field,
        language: language.toLowerCase(),
        status: { $ne: "OUTDATED" },
      }).lean();

      if (!existing) {
        results.push({ entityId: (doc as any).entityId, field: (doc as any).field });
      }
    }

    return results;
  }

  /**
   * Admin: list OUTDATED translations for an entity type.
   */
  async findOutdated(entityType: string): Promise<ITranslation[]> {
    const docs = await Translation.find({
      entityType: entityType.toLowerCase(),
      status: "OUTDATED",
    })
      .sort({ updatedAt: -1 })
      .lean();
    return docs as unknown as ITranslation[];
  }

  /**
   * Admin: compute translation coverage for an entity type.
   * Returns {language, field, approved, total} stats.
   */
  async coverage(
    entityType: string
  ): Promise<Array<{ language: string; field: string; approved: number; total: number }>> {
    const pipeline = [
      { $match: { entityType: entityType.toLowerCase() } },
      {
        $group: {
          _id: { language: "$language", field: "$field" },
          total: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ["$status", "APPROVED"] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          language: "$_id.language",
          field: "$_id.field",
          total: 1,
          approved: 1,
        },
      },
    ];

    return Translation.aggregate(pipeline);
  }
}

export const translationRepository = new TranslationRepository();
export default TranslationRepository;
