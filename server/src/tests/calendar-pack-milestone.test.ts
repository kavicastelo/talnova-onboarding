import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import MeetingEvent from "../modules/calendar/models/meeting-event.model.js";
import EmployeeMilestone from "../modules/milestones/models/employee-milestone.model.js";
import Notification from "../modules/notifications/models/notification.model.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";

describe("Phase 3 — Onboarding Schedule Pack Export & Milestone-Linked 1-on-1s", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let managerUser: any;
  let employeeUser: any;
  let managerToken: string;
  let employeeToken: string;
  let milestone: any;
  let kickoffEvent: any;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: "Calendar Pack Test Org",
      slug: `cal-pack-org-${Date.now()}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Manager
    managerUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `manager-pack-${Date.now()}@test.com`,
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Michael",
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

    // 3. Create Employee
    employeeUser = await User.create({
      organizationId: testOrg._id,
      managerId: managerUser._id,
      auth: {
        email: `hire-pack-${Date.now()}@test.com`,
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Emma",
        lastName: "Candidate",
      },
      employment: {
        department: "Design",
        jobTitle: "Product Designer",
        managerId: managerUser._id,
      },
      permissions: {
        role: "employee",
      },
    });

    employeeToken = app.jwt.sign({
      userId: employeeUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "employee",
    });

    // 4. Create an existing MeetingEvent for the employee
    kickoffEvent = await MeetingEvent.create({
      organizationId: testOrg._id,
      organizerUserId: managerUser._id,
      attendeeUserIds: [managerUser._id, employeeUser._id],
      title: "Day 1 Welcome & Setup Sync",
      description: "Getting accounts provisioned and meeting the squad.",
      startTime: new Date(Date.now() + 24 * 3600 * 1000),
      endTime: new Date(Date.now() + 24 * 3600 * 1000 + 45 * 60 * 1000),
      status: "scheduled",
      category: "manager_1on1",
      iCalUid: `dummy-kickoff-${Date.now()}@talnova.com`,
      locationUrl: "https://meet.google.com/test-pack-call",
    });

    // 5. Create a 30-Day Milestone for the employee
    milestone = await EmployeeMilestone.create({
      organizationId: testOrg._id,
      templateId: dummyId,
      employeeId: employeeUser._id,
      assignedBy: managerUser._id,
      milestoneTitle: "30-Day First Deliverable Review",
      targetDay: 30,
      dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      status: "pending",
      goalsProgress: [
        { goalTitle: "Deliver wireframes for v2 features", completed: false },
        { goalTitle: "Shadow 3 customer calls", completed: false },
      ],
    });
  });

  afterAll(async () => {
    if (testOrg) {
      await Organization.deleteMany({ _id: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await MeetingEvent.deleteMany({ organizationId: testOrg._id });
      await EmployeeMilestone.deleteMany({ organizationId: testOrg._id });
      await Notification.deleteMany({ organizationId: testOrg._id });
    }
    await app.close();
  });

  describe("GET /api/v1/calendar/pack/export", () => {
    it("should export a comprehensive multi-event iCalendar (.ics) schedule pack", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/calendar/pack/export",
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/calendar");
      expect(response.headers["content-disposition"]).toContain("attachment; filename=");
      expect(response.headers["content-disposition"]).toContain(".ics");

      const icsBody = response.body;
      // Should have valid iCalendar header and calendar name
      expect(icsBody).toContain("BEGIN:VCALENDAR");
      expect(icsBody).toContain("X-WR-CALNAME:Talnova 90-Day Onboarding Journey Pack");
      expect(icsBody).toContain("END:VCALENDAR");

      // Should include the scheduled meeting
      expect(icsBody).toContain("SUMMARY:Day 1 Welcome & Setup Sync");
      expect(icsBody).toContain("LOCATION:https://meet.google.com/test-pack-call");

      // Should include the 30-day milestone deadline checkpoint as an all-day event
      expect(icsBody).toContain("SUMMARY:🎯 Onboarding Milestone Day 30: 30-Day First Deliverable Review");
      expect(icsBody).toContain("STATUS:CONFIRMED");
    });
  });

  describe("POST /api/v1/calendar/milestones/:milestoneId/schedule-review", () => {
    it("should auto-create a milestone 1-on-1 review meeting and send dual notifications", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/calendar/milestones/${milestone._id}/schedule-review`,
        headers: {
          authorization: `Bearer ${managerToken}`,
        },
        payload: {
          durationMinutes: 45,
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.title).toContain("Day 30 Milestone Review");
      expect(json.data.category).toBe("manager_1on1");
      expect(json.data.locationUrl).toMatch(/https:\/\/meet\.google\.com\//);

      // Attendees must include both manager and new hire
      const attendeeIds = json.data.attendeeUserIds.map((id: any) => id.toString());
      expect(attendeeIds).toContain(managerUser._id.toString());
      expect(attendeeIds).toContain(employeeUser._id.toString());

      // Dual notifications must be delivered to both manager and employee
      const notifications = await Notification.find({
        organizationId: testOrg._id,
        type: "meeting_scheduled",
        "data.eventId": json.data._id,
      });

      expect(notifications.length).toBeGreaterThanOrEqual(2);
      const recipientIds = notifications.map((n) => n.recipientUserId.toString());
      expect(recipientIds).toContain(managerUser._id.toString());
      expect(recipientIds).toContain(employeeUser._id.toString());
    });
  });
});
