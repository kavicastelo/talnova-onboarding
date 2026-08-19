import { z } from "zod";

export const createMilestoneTemplateSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  targetDay: z.enum(["30", "60", "90", "180"]).transform(Number).or(z.number().refine((val) => [30, 60, 90, 180].includes(val))),
  goals: z
    .array(
      z.object({
        title: z.string().min(1, "Goal title cannot be empty"),
        description: z.string().optional(),
      })
    )
    .optional(),
  checkinQuestions: z
    .array(
      z.object({
        question: z.string().min(1, "Question cannot be empty"),
        type: z.enum(["text", "rating", "boolean"]).default("text"),
        required: z.boolean().default(true),
      })
    )
    .optional(),
  audience: z
    .object({
      departmentNames: z.array(z.string()).optional(),
      jobTitleNames: z.array(z.string()).optional(),
      autoAssignNewHires: z.boolean().optional(),
    })
    .optional(),
});

export const assignMilestoneSchema = z.object({
  templateId: z.string().min(1, "Template ID is required"),
  employeeId: z.string().min(1, "Employee ID is required"),
});

export const selfCheckinSchema = z.object({
  responses: z.array(
    z.object({
      questionId: z.string(),
      question: z.string(),
      answer: z.string().min(1, "Answer cannot be empty"),
    })
  ),
  confidenceRating: z.number().min(1).max(5).optional(),
  comments: z.string().optional(),
  goalsCompletedTitles: z.array(z.string()).optional(),
});

export const managerReviewSchema = z.object({
  approvalStatus: z.enum(["approved", "needs_action"]),
  performanceRating: z.number().min(1).max(5).optional(),
  feedback: z.string().optional(),
});
