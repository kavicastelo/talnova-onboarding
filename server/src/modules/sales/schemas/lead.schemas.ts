import { z } from "zod";

export const LEAD_STATUS_VALUES = [
  "new",
  "contacted",
  "engaged",
  "qualified",
  "opportunity",
  "converted",
  "nurturing",
  "disqualified",
  "unresponsive",
  "lost",
  "duplicate",
] as const;

export const LEAD_SOURCE_VALUES = [
  "website",
  "product_demo",
  "referral",
  "campaign",
  "import",
  "inbound_email",
  "other",
] as const;

export const LEAD_PRIORITY_VALUES = ["low", "normal", "high", "urgent"] as const;

export const LEAD_COMPANY_SIZE_VALUES = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1000+",
] as const;

export const leadConsentSchema = z.object({
  emailMarketing: z.boolean().default(false),
  whatsappMarketing: z.boolean().default(false),
  consentTimestamp: z.string().datetime().or(z.date()).optional(),
  consentSource: z.string().optional(),
  optedOutAt: z.string().datetime().or(z.date()).optional(),
});

export const leadUtmSchema = z.object({
  source: z.string().optional(),
  medium: z.string().optional(),
  campaign: z.string().optional(),
  term: z.string().optional(),
  content: z.string().optional(),
});

export const createLeadSchema = z.object({
  name: z.preprocess(
    (val) => (typeof val === "string" ? val.trim() : val),
    z.string().min(1, "Name is required").max(200, "Name cannot exceed 200 characters")
  ),
  email: z.preprocess(
    (val) => (typeof val === "string" ? val.trim() : val),
    z.string().email("Invalid email address").max(200, "Email cannot exceed 200 characters")
  ),
  phone: z.string().max(50, "Phone number too long").optional(),
  whatsapp: z.string().max(50, "WhatsApp number too long").optional(),
  companyName: z.preprocess(
    (val) => (typeof val === "string" ? val.trim() : val),
    z.string().min(1, "Company name is required").max(200, "Company name cannot exceed 200 characters")
  ),
  jobTitle: z.string().max(150).optional(),
  industry: z.string().max(100).optional(),
  companySize: z.enum(LEAD_COMPANY_SIZE_VALUES).optional(),
  country: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  source: z.enum(LEAD_SOURCE_VALUES).default("website"),
  sourceDetails: z.string().max(500).optional(),
  utm: leadUtmSchema.optional(),
  status: z.enum(LEAD_STATUS_VALUES).default("new"),
  disqualificationReason: z.string().max(500).optional(),
  score: z.number().min(0).default(0),
  priority: z.enum(LEAD_PRIORITY_VALUES).default("normal"),
  interestedProduct: z.string().max(200).optional(),
  estimatedBudget: z.number().min(0).optional(),
  currency: z.string().length(3).default("USD"),
  expectedPurchaseDate: z.string().datetime().or(z.date()).optional(),
  assignedOwnerId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid owner ID format").optional(),
  tags: z.array(z.string().trim().max(50)).default([]),
  consent: leadConsentSchema.default({ emailMarketing: false, whatsappMarketing: false }),
});

export const updateLeadSchema = createLeadSchema.partial().extend({
  lastContactDate: z.string().datetime().or(z.date()).optional(),
  nextFollowUpDate: z.string().datetime().or(z.date()).optional(),
});

export const updateLeadStatusSchema = z.object({
  status: z.enum(LEAD_STATUS_VALUES, { required_error: "Status is required" }),
  disqualificationReason: z.string().max(500).optional(),
  note: z.string().max(2000).optional(),
});

export const leadQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().optional(),
  status: z.string().optional(),
  source: z.string().optional(),
  ownerId: z.string().optional(),
  priority: z.string().optional(),
  minScore: z.coerce.number().min(0).optional(),
  maxScore: z.coerce.number().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z.enum(["createdAt", "score", "priority", "lastContactDate", "name", "companyName"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const addLeadNoteSchema = z.object({
  content: z.string().min(1, "Note content cannot be empty").max(5000, "Note exceeds 5000 characters").trim(),
});

export const mergeLeadsSchema = z.object({
  primaryLeadId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid primary lead ID"),
  secondaryLeadIds: z
    .array(z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid secondary lead ID"))
    .min(1, "At least one secondary lead ID is required to merge"),
  fieldOverrides: z.record(z.any()).optional(),
});

export const checkDuplicatesSchema = z.object({
  email: z.string().optional(),
  phone: z.string().optional(),
  name: z.string().optional(),
  companyName: z.string().optional(),
  excludeLeadId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid exclude lead ID").optional(),
});

export const recordScoreEventSchema = z.object({
  rule: z.string().min(1, "Rule name is required").max(100),
  points: z.number().int().min(-100).max(100),
});

export const importPreviewSchema = z.object({
  csvContent: z.string().min(1, "CSV content cannot be empty"),
});

export const importExecuteSchema = z.object({
  csvContent: z.string().min(1, "CSV content cannot be empty"),
  mapping: z.record(z.string()).default({}),
  duplicateStrategy: z.enum(["skip", "overwrite", "create_duplicate"]).default("skip"),
  defaultValues: z
    .object({
      source: z.string().optional(),
      assignedOwnerId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid owner ID format").optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type UpdateLeadStatusInput = z.infer<typeof updateLeadStatusSchema>;
export type LeadQueryParams = z.infer<typeof leadQuerySchema>;
export type AddLeadNoteInput = z.infer<typeof addLeadNoteSchema>;
export type MergeLeadsInput = z.infer<typeof mergeLeadsSchema>;
export type CheckDuplicatesInput = z.infer<typeof checkDuplicatesSchema>;
export type RecordScoreEventInput = z.infer<typeof recordScoreEventSchema>;
export type ImportPreviewInput = z.infer<typeof importPreviewSchema>;
export type ImportExecuteInput = z.infer<typeof importExecuteSchema>;

