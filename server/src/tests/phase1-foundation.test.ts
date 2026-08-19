import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import { Notification } from "../modules/notifications/models/notification.model.js";
import NotificationPreference from "../modules/notifications/models/notification-preference.model.js";
import eventBus from "../infrastructure/events/event-bus.js";
import queueService from "../infrastructure/queue/queue.service.js";
import schedulerService from "../infrastructure/scheduler/scheduler.service.js";
import NotificationService from "../modules/notifications/services/notification.service.js";
import NotificationRepository from "../modules/notifications/repositories/notification.repository.js";

describe("Phase 1 — Platform Foundation Test Suite", () => {
  let app: any;
  let orgAId: mongoose.Types.ObjectId;
  let orgBId: mongoose.Types.ObjectId;
  let userA: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);

    const dummyId = new mongoose.Types.ObjectId();
    const orgA = await Organization.create({
      name: "Phase 1 Org A",
      slug: `phase1-org-a-${Date.now()}`,
      createdBy: dummyId,
      isDeleted: false,
    });
    orgAId = orgA._id as mongoose.Types.ObjectId;

    const orgB = await Organization.create({
      name: "Phase 1 Org B",
      slug: `phase1-org-b-${Date.now()}`,
      createdBy: dummyId,
      isDeleted: false,
    });
    orgBId = orgB._id as mongoose.Types.ObjectId;

    userA = await User.create({
      organizationId: orgAId,
      auth: {
        email: `p1usera_${Date.now()}@test.com`,
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
      },
      profile: { firstName: "User", lastName: "A", fullName: "User A" },
      permissions: { role: "employee", customRoles: [] },
      employment: { employmentType: "full_time", status: "active" },
    });

    userB = await User.create({
      organizationId: orgBId,
      auth: {
        email: `p1userb_${Date.now()}@test.com`,
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
      },
      profile: { firstName: "User", lastName: "B", fullName: "User B" },
      permissions: { role: "employee", customRoles: [] },
      employment: { employmentType: "full_time", status: "active" },
    });

    tokenA = app.jwt.sign({
      userId: userA._id.toString(),
      email: userA.auth.email,
      organizationId: orgAId.toString(),
      role: userA.permissions.role,
    });

    tokenB = app.jwt.sign({
      userId: userB._id.toString(),
      email: userB.auth.email,
      organizationId: orgBId.toString(),
      role: userB.permissions.role,
    });
  });

  afterAll(async () => {
    await Notification.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
    await NotificationPreference.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
    await User.deleteMany({ _id: { $in: [userA._id, userB._id] } });
    await Organization.deleteMany({ _id: { $in: [orgAId, orgBId] } });
  });

  describe("1. Typed Event Bus Primitives", () => {
    it("should publish events with envelope and execute subscribers", async () => {
      let receivedEnvelope: any = null;

      const unsubscribe = eventBus.subscribe("JOURNEY_ASSIGNED", async (envelope) => {
        receivedEnvelope = envelope;
      });

      await eventBus.publish({
        eventName: "JOURNEY_ASSIGNED",
        organizationId: orgAId,
        actorId: userA._id,
        entityId: new mongoose.Types.ObjectId(),
        payload: { journeyTitle: "Security Basics" },
      });

      expect(receivedEnvelope).not.toBeNull();
      expect(receivedEnvelope.eventName).toBe("JOURNEY_ASSIGNED");
      expect(receivedEnvelope.organizationId).toEqual(orgAId);
      expect(receivedEnvelope.payload.journeyTitle).toBe("Security Basics");
      expect(receivedEnvelope.eventId).toBeDefined();

      unsubscribe();
    });
  });

  describe("2. Background Queue Service", () => {
    it("should enqueue, process, and retry failed jobs", async () => {
      let attemptsCount = 0;

      queueService.registerWorker("test_retry_job", async () => {
        attemptsCount++;
        if (attemptsCount === 1) {
          throw new Error("Temporary worker failure");
        }
      });

      const job = await queueService.enqueue(
        "test_retry_job",
        { key: "value" },
        {
          organizationId: orgAId,
          maxRetries: 2,
          backoffDelayMs: 10,
        }
      );

      // Wait for background retry cycle to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(job).not.toBeNull();
      expect(attemptsCount).toBe(2);
    });

    it("should suppress duplicate jobs based on idempotency key", async () => {
      let execCount = 0;
      queueService.registerWorker("test_idempotent_job", async () => {
        execCount++;
      });

      const job1 = await queueService.enqueue(
        "test_idempotent_job",
        { data: "first" },
        { organizationId: orgAId, idempotencyKey: "unique_op_123" }
      );

      const job2 = await queueService.enqueue(
        "test_idempotent_job",
        { data: "second" },
        { organizationId: orgAId, idempotencyKey: "unique_op_123" }
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(job1).not.toBeNull();
      expect(job2).toBeNull(); // Suppressed
      expect(execCount).toBe(1);
    });
  });

  describe("3. Background Scheduler Engine", () => {
    it("should trigger overdue and compliance scan tasks", async () => {
      const scanCount = await schedulerService.scanOverdueAssignments();
      expect(typeof scanCount).toBe("number");
    });
  });

  describe("4. Production Notification Delivery & Preferences", () => {
    it("should create in-app notification when preferences permit", async () => {
      const notificationService = new NotificationService(new NotificationRepository());

      const notification = await notificationService.createNotification({
        organizationId: orgAId,
        recipientUserId: userA._id,
        type: "journey_assigned",
        channel: "in_app",
        title: "New Journey Assigned",
        message: "Please complete your mandatory training.",
      });

      expect(notification).not.toBeNull();
      expect(notification!.recipientUserId.toString()).toBe(userA._id.toString());
      expect(notification!.status).toBe("sent");
    });

    it("should respect user channel preferences when disabled", async () => {
      const notificationService = new NotificationService(new NotificationRepository());

      // Disable email channel in preferences
      await notificationService.updatePreferences(userA._id, orgAId, {
        channels: { inApp: true, email: false },
      });

      const notification = await notificationService.createNotification({
        organizationId: orgAId,
        recipientUserId: userA._id,
        type: "journey_assigned",
        channel: "email",
        title: "Email Notification",
        message: "Test email message",
      });

      expect(notification).toBeNull(); // Blocked by preferences
    });
  });

  describe("5. Notification API & Multi-Tenant Isolation", () => {
    it("User A should list their own notifications via API", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/notifications",
        headers: {
          authorization: `Bearer ${tokenA}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });

    it("User B cannot view User A notifications (Tenant Isolation)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/notifications",
        headers: {
          authorization: `Bearer ${tokenB}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      // User B should receive empty list, not User A's data
      const userAItems = json.data.filter((n: any) => n.recipientUserId === userA._id.toString());
      expect(userAItems.length).toBe(0);
    });

    it("User A can fetch and update notification preferences", async () => {
      const getRes = await app.inject({
        method: "GET",
        url: "/api/v1/notifications/preferences",
        headers: {
          authorization: `Bearer ${tokenA}`,
        },
      });

      expect(getRes.statusCode).toBe(200);
      const getJson = JSON.parse(getRes.body);
      expect(getJson.data.userId).toBe(userA._id.toString());

      const updateRes = await app.inject({
        method: "PUT",
        url: "/api/v1/notifications/preferences",
        headers: {
          authorization: `Bearer ${tokenA}`,
        },
        payload: {
          frequency: "daily_digest",
        },
      });

      expect(updateRes.statusCode).toBe(200);
      const updateJson = JSON.parse(updateRes.body);
      expect(updateJson.data.frequency).toBe("daily_digest");
    });
  });
});
