import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import Organization from "../modules/organizations/models/organization.model.js";
import User from "../modules/auth/models/user.model.js";
import KioskJourneyModel from "../modules/kiosk/models/kiosk-journey.model.js";
import KioskDeviceModel from "../modules/kiosk/models/kiosk-device.model.js";
import { KioskSessionModel } from "../modules/kiosk/models/kiosk-session.model.js";
import { KioskWebhookSubscriptionModel } from "../modules/kiosk/models/kiosk-webhook-subscription.model.js";
import { KioskWebhookDeliveryModel } from "../modules/kiosk/models/kiosk-webhook-delivery.model.js";
import kioskWebhookService from "../modules/kiosk/services/kiosk-webhook.service.js";
import { KioskService } from "../modules/kiosk/services/kiosk.service.js";
import { KioskJourneyRepository } from "../modules/kiosk/repositories/kiosk-journey.repository.js";
import { KioskDeviceRepository } from "../modules/kiosk/repositories/kiosk-device.repository.js";
import { KioskAnalyticsRepository } from "../modules/kiosk/repositories/kiosk-analytics.repository.js";
import { KioskSecurityService } from "../modules/kiosk/services/kiosk-security.service.js";

describe("K-ENT-003: Real-Time Enterprise Kiosk Lifecycle Webhooks", () => {
  let app: FastifyInstance;
  let kioskService: KioskService;
  let testOrgId: string;
  const testOrgSlug = "webhook-facility-test";
  const dummyAdminId = new mongoose.Types.ObjectId();
  const originalFetch = globalThis.fetch;

  // Track dispatched webhook calls
  const dispatchedWebhooks: Array<{
    url: string;
    headers: Record<string, string>;
    body: any;
  }> = [];

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    kioskService = new KioskService(
      new KioskJourneyRepository(),
      new KioskDeviceRepository(),
      new KioskAnalyticsRepository(),
      new KioskSecurityService()
    );

    // Clean up any existing records
    await Organization.deleteMany({ slug: testOrgSlug });

    // Create test organization
    const org = await Organization.create({
      name: "Webhook Test Facility",
      slug: testOrgSlug,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyAdminId,
      kioskSettings: {
        enforceKioskLockdown: true,
      },
    });
    testOrgId = org._id.toString();

    // Clean up collections for this org
    await KioskWebhookSubscriptionModel.deleteMany({ organizationId: org._id });
    await KioskWebhookDeliveryModel.deleteMany({ organizationId: org._id });
    await KioskSessionModel.deleteMany({ organizationId: org._id });
    await KioskJourneyModel.deleteMany({ organizationId: org._id });
    await KioskDeviceModel.deleteMany({ organizationId: org._id });
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    await KioskWebhookSubscriptionModel.deleteMany({ organizationId: new mongoose.Types.ObjectId(testOrgId) });
    await KioskWebhookDeliveryModel.deleteMany({ organizationId: new mongoose.Types.ObjectId(testOrgId) });
    await KioskSessionModel.deleteMany({ organizationId: new mongoose.Types.ObjectId(testOrgId) });
    await KioskJourneyModel.deleteMany({ organizationId: new mongoose.Types.ObjectId(testOrgId) });
    await KioskDeviceModel.deleteMany({ organizationId: new mongoose.Types.ObjectId(testOrgId) });
    await Organization.deleteMany({ _id: new mongoose.Types.ObjectId(testOrgId) });
    await app.close();
  });

  beforeEach(() => {
    dispatchedWebhooks.length = 0;

    // Mock global fetch to capture outbound webhook calls
    globalThis.fetch = vi.fn().mockImplementation(async (url: any, init: any) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      const rawHeaders = init?.headers || {};
      const normalizedHeaders: Record<string, string> = {};

      if (rawHeaders instanceof Headers) {
        rawHeaders.forEach((val, key) => {
          normalizedHeaders[key.toLowerCase()] = val;
        });
      } else if (typeof rawHeaders === "object") {
        for (const [k, v] of Object.entries(rawHeaders)) {
          normalizedHeaders[k.toLowerCase()] = String(v);
        }
      }

      let parsedBody: any = null;
      if (typeof init?.body === "string") {
        try {
          parsedBody = JSON.parse(init.body);
        } catch {
          parsedBody = init.body;
        }
      }

      dispatchedWebhooks.push({
        url: urlStr,
        headers: normalizedHeaders,
        body: parsedBody,
      });

      return new Response(JSON.stringify({ success: true, processed: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // =========================================================================
  // 1. Subscription Management APIs
  // =========================================================================
  describe("Webhook Subscription Management", () => {
    let createdSubId: string;
    const testSecret = "turnstile_hmac_secret_key_12345";

    it("registers a new webhook subscription via POST /webhooks/subscriptions", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/webhooks/subscriptions",
        headers: { "x-organization-id": testOrgId },
        payload: {
          url: "https://access-control.facility.corp/api/v1/turnstile-grant",
          secret: testSecret,
          topics: ["kiosk.session.completed", "kiosk.device.offline"],
          name: "Turnstile Badge Access System",
          description: "Lenel OnGuard access grant integration",
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.url).toBe("https://access-control.facility.corp/api/v1/turnstile-grant");
      expect(body.data.secret).toBe(testSecret);
      expect(body.data.topics).toEqual(["kiosk.session.completed", "kiosk.device.offline"]);
      createdSubId = body.data._id;
    });

    it("lists subscriptions via GET /webhooks/subscriptions", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/kiosk/webhooks/subscriptions",
        headers: { "x-organization-id": testOrgId },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.some((s: any) => s._id === createdSubId)).toBe(true);
    });

    it("retrieves subscription by ID via GET /webhooks/subscriptions/:id", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/webhooks/subscriptions/${createdSubId}`,
        headers: { "x-organization-id": testOrgId },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data._id).toBe(createdSubId);
      expect(body.data.name).toBe("Turnstile Badge Access System");
    });

    it("updates subscription topics via PATCH /webhooks/subscriptions/:id", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/kiosk/webhooks/subscriptions/${createdSubId}`,
        headers: { "x-organization-id": testOrgId },
        payload: {
          topics: ["kiosk.session.completed", "kiosk.device.offline", "kiosk.emergency.activated"],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.topics).toContain("kiosk.emergency.activated");
    });
  });

  // =========================================================================
  // 2. Acceptance Criteria: Session Completion Webhook Dispatch
  // =========================================================================
  describe("Acceptance Criteria: POST /sessions/:id/complete Dispatches Webhook", () => {
    it("Given an employee completing a briefing, When POST /sessions/:id/complete finishes, Then a webhook event is dispatched to all subscribed endpoints with valid HMAC signature", async () => {
      const turnstileSecret = "lenel_onguard_secret_key_888";
      const turnstileUrl = "https://turnstile.security.local/api/access/grant";

      // 1. Subscribe Turnstile endpoint to kiosk.session.completed
      await KioskWebhookSubscriptionModel.deleteMany({ organizationId: new mongoose.Types.ObjectId(testOrgId) });
      const subscription = await KioskWebhookSubscriptionModel.create({
        organizationId: new mongoose.Types.ObjectId(testOrgId),
        url: turnstileUrl,
        secret: turnstileSecret,
        topics: ["kiosk.session.completed"],
        enabled: true,
        name: "Turnstile Controller",
      });

      // 2. Create Frontline Worker User with Badge ID (K-ENT-001 integration)
      const worker = await User.create({
        auth: {
          email: `worker-safety-${Date.now()}@facility.test`,
          passwordHash: "dummy_hashed_password_123",
        },
        profile: {
          firstName: "Marcus",
          lastName: "Vance",
        },
        role: "employee",
        organizationId: new mongoose.Types.ObjectId(testOrgId),
        employment: {
          badgeId: "BDG-TURNSTILE-7749",
          employeeId: "EMP-7749",
        },
      });

      // 3. Create Journey with 1 mandatory step
      const journey = await KioskJourneyModel.create({
        organizationId: new mongoose.Types.ObjectId(testOrgId),
        title: "Confined Space Entry Briefing",
        languages: ["en"],
        createdBy: dummyAdminId,
        isDeleted: false,
        steps: [
          {
            id: "step_confined_entry",
            type: "content",
            order: 0,
            title: "Oxygen Atmosphere Verification",
            blocks: [],
            interaction: { type: "hold_to_confirm", holdDurationMs: 1000 },
            isMandatory: true,
          },
        ],
        settings: {
          minimumDurationSeconds: 0,
          security: { protectionType: "none" },
        },
        publishing: {
          status: "published",
          version: 1,
          publishedAt: new Date(),
        },
      });

      // 4. Create Active Kiosk Device & Session
      const testDevice = await KioskDeviceModel.create({
        organizationId: new mongoose.Types.ObjectId(testOrgId),
        deviceId: "HW-KIOSK-GATE-1",
        name: "Gate 1 Terminal",
        location: "Gate 1",
        status: "online",
        deviceType: "countertop_tablet",
        paired: true,
      });

      const session = await KioskSessionModel.create({
        organizationId: new mongoose.Types.ObjectId(testOrgId),
        deviceId: testDevice._id,
        journeyId: journey._id,
        versionNumber: 1,
        userId: worker._id,
        sessionToken: "session_token_" + Date.now(),
        status: "active",
        startedAt: new Date(Date.now() - 60000),
        completedStepIds: ["step_confined_entry"],
        durationSeconds: 60,
        supervisorWitness: {
          supervisorId: dummyAdminId,
          witnessedAt: new Date(),
          method: "pin",
        },
      });

      // 5. Invoke POST /sessions/:id/complete (Acceptance Criteria trigger)
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/sessions/${session._id}/complete`,
        headers: { "x-organization-id": testOrgId },
        payload: {
          durationSeconds: 120,
          quizScore: 100,
        },
      });

      expect(res.statusCode).toBe(200);
      const resBody = JSON.parse(res.payload);
      expect(resBody.data.status).toBe("completed");
      expect(resBody.data.verificationChecksum).toBeDefined();

      // 6. Verify Outbound Webhook Dispatch
      expect(dispatchedWebhooks.length).toBeGreaterThanOrEqual(1);
      const webhookCall = dispatchedWebhooks.find((w) => w.url === turnstileUrl);
      expect(webhookCall).toBeDefined();

      // Check Headers: X-Talnova-Signature, X-Talnova-Event
      const headers = webhookCall!.headers;
      const signatureHeader = headers["x-talnova-signature"];
      expect(signatureHeader).toBeDefined();
      expect(headers["x-talnova-event"]).toBe("kiosk.session.completed");
      expect(headers["x-talnova-delivery"]).toBeDefined();

      // Verify HMAC-SHA256 signature with shared secret
      const rawPayload = JSON.stringify(webhookCall!.body);
      const isValidSignature = kioskWebhookService.verifySignature(
        rawPayload,
        signatureHeader,
        turnstileSecret
      );
      expect(isValidSignature).toBe(true);

      // Verify Negative Security Check: Tampered secret fails validation
      const isTamperedSecretValid = kioskWebhookService.verifySignature(
        rawPayload,
        signatureHeader,
        "wrong_tampered_secret"
      );
      expect(isTamperedSecretValid).toBe(false);

      // Verify Payload Structure
      const payload = webhookCall!.body;
      expect(payload.event).toBe("kiosk.session.completed");
      expect(payload.topic).toBe("kiosk.session.completed");
      expect(payload.organizationId).toBe(testOrgId);
      expect(payload.data.sessionId).toBe(session._id.toString());
      expect(payload.data.workerId).toBe(worker._id.toString());
      expect(payload.data.badgeId).toBe("BDG-TURNSTILE-7749");
      expect(payload.data.journeyVersion).toBe(1);
      expect(payload.data.verificationChecksum).toBe(resBody.data.verificationChecksum);
      expect(payload.data.supervisorWitness).toBeDefined();
      expect(payload.data.supervisorWitness.supervisorId).toBe(dummyAdminId.toString());

      // 7. Verify Delivery Audit Log Stored in MongoDB
      const deliveryRecord = await KioskWebhookDeliveryModel.findOne({
        subscriptionId: subscription._id,
        topic: "kiosk.session.completed",
      });
      expect(deliveryRecord).not.toBeNull();
      expect(deliveryRecord?.status).toBe("success");
      expect(deliveryRecord?.statusCode).toBe(200);
      expect(deliveryRecord?.signature).toBe(signatureHeader);
    });
  });

  // =========================================================================
  // 3. Topic: kiosk.device.offline
  // =========================================================================
  describe("Topic: kiosk.device.offline", () => {
    it("dispatches kiosk.device.offline event when a terminal drops offline during operational shift", async () => {
      const opsSecret = "ops_monitor_secret_555";
      const opsUrl = "https://monitoring.facility.corp/kiosk/offline-alerts";

      await KioskWebhookSubscriptionModel.create({
        organizationId: new mongoose.Types.ObjectId(testOrgId),
        url: opsUrl,
        secret: opsSecret,
        topics: ["kiosk.device.offline"],
        enabled: true,
        name: "IT Fleet Monitoring",
      });

      // Create stale device (>15 minutes without heartbeat)
      const staleDate = new Date(Date.now() - 20 * 60 * 1000);
      const device = await KioskDeviceModel.create({
        organizationId: new mongoose.Types.ObjectId(testOrgId),
        deviceId: `HW-STALE-LINE-${Date.now()}`,
        name: "Refinery Gate Kiosk C",
        location: "East Security Checkpoint",
        deviceType: "countertop_tablet",
        status: "online",
        lastHeartbeatAt: staleDate,
        lastSeen: staleDate,
        paired: true,
      });

      // Run Fleet Health Sentinel Scan
      const scanResult = await kioskService.scanKioskFleetHealth(testOrgId, {
        offlineThresholdMinutes: 15,
      });

      expect(scanResult.offlineCount).toBeGreaterThanOrEqual(1);

      // Verify webhook was dispatched to opsUrl
      const offlineCall = dispatchedWebhooks.find((w) => w.url === opsUrl);
      expect(offlineCall).toBeDefined();
      expect(offlineCall!.headers["x-talnova-event"]).toBe("kiosk.device.offline");

      // Verify HMAC-SHA256 signature
      const validSig = kioskWebhookService.verifySignature(
        offlineCall!.body,
        offlineCall!.headers["x-talnova-signature"],
        opsSecret
      );
      expect(validSig).toBe(true);

      // Verify Payload
      expect(offlineCall!.body.data.deviceId).toBe(device.deviceId);
      expect(offlineCall!.body.data.status).toBe("offline");
      expect(offlineCall!.body.data.location).toBe("East Security Checkpoint");
    });
  });

  // =========================================================================
  // 4. Topic: kiosk.device.tampered (Consecutive PIN Lockouts)
  // =========================================================================
  describe("Topic: kiosk.device.tampered", () => {
    it("dispatches kiosk.device.tampered event upon 3 consecutive failed supervisor PIN attempts (lockout)", async () => {
      const secSecret = "soc_siem_secret_999";
      const secUrl = "https://siem.enterprise.corp/events/tamper";

      await KioskWebhookSubscriptionModel.create({
        organizationId: new mongoose.Types.ObjectId(testOrgId),
        url: secUrl,
        secret: secSecret,
        topics: ["kiosk.device.tampered"],
        enabled: true,
        name: "SIEM Security Integration",
      });

      // Create supervisor user with PIN "1234"
      const supervisor = await User.create({
        auth: {
          email: `supervisor-tamper-${Date.now()}@facility.test`,
          passwordHash: "dummy_hashed_password_123",
        },
        profile: {
          firstName: "Chief Safety",
          lastName: "Officer",
        },
        permissions: {
          role: "supervisor",
        },
        organizationId: new mongoose.Types.ObjectId(testOrgId),
        security: {
          supervisorPinHash: "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4",
          failedSupervisorPinAttempts: 2, // 2 prior failures
        },
        status: "active",
        isDeleted: false,
      });

      // 3rd failed attempt triggers lockout and kiosk.device.tampered webhook
      await expect(
        kioskService.verifySupervisorPin({
          supervisorId: supervisor._id.toString(),
          pin: "9999", // Wrong PIN
          organizationId: testOrgId,
        })
      ).rejects.toThrow();

      // Verify webhook dispatch
      const tamperCall = dispatchedWebhooks.find((w) => w.url === secUrl);
      expect(tamperCall).toBeDefined();
      expect(tamperCall!.headers["x-talnova-event"]).toBe("kiosk.device.tampered");

      // Verify HMAC
      const validSig = kioskWebhookService.verifySignature(
        tamperCall!.body,
        tamperCall!.headers["x-talnova-signature"],
        secSecret
      );
      expect(validSig).toBe(true);

      // Verify Payload
      expect(tamperCall!.body.data.tamperType).toBe("pin_lockout");
      expect(tamperCall!.body.data.consecutiveFailedAttempts).toBe(3);
      expect(tamperCall!.body.data.supervisorId).toBe(supervisor._id.toString());
      expect(tamperCall!.body.data.lockoutDurationSeconds).toBe(300);
    });
  });

  // =========================================================================
  // 5. Topic: kiosk.emergency.activated
  // =========================================================================
  describe("Topic: kiosk.emergency.activated", () => {
    it("dispatches kiosk.emergency.activated event when facility emergency protocol is triggered", async () => {
      const emergencySecret = "pagerduty_emergency_key_777";
      const emergencyUrl = "https://pagerduty.facility.corp/kiosk/emergency-hook";

      await KioskWebhookSubscriptionModel.create({
        organizationId: new mongoose.Types.ObjectId(testOrgId),
        url: emergencyUrl,
        secret: emergencySecret,
        topics: ["kiosk.emergency.activated"],
        enabled: true,
        name: "Emergency Broadcast System",
      });

      // Broadcast emergency
      const emergency = await kioskService.broadcastEmergency(
        testOrgId,
        {
          type: "toxic_spill",
          severity: "evacuate",
          title: "Ammonia Leak at Chemical Storage B",
          message: "Evacuate immediately to Muster Point B",
          primaryExit: "South Windward Gate 4",
          secondaryExit: "North Main Exit",
          assemblyZone: "Muster Point B",
        },
        dummyAdminId.toString()
      );

      expect(emergency).toBeDefined();

      // Verify webhook dispatch
      const emergencyCall = dispatchedWebhooks.find((w) => w.url === emergencyUrl);
      expect(emergencyCall).toBeDefined();
      expect(emergencyCall!.headers["x-talnova-event"]).toBe("kiosk.emergency.activated");

      // Verify HMAC
      const validSig = kioskWebhookService.verifySignature(
        emergencyCall!.body,
        emergencyCall!.headers["x-talnova-signature"],
        emergencySecret
      );
      expect(validSig).toBe(true);

      // Verify Payload
      expect(emergencyCall!.body.data.emergencyId).toBe(emergency._id.toString());
      expect(emergencyCall!.body.data.type).toBe("toxic_spill");
      expect(emergencyCall!.body.data.severity).toBe("evacuate");
      expect(emergencyCall!.body.data.primaryExit).toBe("South Windward Gate 4");
    });
  });

  // =========================================================================
  // 6. Topic Filtering & Multi-Endpoint Subscriptions
  // =========================================================================
  describe("Topic Filtering & Multi-Endpoint Subscriptions", () => {
    it("ensures endpoints subscribed only to emergency do NOT receive session.completed events", async () => {
      const emrgOnlyUrl = "https://fire-dept.facility.corp/webhooks";
      const turnstileUrl = "https://turnstiles.facility.corp/webhooks";

      await KioskWebhookSubscriptionModel.deleteMany({ organizationId: new mongoose.Types.ObjectId(testOrgId) });

      await KioskWebhookSubscriptionModel.create({
        organizationId: new mongoose.Types.ObjectId(testOrgId),
        url: emrgOnlyUrl,
        secret: "secret_fire_dept",
        topics: ["kiosk.emergency.activated"],
        enabled: true,
      });

      await KioskWebhookSubscriptionModel.create({
        organizationId: new mongoose.Types.ObjectId(testOrgId),
        url: turnstileUrl,
        secret: "secret_turnstiles",
        topics: ["kiosk.session.completed"],
        enabled: true,
      });

      // Dispatch session completed event
      await kioskWebhookService.publishEvent(testOrgId, "kiosk.session.completed", {
        sessionId: "sess-999",
        workerId: "emp-999",
        verificationChecksum: "sha256-dummy",
        completedAt: new Date().toISOString(),
      });

      // Verify only turnstile received it, fire dept did not
      const emrgReceived = dispatchedWebhooks.some((w) => w.url === emrgOnlyUrl);
      const turnstileReceived = dispatchedWebhooks.some((w) => w.url === turnstileUrl);

      expect(emrgReceived).toBe(false);
      expect(turnstileReceived).toBe(true);
    });

    it("wildcard (*) subscription receives all kiosk event topics", async () => {
      const auditCollectorUrl = "https://audit-collector.corp/kiosk-events";

      await KioskWebhookSubscriptionModel.create({
        organizationId: new mongoose.Types.ObjectId(testOrgId),
        url: auditCollectorUrl,
        secret: "wildcard_secret_123",
        topics: ["*"],
        enabled: true,
      });

      dispatchedWebhooks.length = 0;

      await kioskWebhookService.publishEvent(testOrgId, "kiosk.device.offline", {
        deviceId: "HW-001",
        status: "offline",
      });

      await kioskWebhookService.publishEvent(testOrgId, "kiosk.emergency.activated", {
        emergencyId: "EM-001",
        title: "Test Emergency",
      });

      const auditCalls = dispatchedWebhooks.filter((w) => w.url === auditCollectorUrl);
      expect(auditCalls.length).toBe(2);
      expect(auditCalls.map((c) => c.headers["x-talnova-event"])).toEqual([
        "kiosk.device.offline",
        "kiosk.emergency.activated",
      ]);
    });
  });

  // =========================================================================
  // 7. Delivery Audit History API
  // =========================================================================
  describe("Delivery Audit History API", () => {
    it("returns recent delivery logs via GET /webhooks/deliveries", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/kiosk/webhooks/deliveries?limit=10",
        headers: { "x-organization-id": testOrgId },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data[0].signature).toBeDefined();
      expect(body.data[0].status).toBeDefined();
    });

    it("triggers test webhook dispatch via POST /webhooks/test", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/webhooks/test",
        headers: { "x-organization-id": testOrgId },
        payload: {
          topic: "kiosk.session.completed",
          payload: {
            testDispatch: true,
            simulatedWorker: "EMP-TEST-99",
          },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.deliveredCount).toBeGreaterThan(0);
    });
  });
});
