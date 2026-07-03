import mongoose from "mongoose";
import { ITranslation, TranslationStatus } from "../models/translation.model.js";
import {
  TranslationRepository,
  MemoryCacheProvider,
  LocaleNegotiator,
  TranslationVersionManager,
  ICacheProvider,
  NoOpEventBus,
  ILocalizationEventBus,
} from "../../../infrastructure/localization/index.js";
import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  TRANSLATABLE_FIELDS,
  type SupportedLocale,
} from "../../../config/localization.config.js";
import AppError from "../../../common/errors/app-error.js";

// Re-export so existing callers don't break
export { SUPPORTED_LOCALES, type SupportedLocale };

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * LocalizationService
 *
 * The single public interface for all translation operations.
 * Business modules call ONLY this service — never the repository or model directly.
 *
 * Responsibilities:
 *   - Locale validation and negotiation (delegated to LocaleNegotiator)
 *   - Translation retrieval with fallback chain (delegated to repository + cache)
 *   - Overlaying translations onto domain documents
 *   - Admin operations: upsert, approve, list missing/outdated, coverage
 *   - Cache management (delegated to ICacheProvider)
 *   - Version lifecycle (delegated to TranslationVersionManager)
 */
export class LocalizationService {
  private readonly repository: TranslationRepository;
  private readonly cache: ICacheProvider;
  private readonly negotiator: LocaleNegotiator;
  private readonly versionManager: TranslationVersionManager;
  private readonly events: ILocalizationEventBus;

  constructor(options?: {
    repository?: TranslationRepository;
    cache?: ICacheProvider;
    negotiator?: LocaleNegotiator;
    events?: ILocalizationEventBus;
  }) {
    this.cache = options?.cache ?? new MemoryCacheProvider();
    this.repository = options?.repository ?? new TranslationRepository();
    this.negotiator = options?.negotiator ?? new LocaleNegotiator();
    this.versionManager = new TranslationVersionManager(this.repository, this.cache);
    this.events = options?.events ?? new NoOpEventBus();
  }

  // ─── Locale resolution ────────────────────────────────────────────────────

  /**
   * Validate a locale string. Throws 400 if unsupported.
   * Falls back to 'en' for falsy input.
   */
  validateLocale(lang: string | undefined): SupportedLocale {
    if (!lang) return DEFAULT_LOCALE;
    const resolved = this.negotiator.resolve(lang);
    if (!resolved) {
      throw new AppError(
        400,
        "UNSUPPORTED_LOCALE",
        `Locale '${lang}' is not supported. Supported: ${SUPPORTED_LOCALES.join(", ")}`
      );
    }
    return resolved;
  }

  /**
   * Normalize a locale string. Returns 'en' silently for unsupported values.
   * Use in middleware where silent fallback is required.
   */
  normalizeLocale(lang: string | undefined): SupportedLocale {
    return this.negotiator.normalize(lang);
  }

  /**
   * RFC-compliant negotiation from Accept-Language header value.
   */
  negotiateLocale(acceptLanguageHeader: string | undefined): SupportedLocale {
    return this.negotiator.negotiate(acceptLanguageHeader);
  }

  // ─── Translation retrieval ────────────────────────────────────────────────

  /**
   * Retrieve a single approved translation for an entity field.
   *
   * Fallback chain:
   *   1. Requested locale (APPROVED only)
   *   2. English (APPROVED only)
   *   3. null — caller decides what to display
   *
   * Only APPROVED translations are returned. OUTDATED and DRAFT are never served.
   */
  async getTranslation(
    entityType: string,
    entityId: string | mongoose.Types.ObjectId,
    field: string,
    requestedLang: SupportedLocale
  ): Promise<ITranslation | null> {
    const id = entityId.toString();

    const result = await this._fetchCached(entityType, id, field, requestedLang);
    if (result) return result;

    if (requestedLang !== DEFAULT_LOCALE) {
      return this._fetchCached(entityType, id, field, DEFAULT_LOCALE);
    }

    return null;
  }

  private async _fetchCached(
    entityType: string,
    entityId: string,
    field: string,
    language: string
  ): Promise<ITranslation | null> {
    const key = this.versionManager.buildCacheKey(entityType, entityId, field, language);
    const cached = await this.cache.get<ITranslation | null>(key);
    if (cached !== undefined) return cached;

    const translation = await this.repository.findApproved(entityType, entityId, field, language);
    await this.cache.set(key, translation, CACHE_TTL_MS);
    return translation;
  }

