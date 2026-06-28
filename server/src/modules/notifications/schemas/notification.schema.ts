import { z } from "zod";

export const getNotificationsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  isRead: z.enum(["true", "false"]).optional(),
});
