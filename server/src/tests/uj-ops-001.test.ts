import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import GamificationProfile from "../modules/gamification/models/gamification-profile.model.js";

describe("Journey Test UJ-OPS-001: View Leaderboard & Earn Points/Badges", () => {
  let app: FastifyInstance;
  let testOrgA: any;
  let testOrgB: any;
  let userA: any;
  let userA2: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const ts = Date.now();
    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization A
    testOrgA = await Organization.create({
      name: "Ops Leaderboard Org A",
      slug: `ops-org-a-${ts}`,
      domain: `ops-org-a-${ts}.test`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Organization B
    testOrgB = await Organization.create({
      name: "Ops Leaderboard Org B",
      slug: `ops-org-b-${ts}`,
      domain: `ops-org-b-${ts}.test`,
      plan: "Starter",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });

    // 3. Create User A in Org A
    userA = await User.create({
      organizationId: testOrgA._id,
      auth: {
        email: `learner-a-${ts}@ops.test`,
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
      },
      profile: {
        firstName: "Jordan",
        lastName: "Learner",
        fullName: "Jordan Learner",
      },
      employment: {
        department: "Customer Success",
        jobTitle: "Associate",
        status: "active",
      },
      permissions: {
        role: "employee",
      },
    });

    // 4. Create User A2 (cohort member) in Org A
    userA2 = await User.create({
      organizationId: testOrgA._id,
      auth: {
        email: `peer-a2-${ts}@ops.test`,
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
      },
      profile: {
        firstName: "Taylor",
        lastName: "Swift",
        fullName: "Taylor Swift",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Engineer",
        status: "active",
      },
      permissions: {
        role: "employee",
      },
    });

    // 5. Create User B in Org B
    userB = await User.create({
      organizationId: testOrgB._id,
      auth: {
        email: `learner-b-${ts}@ops.test`,
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
      },
      profile: {
        firstName: "Morgan",
        lastName: "TenantB",
        fullName: "Morgan TenantB",
      },
      employment: {
        department: "Sales",
        jobTitle: "Account Exec",
        status: "active",
      },
      permissions: {
        role: "employee",
      },
    });

    tokenA = app.jwt.sign({
      userId: userA._id.toString(),
      role: userA.permissions.role,
      organizationId: testOrgA._id.toString(),
    });

    tokenB = app.jwt.sign({
      userId: userB._id.toString(),
      role: userB.permissions.role,
      organizationId: testOrgB._id.toString(),
    });

    // 6. Seed Profile for User A: 250 points, 5 streak, unlocked badges
    await GamificationProfile.create({
      organizationId: testOrgA._id,
      userId: userA._id,
      points: 250,
      level: 3,
      currentStreak: 5,
      longestStreak: 7,
      lastActiveDate: new Date(),
      unlockedBadges: [
        {
          badgeId: "quick_starter",
          name: "Quick Starter",
          description: "Earned your first onboarding points!",
          icon: "⚡",
          unlockedAt: new Date(),
        },
        {
          badgeId: "first_step",
          name: "First Step",
          description: "Earned your first 50 points in onboarding!",
          icon: "🌟",
          unlockedAt: new Date(),
        },
        {
          badgeId: "first_signer",
          name: "First Signer",
          description: "Completed key onboarding documents!",
          icon: "✍️",
          unlockedAt: new Date(),
        },
      ],
      pointHistory: [
        {
          action: "quiz_completed",
          points: 50,
          description: "Completed safety compliance quiz",
          timestamp: new Date(),
        },
      ],
    });

    // 7. Seed Profile for Peer A2: 400 points
    await GamificationProfile.create({
      organizationId: testOrgA._id,
      userId: userA2._id,
      points: 400,
      level: 4,
      currentStreak: 8,
      longestStreak: 10,
      lastActiveDate: new Date(),
      unlockedBadges: [
        {
          badgeId: "quick_starter",
          name: "Quick Starter",
          description: "Earned your first onboarding points!",
          icon: "⚡",
          unlockedAt: new Date(),
        },
      ],
      pointHistory: [],
    });

    // 8. Seed Profile for User B: 100 points
    await GamificationProfile.create({
      organizationId: testOrgB._id,
      userId: userB._id,
      points: 100,
      level: 2,
      currentStreak: 2,
      longestStreak: 2,
      lastActiveDate: new Date(),
      unlockedBadges: [],
      pointHistory: [],
    });
  });

  afterAll(async () => {
    if (testOrgA && testOrgB) {
      await GamificationProfile.deleteMany({ organizationId: { $in: [testOrgA._id, testOrgB._id] } });
      await User.deleteMany({ organizationId: { $in: [testOrgA._id, testOrgB._id] } });
      await Organization.deleteMany({ _id: { $in: [testOrgA._id, testOrgB._id] } });
    }
  });

  it("Step 1-2: GET /api/v1/gamification/profile returns HTTP 200 OK with points, streak, and badges", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/gamification/profile",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);

    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.points).toBe(250);
    expect(body.data.level).toBe(3);
    expect(body.data.currentStreak).toBe(5);
    expect(body.data.longestStreak).toBe(7);

    // Verify unlocked badges
    expect(Array.isArray(body.data.unlockedBadges)).toBe(true);
    expect(body.data.unlockedBadges.length).toBe(3);
    const badgeNames = body.data.unlockedBadges.map((b: any) => b.name);
    expect(badgeNames).toContain("Quick Starter");
    expect(badgeNames).toContain("First Step");
    expect(badgeNames).toContain("First Signer");
  });

  it("Step 1-2: GET /api/v1/gamification/leaderboard returns HTTP 200 OK with ranked cohort entries", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/gamification/leaderboard",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);

    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(2);

    // Rank 1 must be Peer A2 with 400 pts
    expect(body.data[0].rank).toBe(1);
    expect(body.data[0].name).toBe("Taylor Swift");
    expect(body.data[0].points).toBe(400);

    // Rank 2 must be User A with 250 pts
    expect(body.data[1].rank).toBe(2);
    expect(body.data[1].name).toBe("Jordan Learner");
    expect(body.data[1].points).toBe(250);
  });

  it("Alternative Path: User completes task/lesson and awards points server-side", async () => {
    const awardRes = await app.inject({
      method: "POST",
      url: "/api/v1/gamification/award-points",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
      payload: {
        action: "lesson_completed",
        points: 25,
        description: "Completed company culture orientation lesson",
      },
    });

    expect(awardRes.statusCode).toBe(200);
    const awardBody = JSON.parse(awardRes.body);
    expect(awardBody.success).toBe(true);
    expect(awardBody.data.points).toBe(275);

    // Re-verify profile reflects new score
    const profileRes = await app.inject({
      method: "GET",
      url: "/api/v1/gamification/profile",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });

    const profileBody = JSON.parse(profileRes.body);
    expect(profileBody.data.points).toBe(275);
  });

  it("Telemetry: User records activity streak via POST /api/v1/gamification/streak", async () => {
    const streakRes = await app.inject({
      method: "POST",
      url: "/api/v1/gamification/streak",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });

    expect(streakRes.statusCode).toBe(200);
    const streakBody = JSON.parse(streakRes.body);
    expect(streakBody.success).toBe(true);
    expect(streakBody.data.currentStreak).toBeGreaterThanOrEqual(1);
  });

  it("Negative Test: Unauthenticated request is rejected with HTTP 401 Unauthorized", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/gamification/profile",
    });

    expect(response.statusCode).toBe(401);
  });

  it("Negative Test: Anti-gaming rate limit protects against excessive client points farming", async () => {
    // Attempt multiple rapid point claims for same action exceeding limit (>150 pts/hr)
    const res1 = await app.inject({
      method: "POST",
      url: "/api/v1/gamification/award-points",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
      payload: {
        action: "spam_action",
        points: 100,
        description: "Attempted farm",
      },
    });
    const pointsAfterRes1 = JSON.parse(res1.body).data.points;

    const res2 = await app.inject({
      method: "POST",
      url: "/api/v1/gamification/award-points",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
      payload: {
        action: "spam_action",
        points: 100,
        description: "Attempted farm second time",
      },
    });
    const pointsAfterRes2 = JSON.parse(res2.body).data.points;

    // Second claim should be rate limited and not award the additional 100 points
    expect(pointsAfterRes2).toBe(pointsAfterRes1);
  });

  it("Authorization & Tenant Isolation: User B cannot see User A on leaderboard", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/gamification/leaderboard",
      headers: {
        Authorization: `Bearer ${tokenB}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);

    expect(body.success).toBe(true);
    expect(body.data.length).toBe(1);
    expect(body.data[0].name).toBe("Morgan TenantB");
    expect(body.data.some((e: any) => e.name === "Jordan Learner" || e.name === "Taylor Swift")).toBe(false);
  });

  it("Data Integrity Check: MongoDB GamificationProfile points matches API response exactly", async () => {
    const profileRes = await app.inject({
      method: "GET",
      url: "/api/v1/gamification/profile",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });

    const apiPoints = JSON.parse(profileRes.body).data.points;

    const dbProfile = await GamificationProfile.findOne({
      organizationId: testOrgA._id,
      userId: userA._id,
    });

    expect(dbProfile).toBeDefined();
    expect(dbProfile?.points).toBe(apiPoints);
  });
});
