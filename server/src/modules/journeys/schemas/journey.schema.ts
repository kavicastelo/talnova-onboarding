import { z } from "zod";

const OptionSchema = z.object({
  text: z.string().min(1, "Option text cannot be empty"),
  isCorrect: z.boolean(),
});

const QuestionSchema = z.object({
  type: z.enum(["single_choice", "multiple_choice", "true_false"]),
  question: z.string().min(1, "Question text cannot be empty"),
  options: z.array(OptionSchema),
  explanation: z.string().optional(),
  points: z.number().min(1).default(1),
});

const QuizSchema = z.object({
  title: z.string().min(1, "Quiz title cannot be empty"),
  passingScore: z.number().min(0).max(100).default(80),
  questions: z.array(QuestionSchema),
});

const AttachmentSchema = z.object({
  title: z.string().min(1, "Attachment title cannot be empty"),
  uploadId: z.string(),
  downloadable: z.boolean().default(true),
});

const ContentBlockSchema = z.object({
  type: z.enum(["video", "audio", "image", "pdf", "document", "text", "embed", "checklist"]),
  title: z.string().optional(),
  content: z.string().optional(),
  uploadId: z.string().optional(),
  embedUrl: z.string().url().or(z.string().length(0)).optional(),
  order: z.number(),
  settings: z
    .object({
      autoplay: z.boolean().optional(),
      downloadable: z.boolean().optional(),
      requiredViewPercentage: z.number().optional(),
    })
    .optional(),
});

const LessonSchema = z.object({
  title: z.string().min(1, "Lesson title cannot be empty"),
  description: z.string().optional(),
  order: z.number(),
  estimatedDurationMinutes: z.number().min(0).default(0),
  contentBlocks: z.array(ContentBlockSchema).default([]),
  attachments: z.array(AttachmentSchema).default([]),
  quiz: QuizSchema.optional(),
  completionRules: z.object({
    requireContentCompletion: z.boolean().default(true),
    requireQuizCompletion: z.boolean().default(false),
    minimumQuizScore: z.number().min(0).max(100).optional(),
  }),
});

const ModuleSchema = z.object({
  title: z.string().min(1, "Module title cannot be empty"),
  description: z.string().optional(),
  order: z.number(),
  estimatedDurationMinutes: z.number().min(0).default(0),
  lessons: z.array(LessonSchema).default([]),
});

export const createJourneySchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  audience: z
    .object({
      departments: z.array(z.string()).optional(),
      teams: z.array(z.string()).optional(),
      jobTitles: z.array(z.string()).optional(),
      employmentTypes: z.array(z.string()).optional(),
      isPublic: z.boolean().optional(),
    })
    .optional(),
});

export const updateJourneySchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(10).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  audience: z
    .object({
      departments: z.array(z.string()).optional(),
      teams: z.array(z.string()).optional(),
      jobTitles: z.array(z.string()).optional(),
      employmentTypes: z.array(z.string()).optional(),
      isPublic: z.boolean().optional(),
    })
    .optional(),
  modules: z.array(ModuleSchema).optional(),
  certificate: z
    .object({
      enabled: z.boolean(),
      templateId: z.string().optional(),
      passingScore: z.number().min(0).max(100).optional(),
    })
    .optional(),
  settings: z
    .object({
      allowSkipLessons: z.boolean(),
      requireSequentialCompletion: z.boolean(),
      allowRetakes: z.boolean(),
      maxRetakes: z.number().optional(),
    })
    .optional(),
});

export const duplicateJourneySchema = z.object({
  title: z.string().min(3, "New title must be at least 3 characters"),
});


