import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import BuddyProfile from "../modules/buddy/models/buddy-profile.model.js";
import BuddyAssignment from "../modules/buddy/models/buddy-assignment.model.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import buddyService from "../modules/buddy/services/buddy.service.js";

describe("Phase 8 — Buddy & Onboarding Support Program Test Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let adminUser: any;
  let buddyUser: any;
  let newHireUser: any;
  let adminToken: string;
  let buddyToken: string;
  let newHireToken: string;

  let createdProfile: any;
  let createdAssignment: any;

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
      name: "Phase 8 Test Org",
      slug: `phase8-org-${Date.now()}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Admin User
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: "phase8-admin@test.com",
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Phase8",
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

    // 3. Create Experienced Buddy User
    buddyUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: "phase8-buddy@test.com",
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Senior",
        lastName: "Buddy",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Senior Staff Engineer",
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

    // 4. Create New Hire Employee User
    newHireUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: "phase8-newhire@test.com",
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Junior",
        lastName: "NewHire",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Associate Engineer",
      },
      permissions: {
        role: "employee",
      },
    });

    newHireToken = app.jwt.sign({
      userId: newHireUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "employee",
    });

    // 5. Create Secondary Tenant
    otherOrg = await Organization.create({
      name: "Phase 8 Other Org",
      slug: `phase8-other-${Date.now()}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    otherAdmin = await User.create({
      organizationId: otherOrg._id,
      auth: {
        email: "other8-admin@test.com",
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
      await BuddyAssignment.deleteMany({ organizationId: testOrg._id });
      await BuddyProfile.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    }
    if (otherOrg) {
      await User.deleteMany({ organizationId: otherOrg._id });
      await Organization.deleteOne({ _id: otherOrg._id });
    }
    await app.close();
  });

  describe("1. Buddy Eligibility & Profile Registration (BUD-001)", () => {
    it("should register buddy profile via POST /api/v1/buddy/profiles", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/buddy/profiles",
        headers: {
          authorization: `Bearer ${buddyToken}`,
        },
        payload: {
          isAvailable: true,
          maxMentees: 3,
          skills: ["React", "Node.js", "Mentorship"],
          bio: "Excited to support new team members during onboarding!",
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.isAvailable).toBe(true);
      createdProfile = json.data;
    });

    it("should list available buddies via GET /api/v1/buddy/available", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/buddy/available",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("2. Buddy Assignment & Pairing (BUD-002, BUD-003)", () => {
    it("should assign buddy to new hire via POST /api/v1/buddy/assign", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/buddy/assign",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          newHireUserId: newHireUser._id.toString(),
          buddyUserId: buddyUser._id.toString(),
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("active");
      expect(json.data.checklist.length).toBeGreaterThan(0);
      createdAssignment = json.data;
    });

    it("should allow new hire to query assigned buddy via GET /api/v1/buddy/my-buddy", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/buddy/my-buddy",
        headers: {
          authorization: `Bearer ${newHireToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.buddyUserId.profile.firstName).toBe("Senior");
    });

    it("should allow buddy to query assigned mentees via GET /api/v1/buddy/my-mentees", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/buddy/my-mentees",
        headers: {
          authorization: `Bearer ${buddyToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("3. Buddy Checklist & 1-on-1 Check-In Logging (BUD-004, BUD-005)", () => {
    it("should toggle checklist item completion via PUT /api/v1/buddy/assignment/:id/checklist", async () => {
      const firstTaskId = createdAssignment.checklist[0]._id;

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/buddy/assignment/${createdAssignment._id}/checklist`,
        headers: {
          authorization: `Bearer ${buddyToken}`,
        },
        payload: {
          taskId: firstTaskId,
          completed: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.checklist[0].completed).toBe(true);
    });

    it("should log 1-on-1 buddy check-in meeting via POST /api/v1/buddy/assignment/:id/checkin", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/buddy/assignment/${createdAssignment._id}/checkin`,
        headers: {
          authorization: `Bearer ${buddyToken}`,
        },
        payload: {
          notes: "Had a great virtual coffee chat! Helped with Slack and tools setup.",
          rating: 5,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.checkins.length).toBe(1);
      expect(json.data.checkins[0].rating).toBe(5);
    });
  });

  describe("4. Auto-Assignment on User Creation (BUD-002)", () => {
    it("should auto-assign available buddy when new hire registers", async () => {
      const brandNewHire = await User.create({
        organizationId: testOrg._id,
        auth: {
          email: "buddy-autohire@test.com",
          passwordHash: "hashedpassword123",
        },
        profile: {
          firstName: "Auto",
          lastName: "Hire",
        },
        permissions: {
          role: "employee",
        },
      });

      const success = await buddyService.autoAssignBuddyToNewHire(testOrg._id, brandNewHire._id);
      expect(success).toBe(true);
    });
  });

  describe("5. Multi-Tenant Boundary Isolation", () => {
    it("should return empty available buddies list for Tenant B admin", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/buddy/available",
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
