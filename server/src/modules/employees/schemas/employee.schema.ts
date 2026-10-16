import { z } from "zod";

export const updateProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
  location: z.string().optional(),
  timezone: z.string().optional(),
  avatar: z
    .object({
      uploadId: z.string(),
      fileName: z.string(),
      publicUrl: z.string().optional(),
    })
    .optional(),
});

export const updatePreferencesSchema = z.object({
  language: z.string().optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  emailNotifications: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(8, "Password must be at least 8 characters"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});

export const inviteEmployeeSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email address is required for employee invitations")
    .email("Invalid email address"),
  employeeId: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((val) => (val ? val : undefined)),
  phone: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((val) => (val ? val : undefined)),
  badgeId: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((val) => (val ? val : undefined)),
  initialPassword: z.string().min(8, "Initial password must be at least 8 characters").optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["owner", "admin", "manager", "employee", "super_admin", "it_admin", "hr_admin"]),
  roles: z.array(z.string()).optional(),
  customRoles: z.array(z.string()).optional(),
  department: z.string().optional(),
  departmentId: z.string().optional(),
  teamId: z.string().optional(),
  jobTitleId: z.string().optional(),
  designation: z.string().optional(),
  payrollCategory: z.string().optional(),
  managerId: z.string().optional(),
  employmentType: z.enum(["full_time", "part_time", "contractor", "intern"]).default("full_time"),
  hireDate: z.string().optional(),
});

export const updateEmployeeSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  employeeId: z.string().optional(),
  badgeId: z.string().optional(),
  departmentId: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
  managerId: z.string().nullable().optional(),
  status: z.enum(["invited", "active", "onboarding", "inactive", "on_leave", "sick", "terminated"]).optional(),
  role: z.enum(["owner", "admin", "manager", "employee", "super_admin", "it_admin", "hr_admin"]).optional(),
  roles: z.array(z.string()).optional(),
  customRoles: z.array(z.string()).optional(),
  designation: z.string().optional(),
  payrollCategory: z.string().optional(),
  employmentType: z.enum(["full_time", "part_time", "contractor", "intern"]).optional(),
  hireDate: z.string().optional(),
});

export const bulkImportOptionsSchema = z.object({
  triggerWorkflows: z.boolean().default(true),
  autoAssignRoleChecklists: z.boolean().default(true),
  sendInvites: z.boolean().default(false),
  defaultJourneyId: z.string().optional().nullable(),
  updateExisting: z.boolean().default(false),
});

export const importEmployeeRowSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email("Invalid email address")
      .optional()
      .nullable()
      .or(z.literal(""))
      .transform((val) => (val ? val : undefined)),
    name: z.string().optional().nullable(),
    firstName: z.string().optional().nullable(),
    lastName: z.string().optional().nullable(),
    fullName: z.string().optional().nullable(),
    department: z.string().optional().nullable(),
    departmentId: z.string().optional().nullable(),
    jobTitle: z.string().optional().nullable(),
    role: z.enum(["owner", "admin", "manager", "employee", "super_admin", "hr_admin", "it_admin"]).optional().nullable(),
    roles: z.array(z.string()).optional().nullable(),
    employeeId: z
      .string()
      .trim()
      .optional()
      .nullable()
      .or(z.literal(""))
      .transform((val) => (val ? val : undefined)),
    badgeId: z
      .string()
      .trim()
      .optional()
      .nullable()
      .or(z.literal(""))
      .transform((val) => (val ? val : undefined)),
    nationalId: z.string().optional().nullable(),
    managerEmail: z
      .string()
      .trim()
      .email("Invalid manager email")
      .optional()
      .nullable()
      .or(z.literal(""))
      .transform((val) => (val ? val : undefined)),
    managerEmployeeId: z.string().optional().nullable(),
    designation: z.string().optional().nullable(),
    payrollCategory: z.string().optional().nullable(),
    employmentType: z.enum(["full_time", "part_time", "contractor", "intern"]).optional().nullable(),
    hireDate: z.string().optional().nullable(),
    phone: z
      .string()
      .trim()
      .optional()
      .nullable()
      .or(z.literal(""))
      .transform((val) => (val ? val : undefined)),
    location: z.string().optional().nullable(),
    timezone: z.string().optional().nullable(),
    customAttributes: z.record(z.any()).optional().nullable(),
  })
  .refine(
    (row) => !!(row.email || row.employeeId || row.phone),
    {
      message: "Row must include at least one identifier (email, employee ID, or phone number)",
      path: ["email"],
    }
  );

export const validateBulkImportSchema = z.object({
  users: z.array(z.record(z.any())).min(1, "At least one row must be provided"),
  options: bulkImportOptionsSchema.optional().default({}),
});

export const importEmployeesSchema = z.object({
  users: z.array(importEmployeeRowSchema).min(1, "At least one employee must be provided"),
  options: bulkImportOptionsSchema.optional().default({}),
});

export type ImportEmployeeRow = z.infer<typeof importEmployeeRowSchema>;
export type BulkImportOptions = z.infer<typeof bulkImportOptionsSchema>;
export type ImportEmployeesInput = z.infer<typeof importEmployeesSchema>;
export type ValidateBulkImportInput = z.infer<typeof validateBulkImportSchema>;


