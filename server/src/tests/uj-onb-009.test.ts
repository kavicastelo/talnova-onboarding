import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import PushSubscription from "../modules/notifications/models/push-subscription.model.js";

describe("Journey Test UJ-ONB-009: Offline Learning Progress Sync via PWA", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let employeeUser: any;
  let employeeToken: string;

  let otherOrg: any;
  let otherUser: any;
  let otherToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();
    const ts = Date.now();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: "Field PWA Mobile Org",
      slug: `field-pwa-org-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Employee User
    employeeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `fieldworker-${ts}@test.com`,
        passwordHash: "argon2_test_hash",
      },
      profile: {
        firstName: "Field",
        lastName: "Worker",
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

    // 3. Other tenant for authorization checks
    otherOrg = await Organization.create({
      name: "Other Tenant Org",
      slug: `other-tenant-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    otherUser = await User.create({
      organizationId: otherOrg._id,
      auth: {
        email: `other-worker-${ts}@test.com`,
        passwordHash: "argon2_test_hash",
      },
      profile: {
        firstName: "Other",
        lastName: "Worker",
      },
      permissions: {
        role: "employee",
      },
    });

    otherToken = app.jwt.sign({
      userId: otherUser._id.toString(),
      organizationId: otherOrg._id.toString(),
      role: "employee",
    });
  });

  afterAll(async () => {
    if (testOrg) {
      await PushSubscription.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    }
    if (otherOrg) {
      await User.deleteMany({ organizationId: otherOrg._id });
      await Organization.deleteOne({ _id: otherOrg._id });
    }
    await app.close();
  });

  describe("Happy Path — Cached Lesson Retrieval & Offline Progress Sync", () => {
    it("Step 1: GET /api/v1/assignments/assign-pwa-01 returns cached course structure with les-pwa-02", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/assignments/assign-pwa-01",
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe("assign-pwa-01");
      expect(json.data.modules.length).toBeGreaterThan(0);

      const module1 = json.data.modules[0];
      const lesson2 = module1.lessons.find((l: any) => l.id === "les-pwa-02");
      expect(lesson2).toBeDefined();
      expect(lesson2.title).toContain("Hazard Assessment");
    });

    it("Step 7 & 8: POST /api/v1/assignments/assign-pwa-01/progress dispatches completedLessonIds and returns HTTP 200 OK", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/assignments/assign-pwa-01/progress",
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
        payload: {
          completedLessonIds: ["les-pwa-02"],
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.completedLessonIds).toContain("les-pwa-02");
      expect(json.data.completionPercentage).toBe(100);
      expect(json.data.status).toBe("completed");
    });

    it("Step 9: GET /api/v1/assignments/assign-pwa-01 confirms progress persistence and completed status", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/assignments/assign-pwa-01",
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("completed");
      expect(json.data.progress.completionPercentage).toBe(100);

      const module1 = json.data.modules[0];
      const lesson2 = module1.lessons.find((l: any) => l.id === "les-pwa-02");
      expect(lesson2.status).toBe("completed");
    });
  });

  describe("Alternative Paths — Batched Progress Sync", () => {
    it("Batches multiple offline lesson completions into single request", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/assignments/assign-pwa-01/progress",
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
        payload: {
          completedLessonIds: ["les-pwa-01", "les-pwa-02"],
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.completedLessonIds).toEqual(expect.arrayContaining(["les-pwa-01", "les-pwa-02"]));
    });
  });

  describe("Negative & Authorization Tests", () => {
    it("Rejects unauthenticated progress synchronization with 401 Unauthorized", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/assignments/assign-pwa-01/progress",
        payload: {
          completedLessonIds: ["les-pwa-02"],
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("Integration Checks — Web Push Subscription", () => {
    it("Registers Web Push subscription via POST /api/v1/notifications/push-subscription", async () => {
      const pushEndpoint = `https://fcm.googleapis.com/fcm/send/pwa-sync-${Date.now()}`;
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/notifications/push-subscription",
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
        payload: {
          endpoint: pushEndpoint,
          keys: {
            p256dh: "pwa_test_p256dh_key",
            auth: "pwa_test_auth_secret",
          },
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.endpoint).toBe(pushEndpoint);

      const savedSub = await PushSubscription.findOne({ endpoint: pushEndpoint });
      expect(savedSub).toBeDefined();
    });
  });
});
