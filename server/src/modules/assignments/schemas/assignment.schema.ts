import { z } from "zod";

export const assignJourneySchema = z.object({
  employeeId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid employee ID format"),
  journeyId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid journey ID format"),
  dueDate: z.string().datetime().or(z.string().date()).optional(),
  priority: z.enum(["low", "normal", "high", "critical"]).optional().default("normal"),
});

export const completeLessonSchema = z.object({
  moduleId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid module ID format"),
  lessonId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid lesson ID format"),
  timeSpentSeconds: z.number().min(0, "Time spent cannot be negative"),
  completedBlockIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional().default([]),
});

export const submitQuizSchema = z.object({
  moduleId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid module ID format"),
  lessonId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid lesson ID format"),
  answers: z.array(
    z.object({
      questionId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid question ID format"),
      selectedOptions: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid option ID format")),
    })
  ),
});
