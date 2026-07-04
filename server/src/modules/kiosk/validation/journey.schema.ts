import { z } from "zod";
import { ObjectIdSchema, LanguageCodeSchema, PinCodeSchema, KioskSecurityProtectionTypeSchema } from "./common.schema.js";
import { KioskStepSchema } from "./step.schema.js";
import { SIGNED_URL_QUERY_KEYS } from "../constants/index.js";

/**
 * Security settings for a Kiosk Journey.
 */
export const KioskJourneySecuritySettingsSchema = z
  .object({
    protectionType: KioskSecurityProtectionTypeSchema,
    pinCode: z.string().optional(),
    expiresAt: z.union([z.date(), z.string().datetime()]).nullable().optional()
  })
  .strict()
  .superRefine((data, ctx) => {
    // 1. PIN validation required if protectionType is "pin"
    if (data.protectionType === "pin") {
      if (!data.pinCode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pinCode"],
          message: "PIN code is required when protection type is PIN"
        });
      } else {
        const pinResult = PinCodeSchema.safeParse(data.pinCode);
        if (!pinResult.success) {
          pinResult.error.issues.forEach((issue) => {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["pinCode"],
              message: issue.message
            });
          });
        }
      }
    }

    // 2. Expiration required if protectionType is "signed_url"
    if (data.protectionType === "signed_url" && !data.expiresAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiresAt"],
        message: "Expiration timestamp is required when protection type is signed_url"
      });
    }
  });

/**
 * General display and execution settings for a Kiosk Journey.
 */
export const KioskJourneySettingsSchema = z
  .object({
    autoPlay: z.boolean(),
    loopForever: z.boolean(),
    idleTimeoutSeconds: z.number().int().positive(),
    autoReturnHome: z.boolean(),
    hideNavigation: z.boolean(),
    disableExit: z.boolean(),
    security: KioskJourneySecuritySettingsSchema
  })
  .strict();

/**
 * Publishing lifecycle status and version metadata.
 */
export const KioskPublishingSettingsSchema = z
  .object({
    status: z.enum(["draft", "published", "archived"]),
    version: z.number().int().positive(),
    publishedAt: z.union([z.date(), z.string().datetime()]).nullable().optional()
  })
  .strict();

/**
 * Base schema representing the core Kiosk Journey properties before refinement.
 */
export const BaseKioskJourneySchema = z
  .object({
    _id: ObjectIdSchema,
    organizationId: ObjectIdSchema,
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    languages: z.array(LanguageCodeSchema).min(1, { message: "At least one language is required" }),
    steps: z.array(KioskStepSchema),
    settings: KioskJourneySettingsSchema,
    publishing: KioskPublishingSettingsSchema,
    createdAt: z.union([z.date(), z.string().datetime()]),
    updatedAt: z.union([z.date(), z.string().datetime()]),
    createdBy: z.string().min(1),
    updatedBy: z.string().min(1).optional(),
    isDeleted: z.boolean(),
    deletedAt: z.union([z.date(), z.string().datetime()]).nullable().optional()
  })
  .strict();

/**
 * Shared refinement check for validating kiosk steps uniqueness, sequence, and routing paths.
 */
const refineJourneyData = (data: {
  publishing: { status: "draft" | "published" | "archived" };
  languages: readonly string[];
  steps: readonly z.infer<typeof KioskStepSchema>[];
}, ctx: z.RefinementCtx) => {
  // 1. Validate languages list is unique
  const langSet = new Set<string>();
  data.languages.forEach((lang, idx) => {
    if (langSet.has(lang)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["languages", idx],
        message: `Duplicate language code "${lang}" detected`
      });
    }
    langSet.add(lang);
  });

  // 2. Validate step list constraints
  const stepIds = new Set<string>();
  const stepOrders = new Set<number>();

  if (data.publishing.status === "published" && data.steps.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["steps"],
      message: "Published journeys must contain at least one step"
    });
  }

  data.steps.forEach((step, idx) => {
    // Step ID uniqueness check
    if (stepIds.has(step.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["steps", idx, "id"],
        message: `Duplicate step ID "${step.id}" detected in journey`
      });
    }
    stepIds.add(step.id);

    // Step Order uniqueness check
    if (stepOrders.has(step.order)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["steps", idx, "order"],
        message: `Duplicate step order index "${step.order}" detected in journey`
      });
    }
    stepOrders.add(step.order);
  });

  // 3. Routing references verification (cross-step)
  data.steps.forEach((step, idx) => {
    // Check hotspots routing target exists
    if (step.interaction.hotspots) {
      step.interaction.hotspots.forEach((hotspot, hIdx) => {
        if (!stepIds.has(hotspot.actionStepId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["steps", idx, "interaction", "hotspots", hIdx, "actionStepId"],
            message: `Target step ID "${hotspot.actionStepId}" not found in journey steps`
          });
        }
      });
    }

    // Check path target correctStepId exists
    if (step.interaction.correctStepId && !stepIds.has(step.interaction.correctStepId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["steps", idx, "interaction", "correctStepId"],
        message: `Correct target step ID "${step.interaction.correctStepId}" not found in journey steps`
      });
    }

    // Check path target incorrectStepId exists
    if (step.interaction.incorrectStepId && !stepIds.has(step.interaction.incorrectStepId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["steps", idx, "interaction", "incorrectStepId"],
        message: `Incorrect target step ID "${step.interaction.incorrectStepId}" not found in journey steps`
      });
    }
  });
};

/**
 * Main domain schema for Kiosk Journey records.
 */
export const KioskJourneySchema = BaseKioskJourneySchema.superRefine(refineJourneyData);

export const CreateKioskJourneySchema = BaseKioskJourneySchema.omit({
  _id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  isDeleted: true,
  deletedAt: true
}).passthrough().superRefine(refineJourneyData);

/**
 * Validator schema for updating an existing Kiosk Journey.
 */
export const UpdateKioskJourneySchema = BaseKioskJourneySchema.omit({
  _id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  isDeleted: true,
  deletedAt: true
}).partial().passthrough();

/**
 * Signed URL query parameters schema validator.
 */
export const SignedUrlQuerySchema = z
  .object({
    [SIGNED_URL_QUERY_KEYS.ORGANIZATION_ID]: ObjectIdSchema,
    [SIGNED_URL_QUERY_KEYS.EXPIRATION]: z.string().regex(/^\d+$/, { message: "Expiration must be a numeric timestamp" }),
    [SIGNED_URL_QUERY_KEYS.SIGNATURE]: z.string().min(1, { message: "Signature hash is required" })
  })
  .strict()
  .describe("Signed URL validation parameter schema");

