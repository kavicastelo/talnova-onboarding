import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import MeetingEvent from "../modules/calendar/models/meeting-event.model.js";
import Notification from "../modules/notifications/models/notification.model.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";

describe("Phase 1 — Mutual Calendar Availability & Multi-Attendee Scheduling Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let managerUser: any;
  let newHireUser: any;
  let buddyUser: any;
  let managerToken: string;
  let newHireToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: "Calendar Availability Test Org",
      slug: `cal-avail-org-${Date.now()}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Manager
    managerUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `manager-${Date.now()}@test.com`,
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Sarah",
        lastName: "Manager",
      },
      permissions: {
        role: "manager",
      },
    });

    managerToken = app.jwt.sign({
      userId: managerUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "manager",
    });

    // 3. Create New Hire
    newHireUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `newhire-${Date.now()}@test.com`,
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Alex",
        lastName: "NewHire",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Junior Dev",
      },
      permissions: {
        role: "employee",
      },
    });

    newHireToken = app.jwt.sign({
      userId: newHireUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "employee",
    });

    // 4. Create Buddy
    buddyUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `buddy-${Date.now()}@test.com`,
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Taylor",
        lastName: "Buddy",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Senior Dev",
      },
      permissions: {
        role: "employee",
      },
    });
  });

  afterAll(async () => {
    if (testOrg?._id) {
      await MeetingEvent.deleteMany({ organizationId: testOrg._id });
      await Notification.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    }
  });

  describe("1. Mutual Availability Query (GET /api/v1/calendar/availability)", () => {
    it("should return all 18 standard 30-min working hour slots when users have no existing meetings", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/calendar/availability?userIds=${newHireUser._id}&userIds=${buddyUser._id}&date=2026-11-10&durationMinutes=30`,
        headers: {
          authorization: `Bearer ${managerToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.date).toBe("2026-11-10");
      expect(json.data.totalCandidateSlots).toBe(18); // 09:00 to 18:00 (9 hours = 18 30m slots)
      expect(json.data.availableSlotsCount).toBe(18);
      expect(json.data.availableSlots.length).toBe(18);
      expect(json.data.availableSlots[0].startFormatted).toBe("09:00 AM");
    });
  });

  describe("2. Multi-Attendee Meeting Scheduling & Dual Notifications (POST /api/v1/calendar/events)", () => {
    let createdEventId: string;

    it("should require at least one attendee", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/calendar/events",
        headers: {
          authorization: `Bearer ${managerToken}`,
        },
        payload: {
          title: "Invalid Empty Meeting",
          startTime: "2026-11-10T10:00:00.000Z",
          endTime: "2026-11-10T10:30:00.000Z",
          attendeeUserIds: [],
        },
      });

      expect(response.statusCode).toBe(422);
    });

    it("should schedule a meeting with manager + new hire + buddy and send dual notifications", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/calendar/events",
        headers: {
          authorization: `Bearer ${managerToken}`,
        },
        payload: {
          title: "3-Way Welcome Alignment Session",
          description: "Meet your buddy and review week 1 milestones",
          category: "manager_1on1",
          startTime: "2026-11-10T10:00:00.000Z",
          endTime: "2026-11-10T11:00:00.000Z",
          attendeeUserIds: [newHireUser._id.toString(), buddyUser._id.toString()],
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.title).toBe("3-Way Welcome Alignment Session");
      expect(json.data.attendeeUserIds.length).toBe(3); // new hire + buddy + organizer auto-included
      expect(json.data.locationUrl).toMatch(/https:\/\/meet\.google\.com\//);
      createdEventId = json.data._id;

      // Verify notifications sent to all 3 participants
      const notifications = await Notification.find({
        organizationId: testOrg._id,
        type: "meeting_scheduled",
      });

      const recipientIds = notifications.map((n) => n.recipientUserId.toString());
      expect(recipientIds).toContain(managerUser._id.toString()); // Organizer confirmation
      expect(recipientIds).toContain(newHireUser._id.toString()); // Attendee 1
      expect(recipientIds).toContain(buddyUser._id.toString());   // Attendee 2
    });

    it("should detect conflict and exclude busy slots from mutual availability", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/calendar/availability?userIds=${newHireUser._id}&userIds=${buddyUser._id}&date=2026-11-10&durationMinutes=30`,
        headers: {
          authorization: `Bearer ${managerToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      // 10:00-11:00 UTC is booked (two 30-min slots: 10:00-10:30 and 10:30-11:00)
      expect(json.data.availableSlotsCount).toBe(16);
      expect(json.data.busyEventsCount).toBeGreaterThanOrEqual(1);

      // Verify the busy slot has conflict details
      const busySlot = json.data.allSlots.find((s: any) => s.startFormatted === "10:00 AM");
      expect(busySlot).toBeDefined();
      expect(busySlot.isAvailable).toBe(false);
      expect(busySlot.conflicts.length).toBeGreaterThan(0);
      expect(busySlot.conflicts[0].title).toBe("3-Way Welcome Alignment Session");
    });

    it("should notify all participants when the meeting is cancelled", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/calendar/events/${createdEventId}/cancel`,
        headers: {
          authorization: `Bearer ${managerToken}`,
        },
        payload: {
          reason: "Emergency schedule shift",
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("cancelled");

      // Verify cancellation notifications were created
      const cancelNotifications = await Notification.find({
        organizationId: testOrg._id,
        type: "meeting_cancelled",
      });

      const cancelRecipientIds = cancelNotifications.map((n) => n.recipientUserId.toString());
      expect(cancelRecipientIds).toContain(managerUser._id.toString());
      expect(cancelRecipientIds).toContain(newHireUser._id.toString());
      expect(cancelRecipientIds).toContain(buddyUser._id.toString());
    });
  });
});
