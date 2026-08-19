import { z } from "zod";

export const nudgeDirectReportSchema = z.object({
  message: z.string().optional(),
});

export const signOffDirectReportSchema = z.object({
  notes: z.string().optional(),
});
