import mongoose from "mongoose";
import crypto from "crypto";
import CalendarConnection, { ICalendarConnection } from "../models/calendar-connection.model.js";
import MeetingEvent, { IMeetingEvent } from "../models/meeting-event.model.js";
import User from "../../auth/models/user.model.js";
import EmployeeMilestone from "../../milestones/models/employee-milestone.model.js";
import NotificationService from "../../notifications/services/notification.service.js";
import NotificationRepository from "../../notifications/repositories/notification.repository.js";
import AppError from "../../../common/errors/app-error.js";

const notificationService = new NotificationService(new NotificationRepository());

export class CalendarService {
  /**
   * Connect or Get Calendar Connection & iCal Token
   */
  async connectProvider(
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    provider: "google" | "outlook" | "ical" = "ical",
    timezone = "UTC"
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    let connection = await CalendarConnection.findOne({ organizationId: orgObjectId, userId: userObjectId });

    if (!connection) {
      const icalToken = crypto.randomBytes(24).toString("hex");
      connection = await CalendarConnection.create({
        organizationId: orgObjectId,
        userId: userObjectId,
        provider,
        syncStatus: "connected",
        timezone,
        icalToken,
        lastSyncedAt: new Date(),
      });
    } else {
      connection.provider = provider;
      connection.timezone = timezone;
      connection.syncStatus = "connected";
      connection.lastSyncedAt = new Date();
      await connection.save();
    }

    return connection;
  }

  /**
   * Get Calendar Connection
   */
  async getConnection(orgId: string | mongoose.Types.ObjectId, userId: string | mongoose.Types.ObjectId) {
    let connection = await CalendarConnection.findOne({
      organizationId: new mongoose.Types.ObjectId(orgId),
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!connection) {
      connection = await this.connectProvider(orgId, userId);
    }

    return connection;
  }

  /**
   * Generate iCal (.ics) feed content for user
   */
  async generateICalFeed(icalToken: string): Promise<string> {
    const connection = await CalendarConnection.findOne({ icalToken, syncStatus: "connected" });
    if (!connection) {
      throw new AppError(404, "NOT_FOUND", "Invalid or expired iCal subscription token");
    }

    const events = await MeetingEvent.find({
      organizationId: connection.organizationId,
      attendeeUserIds: connection.userId,
      status: { $ne: "cancelled" },
      isDeleted: false,
    });

    const formatICalDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    };

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Talnova Onboarding//Calendar Integration//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Talnova Onboarding Schedule",
    ];

    for (const event of events) {
      icsContent.push(
        "BEGIN:VEVENT",
        `UID:${event.iCalUid}`,
        `DTSTAMP:${formatICalDate(event.createdAt)}`,
        `DTSTART:${formatICalDate(event.startTime)}`,
        `DTEND:${formatICalDate(event.endTime)}`,
        `SUMMARY:${event.title}`,
        `DESCRIPTION:${(event.description || "").replace(/\n/g, "\\n")}`,
        `LOCATION:${event.locationUrl || "Talnova Workspace"}`,
        `STATUS:${event.status.toUpperCase()}`,
        "END:VEVENT"
      );
    }

