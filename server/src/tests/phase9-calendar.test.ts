import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import CalendarConnection from "../modules/calendar/models/calendar-connection.model.js";
import MeetingEvent from "../modules/calendar/models/meeting-event.model.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import calendarService from "../modules/calendar/services/calendar.service.js";

describe("Phase 9 — Calendar & Meeting Integration Test Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let adminUser: any;
  let employeeUser: any;
  let adminToken: string;
  let employeeToken: string;

  let createdConnection: any;
  let createdEvent: any;

  let otherOrg: any;
  let otherAdmin: any;
  let otherAdminToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Tenant Organization
    testOrg = await Organization.create({
      name: "Phase 9 Test Org",
      slug: `phase9-org-${Date.now()}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Admin User
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: "phase9-admin@test.com",
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Phase9",
        lastName: "Admin",
      },
      permissions: {
        role: "admin",
      },
    });

    adminToken = app.jwt.sign({
      userId: adminUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "admin",
    });

    // 3. Create Employee User
    employeeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: "phase9-employee@test.com",
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "John",
        lastName: "Doe",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Software Engineer",
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

    // 4. Create Secondary Tenant
    otherOrg = await Organization.create({
      name: "Phase 9 Other Org",
      slug: `phase9-other-${Date.now()}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    otherAdmin = await User.create({
      organizationId: otherOrg._id,
      auth: {
        email: "other9-admin@test.com",
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Other",
        lastName: "Admin",
      },
      permissions: {
        role: "admin",
      },
    });

    otherAdminToken = app.jwt.sign({
      userId: otherAdmin._id.toString(),
      organizationId: otherOrg._id.toString(),
      role: "admin",
    });
  });

  afterAll(async () => {
    if (testOrg) {
      await MeetingEvent.deleteMany({ organizationId: testOrg._id });
      await CalendarConnection.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    }
    if (otherOrg) {
      await User.deleteMany({ organizationId: otherOrg._id });
      await Organization.deleteOne({ _id: otherOrg._id });
    }
    await app.close();
  });

  describe("1. Calendar Connection & iCal Token (CAL-001)", () => {
    it("should connect provider and return connection status via POST /api/v1/calendar/connection", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/calendar/connection",
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
        payload: {
          provider: "ical",
          timezone: "America/New_York",
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.icalToken).toBeDefined();
      createdConnection = json.data;
    });

    it("should fetch connection status via GET /api/v1/calendar/connection", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/calendar/connection",
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.syncStatus).toBe("connected");
    });
  });

  describe("2. Onboarding Meeting Event Creation (CAL-002, CAL-003)", () => {
    it("should schedule a meeting event via POST /api/v1/calendar/events", async () => {
      const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const endTime = new Date(Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/calendar/events",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          title: "Day 1 Welcome Coffee & Orientation",
          category: "buddy_coffee",
          attendeeUserIds: [employeeUser._id.toString()],
          startTime,
          endTime,
          locationUrl: "https://meet.google.com/test-meet-123",
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.title).toBe("Day 1 Welcome Coffee & Orientation");
      expect(json.data.status).toBe("scheduled");
      createdEvent = json.data;
    });

    it("should list scheduled meeting events via GET /api/v1/calendar/events", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/calendar/events",
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("3. Public iCal (.ics) Feed Generation (CAL-001, CAL-005)", () => {
    it("should return valid iCal .ics feed content for subscription", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/calendar/feed/${createdConnection.icalToken}.ics`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/calendar");
      expect(response.body).toContain("BEGIN:VCALENDAR");
      expect(response.body).toContain("BEGIN:VEVENT");
      expect(response.body).toContain("Day 1 Welcome Coffee & Orientation");
    });
  });

  describe("4. Meeting Event Update & Cancellation (CAL-004)", () => {
    it("should cancel meeting event via DELETE /api/v1/calendar/events/:id", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/calendar/events/${createdEvent._id}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("cancelled");
    });
  });

  describe("5. Auto-Scheduling on User Creation (CAL-002)", () => {
    it("should auto-schedule Day 1 welcome coffee when new hire registers", async () => {
      const newHire = await User.create({
        organizationId: testOrg._id,
        auth: {
          email: "calendar-newhire@test.com",
          passwordHash: "hashedpassword123",
        },
        profile: {
          firstName: "Cal",
          lastName: "NewHire",
        },
        permissions: {
          role: "employee",
        },
      });

      const count = await calendarService.autoScheduleOnboardingMeetings(testOrg._id, newHire._id);
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  describe("6. Multi-Tenant Boundary Isolation", () => {
    it("should return empty meeting events list for Tenant B admin", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/calendar/events",
        headers: {
          authorization: `Bearer ${otherAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.length).toBe(0);
    });
  });
});
