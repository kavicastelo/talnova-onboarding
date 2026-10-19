import { z } from "zod";

export const CONTACT_ROLE_VALUES = [
  "buyer",
  "evaluator",
  "technical_contact",
  "approver",
  "admin",
  "other",
] as const;

export const contactConsentSchema = z.object({
  emailMarketing: z.boolean().default(false),
  whatsappMarketing: z.boolean().default(false),
  consentTimestamp: z.string().datetime().or(z.date()).optional(),
  consentSource: z.string().optional(),
  optedOutAt: z.string().datetime().or(z.date()).optional(),
});

export const createContactSchema = z.object({
  companyId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid company ID format").optional(),
  firstName: z.string().min(1, "First name is required").max(100).trim(),
  lastName: z.string().min(1, "Last name is required").max(100).trim(),
  email: z.string().email("Invalid email format").max(200).trim(),
  phone: z.string().max(50).trim().optional(),
  whatsapp: z.string().max(50).trim().optional(),
  jobTitle: z.string().max(150).trim().optional(),
  role: z.enum(CONTACT_ROLE_VALUES).default("evaluator"),
  isPrimaryDecisionMaker: z.boolean().default(false),
  consent: contactConsentSchema.default({ emailMarketing: false, whatsappMarketing: false }),
  tags: z.array(z.string().trim().max(50)).default([]),
});

export const updateContactSchema = createContactSchema.partial();

export const contactQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().optional(),
  companyId: z.string().trim().optional(),
  role: z.string().trim().optional(),
  isPrimary: z.coerce.boolean().optional(),
  sortBy: z.enum(["createdAt", "firstName", "lastName", "fullName", "email"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type ContactQueryParams = z.infer<typeof contactQuerySchema>;
