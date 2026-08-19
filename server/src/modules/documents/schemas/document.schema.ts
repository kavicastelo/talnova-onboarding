import { z } from "zod";

export const createTemplateSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  category: z.enum(["nda", "code_of_conduct", "offer_letter", "handbook", "direct_deposit", "custom"]).default("custom"),
  content: z.string().min(10, "Template content must be at least 10 characters"),
  signatureRequired: z.boolean().default(true),
  audience: z
    .object({
      departmentNames: z.array(z.string()).optional(),
      jobTitleNames: z.array(z.string()).optional(),
      locations: z.array(z.string()).optional(),
      autoAssignNewHires: z.boolean().optional(),
    })
    .optional(),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export const assignDocumentSchema = z.object({
  templateId: z.string().min(1, "Template ID is required"),
  employeeId: z.string().min(1, "Employee ID is required"),
  dueDate: z.string().datetime().optional(),
});

export const signDocumentSchema = z.object({
  type: z.enum(["draw", "type"]),
  signatureDataUrl: z.string().optional(),
  signerName: z.string().min(2, "Signer name must be at least 2 characters"),
});
