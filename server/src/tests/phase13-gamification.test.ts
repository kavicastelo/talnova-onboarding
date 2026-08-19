import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import GamificationProfile from "../modules/gamification/models/gamification-profile.model.js";

describe("Phase 13 — Gamification & Engagement Test Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let employeeUser: any;
  let employeeToken: string;

  let otherOrg: any;
  let otherAdmin: any;
  let otherAdminToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();
    const ts = Date.now();

    await User.deleteMany({ "auth.email": { $regex: "^phase13-" } });

    // 1. Create Tenant Organization
    testOrg = await Organization.create({
      name: "Phase 13 Test Org",
      slug: `phase13-org-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Employee User
    employeeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `phase13-employee-${ts}@test.com`,
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Phase13",
        lastName: "Learner",
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

    // 3. Create Secondary Tenant
    otherOrg = await Organization.create({
      name: "Phase 13 Other Org",
      slug: `phase13-other-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    otherAdmin = await User.create({
      organizationId: otherOrg._id,
      auth: {
        email: `other13-admin-${ts}@test.com`,
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
      await GamificationProfile.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    }
    if (otherOrg) {
      await User.deleteMany({ organizationId: otherOrg._id });
      await Organization.deleteOne({ _id: otherOrg._id });
    }
    await app.close();
  });

  describe("1. Points Engine & Profile Initialization (GAM-001)", () => {
    it("should fetch or initialize gamification profile via GET /api/v1/gamification/profile", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/gamification/profile",
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.points).toBe(0);
      expect(json.data.level).toBe(1);
    });

    it("should award points and recalculate level via POST /api/v1/gamification/award-points", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/gamification/award-points",
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
        payload: {
          action: "quiz_completed",
          points: 50,
          description: "Completed onboarding practice quiz",
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.points).toBe(50);
      expect(json.data.unlockedBadges.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("2. Badges & Micro-Credentials System (GAM-002)", () => {
    it("should unlock 'First Step' badge automatically upon reaching 50 XP threshold", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/gamification/profile",
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.unlockedBadges.some((b: any) => b.badgeId === "first_step")).toBe(true);
    });
  });

  describe("3. Learning Streaks & Telemetry (GAM-003)", () => {
    it("should record active daily streak via POST /api/v1/gamification/streak", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/gamification/streak",
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.currentStreak).toBeGreaterThanOrEqual(1);
    });
  });

  describe("4. Organization Leaderboard Ranking (GAM-004)", () => {
    it("should return tenant leaderboard sorted by points via GET /api/v1/gamification/leaderboard", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/gamification/leaderboard",
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(1);
      expect(json.data[0].rank).toBe(1);
      expect(json.data[0].points).toBe(50);
    });
  });

  describe("5. Multi-Tenant Boundary Isolation", () => {
    it("should isolate Tenant B leaderboard from Tenant A learner points", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/gamification/leaderboard",
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