    icsContent.push("END:VCALENDAR");
    return icsContent.join("\r\n");
  }

  /**
   * Find Mutual Free/Busy Time Slots & Conflicts (CAL-005)
   */
  async getAvailability(
    orgId: string | mongoose.Types.ObjectId,
    params: {
      userIds: string | string[];
      date: string;
      durationMinutes?: number;
      timezone?: string;
    }
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const duration = Number(params.durationMinutes) || 30;
    const targetDate = params.date; // YYYY-MM-DD

    // Parse user IDs (can be comma-separated string or array)
    const rawIds = Array.isArray(params.userIds)
      ? params.userIds
      : typeof params.userIds === "string"
      ? params.userIds.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const userObjectIds = Array.from(new Set(rawIds)).map((id) => new mongoose.Types.ObjectId(id));

    if (userObjectIds.length === 0) {
      throw new AppError(400, "VALIDATION_ERROR", "At least one participant userId is required");
    }

    // Build day boundaries (00:00:00 to 23:59:59 UTC)
    const dayStart = new Date(`${targetDate}T00:00:00.000Z`);
    const dayEnd = new Date(`${targetDate}T23:59:59.999Z`);

    // Fetch non-cancelled meetings for these users intersecting this date
    const busyEvents = await MeetingEvent.find({
      organizationId: orgObjectId,
      isDeleted: false,
      status: { $ne: "cancelled" },
      $or: [
        { organizerUserId: { $in: userObjectIds } },
        { attendeeUserIds: { $in: userObjectIds } },
      ],
      startTime: { $lt: dayEnd },
      endTime: { $gt: dayStart },
    }).populate("organizerUserId attendeeUserIds", "profile email name");

    // Standard business working hours: 09:00 to 18:00
    const workingHourStart = 9;
    const workingHourEnd = 18;

    const candidateSlots: Array<{
      startTime: string;
      endTime: string;
      startFormatted: string;
      endFormatted: string;
      label: string;
      isAvailable: boolean;
      conflicts: Array<{ eventId: string; title: string; busyUserNames: string[] }>;
    }> = [];

    const formatHourMinute = (date: Date) => {
      const h = date.getUTCHours();
      const m = date.getUTCMinutes();
      const period = h >= 12 ? "PM" : "AM";
      const displayHour = h % 12 === 0 ? 12 : h % 12;
      return `${displayHour.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} ${period}`;
    };

    const totalMinutes = (workingHourEnd - workingHourStart) * 60;
    const stepMinutes = duration <= 30 ? 30 : duration;

    for (let offset = 0; offset + duration <= totalMinutes; offset += stepMinutes) {
      const startMinutes = workingHourStart * 60 + offset;
      const endMinutes = startMinutes + duration;

      const slotStart = new Date(dayStart.getTime() + startMinutes * 60 * 1000);
      const slotEnd = new Date(dayStart.getTime() + endMinutes * 60 * 1000);

      // Check overlaps with busy events
      const conflicts: Array<{ eventId: string; title: string; busyUserNames: string[] }> = [];

      for (const ev of busyEvents) {
        const evStart = new Date(ev.startTime);
        const evEnd = new Date(ev.endTime);

        // Overlap condition: slotStart < evEnd && slotEnd > evStart
        if (slotStart < evEnd && slotEnd > evStart) {
          const busyUsers: string[] = [];
          const usersInEvent = [
            ev.organizerUserId as any,
            ...(ev.attendeeUserIds as any[]),
          ];

          for (const u of usersInEvent) {
            const uid = u?._id?.toString() || u?.toString();
            if (userObjectIds.some((targetId) => targetId.toString() === uid)) {
              const name = u?.profile
                ? `${u.profile.firstName || ""} ${u.profile.lastName || ""}`.trim()
                : u?.name || u?.email || "Participant";
              if (!busyUsers.includes(name)) busyUsers.push(name);
            }
          }

          conflicts.push({
            eventId: ev._id.toString(),
            title: ev.title,
            busyUserNames: busyUsers,
          });
        }
      }

      candidateSlots.push({
        startTime: slotStart.toISOString(),
        endTime: slotEnd.toISOString(),
        startFormatted: formatHourMinute(slotStart),
        endFormatted: formatHourMinute(slotEnd),
        label: `${formatHourMinute(slotStart)} - ${formatHourMinute(slotEnd)}`,
        isAvailable: conflicts.length === 0,
        conflicts,
      });
    }

    const availableSlots = candidateSlots.filter((s) => s.isAvailable);

    return {
      date: targetDate,
      durationMinutes: duration,
      participantCount: userObjectIds.length,
      totalCandidateSlots: candidateSlots.length,
      availableSlotsCount: availableSlots.length,
      availableSlots,
      allSlots: candidateSlots,
      busyEventsCount: busyEvents.length,
    };
  }

  /**
   * Schedule Meeting Event (CAL-002, CAL-003)
   */
  async createMeetingEvent(
    orgId: string | mongoose.Types.ObjectId,
    organizerUserId: string | mongoose.Types.ObjectId,
    data: {
      title: string;
      description?: string;
      category?: "manager_1on1" | "buddy_coffee" | "orientation" | "training" | "custom";
      attendeeUserIds: string[];
      startTime: Date;
      endTime: Date;
      timezone?: string;
      locationUrl?: string;
      reminderMinutesBefore?: number;
      notes?: string;
    }
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const organizerObjectId = new mongoose.Types.ObjectId(organizerUserId);

    if (new Date(data.endTime) <= new Date(data.startTime)) {
      throw new AppError(400, "VALIDATION_ERROR", "End time must be after start time");
    }

    if (!data.attendeeUserIds || data.attendeeUserIds.length === 0) {
      throw new AppError(400, "VALIDATION_ERROR", "Meeting requires at least one attendee in addition to organizer");
    }

    const attendeeObjectIds = data.attendeeUserIds.map((id) => new mongoose.Types.ObjectId(id));
    if (!attendeeObjectIds.some((id) => id.toString() === organizerObjectId.toString())) {
      attendeeObjectIds.push(organizerObjectId);
    }

    const iCalUid = `event-${Date.now()}-${crypto.randomBytes(4).toString("hex")}@talnova.app`;
    const defaultRoomCode = `tal-${crypto.randomBytes(3).toString("hex")}-${crypto.randomBytes(3).toString("hex")}`;
    const locationUrl = data.locationUrl || `https://meet.google.com/${defaultRoomCode}`;

    const event = await MeetingEvent.create({
      organizationId: orgObjectId,
      title: data.title,
      description: data.description,
      category: data.category || "custom",
      organizerUserId: organizerObjectId,
      attendeeUserIds: attendeeObjectIds,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      timezone: data.timezone || "UTC",
      locationUrl,
      status: "scheduled",
      reminderMinutesBefore: data.reminderMinutesBefore || 15,
      iCalUid,
      notes: data.notes,
    });

    // Multi-party dual-recipient notifications (CAL-002, Dual-Recipient standard)
    // 1. Notify all invitees
    for (const attendeeId of attendeeObjectIds) {
      if (attendeeId.toString() !== organizerObjectId.toString()) {
        await notificationService.createNotification({
          organizationId: orgId,
          recipientUserId: attendeeId,
          type: "meeting_scheduled",
          title: `New Meeting Scheduled: ${event.title}`,
          message: `You have been invited to "${event.title}" on ${event.startTime.toLocaleString()}. Link: ${event.locationUrl}`,
          priority: "high",
          data: {
            eventId: event._id.toString(),
            locationUrl: event.locationUrl,
          },
        });
      }
    }

    // 2. Notify organizer confirmation
    await notificationService.createNotification({
      organizationId: orgId,
      recipientUserId: organizerObjectId,
      type: "meeting_scheduled",
      title: `Meeting Confirmed: ${event.title}`,
      message: `Your meeting "${event.title}" has been successfully scheduled for ${event.startTime.toLocaleString()}. Link: ${event.locationUrl}`,
      priority: "medium",
      data: {
        eventId: event._id.toString(),
        locationUrl: event.locationUrl,
      },
    });

    return event;
  }

  /**
   * Generate Single Event iCal (.ics)
   */
  async generateSingleEventICal(eventId: string | mongoose.Types.ObjectId): Promise<string> {
    const event = await MeetingEvent.findOne({
      _id: new mongoose.Types.ObjectId(eventId),
      isDeleted: false,
    });

    if (!event) {
      throw new AppError(404, "NOT_FOUND", "Meeting event not found");
    }

    const formatICalDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    };

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Talnova Onboarding//Calendar Integration//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:REQUEST",
      "BEGIN:VEVENT",
      `UID:${event.iCalUid}`,
      `DTSTAMP:${formatICalDate(new Date())}`,
      `DTSTART:${formatICalDate(event.startTime)}`,
      `DTEND:${formatICalDate(event.endTime)}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${(event.description || event.notes || "Onboarding meeting").replace(/\n/g, "\\n")}`,
      event.locationUrl ? `URL:${event.locationUrl}` : "",
      `STATUS:${event.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].filter(Boolean);

    return icsContent.join("\r\n");
  }

  /**
   * List scheduled meeting events for a user
   */
  async listMeetingEvents(orgId: string | mongoose.Types.ObjectId, userId: string | mongoose.Types.ObjectId) {
    return MeetingEvent.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      attendeeUserIds: new mongoose.Types.ObjectId(userId),
      isDeleted: false,
    })
      .populate("organizerUserId", "profile auth employment")
      .populate("attendeeUserIds", "profile auth employment")
      .sort({ startTime: 1 });
  }

  /**
   * Update meeting event (CAL-004)
   */
  async updateMeetingEvent(
    orgId: string | mongoose.Types.ObjectId,
    eventId: string | mongoose.Types.ObjectId,
    data: Partial<IMeetingEvent>
  ) {
    const event = await MeetingEvent.findOne({
      _id: new mongoose.Types.ObjectId(eventId),
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: false,
    });

    if (!event) {
      throw new AppError(404, "NOT_FOUND", "Meeting event not found");
    }

    if (data.title) event.title = data.title;
    if (data.description !== undefined) event.description = data.description;
    if (data.notes !== undefined) event.notes = data.notes;
    if (data.startTime) event.startTime = new Date(data.startTime);
    if (data.endTime) event.endTime = new Date(data.endTime);
    if (data.locationUrl !== undefined) event.locationUrl = data.locationUrl;
    if (data.status) event.status = data.status;

    if (event.endTime <= event.startTime) {
      throw new AppError(400, "VALIDATION_ERROR", "End time must be after start time");
    }

    await event.save();
    return event;
  }

  /**
   * Cancel meeting event
   */
  async cancelMeetingEvent(orgId: string | mongoose.Types.ObjectId, eventId: string | mongoose.Types.ObjectId) {
    const event = await MeetingEvent.findOne({
      _id: new mongoose.Types.ObjectId(eventId),
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: false,
    });

    if (!event) {
      throw new AppError(404, "NOT_FOUND", "Meeting event not found");
    }

    event.status = "cancelled";
    await event.save();

    // Multi-party cancellation notifications (organizer + all attendees)
    const notifyIds = Array.from(
      new Set([
        event.organizerUserId.toString(),
        ...event.attendeeUserIds.map((id) => id.toString()),
      ])
    );

    for (const userId of notifyIds) {
      await notificationService.createNotification({
        organizationId: orgId,
        recipientUserId: userId,
        type: "meeting_cancelled",
        title: `Meeting Cancelled: ${event.title}`,
        message: `The meeting "${event.title}" originally scheduled for ${new Date(event.startTime).toLocaleString()} has been cancelled.`,
        priority: "medium",
        data: {
          eventId: event._id.toString(),
        },
      });
    }

    return event;
  }

  /**
   * Event-driven automatic meeting scheduling for new hires
   */
  async autoScheduleOnboardingMeetings(
    orgId: string | mongoose.Types.ObjectId,
    newHireUserId: string | mongoose.Types.ObjectId
  ): Promise<number> {
    const newHire = await User.findById(newHireUserId);
    if (!newHire) return 0;

    const managerId = newHire.employment?.managerId;
    const now = new Date();

    // 1. Schedule Day 1 Welcome Coffee (tomorrow at 10 AM)
    const day1Time = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    day1Time.setHours(10, 0, 0, 0);
    const day1EndTime = new Date(day1Time.getTime() + 30 * 60 * 1000);

    const attendees = [newHireUserId.toString()];
    if (managerId) attendees.push(managerId.toString());

    await this.createMeetingEvent(orgId, managerId?.toString() || newHireUserId.toString(), {
      title: `Onboarding Day 1 Welcome Coffee — ${newHire.profile?.firstName}`,
      description: "Welcome chat and initial team orientation.",
      category: "buddy_coffee",
      attendeeUserIds: attendees,
      startTime: day1Time,
      endTime: day1EndTime,
    });

    return 1;
  }

  /**
   * Generate Full 90-Day Onboarding Schedule Pack (.ics) — Marketing Differentiator
   */
  async generateOnboardingSchedulePack(
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId
  ): Promise<string> {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // 1. Fetch all scheduled meeting events for this user (1-on-1s, buddy chats, orientations)
    const events = await MeetingEvent.find({
      organizationId: orgObjectId,
      attendeeUserIds: userObjectId,
      status: { $ne: "cancelled" },
      isDeleted: false,
    }).sort({ startTime: 1 });

    // 2. Fetch all milestones for this user
    const milestones = await EmployeeMilestone.find({
      organizationId: orgObjectId,
      employeeId: userObjectId,
      isDeleted: false,
    }).sort({ dueDate: 1 });

    const formatICalDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    };

    const formatAllDayDate = (date: Date) => {
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, "0");
      const d = String(date.getUTCDate()).padStart(2, "0");
      return `${y}${m}${d}`;
    };

    const icsLines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Talnova Onboarding//90-Day Journey Calendar Pack//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Talnova 90-Day Onboarding Journey Pack",
      "X-WR-CALDESC:Complete onboarding roadmap containing orientation, mentor check-ins, and milestone checkpoints.",
    ];

    // Add all meeting events
    for (const ev of events) {
      icsLines.push(
        "BEGIN:VEVENT",
        `UID:${ev.iCalUid}`,
        `DTSTAMP:${formatICalDate(ev.createdAt || new Date())}`,
        `DTSTART:${formatICalDate(ev.startTime)}`,
        `DTEND:${formatICalDate(ev.endTime)}`,
        `SUMMARY:${ev.title}`,
        `DESCRIPTION:${(ev.description || ev.notes || "Onboarding meeting").replace(/\n/g, "\\n")}`,
        `LOCATION:${ev.locationUrl || "Google Meet"}`,
        `STATUS:${ev.status.toUpperCase()}`,
        "END:VEVENT"
      );
    }

    // Add milestone deadline checkpoints as all-day events
    for (const m of milestones) {
      const dueStr = formatAllDayDate(m.dueDate);
      const nextDay = new Date(m.dueDate);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const nextDayStr = formatAllDayDate(nextDay);

      icsLines.push(
        "BEGIN:VEVENT",
        `UID:milestone-${m._id}@talnova.app`,
        `DTSTAMP:${formatICalDate(new Date())}`,
        `DTSTART;VALUE=DATE:${dueStr}`,
        `DTEND;VALUE=DATE:${nextDayStr}`,
        `SUMMARY:🎯 Onboarding Milestone Day ${m.targetDay}: ${m.milestoneTitle}`,
        `DESCRIPTION:Check-in checkpoint for Day ${m.targetDay}. Goals: ${m.goalsProgress.map((g) => g.goalTitle).join("; ")}`,
        "STATUS:CONFIRMED",
        "END:VEVENT"
      );
    }

    icsLines.push("END:VCALENDAR");
    return icsLines.join("\r\n");
  }

  /**
   * Automated Milestone Review 1-on-1 Meeting Scheduling
   */
  async scheduleMilestoneReviewMeeting(
    orgId: string | mongoose.Types.ObjectId,
    schedulerUserId: string | mongoose.Types.ObjectId,
    params: {
      milestoneId: string | mongoose.Types.ObjectId;
      targetDate?: string; // YYYY-MM-DD
      startTime?: string;  // HH:mm
      durationMinutes?: number;
      locationUrl?: string;
    }
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const milestone = await EmployeeMilestone.findOne({
      _id: new mongoose.Types.ObjectId(params.milestoneId),
      organizationId: orgObjectId,
      isDeleted: false,
    });

    if (!milestone) {
      throw new AppError(404, "NOT_FOUND", "Milestone not found");
    }

    const employee = await User.findById(milestone.employeeId);
    if (!employee) {
      throw new AppError(404, "NOT_FOUND", "Employee for milestone not found");
    }

    const managerId = employee.employment?.managerId || (employee.employment as any)?.managerUserId || schedulerUserId;

    // Determine meeting start/end time
    let meetingStart: Date;
    if (params.targetDate) {
      const timeStr = params.startTime || "10:00";
      meetingStart = new Date(`${params.targetDate}T${timeStr}:00.000Z`);
    } else {
      // Default to 2 days before milestone due date, or the due date itself if already within 2 days
      const targetTime = new Date(milestone.dueDate.getTime() - 2 * 24 * 60 * 60 * 1000);
      if (targetTime < new Date()) {
        meetingStart = new Date(milestone.dueDate);
      } else {
        meetingStart = targetTime;
      }
      meetingStart.setUTCHours(10, 0, 0, 0);
    }

    const duration = params.durationMinutes || 45;
    const meetingEnd = new Date(meetingStart.getTime() + duration * 60 * 1000);

    const event = await this.createMeetingEvent(orgId, managerId.toString(), {
      title: `Day ${milestone.targetDay} Milestone Review — ${milestone.milestoneTitle}`,
      description: `Formal 1-on-1 review sync for Day ${milestone.targetDay} milestone "${milestone.milestoneTitle}". Discuss self-checkin responses, goals achieved, and sign-off evaluation.`,
      category: "manager_1on1",
      attendeeUserIds: [employee._id.toString(), managerId.toString()],
      startTime: meetingStart,
      endTime: meetingEnd,
      locationUrl: params.locationUrl,
    });

    return event;
  }
}

export const calendarService = new CalendarService();
export default calendarService;
