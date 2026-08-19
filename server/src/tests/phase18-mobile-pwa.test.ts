import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import PushSubscription from "../modules/notifications/models/push-subscription.model.js";

describe("Phase 18 — Mobile PWA & Field Access Test Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let employeeUser: any;
  let employeeToken: string;

  let otherOrg: any;
  let otherUser: any;
  let otherToken: string;

  const testEndpoint = "https://fcm.googleapis.com/fcm/send/phase18-push-test-token-123";

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();
    const ts = Date.now();

    await User.deleteMany({ "auth.email": { $regex: "^phase18-" } });

    // 1. Create Primary Tenant Organization
    testOrg = await Organization.create({
      name: "Phase 18 Mobile Org",
      slug: `phase18-org-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Employee User
    employeeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `phase18-employee-${ts}@test.com`,
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Mobile",
        lastName: "FieldWorker",
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
      name: "Phase 18 Other Org",
      slug: `phase18-other-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    otherUser = await User.create({
      organizationId: otherOrg._id,
      auth: {
        email: `other18-employee-${ts}@test.com`,
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Other",
        lastName: "FieldWorker",
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

  describe("1. Web Push Subscription Registration (MOB-004)", () => {
    it("should register Web Push subscription via POST /api/v1/notifications/push-subscription", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/notifications/push-subscription",
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
        payload: {
          endpoint: testEndpoint,
          keys: {
            p256dh: "test_p256dh_key_123",
            auth: "test_auth_secret_456",
          },
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.endpoint).toBe(testEndpoint);

      // Verify subscription document in MongoDB
      const sub = await PushSubscription.findOne({ endpoint: testEndpoint });
      expect(sub).toBeDefined();
      expect(sub?.userId.toString()).toBe(employeeUser._id.toString());
    });

    it("should return 400 Bad Request when endpoint or keys are missing", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/notifications/push-subscription",
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
        payload: {
          endpoint: testEndpoint,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("2. Multi-Tenant Boundary Isolation", () => {
    it("should isolate push subscriptions across different tenant organizations", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/notifications/push-subscription",
        headers: {
          authorization: `Bearer ${otherToken}`, // Tenant B user attempting to delete Tenant A subscription
        },
        payload: {
          endpoint: testEndpoint,
        },
      });

      expect(response.statusCode).toBe(200);

      // Verify Tenant A subscription was NOT deleted by Tenant B user
      const sub = await PushSubscription.findOne({ endpoint: testEndpoint });
      expect(sub).toBeDefined();
    });
  });

  describe("3. Web Push Subscription Unregistration (MOB-004)", () => {
    it("should unregister Web Push subscription via DELETE /api/v1/notifications/push-subscription", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/notifications/push-subscription",
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
        payload: {
          endpoint: testEndpoint,
        },
      });

      expect(response.statusCode).toBe(200);

      // Verify subscription deleted from database
      const sub = await PushSubscription.findOne({ endpoint: testEndpoint });
      expect(sub).toBeNull();
    });
  });
});
