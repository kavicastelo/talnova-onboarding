import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import BuddyAssignment from "../modules/buddy/models/buddy-assignment.model.js";
import BuddyProfile from "../modules/buddy/models/buddy-profile.model.js";

describe("Journey Test UJ-BUD-003: Log Buddy Check-in Notes & Sentiment", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let buddyUser: any;
  let menteeUser: any;
  let unrelatedUser: any;
  let buddyToken: string;
  let menteeToken: string;
  let unrelatedToken: string;
  let assignment: any;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const ts = Date.now();
    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: `Checkin Test Org ${ts}`,
      slug: `checkin-test-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Buddy User
    buddyUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `buddy-checkin-${ts}@test.com`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Jordan",
        lastName: "Pike",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Lead Architect",
        status: "active",
      },
      permissions: {
        role: "employee",
      },
    });

    buddyToken = app.jwt.sign({
      userId: buddyUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "employee",
    });

    // Create Buddy Profile
    await BuddyProfile.create({
      organizationId: testOrg._id,
      userId: buddyUser._id,
      isAvailable: true,
      maxMentees: 2,
      currentMenteeCount: 1,
      skills: ["Architecture", "TypeScript"],
      languages: ["English"],
    });

    // 3. Create Mentee User
    menteeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `mentee-checkin-${ts}@test.com`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Robin",
        lastName: "Banks",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Software Engineer",
        status: "active",
      },
      permissions: {
        role: "employee",
      },
    });

    menteeToken = app.jwt.sign({
      userId: menteeUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "employee",
    });

    // 4. Create Unrelated Employee
    unrelatedUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `unrelated-checkin-${ts}@test.com`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Sam",
        lastName: "Curry",
      },
      employment: {
        department: "Finance",
        jobTitle: "Financial Analyst",
        status: "active",
      },
      permissions: {
        role: "employee",
      },
    });

    unrelatedToken = app.jwt.sign({
      userId: unrelatedUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "employee",
    });

    // 5. Create Precondition: Active BuddyAssignment
    assignment = await BuddyAssignment.create({
      organizationId: testOrg._id,
      buddyUserId: buddyUser._id,
      newHireUserId: menteeUser._id,
      assignedBy: buddyUser._id,
      status: "active",
      checklist: [
        { title: "Conduct virtual welcome coffee & intro", stage: "day_1", completed: true },
      ],
      checkins: [],
      communicationLinks: {
        email: buddyUser.auth.email,
      },
    });
  });

  afterAll(async () => {
    if (testOrg) {
      await User.deleteMany({ organizationId: testOrg._id });
      await BuddyAssignment.deleteMany({ organizationId: testOrg._id });
      await BuddyProfile.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    }
    await app.close();
  });

  it("Step 1-7: Buddy logs check-in notes with positive sentiment (POST /api/v1/buddy/assignment/:id/checkin returns 200 OK)", async () => {
    const payload = {
      notes: "Met for coffee. Mentee is settling in well and enjoying the codebase.",
      sentiment: "positive",
      rating: 5,
    };

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/buddy/assignment/${assignment._id}/checkin`,
      headers: {
        authorization: `Bearer ${buddyToken}`,
      },
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data.checkins)).toBe(true);
    expect(body.data.checkins.length).toBe(1);

    const logged = body.data.checkins[0];
    expect(logged.notes).toBe(payload.notes);
    expect(logged.sentiment).toBe("positive");
    expect(logged.rating).toBe(5);
    expect(logged.completedAt).toBeDefined();
  });

  it("Step 8: Mentee query reflects logged check-in history in timeline (GET /api/v1/buddy/my-mentees)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/buddy/my-mentees",
      headers: {
        authorization: `Bearer ${buddyToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    const pairing = body.data.find((p: any) => p._id === assignment._id.toString());
    expect(pairing).toBeDefined();
    expect(pairing.checkins.length).toBe(1);
    expect(pairing.checkins[0].sentiment).toBe("positive");
    expect(pairing.checkins[0].notes).toContain("Mentee is settling in well");
  });

  it("Alternative Path: Buddy logs check-in with 'challenged' sentiment to flag support needed", async () => {
    const challengedPayload = {
      notes: "Facing blockers with local Docker setup and missing repo permissions.",
      sentiment: "challenged",
      rating: 2,
    };

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/buddy/assignment/${assignment._id}/checkin`,
      headers: {
        authorization: `Bearer ${buddyToken}`,
      },
      payload: challengedPayload,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.checkins.length).toBe(2);

    const challengedEntry = body.data.checkins.find((c: any) => c.sentiment === "challenged");
    expect(challengedEntry).toBeDefined();
    expect(challengedEntry.notes).toContain("Facing blockers");
    expect(challengedEntry.rating).toBe(2);
  });

  it("Negative Test: Submit check-in with empty notes fails validation (HTTP 400/422)", async () => {
    const emptyPayload = {
      notes: "",
      sentiment: "positive",
    };

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/buddy/assignment/${assignment._id}/checkin`,
      headers: {
        authorization: `Bearer ${buddyToken}`,
      },
      payload: emptyPayload,
    });

    expect([400, 422]).toContain(res.statusCode);
  });

  it("Authorization Test: Unauthorized employee cannot submit check-in logs for pairing (HTTP 403 Forbidden)", async () => {
    const unauthPayload = {
      notes: "Unauthorized attempt to log check-in.",
      sentiment: "neutral",
    };

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/buddy/assignment/${assignment._id}/checkin`,
      headers: {
        authorization: `Bearer ${unrelatedToken}`, // Unrelated employee
      },
      payload: unauthPayload,
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.code).toBe("FORBIDDEN");
    expect(body.message).toContain("Only assigned buddy or mentee can log check-ins");
  });

  it("Data Integrity Checks: MongoDB BuddyAssignment.checkins array contains valid entries with notes and sentiment", async () => {
    const dbAssignment = await BuddyAssignment.findById(assignment._id);
    expect(dbAssignment).not.toBeNull();
    expect(dbAssignment?.checkins.length).toBe(2);

    const positiveCheckin = dbAssignment?.checkins.find((c) => c.sentiment === "positive");
    expect(positiveCheckin).toBeDefined();
    expect(positiveCheckin?.notes).toBe("Met for coffee. Mentee is settling in well and enjoying the codebase.");
    expect(positiveCheckin?.completedAt).toBeInstanceOf(Date);

    const challengedCheckin = dbAssignment?.checkins.find((c) => c.sentiment === "challenged");
    expect(challengedCheckin).toBeDefined();
    expect(challengedCheckin?.notes).toContain("Facing blockers");
  });
});
