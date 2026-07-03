import { FastifyRequest, FastifyReply } from "fastify";
import {
  localizationService,
  SUPPORTED_LOCALES,
  SupportedLocale,
} from "../services/localization.service.js";
import { Translation } from "../models/translation.model.js";
import AppError from "../../../common/errors/app-error.js";
import mongoose from "mongoose";

export class LocalizationController {
  // ─── Public read ───────────────────────────────────────────────────────────

  /**
   * GET /api/v1/localization/supported-locales
   * Returns the list of supported locales. Frontend uses this to build the switcher.
   */
  getSupportedLocales = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ success: true, data: SUPPORTED_LOCALES });
  };

  /**
   * GET /api/v1/localization/:entityType/:entityId
   * Fetch all approved translations for an entity in the resolved locale.
   * Response shape: { [field]: value } — clients see localized values only.
   */
  getEntityTranslations = async (request: FastifyRequest, reply: FastifyReply) => {
    const { entityType, entityId } = request.params as { entityType: string; entityId: string };
    const locale = request.locale ?? "en";

    if (!mongoose.Types.ObjectId.isValid(entityId)) {
      throw new AppError(400, "INVALID_ID", "Invalid entity ID");
    }

    const translations = await localizationService.listTranslations(entityType, entityId);
    const approved = translations.filter((t) => t.language === locale && t.status === "APPROVED");

    const fields: Record<string, string> = {};
    for (const t of approved) {
      fields[t.field] = t.value;
    }

    return reply.send({ success: true, data: { entityType, entityId, language: locale, fields } });
  };

  // ─── Admin: manage translations ───────────────────────────────────────────

  /**
   * GET /api/v1/localization/admin/:entityType/:entityId/translations
   * List all translations for an entity (all statuses, all languages) — admin use.
   */
  listTranslations = async (request: FastifyRequest, reply: FastifyReply) => {
    const { entityType, entityId } = request.params as { entityType: string; entityId: string };

    if (!mongoose.Types.ObjectId.isValid(entityId)) {
      throw new AppError(400, "INVALID_ID", "Invalid entity ID");
    }

    const translations = await localizationService.listTranslations(entityType, entityId);
    return reply.send({ success: true, data: translations });
  };

  /**
   * PUT /api/v1/localization/admin/:entityType/:entityId/:field/:lang
   * Upsert a translation.
   * When lang=en: marks all other language translations as OUTDATED.
   */
  upsertTranslation = async (request: FastifyRequest, reply: FastifyReply) => {
    const { entityType, entityId, field, lang } = request.params as {
      entityType: string;
      entityId: string;
      field: string;
      lang: string;
    };
    const body = request.body as { value: string; status?: string; sourceVersion?: number };
    const user = request.user as any;

    if (!mongoose.Types.ObjectId.isValid(entityId)) {
      throw new AppError(400, "INVALID_ID", "Invalid entity ID");
    }

    const locale = localizationService.validateLocale(lang) as SupportedLocale;

    if (!body.value?.trim()) {
      throw new AppError(400, "VALIDATION_ERROR", "'value' is required and cannot be empty");
    }

    const translation = await localizationService.upsertTranslation(
      entityType,
      entityId,
      field,
      locale,
      {
        value: body.value,
        status: body.status as any,
        sourceVersion: body.sourceVersion,
        translatedBy: user?._id?.toString(),
      }
    );

    return reply.send({ success: true, data: translation });
  };

  /**
   * POST /api/v1/localization/admin/:entityType/:entityId/:field/:lang/approve
   * Approve a translation — makes it visible to production users.
   */
  approveTranslation = async (request: FastifyRequest, reply: FastifyReply) => {
    const { entityType, entityId, field, lang } = request.params as {
      entityType: string;
      entityId: string;
      field: string;
      lang: string;
    };
    const user = request.user as any;

    if (!mongoose.Types.ObjectId.isValid(entityId)) {
      throw new AppError(400, "INVALID_ID", "Invalid entity ID");
    }

    const locale = localizationService.validateLocale(lang) as SupportedLocale;
    const translation = await localizationService.approveTranslation(
      entityType,
      entityId,
      field,
      locale,
      user._id.toString()
    );

    return reply.send({ success: true, data: translation });
  };

  // ─── Admin readiness ──────────────────────────────────────────────────────

  /**
   * GET /api/v1/localization/admin/missing?entityType=article&lang=si
   * List entity+field pairs missing approved translations for a language.
   */
  listMissingTranslations = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { entityType?: string; lang?: string };

    if (!query.entityType) throw new AppError(400, "VALIDATION_ERROR", "entityType is required");
    if (!query.lang) throw new AppError(400, "VALIDATION_ERROR", "lang is required");

    const locale = localizationService.validateLocale(query.lang) as SupportedLocale;
    const missing = await localizationService.listMissingTranslations(query.entityType, locale);

    return reply.send({ success: true, data: missing, count: missing.length });
  };

  /**
   * GET /api/v1/localization/admin/outdated?entityType=journey
   * List all OUTDATED translations (source changed, translation not re-approved).
   */
  listOutdatedTranslations = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { entityType?: string };
    if (!query.entityType) throw new AppError(400, "VALIDATION_ERROR", "entityType is required");

    const outdated = await localizationService.listOutdatedTranslations(query.entityType);
    return reply.send({ success: true, data: outdated, count: outdated.length });
  };

  /**
   * GET /api/v1/localization/admin/coverage?entityType=article
   * Translation coverage stats: approved vs total per language per field.
   */
  translationCoverage = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { entityType?: string };
    if (!query.entityType) throw new AppError(400, "VALIDATION_ERROR", "entityType is required");

    const coverage = await localizationService.translationCoverage(query.entityType);
    return reply.send({ success: true, data: coverage });
  };
}

export default LocalizationController;
