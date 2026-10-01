import { z } from "zod";

export const EmergencyContactSchema = z.object({
  name: z.string().min(1, "Contact name is required"),
  phone: z.string().min(1, "Contact phone is required"),
  role: z.string().optional()
});

export const EmergencyBroadcastSchema = z.object({
  organizationId: z.string().optional(),
  type: z.enum(["fire", "gas_leak", "toxic_spill", "weather", "security_threat", "general"]),
  severity: z.enum(["warning", "critical", "evacuate"]).default("evacuate"),
  title: z.string().min(1, "Emergency title is required"),
  message: z.string().min(1, "Emergency message is required"),
  evacuationMapUrl: z.string().optional(),
  primaryExit: z.string().optional(),
  secondaryExit: z.string().optional(),
  assemblyZone: z.string().optional(),
  emergencyContacts: z.array(EmergencyContactSchema).optional(),
  soundSiren: z.boolean().default(true),
  siteId: z.string().optional(),
  deviceIds: z.array(z.string()).optional()
});

export const EmergencyClearSchema = z.object({
  organizationId: z.string().optional(),
  reason: z.string().optional()
});

export type EmergencyBroadcastInput = z.infer<typeof EmergencyBroadcastSchema>;
export type EmergencyClearInput = z.infer<typeof EmergencyClearSchema>;
