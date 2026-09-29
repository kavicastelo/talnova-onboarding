import mongoose from "mongoose";
import {
  IKioskJourney
} from "../models/kiosk-journey.model.js";
import {
  ValidationReport,
  ValidationErrorDetail
} from "../types/validation.types.js";
import { Upload } from "../../uploads/models/upload.model.js";
import { User } from "../../auth/models/user.model.js";

export interface ValidateJourneyOptions {
  organizationId?: string | mongoose.Types.ObjectId;
  checkDatabase?: boolean;
}

/**
 * Validates a Kiosk Journey against enterprise pre-publish rules:
 * 1. Minimum 1 content step and exactly 1 terminal completion step.
 * 2. S3/Storage media asset existence verification.
 * 3. Declared language translation completeness.
 * 4. Quiz question answer correctness & passing score bounds (50-100%).
 * 5. Supervisor role availability if supervisor witness is required.
 */
export async function validateJourneyForPublish(
  journey: IKioskJourney | any,
  optionsOrOrgId: ValidateJourneyOptions | string | mongoose.Types.ObjectId = {}
): Promise<ValidationReport> {
  const options: ValidateJourneyOptions =
    typeof optionsOrOrgId === "string" || optionsOrOrgId instanceof mongoose.Types.ObjectId
      ? { organizationId: optionsOrOrgId, checkDatabase: true }
      : optionsOrOrgId || {};

  const errors: ValidationErrorDetail[] = [];
  const warnings: ValidationErrorDetail[] = [];

  const orgId = options.organizationId || journey.organizationId;
  const checkDatabase = options.checkDatabase ?? Boolean(orgId);
  const steps = Array.isArray(journey.steps) ? journey.steps : [];
  const declaredLanguages: string[] = Array.isArray(journey.languages)
    ? journey.languages
    : [];

  // 0. General Title & Language Validation
  if (!journey.title || typeof journey.title !== "string" || journey.title.trim() === "") {
    errors.push({
      rule: "step_structure",
      field: "title",
      message: "Journey title is required."
    });
  }

  if (declaredLanguages.length === 0) {
    errors.push({
      rule: "language_translation",
      field: "languages",
      message: "At least one declared language is required."
    });
  }

  // --- RULE 1: Step Structure & Terminal Completion Step ---
  const contentSteps = steps.filter((s: any) => s.type !== "completion");
  const completionSteps = steps.filter((s: any) => s.type === "completion");

  if (contentSteps.length === 0) {
    errors.push({
      rule: "step_structure",
      field: "steps",
      message: "Journey must contain at least 1 content step before completion."
    });
  }

  if (completionSteps.length === 0) {
    errors.push({
      rule: "terminal_completion",
      field: "steps",
      message: "Journey must have exactly 1 terminal completion step."
    });
  } else if (completionSteps.length > 1) {
    errors.push({
      rule: "terminal_completion",
      field: "steps",
      message: `Journey must have exactly 1 terminal completion step, but found ${completionSteps.length}.`
    });
  } else {
    // Exactly 1 completion step exists - ensure it is the final step
    const compStep = completionSteps[0];
    const compIndex = steps.findIndex((s: any) => s.id === compStep.id);
    const isLastInArray = compIndex === steps.length - 1;
    const maxContentOrder = Math.max(...contentSteps.map((s: any) => s.order ?? 0), -1);

    if (!isLastInArray || (compStep.order !== undefined && compStep.order <= maxContentOrder)) {
      errors.push({
        rule: "terminal_completion",
        stepId: compStep.id,
        field: "order",
        message: "Terminal completion step must be the final step of the journey."
      });
    }
  }

  // Validate step title presence
  steps.forEach((step: any, idx: number) => {
    if (!step.title || typeof step.title !== "string" || step.title.trim() === "") {
      errors.push({
        rule: "step_structure",
        stepId: step.id,
        field: "title",
        message: `Step ${idx + 1} (${step.id}) is missing a title.`
      });
    }
  });

  // --- RULE 2: Media Asset Existence (Structural & S3/Database) ---
  // --- RULE 3: Declared Language Translation Completeness ---
  const mediaAssetIdsToCheck = new Map<string, { stepId: string; blockId: string }>();

  steps.forEach((step: any) => {
    const blocks = Array.isArray(step.blocks) ? step.blocks : [];

    blocks.forEach((block: any) => {
      declaredLanguages.forEach((lang) => {
        const rawRef =
          block.mediaReferences instanceof Map
            ? block.mediaReferences.get(lang)
            : typeof block.mediaReferences?.get === "function"
              ? block.mediaReferences.get(lang)
              : block.mediaReferences?.[lang];
        const mediaRef = rawRef && typeof rawRef.toObject === "function" ? rawRef.toObject() : rawRef;
        const isDefaultLang = lang === (journey.defaultLanguage || "en");
        const textTranslation = block.translations?.[lang] ?? (isDefaultLang ? block.textValue : undefined);
        const resolvedText = mediaRef?.textValue ?? textTranslation;
        const resolvedUploadId = mediaRef?.uploadId ?? (isDefaultLang ? block.media?.uploadId : undefined);
        const resolvedEmbedUrl = mediaRef?.embedUrl ?? (isDefaultLang ? block.media?.embedUrl : undefined);
        const resolvedAudioUploadId = mediaRef?.audioUploadId ?? (isDefaultLang ? block.media?.audioUploadId : undefined);

        const hasAnyContent = Boolean(
          mediaRef ||
          (textTranslation !== undefined && textTranslation !== null) ||
          resolvedUploadId ||
          resolvedEmbedUrl
        );

        if (!hasAnyContent) {
          errors.push({
            rule: "language_translation",
            stepId: step.id,
            blockId: block.id,
            language: lang,
            message: `Step "${step.title}" block "${block.id}" is missing content for declared language "${lang}".`
          });
          return;
        }

        // Rule 3: TextBlock textValue completeness for each declared language
        if (block.type === "text") {
          if (!resolvedText || typeof resolvedText !== "string" || resolvedText.trim() === "") {
            errors.push({
              rule: "language_translation",
              stepId: step.id,
              blockId: block.id,
              field: "textValue",
              language: lang,
              message: `Step "${step.title}" block "${block.id}" is missing translation text for declared language "${lang}".`
            });
          }
        }

        // Rule 2: Media Asset reference completeness
        if (block.type === "image") {
          if (!resolvedUploadId && !resolvedEmbedUrl) {
            errors.push({
              rule: "media_asset",
              stepId: step.id,
              blockId: block.id,
              language: lang,
              message: `Step "${step.title}" image block "${block.id}" is missing an image asset or URL for declared language "${lang}".`
            });
          }
        } else if (block.type === "video") {
          if (!resolvedUploadId && !resolvedEmbedUrl) {
            errors.push({
              rule: "media_asset",
              stepId: step.id,
              blockId: block.id,
              language: lang,
              message: `Step "${step.title}" video block "${block.id}" is missing a video asset or embed URL for declared language "${lang}".`
            });
          }
        } else if (block.type === "audio") {
          if (!resolvedUploadId && !resolvedAudioUploadId && !resolvedEmbedUrl) {
            errors.push({
              rule: "media_asset",
              stepId: step.id,
              blockId: block.id,
              language: lang,
              message: `Step "${step.title}" audio block "${block.id}" is missing an audio asset for declared language "${lang}".`
            });
          }
        }

        if (resolvedUploadId) {
          mediaAssetIdsToCheck.set(resolvedUploadId.toString(), {
            stepId: step.id,
            blockId: block.id
          });
        }
        if (resolvedAudioUploadId) {
          mediaAssetIdsToCheck.set(resolvedAudioUploadId.toString(), {
            stepId: step.id,
            blockId: block.id
          });
        }
      });
    });
  });

  // Verify Media Assets in MongoDB / Storage
  if (checkDatabase && mediaAssetIdsToCheck.size > 0 && orgId) {
    const assetIdStrings = Array.from(mediaAssetIdsToCheck.keys());
    const validObjectIds = assetIdStrings
      .filter((id) => mongoose.Types.ObjectId.isValid(id) && id.length === 24)
      .map((id) => new mongoose.Types.ObjectId(id));

    // Non-ObjectId asset IDs fail immediately
    assetIdStrings.forEach((id) => {
      if (!mongoose.Types.ObjectId.isValid(id) || id.length !== 24) {
        const ctx = mediaAssetIdsToCheck.get(id);
        errors.push({
          rule: "media_asset",
          stepId: ctx?.stepId,
          blockId: ctx?.blockId,
          message: `Referenced media asset ID "${id}" is malformed.`
        });
      }
    });

    if (validObjectIds.length > 0) {
      const existingUploads = await Upload.find({
        _id: { $in: validObjectIds },
        organizationId: new mongoose.Types.ObjectId(orgId.toString()),
        "lifecycle.status": { $ne: "deleted" }
      }).select("_id");

      const existingSet = new Set(existingUploads.map((u) => u._id.toString()));

      validObjectIds.forEach((objId) => {
        const idStr = objId.toString();
        if (!existingSet.has(idStr)) {
          const ctx = mediaAssetIdsToCheck.get(idStr);
          errors.push({
            rule: "media_asset",
            stepId: ctx?.stepId,
            blockId: ctx?.blockId,
            message: `Media asset "${idStr}" referenced in block "${ctx?.blockId}" does not exist or has been deleted.`
          });
        }
      });
    }
  }

  // --- RULE 4: Quiz Question Answer Correctness & Passing Score Bounds (50-100%) ---
  steps.forEach((step: any) => {
    const quiz = step.interaction?.quiz || step.quiz;

    if (quiz) {
      // Validate passingScore (50-100%)
      if (
        typeof quiz.passingScore !== "number" ||
        isNaN(quiz.passingScore) ||
        quiz.passingScore < 50 ||
        quiz.passingScore > 100
      ) {
        errors.push({
          rule: "quiz_correctness",
          stepId: step.id,
          field: "passingScore",
          message: `Quiz in step "${step.title}" has invalid passing score (${quiz.passingScore}). Passing score must be between 50% and 100%.`
        });
      }

      // Validate questions array
      if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
        errors.push({
          rule: "quiz_correctness",
          stepId: step.id,
          field: "questions",
          message: `Quiz in step "${step.title}" must contain at least 1 question.`
        });
      } else {
        quiz.questions.forEach((q: any, qIdx: number) => {
          const qLabel = q.question && q.question.trim() !== "" ? `"${q.question}"` : `#${qIdx + 1}`;

          if (!q.question || typeof q.question !== "string" || q.question.trim() === "") {
            errors.push({
              rule: "quiz_correctness",
              stepId: step.id,
              message: `Quiz question ${qIdx + 1} in step "${step.title}" is missing question prompt text.`
            });
          }

          if (!Array.isArray(q.options) || q.options.length < 2) {
            errors.push({
              rule: "quiz_correctness",
              stepId: step.id,
              message: `Quiz question ${qLabel} in step "${step.title}" must have at least 2 options.`
            });
          } else {
            q.options.forEach((opt: any, optIdx: number) => {
              if (typeof opt !== "string" || opt.trim() === "") {
                errors.push({
                  rule: "quiz_correctness",
                  stepId: step.id,
                  message: `Option ${optIdx + 1} of quiz question ${qLabel} in step "${step.title}" cannot be empty.`
                });
              }
            });

            if (
              typeof q.correctOptionIndex !== "number" ||
              !Number.isInteger(q.correctOptionIndex) ||
              q.correctOptionIndex < 0 ||
              q.correctOptionIndex >= q.options.length
            ) {
              errors.push({
                rule: "quiz_correctness",
                stepId: step.id,
                field: "correctOptionIndex",
                message: `Quiz question ${qLabel} in step "${step.title}" has invalid correctOptionIndex (${q.correctOptionIndex}). Must be between 0 and ${q.options.length - 1} (out of bounds).`
              });
            }
          }
        });
      }
    }
  });

  // --- RULE 5: Supervisor Role Availability if Supervisor Witness is Required ---
  const isSupervisorWitnessRequired =
    journey.settings?.requireSupervisorWitness === true ||
    journey.settings?.security?.protectionType === "supervisor" ||
    steps.some(
      (s: any) =>
        s.interaction?.requireSupervisorWitness === true ||
        s.interaction?.type === "supervisor_witness" ||
        s.requireSupervisorWitness === true
    );

  if (isSupervisorWitnessRequired) {
    if (checkDatabase && orgId) {
      const supervisorCount = await User.countDocuments({
        organizationId: new mongoose.Types.ObjectId(orgId.toString()),
        $or: [
          { "permissions.role": "supervisor" },
          { "permissions.roles": "supervisor" },
          { "permissions.customRoles": "supervisor" },
          { "permissions.role": "manager" }
        ],
        isDeleted: false,
        "employment.status": { $ne: "inactive" }
      });

      if (supervisorCount === 0) {
        errors.push({
          rule: "supervisor_availability",
          message:
            "Supervisor witness is required, but no active supervisor user exists for this organization."
        });
      }
    } else {
      warnings.push({
        rule: "supervisor_availability",
        message:
          "Supervisor witness is required. Ensure an active frontline supervisor is provisioned before deployment."
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export default validateJourneyForPublish;
