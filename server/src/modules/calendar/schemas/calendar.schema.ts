import { z } from "zod";

export const connectCalendarSchema = z.object({
  provider: z.enum(["google", "outlook", "ical"]).default("ical"),
  timezone: z.string().default("UTC"),
});

export const createMeetingEventSchema = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters"),
    description: z.string().optional(),
    category: z.enum(["manager_1on1", "buddy_coffee", "orientation", "training", "custom"]).default("custom"),
    attendeeUserIds: z.array(z.string()).min(1, "At least one attendee is required"),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    timezone: z.string().optional(),
    locationUrl: z.string().optional(),
    reminderMinutesBefore: z.number().optional(),
    notes: z.string().optional(),
    organizerUserId: z.string().optional(),
  })
  .refine((data) => new Date(data.endTime) > new Date(data.startTime), {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export const updateMeetingEventSchema = z
  .object({
    title: z.string().min(3).optional(),
    description: z.string().optional(),
    category: z.enum(["manager_1on1", "buddy_coffee", "orientation", "training", "custom"]).optional(),
    attendeeUserIds: z.array(z.string()).optional(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    timezone: z.string().optional(),
    locationUrl: z.string().optional(),
    reminderMinutesBefore: z.number().optional(),
    notes: z.string().optional(),
    status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime) {
        return new Date(data.endTime) > new Date(data.startTime);
      }
      return true;
    },
    {
      message: "End time must be after start time",
      path: ["endTime"],
    }
  );
