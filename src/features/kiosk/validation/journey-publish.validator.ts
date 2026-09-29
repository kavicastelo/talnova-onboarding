import { KioskJourney } from "../../../types/kiosk/journey.types.js";
import {
  ValidationReport,
  ValidationErrorDetail
} from "../../../types/kiosk/validation.types.js";

/**
 * Client-side visual workspace linter and pre-publish validator.
 * Checks all 5 enterprise authoring rules to block broken journeys and highlight defects.
 */
export function validateJourneyForPublish(journey: Partial<KioskJourney>): ValidationReport {
  const errors: ValidationErrorDetail[] = [];
  const warnings: ValidationErrorDetail[] = [];

  const steps = Array.isArray(journey.steps) ? journey.steps : [];
  const declaredLanguages = Array.isArray(journey.languages) ? journey.languages : [];

  // General checks
  if (!journey.title || journey.title.trim() === "") {
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
      message: "At least one declared language must be selected."
    });
  }

  // --- RULE 1: Step Structure & Terminal Completion Step ---
  const contentSteps = steps.filter((s) => s.type !== "completion");
  const completionSteps = steps.filter((s) => s.type === "completion");

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
    const compIndex = steps.findIndex((s) => s.id === compStep.id);
    const isLastInArray = compIndex === steps.length - 1;
    const maxContentOrder = Math.max(...contentSteps.map((s) => s.order ?? 0), -1);

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
  steps.forEach((step, idx) => {
    if (!step.title || step.title.trim() === "") {
      errors.push({
        rule: "step_structure",
        stepId: step.id,
        field: "title",
        message: `Step ${idx + 1} (${step.id}) is missing a title.`
      });
    }
  });

  // --- RULE 2: Media Asset Existence ---
  // --- RULE 3: Declared Language Translation Completeness ---
  steps.forEach((step) => {
    const blocks = Array.isArray(step.blocks) ? step.blocks : [];

    blocks.forEach((block: any) => {
      declaredLanguages.forEach((lang) => {
        const rawRef =
          block.mediaReferences instanceof Map
            ? block.mediaReferences.get(lang)
            : typeof block.mediaReferences?.get === "function"
              ? block.mediaReferences.get(lang)
              : block.mediaReferences?.[lang];
        const mediaRef = rawRef;
        const isDefaultLang = lang === ((journey as any).defaultLanguage || journey.languages?.[0] || "en");
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
          if (!resolvedText || resolvedText.trim() === "") {
            errors.push({
              rule: "language_translation",
              stepId: step.id,
              blockId: block.id,
              language: lang,
              field: "textValue",
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
      });
    });
  });

  // --- RULE 4: Quiz Question Answer Correctness & Passing Score Bounds (50-100%) ---
  steps.forEach((step) => {
    const quiz = (step.interaction as any)?.quiz || (step as any).quiz;

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

          if (!q.question || q.question.trim() === "") {
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
            q.options.forEach((opt: string, optIdx: number) => {
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
    (journey.settings?.security?.protectionType as string) === "supervisor" ||
    steps.some(
      (s: any) =>
        s.interaction?.requireSupervisorWitness === true ||
        s.interaction?.type === "supervisor_witness" ||
        s.requireSupervisorWitness === true
    );

  if (isSupervisorWitnessRequired) {
    warnings.push({
      rule: "supervisor_availability",
      message:
        "Supervisor witness is required. Ensure an active frontline supervisor is provisioned before deployment."
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export default validateJourneyForPublish;
