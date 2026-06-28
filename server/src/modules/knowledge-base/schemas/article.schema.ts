import { z } from "zod";

const VisibilitySchema = z.object({
  access: z.enum(["all", "department", "team", "custom"]).default("all"),
  departments: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional(),
  teams: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional(),
  users: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional(),
});

const ContentBlockSchema = z.object({
  _id: z.string().optional(),
  type: z.enum(["text", "image", "video", "audio", "pdf", "document", "embed", "callout", "code"]),
  content: z.string().optional(),
  uploadId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  embedUrl: z.string().url().or(z.string().length(0)).optional(),
  order: z.number().optional(),
});

const AttachmentSchema = z.object({
  _id: z.string().optional(),
  title: z.string().min(1, "Attachment title cannot be empty"),
  uploadId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid upload ID format"),
  downloadable: z.boolean().default(true),
});

export const createArticleSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  summary: z.string().optional(),
  content: z.object({
    blocks: z.array(ContentBlockSchema).default([]),
  }),
  categoryId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  tags: z.array(z.string()).optional().default([]),
  visibility: VisibilitySchema.optional(),
  attachments: z.array(AttachmentSchema).optional().default([]),
});

export const updateArticleSchema = z.object({
  title: z.string().min(3).optional(),
  summary: z.string().optional(),
  content: z
    .object({
      blocks: z.array(ContentBlockSchema),
    })
    .optional(),
  categoryId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  tags: z.array(z.string()).optional(),
  visibility: VisibilitySchema.optional(),
  attachments: z.array(AttachmentSchema).optional(),
});
