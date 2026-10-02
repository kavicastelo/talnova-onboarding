import { z } from "zod";

export const KioskWebhookTopicSchema = z.enum([
  "kiosk.device.offline",
  "kiosk.device.tampered",
  "kiosk.session.completed",
  "kiosk.emergency.activated",
  "*",
]);

export const CreateKioskWebhookSubscriptionSchema = z.object({
  url: z.string().url("A valid HTTP or HTTPS webhook URL is required"),
  secret: z.string().min(8, "Webhook signing secret must be at least 8 characters").optional(),
  topics: z.array(z.string()).min(1, "At least one event topic must be selected").default(["*"]),
  name: z.string().optional(),
  description: z.string().optional(),
  headers: z.record(z.string()).optional(),
  enabled: z.boolean().optional().default(true),
});

export const UpdateKioskWebhookSubscriptionSchema = z.object({
  url: z.string().url("A valid HTTP or HTTPS webhook URL is required").optional(),
  secret: z.string().min(8, "Webhook signing secret must be at least 8 characters").optional(),
  topics: z.array(z.string()).optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  headers: z.record(z.string()).optional(),
  enabled: z.boolean().optional(),
});

export const TestKioskWebhookDispatchSchema = z.object({
  topic: KioskWebhookTopicSchema.optional().default("kiosk.session.completed"),
  subscriptionId: z.string().optional(),
  payload: z.record(z.any()).optional(),
});

export type CreateKioskWebhookSubscriptionInput = z.infer<typeof CreateKioskWebhookSubscriptionSchema>;
export type UpdateKioskWebhookSubscriptionInput = z.infer<typeof UpdateKioskWebhookSubscriptionSchema>;
export type TestKioskWebhookDispatchInput = z.infer<typeof TestKioskWebhookDispatchSchema>;
