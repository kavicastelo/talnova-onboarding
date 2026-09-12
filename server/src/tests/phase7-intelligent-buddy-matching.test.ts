import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import BuddyProfile from "../modules/buddy/models/buddy-profile.model.js";
import BuddyAssignment from "../modules/buddy/models/buddy-assignment.model.js";
import MeetingEvent from "../modules/calendar/models/meeting-event.model.js";
import Notification from "../modules/notifications/models/notification.model.js";
import buddyService from "../modules/buddy/services/buddy.service.js";
import registerEventSubscribers from "../infrastructure/events/event-subscribers.js";
import eventBus from "../infrastructure/events/event-bus.js";

describe("Phase 7 — Intelligent Multi-Factor Buddy Matching & Proactive Coaching Test Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let hrAdminUser: any;
  let engineerNewHire: any;
  let buddyA: any; // Optimal: Engineering, Tokyo, English, capacity available
  let buddyB: any; // Suboptimal: Sales, London, English, capacity available
  let buddyC: any; // Disqualified: Engineering, Tokyo, English, capacity FULL
  let buddyAProfile: any;
  let buddyBProfile: any;
  let buddyCProfile: any;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    registerEventSubscribers();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: "Buddy Matching Test Corp",
      slug: `buddy-org-${Date.now()}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create HR Admin User
    hrAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `hr-admin-${Date.now()}@buddytest.com`,
        passwordHash: "$2a$10$abcdefghijklmnopqrstuuu",
        emailVerified: true,
      },
      profile: { firstName: "Sarah", lastName: "HR", fullName: "Sarah HR" },
      permissions: { role: "admin" },
      employment: { status: "active", department: "People Operations" },
      preferences: { language: "en" },
    });

    // 3. Create Engineer New Hire in Tokyo
    engineerNewHire = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `kenji-hire-${Date.now()}@buddytest.com`,
        passwordHash: "$2a$10$abcdefghijklmnopqrstuuu",
        emailVerified: true,
      },
      profile: {
        firstName: "Kenji",
        lastName: "Sato",
        fullName: "Kenji Sato",
        location: "Tokyo",
        timezone: "Asia/Tokyo",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Software Engineer",
        status: "onboarding",
      },
      preferences: { language: "en" },
    });

    // 4. Seed Buddy A (Optimal: Engineering, Tokyo, English, Capacity: 1 / 3)
    const buddyAUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `buddy-a-${Date.now()}@buddytest.com`,
        passwordHash: "$2a$10$abcdefghijklmnopqrstuuu",
        emailVerified: true,
      },
      profile: {
        firstName: "Akira",
        lastName: "Tanaka",
        fullName: "Akira Tanaka",
        location: "Tokyo",
        timezone: "Asia/Tokyo",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Senior Software Engineer",
        status: "active",
      },
      preferences: { language: "en" },
    });

    buddyAProfile = await BuddyProfile.create({
      organizationId: testOrg._id,
      userId: buddyAUser._id,
      isAvailable: true,
      maxMentees: 3,
      currentMenteeCount: 1, // Has 2 slots open
      department: "Engineering",
      languages: ["en", "ja"],
      skills: ["TypeScript", "Node.js", "React"],
      bio: "Full stack mentor in Tokyo office",
    });
    buddyA = buddyAUser;

    // 5. Seed Buddy B (Suboptimal: Sales, London, English, Capacity: 0 / 3)
    const buddyBUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `buddy-b-${Date.now()}@buddytest.com`,
        passwordHash: "$2a$10$abcdefghijklmnopqrstuuu",
        emailVerified: true,
      },
      profile: {
        firstName: "Oliver",
        lastName: "Smith",
        fullName: "Oliver Smith",
        location: "London",
        timezone: "Europe/London",
      },
      employment: {
        department: "Sales",
        jobTitle: "Account Executive",
        status: "active",
      },
      preferences: { language: "en" },
    });

    buddyBProfile = await BuddyProfile.create({
      organizationId: testOrg._id,
      userId: buddyBUser._id,
      isAvailable: true,
      maxMentees: 3,
      currentMenteeCount: 0,
      department: "Sales",
      languages: ["en"],
      skills: ["Negotiation", "CRM"],
      bio: "Sales lead in UK",
    });
    buddyB = buddyBUser;

    // 6. Seed Buddy C (Disqualified: Engineering, Tokyo, Capacity: 3 / 3 - FULL)
    const buddyCUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `buddy-c-${Date.now()}@buddytest.com`,
        passwordHash: "$2a$10$abcdefghijklmnopqrstuuu",
        emailVerified: true,
      },
      profile: {
        firstName: "Yuki",
        lastName: "Watanabe",
        fullName: "Yuki Watanabe",
        location: "Tokyo",
        timezone: "Asia/Tokyo",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Staff Engineer",
        status: "active",
      },
      preferences: { language: "en" },
    });

    buddyCProfile = await BuddyProfile.create({
      organizationId: testOrg._id,
      userId: buddyCUser._id,
      isAvailable: true,
      maxMentees: 3,
      currentMenteeCount: 3, // Capacity Exhausted!
      department: "Engineering",
      languages: ["en", "ja"],
      skills: ["TypeScript", "Distributed Systems"],
      bio: "Busy staff engineer",
    });
    buddyC = buddyCUser;
  }, 20000);

  afterAll(async () => {
    // Cleanup collections
    await User.deleteMany({ organizationId: testOrg._id });
    await BuddyProfile.deleteMany({ organizationId: testOrg._id });
    await BuddyAssignment.deleteMany({ organizationId: testOrg._id });
    await MeetingEvent.deleteMany({ organizationId: testOrg._id });
    await Notification.deleteMany({ organizationId: testOrg._id });
    await Organization.deleteOne({ _id: testOrg._id });
  });

  describe("1. Intelligent Multi-Factor Buddy Compatibility Scoring & Matching", () => {
    it("should calculate higher compatibility score for Buddy A than Buddy B", () => {
      const scoreA = buddyService.calculateCompatibilityScore(engineerNewHire, buddyAProfile, buddyA);
      const scoreB = buddyService.calculateCompatibilityScore(engineerNewHire, buddyBProfile, buddyB);

      expect(scoreA.score).toBeGreaterThan(scoreB.score);
      expect(scoreA.criteria.departmentScore).toBe(1.0); // Engineering === Engineering
      expect(scoreB.criteria.departmentScore).toBe(0.1); // Sales !== Engineering
      expect(scoreA.criteria.locationScore).toBe(1.0); // Tokyo === Tokyo
      expect(scoreA.score).toBeGreaterThanOrEqual(0.70);
    });

    it("should auto-pair Buddy A with the new hire over Buddy B and full Buddy C", async () => {
      const result = await buddyService.autoAssignBuddyToNewHire(testOrg._id, engineerNewHire._id);

      expect(result.success).toBe(true);
      expect(result.buddyUserId).toBe(buddyA._id.toString());
      expect(result.matchScore).toBeGreaterThanOrEqual(0.70);
      expect(result.matchCriteria).toBeDefined();
      expect(result.matchCriteria.departmentScore).toBe(1.0);

      // Verify Buddy A mentee count incremented
      const updatedProfileA = await BuddyProfile.findOne({ userId: buddyA._id });
      expect(updatedProfileA?.currentMenteeCount).toBe(2);

      // Verify active assignment saved in database
      const assignment = await BuddyAssignment.findById(result.assignmentId);
      expect(assignment).toBeDefined();
      expect(assignment?.status).toBe("active");
      expect(assignment?.matchScore).toBe(result.matchScore);
    });
  });

  describe("2. Hard Capacity Limit Enforcement Guardrail", () => {
    it("should never select Buddy C whose currentMenteeCount >= maxMentees", async () => {
      // Seed a second engineer new hire
      const secondHire = await User.create({
        organizationId: testOrg._id,
        auth: {
          email: `second-hire-${Date.now()}@buddytest.com`,
          passwordHash: "$2a$10$abcdefghijklmnopqrstuuu",
          emailVerified: true,
        },
        profile: {
          firstName: "Mayu",
          lastName: "Kato",
          fullName: "Mayu Kato",
          location: "Tokyo",
        },
        employment: {
          department: "Engineering",
          status: "onboarding",
        },
        preferences: { language: "en" },
      });

      // Even though Buddy C is Engineering and Tokyo, Buddy C is at capacity (3/3)
      const result = await buddyService.autoAssignBuddyToNewHire(testOrg._id, secondHire._id);

      expect(result.success).toBe(true);
      // It must NOT be Buddy C! Buddy A still has 1 slot left (now 2/3) or Buddy B
      expect(result.buddyUserId).not.toBe(buddyC._id.toString());
    });
  });

  describe("3. Graceful Exhaustion & HR Ops Exception Workbench Triage", () => {
    it("should escalate to HR Ops and return clean failure when all buddies are at capacity", async () => {
      // Saturate all buddy profiles in the test org
      await BuddyProfile.updateMany(
        { organizationId: testOrg._id },
        { currentMenteeCount: 3, maxMentees: 3 }
      );

      const strandedHire = await User.create({
        organizationId: testOrg._id,
        auth: {
          email: `stranded-hire-${Date.now()}@buddytest.com`,
          passwordHash: "$2a$10$abcdefghijklmnopqrstuuu",
          emailVerified: true,
        },
        profile: {
          firstName: "Riku",
          lastName: "Takahashi",
          fullName: "Riku Takahashi",
        },
        employment: {
          department: "Engineering",
          status: "onboarding",
        },
        preferences: { language: "en" },
      });

      // Listen for event
      let conflictEventPublished = false;
      const unsubscribe = eventBus.subscribe("WORKFLOW_RULE_CONFLICT_ARBITRATED", async (event) => {
        if (event.payload?.conflictType === "NO_BUDDY_AVAILABLE") {
          conflictEventPublished = true;
        }
      });

      // Trigger auto-assignment with zero available capacity
      const result = await buddyService.autoAssignBuddyToNewHire(testOrg._id, strandedHire._id);

      expect(result.success).toBe(false);
      expect(result.reason).toBe("no_buddies_available");

      // Verify notification sent to HR Admin
      const hrNotifications = await Notification.find({
        organizationId: testOrg._id,
        recipientUserId: hrAdminUser._id,
        type: "manager_alert",
      });

      const exhaustionNotice = hrNotifications.find((n) =>
        n.title.includes("Buddy Matching Exception: Capacity Exhausted")
      );
      expect(exhaustionNotice).toBeDefined();
      expect(exhaustionNotice?.message).toContain("Riku Takahashi");

      unsubscribe();
    });
  });

  describe("4. Calendar 1-on-1 Auto-Provisioning", () => {
    it("should have automatically provisioned a buddy_coffee meeting upon buddy assignment", async () => {
      // Find the meeting created for Kenji (engineerNewHire) and Akira (buddyA)
      const meetings = await MeetingEvent.find({
        organizationId: testOrg._id,
        category: "buddy_coffee",
      });

      expect(meetings.length).toBeGreaterThan(0);
      const coffeeMeeting = meetings.find(
        (m) =>
          m.attendeeUserIds.some((id) => id.toString() === buddyA._id.toString()) &&
          m.attendeeUserIds.some((id) => id.toString() === engineerNewHire._id.toString())
      );

      expect(coffeeMeeting).toBeDefined();
      expect(coffeeMeeting?.title).toContain("Welcome Coffee & Intro");
      expect(coffeeMeeting?.category).toBe("buddy_coffee");
    });
  });

  describe("5. Proactive Buddy Coaching Sentinel", () => {
    it("should scan active pairings and dispatch stage-appropriate conversational coaching nudges", async () => {
      // Reset capacity for Buddy A
      await BuddyProfile.updateOne(
        { userId: buddyA._id },
        { currentMenteeCount: 1, maxMentees: 5 }
      );

      // Create 3 active pairings representing Week 1, Week 2, and Week 4
      const menteeW1 = await User.create({
        organizationId: testOrg._id,
        auth: { email: `mentee-w1-${Date.now()}@buddytest.com`, passwordHash: "h" },
        profile: { firstName: "Daisy", lastName: "Week1", fullName: "Daisy Week1" },
        employment: { department: "Engineering", status: "onboarding" },
      });
      const menteeW2 = await User.create({
        organizationId: testOrg._id,
        auth: { email: `mentee-w2-${Date.now()}@buddytest.com`, passwordHash: "h" },
        profile: { firstName: "Ethan", lastName: "Week2", fullName: "Ethan Week2" },
        employment: { department: "Engineering", status: "onboarding" },
      });
      const menteeW4 = await User.create({
        organizationId: testOrg._id,
        auth: { email: `mentee-w4-${Date.now()}@buddytest.com`, passwordHash: "h" },
        profile: { firstName: "Fiona", lastName: "Week4", fullName: "Fiona Week4" },
        employment: { department: "Engineering", status: "onboarding" },
      });

      // Assignment 1: 2 days old (Week 1)
      const assignW1 = await BuddyAssignment.create({
        organizationId: testOrg._id,
        buddyUserId: buddyA._id,
        newHireUserId: menteeW1._id,
        assignedBy: hrAdminUser._id,
        status: "active",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      });

      // Assignment 2: 10 days old (Week 2)
      const assignW2 = await BuddyAssignment.create({
        organizationId: testOrg._id,
        buddyUserId: buddyA._id,
        newHireUserId: menteeW2._id,
        assignedBy: hrAdminUser._id,
        status: "active",
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      });

      // Assignment 3: 25 days old (Week 4)
      const assignW4 = await BuddyAssignment.create({
        organizationId: testOrg._id,
        buddyUserId: buddyA._id,
        newHireUserId: menteeW4._id,
        assignedBy: hrAdminUser._id,
        status: "active",
        createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      });

      // Run sentinel scan
      const scanResult = await buddyService.scanBuddyCoachingNudges(testOrg._id);
      expect(scanResult.processedCount).toBeGreaterThanOrEqual(3);
      expect(scanResult.nudgesSentCount).toBeGreaterThanOrEqual(3);

      // Verify Week 1 Nudge
      const reloadedW1 = await BuddyAssignment.findById(assignW1._id);
      expect(reloadedW1?.coachingNudges?.week1SentAt).toBeDefined();

      // Verify Week 2 Nudge
      const reloadedW2 = await BuddyAssignment.findById(assignW2._id);
      expect(reloadedW2?.coachingNudges?.week2SentAt).toBeDefined();

      // Verify Week 4 Nudge
      const reloadedW4 = await BuddyAssignment.findById(assignW4._id);
      expect(reloadedW4?.coachingNudges?.week4SentAt).toBeDefined();

      // Verify Notifications delivered to Buddy A
      const buddyNotifications = await Notification.find({
        organizationId: testOrg._id,
        recipientUserId: buddyA._id,
      });

      expect(buddyNotifications.some((n) => n.title.includes("Week 1 Welcome Tip"))).toBe(true);
      expect(buddyNotifications.some((n) => n.title.includes("Week 2 Check-in Reminder"))).toBe(true);
      expect(buddyNotifications.some((n) => n.title.includes("Week 4 Milestone Check"))).toBe(true);

      // Idempotency: second scan should NOT re-send nudges for same stages
      const secondScan = await buddyService.scanBuddyCoachingNudges(testOrg._id);
      expect(secondScan.nudgesSentCount).toBe(0);
    });
  });

  describe("6. Manual Override & Reassignment Customization Guardrail", () => {
    it("should allow admin or manager to manually assign any buddy and handle reassignment gracefully", async () => {
      // Re-enable Buddy B
      await BuddyProfile.updateOne(
        { userId: buddyB._id },
        { currentMenteeCount: 0, maxMentees: 5 }
      );

      // Kenji was assigned to Buddy A. Admin manually re-assigns Kenji to Buddy B.
      const reassignment = await buddyService.assignBuddy(
        testOrg._id,
        engineerNewHire._id,
        buddyB._id,
        hrAdminUser._id,
        "Custom Manual Override"
      );

      expect(reassignment).toBeDefined();
      expect(reassignment.status).toBe("active");
      expect(reassignment.buddyUserId.toString()).toBe(buddyB._id.toString());

      // Check that Kenji's previous assignment with Buddy A was marked reassigned
      const oldAssignment = await BuddyAssignment.findOne({
        organizationId: testOrg._id,
        newHireUserId: engineerNewHire._id,
        buddyUserId: buddyA._id,
      });
      expect(oldAssignment?.status).toBe("reassigned");
    });
  });
});
