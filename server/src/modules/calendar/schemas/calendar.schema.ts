import { z } from "zod";

export const connectCalendarSchema = z.object({
  provider: z.enum(["google", "outlook", "ical"]).default("ical"),
  timezone: z.string().default("UTC"),
});

export const createMeetingEventSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  category: z.enum(["manager_1on1", "buddy_coffee", "orientation", "training", "custom"]).default("custom"),
  attendeeUserIds: z.array(z.string()).min(1, "At least one attendee is required"),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  timezone: z.string().optional(),
  locationUrl: z.string().optional(),
  reminderMinutesBefore: z.number().optional(),
});

export const updateMeetingEventSchema = createMeetingEventSchema.partial();
