import { z } from "zod";

export const campaignChannelEnum = z.enum(["email", "whatsapp"]);

export const campaignStatusEnum = z.enum([
  "draft",
  "validating",
  "scheduled",
  "queued",
  "sending",
  "completed",
  "paused",
  "cancelled",
  "failed",
]);

export const templateCategoryEnum = z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]);

export const campaignRecipientInputSchema = z.object({
  contactId: z.string().trim().optional(),
  leadId: z.string().trim().optional(),
  recipientEmail: z.string().email().optional(),
  recipientPhone: z.string().trim().optional(),
  recipientName: z.string().trim().optional(),
});

export const createCampaignSchema = z
  .object({
    name: z.string().min(1, "Campaign name is required").max(200).trim(),
    description: z.string().trim().optional(),
    channel: campaignChannelEnum,
    templateId: z.string().trim().optional(),
    subject: z.string().trim().optional(),
    previewText: z.string().trim().optional(),
    content: z.string().optional(),
    whatsappTemplateName: z.string().trim().optional(),
    whatsappLanguageCode: z.string().trim().default("en"),
    whatsappParameters: z.record(z.string()).optional(),
    audienceFilter: z.record(z.any()).optional(),
    scheduledAt: z.string().or(z.date()).optional(),
    tags: z.array(z.string().trim()).optional(),
    recipients: z.array(campaignRecipientInputSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.channel === "email") {
      if (!data.templateId && !data.subject) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["subject"],
          message: "Subject line is required for email campaigns when no templateId is specified",
        });
      }
    } else if (data.channel === "whatsapp") {
      if (!data.templateId && !data.whatsappTemplateName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["whatsappTemplateName"],
          message: "Meta WhatsApp template name is required when no templateId is specified",
        });
      }
    }
  });

export const updateCampaignSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  description: z.string().trim().nullable().optional(),
  templateId: z.string().trim().nullable().optional(),
  subject: z.string().trim().nullable().optional(),
  previewText: z.string().trim().nullable().optional(),
  content: z.string().nullable().optional(),
  whatsappTemplateName: z.string().trim().nullable().optional(),
  whatsappLanguageCode: z.string().trim().optional(),
  whatsappParameters: z.record(z.string()).nullable().optional(),
  audienceFilter: z.record(z.any()).nullable().optional(),
  scheduledAt: z.string().or(z.date()).nullable().optional(),
  tags: z.array(z.string().trim()).optional(),
});

export const updateCampaignStatusSchema = z.object({
  status: z.enum(["draft", "scheduled", "sending", "paused", "completed", "cancelled"]),
  reason: z.string().trim().optional(),
});

export const cloneCampaignSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  includeRecipients: z.boolean().default(true),
});

export const addRecipientsSchema = z.object({
  recipients: z.array(campaignRecipientInputSchema).min(1, "At least one recipient is required"),
});

