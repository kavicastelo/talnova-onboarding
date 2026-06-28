import { z } from "zod";

export const requestUploadUrlSchema = z.object({
  fileName: z.string().min(1, "File name is required"),
  fileSizeBytes: z.number().min(1, "File size must be greater than 0"),
  mimeType: z.string().min(1, "MIME type is required"),
  visibility: z.enum(["public", "private"]).optional().default("private"),
});

export const confirmUploadSchema = z.object({
  uploadId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid upload ID format"),
});
