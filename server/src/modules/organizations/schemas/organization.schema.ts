import { z } from "zod";

export const updateOrganizationSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  description: z.string().optional(),
  website: z.string().url("Invalid URL").or(z.string().length(0)).optional(),
  industry: z.string().optional(),
  size: z.enum(["1-10", "11-50", "51-250", "251-1000", "1000+"]).optional(),
  supportEmail: z.string().email("Invalid email").optional(),
  workspace: z.object({
    timezone: z.string().optional(),
    locale: z.string().optional(),
    dateFormat: z.string().optional(),
    firstDayOfWeek: z.number().min(0).max(6).optional(),
  }).optional(),
  notificationSettings: z.object({
    assignmentEmail: z.boolean().optional(),
    reminderEmail: z.boolean().optional(),
    weeklyDigest: z.boolean().optional(),
  }).optional(),
});

export const updateBrandingSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be valid hex color").optional(),
  secondaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be valid hex color").optional(),
  accentColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be valid hex color").optional(),
  logo: z.object({
    uploadId: z.string(),
    fileName: z.string(),
    publicUrl: z.string().optional(),
  }).optional(),
  favicon: z.object({
    uploadId: z.string(),
    fileName: z.string(),
    publicUrl: z.string().optional(),
  }).optional(),
});

export const updateSecuritySchema = z.object({
  allowPasswordLogin: z.boolean().optional(),
  enforceMfa: z.boolean().optional(),
  sessionTimeout: z.number().min(60, "Timeout must be at least 60 seconds").optional(),
});

export const departmentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be valid hex color").or(z.string().length(0)).optional(),
});

export const teamSchema = z.object({
  name: z.string().min(1, "Name is required"),
  departmentId: z.string().optional(),
});