  /**
   * Localize a domain document by overlaying approved translations for the given locale.
   *
   * @param entityType  Domain model name (e.g. "journey", "article")
   * @param doc         The domain document (must have an _id or id field)
   * @param locale      Target locale
   * @param fields      Which fields to localize (default: all registered fields for entityType)
   *
   * Returns the original document unchanged if no translation is found.
   * Never throws — localization is always best-effort, never blocking.
   */
  async localizeDocument<T extends { _id?: any; id?: string }>(
    entityType: string,
    doc: T,
    locale: SupportedLocale,
    fields?: string[]
  ): Promise<T> {
    if (locale === DEFAULT_LOCALE) return doc; // English is already the source

    try {
      const entityId = (doc._id ?? doc.id)?.toString();
      if (!entityId) return doc;

      const targetFields = fields ?? TRANSLATABLE_FIELDS[entityType] ?? [];
      if (targetFields.length === 0) return doc;

      const overrides: Record<string, string> = {};
      await Promise.all(
        targetFields.map(async (field) => {
          const translation = await this.getTranslation(entityType, entityId, field, locale);
          if (translation?.value) {
            overrides[field] = translation.value;
          }
        })
      );

      return Object.keys(overrides).length > 0 ? { ...doc, ...overrides } : doc;
    } catch {
      // Localization is never blocking — return original on any error
      return doc;
    }
  }

  // ─── Admin operations ─────────────────────────────────────────────────────

  /**
   * Upsert a translation for an entity field.
   *
   * When language === 'en': marks all other language translations as OUTDATED.
   * When language !== 'en': stores as DRAFT by default.
   */
  async upsertTranslation(
    entityType: string,
    entityId: string | mongoose.Types.ObjectId,
    field: string,
    language: SupportedLocale,
    data: { value: string; status?: TranslationStatus; translatedBy?: string; sourceVersion?: number }
  ): Promise<ITranslation> {
    const id = entityId.toString();
    const isEnglish = language === DEFAULT_LOCALE;

    const translation = await this.repository.upsert(entityType, id, field, language, {
      value: data.value,
      status: data.status ?? (isEnglish ? "APPROVED" : "DRAFT"),
      sourceVersion: data.sourceVersion ?? 1,
      translatedBy: data.translatedBy,
    });

    // If English source changed → mark other translations OUTDATED
    if (isEnglish) {
      await this.versionManager.onSourceChanged(entityType, id, field, translation.sourceVersion);

      this.events.publish({
        type: "SourceUpdated",
        entityType,
        entityId: id,
        field,
        newSourceVersion: translation.sourceVersion,
        affectedLanguages: SUPPORTED_LOCALES.filter((l) => l !== "en"),
        timestamp: new Date(),
      });
    } else {
      await this.versionManager.invalidate(entityType, id, field, language);

      this.events.publish({
        type: "TranslationUpdated",
        entityType,
        entityId: id,
        field,
        language,
        previousStatus: "DRAFT",
        newStatus: translation.status,
        version: translation.version,
        timestamp: new Date(),
      });
    }

    return translation;
  }

  /**
   * Approve a translation — makes it visible to production users.
   */
  async approveTranslation(
    entityType: string,
    entityId: string | mongoose.Types.ObjectId,
    field: string,
    language: SupportedLocale,
    approverId: string
  ): Promise<ITranslation> {
    const id = entityId.toString();
    const translation = await this.repository.approve(entityType, id, field, language, approverId);

    if (!translation) {
      throw new AppError(404, "NOT_FOUND", "Translation not found");
    }

    await this.versionManager.invalidate(entityType, id, field, language);

    this.events.publish({
      type: "TranslationApproved",
      entityType,
      entityId: id,
      field,
      language,
      approvedBy: approverId,
      version: translation.version,
      timestamp: new Date(),
    });

    return translation;
  }

  /**
   * List all translations for an entity (any status) — admin use.
   */
  async listTranslations(
    entityType: string,
    entityId: string | mongoose.Types.ObjectId
  ): Promise<ITranslation[]> {
    return this.repository.findAllForEntity(entityType, entityId.toString());
  }

  // ─── Admin readiness ──────────────────────────────────────────────────────

  /**
   * List entity+field pairs that are missing approved translations for a language.
   */
  async listMissingTranslations(
    entityType: string,
    language: SupportedLocale
  ): Promise<Array<{ entityId: mongoose.Types.ObjectId; field: string }>> {
    const fields = TRANSLATABLE_FIELDS[entityType] ?? [];
    return this.repository.findMissing(entityType, language, fields);
  }

  /**
   * List all OUTDATED translations for an entity type.
   */
  async listOutdatedTranslations(entityType: string): Promise<ITranslation[]> {
    return this.repository.findOutdated(entityType);
  }

  /**
   * Compute translation coverage for an entity type.
   * Returns per-language, per-field approved vs total counts.
   */
  async translationCoverage(
    entityType: string
  ): Promise<Array<{ language: string; field: string; approved: number; total: number }>> {
    return this.repository.coverage(entityType);
  }
}

// Singleton for injection — defaults to MemoryCacheProvider
export const localizationService = new LocalizationService();
export default LocalizationService;
