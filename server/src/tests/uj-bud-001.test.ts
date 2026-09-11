import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import BuddyProfile from "../modules/buddy/models/buddy-profile.model.js";

describe("Journey Test UJ-BUD-001: Register Buddy Profile & Availability", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let employeeUser: any;
  let otherEmployeeUser: any;
  let employeeToken: string;
  let otherEmployeeToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const ts = Date.now();
    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: `Buddy Reg Test Org ${ts}`,
      slug: `buddy-reg-test-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Employee (Peer Buddy Candidate)
    employeeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `buddy-employee-${ts}@test.com`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Sam",
        lastName: "Rivers",
      },
      employment: {
        department: "Backend Engineering",
        jobTitle: "Senior Software Engineer",
        status: "active",
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

    // 3. Create Another Employee (For Authorization Test)
    otherEmployeeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `other-employee-${ts}@test.com`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Jordan",
        lastName: "Lee",
      },
      employment: {
        department: "Product",
        jobTitle: "Product Designer",
        status: "active",
      },
      permissions: {
        role: "employee",
      },
    });

    otherEmployeeToken = app.jwt.sign({
      userId: otherEmployeeUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "employee",
    });
  });

  afterAll(async () => {
    if (testOrg) {
      await User.deleteMany({ organizationId: testOrg._id });
      await BuddyProfile.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    }
    await app.close();
  });

  it("Step 1-7: Employee registers buddy profile (POST /api/v1/buddy/profiles returns 200 OK with expected profile)", async () => {
    const registerPayload = {
      bio: "Senior backend engineer enthusiastic about Node.js and distributed systems.",
      skills: ["TypeScript", "MongoDB"],
      languages: ["English", "Spanish"],
      maxMentees: 2,
      isAvailable: true,
    };

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/buddy/profiles",
      headers: {
        authorization: `Bearer ${employeeToken}`,
      },
      payload: registerPayload,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    // Assert response contains { profile: { userId, maxMentees: 2, isActive: true } }
    expect(body.profile).toBeDefined();
    expect(body.profile.userId.toString()).toBe(employeeUser._id.toString());
    expect(body.profile.maxMentees).toBe(2);
    expect(body.profile.isActive).toBe(true);
    expect(body.profile.bio).toBe(registerPayload.bio);
    expect(body.profile.skills).toEqual(expect.arrayContaining(["TypeScript", "MongoDB"]));
    expect(body.profile.languages).toEqual(expect.arrayContaining(["English", "Spanish"]));
  });

  it("Step 8: UI and query support (GET /api/v1/buddy/my-profile returns active buddy profile)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/buddy/my-profile",
      headers: {
        authorization: `Bearer ${employeeToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.profile).toBeDefined();
    expect(body.profile.isActive).toBe(true);
    expect(body.profile.maxMentees).toBe(2);
    expect(body.profile.bio).toContain("Senior backend engineer");
  });

  it("Integration Check: Profile is discoverable in available buddies pool (GET /api/v1/buddy/available)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/buddy/available",
      headers: {
        authorization: `Bearer ${employeeToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const found = body.data.find((b: any) => b.userId?._id?.toString() === employeeUser._id.toString());
    expect(found).toBeDefined();
    expect(found.isAvailable).toBe(true);
    expect(found.maxMentees).toBe(2);
    expect(found.currentMenteeCount).toBe(0);
    expect(found.department).toBe("Backend Engineering");
  });

  it("Alternative Path: Buddy toggles availability to false when on vacation (profile excluded from available pool)", async () => {
    // 1. Toggle availability to false
    const toggleRes = await app.inject({
      method: "POST",
      url: "/api/v1/buddy/profiles",
      headers: {
        authorization: `Bearer ${employeeToken}`,
      },
      payload: {
        isAvailable: false,
      },
    });

    expect(toggleRes.statusCode).toBe(200);
    const toggleBody = JSON.parse(toggleRes.body);
    expect(toggleBody.profile.isActive).toBe(false);

    // 2. Verify excluded from GET /api/v1/buddy/available
    const availableRes = await app.inject({
      method: "GET",
      url: "/api/v1/buddy/available",
      headers: {
        authorization: `Bearer ${employeeToken}`,
      },
    });

    const availableBody = JSON.parse(availableRes.body);
    const foundWhenVacation = availableBody.data.find(
      (b: any) => b.userId?._id?.toString() === employeeUser._id.toString()
    );
    expect(foundWhenVacation).toBeUndefined();

    // 3. Toggle back to true for remaining checks
    const restoreRes = await app.inject({
      method: "POST",
      url: "/api/v1/buddy/profiles",
      headers: {
        authorization: `Bearer ${employeeToken}`,
      },
      payload: {
        isAvailable: true,
      },
    });
    expect(restoreRes.statusCode).toBe(200);
  });

  it("Negative Test: Submit max mentees = 0 or negative flags invalid range (HTTP 400)", async () => {
    // Max mentees = 0
    const zeroRes = await app.inject({
      method: "POST",
      url: "/api/v1/buddy/profiles",
      headers: {
        authorization: `Bearer ${employeeToken}`,
      },
      payload: {
        maxMentees: 0,
      },
    });

    expect([400, 422]).toContain(zeroRes.statusCode);

    // Max mentees negative
    const negRes = await app.inject({
      method: "POST",
      url: "/api/v1/buddy/profiles",
      headers: {
        authorization: `Bearer ${employeeToken}`,
      },
      payload: {
        maxMentees: -3,
      },
    });

    expect([400, 422]).toContain(negRes.statusCode);
  });

  it("Authorization Test: User cannot modify another user's buddy profile (HTTP 403)", async () => {
    // Other employee attempts to modify Sam Rivers' profile
    const unauthRes = await app.inject({
      method: "POST",
      url: "/api/v1/buddy/profiles",
      headers: {
        authorization: `Bearer ${otherEmployeeToken}`,
      },
      payload: {
        userId: employeeUser._id.toString(),
        bio: "Malicious override of peer profile",
      },
    });

    expect(unauthRes.statusCode).toBe(403);
    const body = JSON.parse(unauthRes.body);
    expect(body.code).toBe("FORBIDDEN");
    expect(body.message).toContain("User can only modify their own buddy profile");
  });

  it("Data Integrity Checks: MongoDB BuddyProfile matches authenticated user", async () => {
    const profileInDb = await BuddyProfile.findOne({
      organizationId: testOrg._id,
      userId: employeeUser._id,
    });

    expect(profileInDb).not.toBeNull();
    expect(profileInDb?.userId.toString()).toBe(employeeUser._id.toString());
    expect(profileInDb?.organizationId.toString()).toBe(testOrg._id.toString());
    expect(profileInDb?.maxMentees).toBe(2);
    expect(profileInDb?.bio).toContain("Senior backend engineer");
    expect(profileInDb?.skills).toEqual(expect.arrayContaining(["TypeScript", "MongoDB"]));
    expect(profileInDb?.languages).toEqual(expect.arrayContaining(["English", "Spanish"]));
    expect(profileInDb?.isAvailable).toBe(true);
  });
});
