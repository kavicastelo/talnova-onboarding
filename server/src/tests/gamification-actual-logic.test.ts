import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import GamificationProfile from "../modules/gamification/models/gamification-profile.model.js";
import { GamificationService } from "../modules/gamification/services/gamification.service.js";
import eventBus from "../infrastructure/events/event-bus.js";

describe("Gamification Actual Server-Side Logic & Scoring Validation Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let employeeUser: any;
  let employeeToken: string;
  let gamificationService: GamificationService;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    gamificationService = new GamificationService();

    const dummyId = new mongoose.Types.ObjectId();
    const ts = Date.now();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: "Gamification Real Logic Org",
      slug: `gamif-real-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Employee
    employeeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `gamif-learner-${ts}@test.com`,
        passwordHash: "hashedpass123",
      },
      profile: {
        firstName: "Sam",
        lastName: "Pace",
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
      await GamificationProfile.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    }
    await app.close();
  });

  describe("1. Real Server-Side Event Integrations & Idempotency", () => {
    it("should award 25 points on TASK_COMPLETED event with task referenceId", async () => {
      const taskId = new mongoose.Types.ObjectId().toString();

      // Publish TASK_COMPLETED event
      await eventBus.publish({
        eventName: "TASK_COMPLETED",
        organizationId: testOrg._id.toString(),
        actorId: employeeUser._id.toString(),
        entityId: taskId as any,
        payload: {
          taskId,
          title: "Complete Company Security Review",
          assignedToUserId: employeeUser._id.toString(),
        },
      });

      // Small delay for async event subscriber execution
      await new Promise((resolve) => setTimeout(resolve, 150));

      const profile = await gamificationService.getProfile(testOrg._id, employeeUser._id);
      expect(profile.points).toBe(25);
      expect(profile.level).toBe(1);
      expect(profile.pointHistory.length).toBe(1);
      expect(profile.pointHistory[0].action).toBe("task_completed");
      expect(profile.pointHistory[0].referenceId).toBe(`task_${taskId}`);
      expect(profile.unlockedBadges.some((b) => b.badgeId === "quick_starter")).toBe(true);
    });

    it("should NOT award duplicate points when the same task event is re-emitted (idempotency)", async () => {
      const profileBefore = await gamificationService.getProfile(testOrg._id, employeeUser._id);
      const initialPoints = profileBefore.points;
      const firstTaskRef = profileBefore.pointHistory[0].referenceId;

      // Manually trigger awardPoints with same referenceId
      const profileAfter = await gamificationService.awardPoints(
        testOrg._id,
        employeeUser._id,
        "task_completed",
        25,
        "Attempt duplicate task completion",
        firstTaskRef
      );

      // Points and history must remain unchanged
      expect(profileAfter.points).toBe(initialPoints);
      expect(profileAfter.pointHistory.length).toBe(profileBefore.pointHistory.length);
    });

    it("should award 50 points on DOCUMENT_SIGNED event and unlock First Step & First Signer badges", async () => {
      const docAssignmentId = new mongoose.Types.ObjectId().toString();

      await eventBus.publish({
        eventName: "DOCUMENT_SIGNED",
        organizationId: testOrg._id.toString(),
        actorId: employeeUser._id.toString(),
        entityId: docAssignmentId as any,
        payload: {
          assignmentId: docAssignmentId,
          templateTitle: "Confidentiality & NDA Agreement",
          employeeId: employeeUser._id.toString(),
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 150));

      const profile = await gamificationService.getProfile(testOrg._id, employeeUser._id);
      // 25 (from task) + 50 (from document) = 75 points
      expect(profile.points).toBe(75);
      expect(profile.pointHistory.some((ph) => ph.action === "document_signed")).toBe(true);
      expect(profile.unlockedBadges.some((b) => b.badgeId === "first_step")).toBe(true);
      expect(profile.unlockedBadges.some((b) => b.badgeId === "first_signer")).toBe(true);
    });

    it("should award 50 points on MILESTONE_COMPLETED event and recalculate Level to 2", async () => {
      const milestoneId = new mongoose.Types.ObjectId().toString();

      await eventBus.publish({
        eventName: "MILESTONE_COMPLETED",
        organizationId: testOrg._id.toString(),
        actorId: employeeUser._id.toString(),
        entityId: milestoneId as any,
        payload: {
          milestoneId,
          milestoneTitle: "Day 30 Culture & Role Integration",
          employeeId: employeeUser._id.toString(),
          targetDay: 30,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 150));

      const profile = await gamificationService.getProfile(testOrg._id, employeeUser._id);
      // 75 + 50 = 125 points
      expect(profile.points).toBe(125);
      // Level = Math.floor(125 / 100) + 1 = 2
      expect(profile.level).toBe(2);
      expect(profile.pointHistory.some((ph) => ph.action === "milestone_completed")).toBe(true);
    });

    it("should award 100 points on JOURNEY_COMPLETED event, promote to Level 3, and unlock Fast Learner badge", async () => {
      const journeyId = new mongoose.Types.ObjectId().toString();

      await eventBus.publish({
        eventName: "JOURNEY_COMPLETED",
        organizationId: testOrg._id.toString(),
        actorId: employeeUser._id.toString(),
        entityId: journeyId as any,
        payload: {
          journeyId,
          journeyTitle: "Engineering Core Onboarding",
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 150));

      const profile = await gamificationService.getProfile(testOrg._id, employeeUser._id);
      // 125 + 100 = 225 points
      expect(profile.points).toBe(225);
      // Level = Math.floor(225 / 100) + 1 = 3
      expect(profile.level).toBe(3);
      expect(profile.unlockedBadges.some((b) => b.badgeId === "fast_learner")).toBe(true);
    });
  });

  describe("2. Calendar Day Streak Calculation Logic", () => {
    it("should maintain streak when activity is recorded multiple times on the same calendar day", async () => {
      const profile = await gamificationService.getProfile(testOrg._id, employeeUser._id);
      const initialStreak = profile.currentStreak;

      // Record streak twice today
      await gamificationService.recordActivityStreak(testOrg._id, employeeUser._id);
      await gamificationService.recordActivityStreak(testOrg._id, employeeUser._id);

      const updated = await gamificationService.getProfile(testOrg._id, employeeUser._id);
      expect(updated.currentStreak).toBe(initialStreak);
    });

    it("should correctly increment streak on consecutive calendar day", async () => {
      const profile = await gamificationService.getProfile(testOrg._id, employeeUser._id);

      // Simulate last active was yesterday (e.g. exactly 1 calendar day ago)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      profile.lastActiveDate = yesterday;
      profile.currentStreak = 1;
      profile.longestStreak = 1;
      await profile.save();

      // Record activity streak for today
      await gamificationService.recordActivityStreak(testOrg._id, employeeUser._id);

      const updated = await gamificationService.getProfile(testOrg._id, employeeUser._id);
      expect(updated.currentStreak).toBe(2);
      expect(updated.longestStreak).toBe(2);
    });

    it("should unlock Streak Master badge when reaching 3-day active learning streak", async () => {
      const profile = await gamificationService.getProfile(testOrg._id, employeeUser._id);

      // Simulate 2-day streak yesterday
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      profile.lastActiveDate = yesterday;
      profile.currentStreak = 2;
      profile.longestStreak = 2;
      await profile.save();

      // Record activity streak today (day 3)
      await gamificationService.recordActivityStreak(testOrg._id, employeeUser._id);

      const updated = await gamificationService.getProfile(testOrg._id, employeeUser._id);
      expect(updated.currentStreak).toBe(3);
      expect(updated.longestStreak).toBe(3);
      expect(updated.unlockedBadges.some((b) => b.badgeId === "streak_master")).toBe(true);
    });

    it("should reset streak to 1 if user misses a calendar day (e.g. 2+ days elapsed)", async () => {
      const profile = await gamificationService.getProfile(testOrg._id, employeeUser._id);

      // Simulate 3 days ago (gap of 2 calendar days missed)
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      profile.lastActiveDate = threeDaysAgo;
      profile.currentStreak = 3;
      profile.longestStreak = 3;
      await profile.save();

      // Record activity streak today
      await gamificationService.recordActivityStreak(testOrg._id, employeeUser._id);

      const updated = await gamificationService.getProfile(testOrg._id, employeeUser._id);
      expect(updated.currentStreak).toBe(1);
      // Longest streak should remain preserved as 3
      expect(updated.longestStreak).toBe(3);
    });
  });

  describe("3. Organization Leaderboard Alignment", () => {
    it("should display accurate points, level, streak, and badges count on the organization leaderboard", async () => {
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
      expect(Array.isArray(json.data)).toBe(true);

      const entry = json.data.find((e: any) => e.userId === employeeUser._id.toString());
      expect(entry).toBeDefined();
      expect(entry.points).toBe(225);
      expect(entry.level).toBe(3);
      expect(entry.currentStreak).toBe(1);
      expect(entry.badgesCount).toBeGreaterThanOrEqual(4);
    });
  });
});
