import mongoose from "mongoose";
import crypto from "crypto";
import CalendarConnection, { ICalendarConnection } from "../models/calendar-connection.model.js";
import MeetingEvent, { IMeetingEvent } from "../models/meeting-event.model.js";
import User from "../../auth/models/user.model.js";
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
    }
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const organizerObjectId = new mongoose.Types.ObjectId(organizerUserId);

    const attendeeObjectIds = data.attendeeUserIds.map((id) => new mongoose.Types.ObjectId(id));
    if (!attendeeObjectIds.some((id) => id.toString() === organizerObjectId.toString())) {
      attendeeObjectIds.push(organizerObjectId);
    }

    const iCalUid = `event-${Date.now()}-${crypto.randomBytes(4).toString("hex")}@talnova.app`;

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
      locationUrl: data.locationUrl || "https://meet.google.com/talnova-onboarding",
      status: "scheduled",
      reminderMinutesBefore: data.reminderMinutesBefore || 15,
      iCalUid,
    });

    // Notify attendees
    for (const attendeeId of attendeeObjectIds) {
      if (attendeeId.toString() !== organizerObjectId.toString()) {
        await notificationService.createNotification({
          organizationId: orgId,
          recipientUserId: attendeeId,
          type: "journey_assigned",
          title: `New Meeting Scheduled: ${event.title}`,
          message: `You have been invited to "${event.title}" on ${event.startTime.toLocaleString()}. Link: ${event.locationUrl}`,
          priority: "high",
        });
      }
    }

    return event;
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
    if (data.startTime) event.startTime = new Date(data.startTime);
    if (data.endTime) event.endTime = new Date(data.endTime);
    if (data.locationUrl !== undefined) event.locationUrl = data.locationUrl;
    if (data.status) event.status = data.status;

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
}

export const calendarService = new CalendarService();
export default calendarService;
