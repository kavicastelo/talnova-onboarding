import { z } from "zod";
import { validateFileName, ALLOWED_MIME_TYPES } from "../../../config/storage.config.js";

export const requestUploadUrlSchema = z
  .object({
    fileName: z
      .string()
      .min(1, "File name is required")
      .superRefine((val, ctx) => {
        const result = validateFileName(val);
        if (!result.isValid) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: result.error || "Invalid file name or unapproved extension",
          });
        }
      }),
    fileSizeBytes: z.number().min(1, "File size must be greater than 0").optional(),
    fileSize: z.number().min(1, "File size must be greater than 0").optional(),
    mimeType: z.string().optional(),
    fileType: z.string().optional(),
    visibility: z.enum(["public", "private"]).optional().default("private"),
    category: z.string().optional(),
  })
  .transform((data) => {
    const fileSizeBytes = data.fileSizeBytes ?? data.fileSize ?? 1024;
    const rawMime = data.mimeType ?? data.fileType ?? "";
    const mimeType = rawMime.toLowerCase().trim();

    return {
      ...data,
      fileSizeBytes,
      mimeType,
    };
  })
  .refine((data) => data.fileSizeBytes > 0, {
    message: "File size must be greater than 0",
    path: ["fileSizeBytes"],
  })
  .refine((data) => data.mimeType.length > 0 && ALLOWED_MIME_TYPES.has(data.mimeType), {
    message: "MIME type is not permitted. Only safe document, image, video, and audio MIME types are accepted.",
    path: ["mimeType"],
  });

export const confirmUploadSchema = z.object({
  uploadId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid upload ID format"),
});
