import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import BuddyAssignment from "../modules/buddy/models/buddy-assignment.model.js";
import BuddyProfile from "../modules/buddy/models/buddy-profile.model.js";

describe("Journey Test UJ-BUD-002: Review Mentee Progress & Checklists", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let buddyUser: any;
  let menteeUser: any;
  let unrelatedUser: any;
  let buddyToken: string;
  let menteeToken: string;
  let unrelatedToken: string;
  let assignment: any;
  let targetTaskId: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const ts = Date.now();
    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: `Mentee Progress Org ${ts}`,
      slug: `mentee-progress-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Buddy User
    buddyUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `buddy-${ts}@test.com`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Taylor",
        lastName: "Swift",
      },
      employment: {
        department: "Core Engineering",
        jobTitle: "Senior Staff Engineer",
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
      maxMentees: 3,
      currentMenteeCount: 1,
      skills: ["TypeScript", "MongoDB", "Node.js"],
      languages: ["English", "Spanish"],
      department: "Core Engineering",
      jobTitle: "Senior Staff Engineer",
      bio: "Senior backend engineer enthusiastic about Node.js and distributed systems.",
    });

    // 3. Create Mentee User (Incoming Direct Report)
    menteeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `mentee-${ts}@test.com`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Casey",
        lastName: "Novak",
      },
      employment: {
        department: "Core Engineering",
        jobTitle: "Junior Software Engineer",
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

    // 4. Create Unrelated Employee (For Negative / Authorization tests)
    unrelatedUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `unrelated-${ts}@test.com`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Morgan",
        lastName: "Reese",
      },
      employment: {
        department: "Marketing",
        jobTitle: "Content Strategist",
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
        { title: "Conduct virtual welcome coffee & intro", stage: "day_1", completed: false },
        { title: "Introduce mentee to engineering channel on Slack", stage: "day_1", completed: false },
        { title: "Help with IT tools & Slack channel setup", stage: "day_1", completed: false },
        { title: "Introduce new hire to team members", stage: "week_1", completed: false },
        { title: "Conduct 1-on-1 week 1 check-in meeting", stage: "week_1", completed: false },
      ],
      communicationLinks: {
        email: buddyUser.auth.email,
      },
    });

    const targetItem = assignment.checklist.find(
      (c: any) => c.title === "Introduce mentee to engineering channel on Slack"
    );
    targetTaskId = targetItem._id ? targetItem._id.toString() : targetItem.title;
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

  it("Step 1-4: Buddy queries mentees (GET /api/v1/buddy/my-mentees returns 200 OK with mentee details & progress)", async () => {
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
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);

    const pairing = body.data.find((p: any) => p._id === assignment._id.toString());
    expect(pairing).toBeDefined();
    expect(pairing.newHireUserId?.profile?.firstName).toBe("Casey");
    expect(pairing.newHireUserId?.employment?.department).toBe("Core Engineering");
    expect(pairing.checklist).toBeDefined();
    expect(pairing.checklist.length).toBe(5);

    // Assert initial progress calculation (0%)
    const completedCount = pairing.checklist.filter((t: any) => t.completed).length;
    expect(completedCount).toBe(0);
  });

  it("Step 5-7: Buddy toggles checklist task 'Introduce mentee to engineering channel on Slack' (PUT /api/v1/buddy/assignment/:id/checklist returns 200 OK and updates progress)", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/buddy/assignment/${assignment._id}/checklist`,
      headers: {
        authorization: `Bearer ${buddyToken}`,
      },
      payload: {
        taskId: targetTaskId,
        completed: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();

    const updatedTask = body.data.checklist.find(
      (c: any) => c.title === "Introduce mentee to engineering channel on Slack"
    );
    expect(updatedTask).toBeDefined();
    expect(updatedTask.completed).toBe(true);
    expect(updatedTask.completedAt).toBeDefined();

    // Assert recalculated progress: 1 of 5 = 20%
    const completed = body.data.checklist.filter((t: any) => t.completed).length;
    const total = body.data.checklist.length;
    const progressPercentage = Math.round((completed / total) * 100);
    expect(progressPercentage).toBe(20);
  });

  it("Alternative Path: Buddy adds an ad-hoc custom task to the mentee checklist (POST /api/v1/buddy/assignment/:id/checklist/task)", async () => {
    const customTaskPayload = {
      title: "Schedule cross-team architecture alignment lunch",
      description: "Introduce mentee to Principal Engineers over lunch",
      stage: "week_1",
    };

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/buddy/assignment/${assignment._id}/checklist/task`,
      headers: {
        authorization: `Bearer ${buddyToken}`,
      },
      payload: customTaskPayload,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.checklist.length).toBe(6);

    const added = body.data.checklist.find(
      (t: any) => t.title === "Schedule cross-team architecture alignment lunch"
    );
    expect(added).toBeDefined();
    expect(added.completed).toBe(false);
    expect(added.stage).toBe("week_1");
  });

  it("Negative Test: Attempting to update a checklist belonging to another buddy pair returns HTTP 403 Forbidden", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/buddy/assignment/${assignment._id}/checklist`,
      headers: {
        authorization: `Bearer ${unrelatedToken}`, // Unrelated employee
      },
      payload: {
        taskId: targetTaskId,
        completed: false,
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.code).toBe("FORBIDDEN");
    expect(body.message).toContain("Only assigned buddy or mentee can toggle checklist items");
  });

  it("Authorization Test: Mentee can also toggle their shared checklist task", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/buddy/assignment/${assignment._id}/checklist`,
      headers: {
        authorization: `Bearer ${menteeToken}`, // Mentee user
      },
      payload: {
        taskId: targetTaskId,
        completed: false, // Toggle back to false
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    const updated = body.data.checklist.find(
      (c: any) => c.title === "Introduce mentee to engineering channel on Slack"
    );
    expect(updated.completed).toBe(false);

    // Toggle back to true to verify data integrity
    await app.inject({
      method: "PUT",
      url: `/api/v1/buddy/assignment/${assignment._id}/checklist`,
      headers: {
        authorization: `Bearer ${buddyToken}`,
      },
      payload: {
        taskId: targetTaskId,
        completed: true,
      },
    });
  });

  it("Data Integrity Checks: MongoDB BuddyAssignment.checklist contains taskId, completed: true, and completedAt", async () => {
    const dbAssignment = await BuddyAssignment.findById(assignment._id);
    expect(dbAssignment).not.toBeNull();

    const dbTask = dbAssignment?.checklist.find(
      (c: any) => c.title === "Introduce mentee to engineering channel on Slack"
    );
    expect(dbTask).toBeDefined();
    expect(dbTask?.completed).toBe(true);
    expect(dbTask?.completedAt).toBeInstanceOf(Date);
  });
});