export const campaignQuerySchema = z.object({
  search: z.string().optional(),
  channel: campaignChannelEnum.optional(),
  status: campaignStatusEnum.optional(),
  tag: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "updatedAt", "name", "scheduledAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const createTemplateSchema = z
  .object({
    name: z.string().min(1, "Template name is required").max(200).trim(),
    channel: campaignChannelEnum,
    subject: z.string().trim().optional(),
    previewText: z.string().trim().optional(),
    htmlContent: z.string().optional(),
    plainTextContent: z.string().optional(),
    whatsappTemplateName: z.string().trim().optional(),
    whatsappLanguageCode: z.string().trim().default("en"),
    whatsappCategory: templateCategoryEnum.default("MARKETING"),
    whatsappParameters: z.array(z.string().trim()).optional(),
    tags: z.array(z.string().trim()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.channel === "whatsapp") {
      if (!data.whatsappTemplateName || data.whatsappTemplateName.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["whatsappTemplateName"],
          message: "Approved Meta WhatsApp template name is required for WhatsApp templates",
        });
      }
      if (!data.whatsappLanguageCode || data.whatsappLanguageCode.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["whatsappLanguageCode"],
          message: "Language code (e.g. 'en') is required for WhatsApp templates",
        });
      }
    } else if (data.channel === "email") {
      if (!data.subject || data.subject.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["subject"],
          message: "Subject line is required for Email templates",
        });
      }
      if (!data.htmlContent && !data.plainTextContent) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["htmlContent"],
          message: "At least one of htmlContent or plainTextContent is required for Email templates",
        });
      }
    }
  });

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  subject: z.string().trim().nullable().optional(),
  previewText: z.string().trim().nullable().optional(),
  htmlContent: z.string().nullable().optional(),
  plainTextContent: z.string().nullable().optional(),
  whatsappTemplateName: z.string().trim().nullable().optional(),
  whatsappLanguageCode: z.string().trim().optional(),
  whatsappCategory: templateCategoryEnum.optional(),
  whatsappParameters: z.array(z.string().trim()).optional(),
  tags: z.array(z.string().trim()).optional(),
});

export const templateQuerySchema = z.object({
  search: z.string().optional(),
  channel: campaignChannelEnum.optional(),
  tag: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "updatedAt", "name"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const previewTemplateSchema = z.object({
  templateId: z.string().trim().optional(),
  subject: z.string().trim().optional(),
  htmlContent: z.string().optional(),
  plainTextContent: z.string().optional(),
  leadId: z.string().trim().optional(),
  contactId: z.string().trim().optional(),
  sampleVariables: z.record(z.any()).optional(),
  defaultFallback: z.string().default(""),
});

export const audienceFilterSchema = z.object({
  target: z.enum(["leads", "contacts", "both"]).default("leads"),
  channel: campaignChannelEnum.default("email"),
  statuses: z.array(z.string().trim()).optional(),
  minScore: z.number().optional(),
  maxScore: z.number().optional(),
  industries: z.array(z.string().trim()).optional(),
  companySizes: z.array(z.string().trim()).optional(),
  includeTags: z.array(z.string().trim()).optional(),
  excludeTags: z.array(z.string().trim()).optional(),
  sources: z.array(z.string().trim()).optional(),
  country: z.string().trim().optional(),
  region: z.string().trim().optional(),
  inactiveDays: z.number().int().min(1).optional(),
  roles: z.array(z.string().trim()).optional(),
  frequencyCap: z
    .object({
      maxMessages: z.number().int().min(1).default(2),
      windowDays: z.number().int().min(1).default(7),
    })
    .optional(),
});

export const audienceEstimateSchema = z.object({
  filter: audienceFilterSchema,
  sampleSize: z.number().int().min(0).max(50).default(5),
});

export const audienceResolveSchema = z.object({
  filter: audienceFilterSchema,
  limit: z.number().int().min(1).max(10000).optional(),
});

export const launchCampaignOptionsSchema = z.object({
  batchSize: z.coerce.number().int().min(1).max(500).optional(),
  rateLimitPerSecond: z.coerce.number().int().min(1).max(1000).optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type UpdateCampaignStatusInput = z.infer<typeof updateCampaignStatusSchema>;
export type CloneCampaignInput = z.infer<typeof cloneCampaignSchema>;
export type AddRecipientsInput = z.infer<typeof addRecipientsSchema>;
export type CampaignQueryParams = z.infer<typeof campaignQuerySchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type TemplateQueryParams = z.infer<typeof templateQuerySchema>;
export type PreviewTemplateInput = z.infer<typeof previewTemplateSchema>;
export type AudienceFilterInput = z.infer<typeof audienceFilterSchema>;
export type AudienceEstimateInput = z.infer<typeof audienceEstimateSchema>;
export type AudienceResolveInput = z.infer<typeof audienceResolveSchema>;
export type LaunchCampaignOptionsInput = z.infer<typeof launchCampaignOptionsSchema>;
