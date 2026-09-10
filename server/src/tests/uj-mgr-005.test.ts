import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import BuddyAssignment from "../modules/buddy/models/buddy-assignment.model.js";
import BuddyProfile from "../modules/buddy/models/buddy-profile.model.js";
import Notification from "../modules/notifications/models/notification.model.js";

describe("Journey Test UJ-MGR-005: Assign Onboarding Buddy to New Hire", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let managerUser: any;
  let menteeUser: any;
  let buddyUser: any;
  let backupBuddyUser: any;
  let managerToken: string;
  let menteeToken: string;
  let createdAssignmentId: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const ts = Date.now();
    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: `Buddy Test Org ${ts}`,
      slug: `buddy-test-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Manager
    managerUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `manager-${ts}@test.com`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Marcus",
        lastName: "Vance",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Engineering Director",
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

    // 3. Create Incoming Direct Report (Mentee)
    menteeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `mentee-${ts}@test.com`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Elena",
        lastName: "Rostova",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Software Engineer",
        status: "onboarding",
        managerId: managerUser._id,
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

    // 4. Create Registered Peer Buddy
    buddyUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `buddy-${ts}@test.com`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Lucas",
        lastName: "Silva",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Senior Engineer",
        status: "active",
      },
      permissions: {
        role: "employee",
      },
    });

    await BuddyProfile.create({
      organizationId: testOrg._id,
      userId: buddyUser._id,
      isAvailable: true,
      maxMentees: 3,
      currentMenteeCount: 0,
      skills: ["System Design", "Node.js", "Culture"],
      bio: "Excited to welcome new teammates to the engineering group!",
    });

    // 5. Create Backup Peer Buddy (for re-assignment alternative path)
    backupBuddyUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `backup-buddy-${ts}@test.com`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Chloe",
        lastName: "Decker",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Staff Engineer",
        status: "active",
      },
      permissions: {
        role: "employee",
      },
    });

    await BuddyProfile.create({
      organizationId: testOrg._id,
      userId: backupBuddyUser._id,
      isAvailable: true,
      maxMentees: 3,
      currentMenteeCount: 0,
      skills: ["Architecture", "Mentorship"],
      bio: "Happy to mentor new hires on architecture and processes.",
    });
  });

  afterAll(async () => {
    if (testOrg) {
      await BuddyAssignment.deleteMany({ organizationId: testOrg._id });
      await BuddyProfile.deleteMany({ organizationId: testOrg._id });
      await Notification.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.findByIdAndDelete(testOrg._id);
    }
    await app.close();
  });

  it("Precondition: Available registered buddies query returns active buddies", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/buddy/available",
      headers: {
        Authorization: `Bearer ${managerToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(2);

    const match = body.data.find((b: any) => b.userId?._id === buddyUser._id.toString());
    expect(match).toBeDefined();
    expect(match.isAvailable).toBe(true);
  });

  it("Step 1-8: Manager assigns buddy to direct report (POST /api/v1/buddy/assign returns 201 Created)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/buddy/assign",
      headers: {
        Authorization: `Bearer ${managerToken}`,
      },
      payload: {
        newHireUserId: menteeUser._id.toString(),
        buddyUserId: buddyUser._id.toString(),
        checklistTemplate: "Standard Cultural Onboarding",
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.assignment).toBeDefined();
    expect(body.assignment.buddyId.toString()).toBe(buddyUser._id.toString());
    expect(body.assignment.employeeId.toString()).toBe(menteeUser._id.toString());
    expect(body.assignment.status).toBe("active");
    expect(Array.isArray(body.assignment.checklist)).toBe(true);
    expect(body.assignment.checklist.length).toBeGreaterThanOrEqual(5);

    createdAssignmentId = body.assignment._id;
  });

  it("Step 9: Mentee and Manager dashboards reflect active pairing with 0% progress", async () => {
    // 1. Mentee's view of assigned buddy
    const menteeResponse = await app.inject({
      method: "GET",
      url: "/api/v1/buddy/my-buddy",
      headers: {
        Authorization: `Bearer ${menteeToken}`,
      },
    });

    expect(menteeResponse.statusCode).toBe(200);
    const menteeBody = JSON.parse(menteeResponse.body);
    expect(menteeBody.data).toBeDefined();
    expect(menteeBody.data.buddyUserId?._id).toBe(buddyUser._id.toString());
    expect(menteeBody.data.status).toBe("active");

    const completed = menteeBody.data.checklist.filter((item: any) => item.completed).length;
    expect(completed).toBe(0); // 0% initial progress

    // 2. Manager view of organization assignments
    const listResponse = await app.inject({
      method: "GET",
      url: "/api/v1/buddy/assignments",
      headers: {
        Authorization: `Bearer ${managerToken}`,
      },
    });

    expect(listResponse.statusCode).toBe(200);
    const listBody = JSON.parse(listResponse.body);
    const pairing = listBody.data.find((p: any) => p._id === createdAssignmentId);
    expect(pairing).toBeDefined();
    expect(pairing.status).toBe("active");
  });

  it("Alternative Path: Manager re-assigns buddy when original buddy changes teams", async () => {
    const reassignResponse = await app.inject({
      method: "POST",
      url: "/api/v1/buddy/assign",
      headers: {
        Authorization: `Bearer ${managerToken}`,
      },
      payload: {
        newHireUserId: menteeUser._id.toString(),
        buddyUserId: backupBuddyUser._id.toString(),
        checklistTemplate: "Technical Deep Dive & Tooling",
      },
    });

    expect(reassignResponse.statusCode).toBe(201);
    const reassignBody = JSON.parse(reassignResponse.body);
    expect(reassignBody.assignment.buddyId.toString()).toBe(backupBuddyUser._id.toString());
    expect(reassignBody.assignment.status).toBe("active");

    // Verify original assignment was transitioned to "reassigned"
    const oldAssignment = await BuddyAssignment.findById(createdAssignmentId);
    expect(oldAssignment?.status).toBe("reassigned");
  });

  it("Negative Test: Attempt pairing an employee with themselves rejects with HTTP 400 (CANNOT_PAIR_SELF)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/buddy/assign",
      headers: {
        Authorization: `Bearer ${managerToken}`,
      },
      payload: {
        newHireUserId: menteeUser._id.toString(),
        buddyUserId: menteeUser._id.toString(), // Self pairing
        checklistTemplate: "Standard Cultural Onboarding",
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.code).toBe("CANNOT_PAIR_SELF");
  });

  it("Authorization Test: Standard employees cannot initiate buddy assignments (HTTP 403 Forbidden)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/buddy/assign",
      headers: {
        Authorization: `Bearer ${menteeToken}`,
      },
      payload: {
        newHireUserId: menteeUser._id.toString(),
        buddyUserId: buddyUser._id.toString(),
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.code).toBe("FORBIDDEN");
  });

  it("Data Integrity & Integration Checks: References stored and notifications dispatched to both parties", async () => {
    // 1. Data Integrity: Check MongoDB BuddyAssignment
    const activeAssignment = await BuddyAssignment.findOne({
      organizationId: testOrg._id,
      newHireUserId: menteeUser._id,
      status: "active",
    });

    expect(activeAssignment).toBeDefined();
    expect(activeAssignment?.buddyUserId.toString()).toBe(backupBuddyUser._id.toString());
    expect(activeAssignment?.newHireUserId.toString()).toBe(menteeUser._id.toString());
    expect(activeAssignment?.checklist.length).toBeGreaterThan(0);

    // 2. Integration Check: Notifications sent to both mentee and buddy
    const menteeNotification = await Notification.findOne({
      organizationId: testOrg._id,
      recipientUserId: menteeUser._id,
      title: /Onboarding Buddy/i,
    });
    expect(menteeNotification).toBeDefined();

    const buddyNotification = await Notification.findOne({
      organizationId: testOrg._id,
      recipientUserId: backupBuddyUser._id,
      title: /Mentee Assigned/i,
    });
    expect(buddyNotification).toBeDefined();
  });
});
