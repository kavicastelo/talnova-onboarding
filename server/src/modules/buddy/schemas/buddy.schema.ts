import { z } from "zod";

export const registerBuddySchema = z.object({
  isAvailable: z.boolean().default(true),
  maxMentees: z.number().min(1).max(10).default(3),
  skills: z.array(z.string()).optional(),
  bio: z.string().optional(),
});

export const assignBuddySchema = z.object({
  newHireUserId: z.string().min(1, "New hire user ID is required"),
  buddyUserId: z.string().min(1, "Buddy user ID is required"),
});

export const updateChecklistSchema = z.object({
  taskId: z.string().min(1, "Task ID is required"),
  completed: z.boolean(),
});

export const logCheckinSchema = z.object({
  notes: z.string().min(3, "Notes must be at least 3 characters"),
  rating: z.number().min(1).max(5).optional(),
});
