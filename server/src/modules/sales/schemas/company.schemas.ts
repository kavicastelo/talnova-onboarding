import { z } from "zod";

export const COMPANY_TIER_VALUES = ["starter", "growth", "enterprise", "strategic"] as const;
export const COMPANY_STATUS_VALUES = ["prospect", "qualified", "customer", "inactive", "former_customer"] as const;

export const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required").max(200).trim(),
  domain: z.string().min(1, "Domain is required").max(200).trim(),
  website: z.string().max(300).trim().optional(),
  industry: z.string().max(100).trim().optional(),
  employeeCount: z.number().int().min(0).optional(),
  country: z.string().max(100).trim().optional(),
  region: z.string().max(100).trim().optional(),
  annualRevenuePotential: z.number().min(0).default(0),
  currency: z.string().length(3).default("USD"),
  tier: z.enum(COMPANY_TIER_VALUES).default("enterprise"),
  status: z.enum(COMPANY_STATUS_VALUES).default("prospect"),
  accountOwnerId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid owner ID format").optional(),
  tags: z.array(z.string().trim().max(50)).default([]),
});

export const updateCompanySchema = createCompanySchema.partial();

export const companyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().optional(),
  industry: z.string().trim().optional(),
  tier: z.string().trim().optional(),
  status: z.string().trim().optional(),
  country: z.string().trim().optional(),
  ownerId: z.string().trim().optional(),
  sortBy: z.enum(["createdAt", "name", "annualRevenuePotential", "employeeCount"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const addCompanyNoteSchema = z.object({
  content: z.string().min(1, "Note content cannot be empty").max(5000).trim(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type CompanyQueryParams = z.infer<typeof companyQuerySchema>;
export type AddCompanyNoteInput = z.infer<typeof addCompanyNoteSchema>;
