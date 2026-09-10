import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import MeetingEvent, { CalendarEvent } from "../modules/calendar/models/meeting-event.model.js";
import Notification from "../modules/notifications/models/notification.model.js";

describe("Journey Test UJ-MGR-004: Schedule & Log 1-on-1 Check-in Meetings", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let managerUser: any;
  let employeeUser: any;
  let managerToken: string;
  let employeeToken: string;
  let createdEventId: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const ts = Date.now();
    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Tenant Organization
    testOrg = await Organization.create({
      name: `Calendar Test Org ${ts}`,
      slug: `cal-test-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Department / Team Manager (role: "manager")
    managerUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `manager-${ts}@test.com`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Sarah",
        lastName: "Connor",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Engineering Manager",
        status: "active",
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

    // 3. Create Direct Report Employee (role: "employee")
    employeeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `newhire-${ts}@test.com`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Alex",
        lastName: "Mercer",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Junior Software Engineer",
        status: "onboarding",
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
  });

  afterAll(async () => {
    if (testOrg) {
      await MeetingEvent.deleteMany({ organizationId: testOrg._id });
      await Notification.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.findByIdAndDelete(testOrg._id);
    }
    await app.close();
  });

  it("Step 1-8: Manager schedules 1-on-1 check-in meeting (POST /api/v1/calendar/events returns 201 Created)", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];

    const startTime = `${dateStr}T10:00:00.000Z`;
    const endTime = `${dateStr}T10:30:00.000Z`;

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/calendar/events",
      headers: {
        Authorization: `Bearer ${managerToken}`,
      },
      payload: {
        title: "Week 1 Check-in & Feedback",
        description: "Review dev environment setup, team channels, and questions.",
        category: "manager_1on1",
        attendeeUserIds: [employeeUser._id.toString()],
        startTime,
        endTime,
        locationUrl: "https://meet.google.com/talnova-onboarding",
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.title).toBe("Week 1 Check-in & Feedback");
    expect(body.data.description).toContain("Review dev environment setup");
    expect(body.data.category).toBe("manager_1on1");
    expect(body.data.status).toBe("scheduled");
    expect(body.data.organizerUserId.toString()).toBe(managerUser._id.toString());

    createdEventId = body.data._id;
  });

  it("Step 9: Event appears on manager calendar roster (GET /api/v1/calendar/events returns 200 OK)", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/calendar/events",
      headers: {
        Authorization: `Bearer ${managerToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const match = body.data.find((ev: any) => ev._id === createdEventId);
    expect(match).toBeDefined();
    expect(match.title).toBe("Week 1 Check-in & Feedback");
  });

  it("Step 10-11: Document discussion notes on meeting (PATCH /api/v1/calendar/events/:id persists notes)", async () => {
    const notesText = "Ramp on track. Discussed sprint goals.";

    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/calendar/events/${createdEventId}`,
      headers: {
        Authorization: `Bearer ${managerToken}`,
      },
      payload: {
        notes: notesText,
      },
    });

    expect(patchResponse.statusCode).toBe(200);
    const patchBody = JSON.parse(patchResponse.body);
    expect(patchBody.success).toBe(true);
    expect(patchBody.data.notes).toBe(notesText);

    // Verify persistence via GET
    const listResponse = await app.inject({
      method: "GET",
      url: "/api/v1/calendar/events",
      headers: {
        Authorization: `Bearer ${managerToken}`,
      },
    });

    const body = JSON.parse(listResponse.body);
    const event = body.data.find((ev: any) => ev._id === createdEventId);
    expect(event).toBeDefined();
    expect(event.notes).toBe(notesText);
  });

  it("Alternative Path: Download .ics calendar invitation file (GET /api/v1/calendar/events/:id/export)", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/calendar/events/${createdEventId}/export`,
      headers: {
        Authorization: `Bearer ${managerToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/calendar");
    expect(response.body).toContain("BEGIN:VCALENDAR");
    expect(response.body).toContain("BEGIN:VEVENT");
    expect(response.body).toContain("SUMMARY:Week 1 Check-in & Feedback");
    expect(response.body).toContain("END:VEVENT");
    expect(response.body).toContain("END:VCALENDAR");
  });

  it("Negative Test: End time earlier than start time flags validation error", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];

    // Invalid range: start 11:00 AM, end 10:00 AM
    const startTime = `${dateStr}T11:00:00.000Z`;
    const endTime = `${dateStr}T10:00:00.000Z`;

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/calendar/events",
      headers: {
        Authorization: `Bearer ${managerToken}`,
      },
      payload: {
        title: "Invalid Timing Check-in",
        attendeeUserIds: [employeeUser._id.toString()],
        startTime,
        endTime,
      },
    });

    expect([400, 422]).toContain(response.statusCode);
    const body = JSON.parse(response.body);
    expect(body.message).toMatch(/End time must be after start time|validation/i);
  });

  it("Authorization Test: Employee cannot schedule meetings on behalf of other managers", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];

    const startTime = `${dateStr}T14:00:00.000Z`;
    const endTime = `${dateStr}T14:30:00.000Z`;

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/calendar/events",
      headers: {
        Authorization: `Bearer ${employeeToken}`,
      },
      payload: {
        title: "Impersonated Meeting",
        attendeeUserIds: [employeeUser._id.toString()],
        organizerUserId: managerUser._id.toString(), // Attempting to schedule on behalf of manager
        startTime,
        endTime,
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.code).toBe("FORBIDDEN");
  });

  it("Data Integrity & Integration Check: MongoDB CalendarEvent and attendee notification exist", async () => {
    // 1. Data Integrity: CalendarEvent (alias of MeetingEvent) matches organizationId
    const dbEvent = await CalendarEvent.findById(createdEventId);
    expect(dbEvent).toBeDefined();
    expect(dbEvent?.organizationId.toString()).toBe(testOrg._id.toString());
    expect(dbEvent?.notes).toBe("Ramp on track. Discussed sprint goals.");

    // 2. Integration Check: Notification sent to direct report employee
    const notification = await Notification.findOne({
      organizationId: testOrg._id,
      recipientUserId: employeeUser._id,
    });
    expect(notification).toBeDefined();
    expect(notification?.title).toContain("New Meeting Scheduled");
  });
});
