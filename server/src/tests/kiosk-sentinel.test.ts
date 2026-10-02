import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import http from "http";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import KioskDeviceModel from "../modules/kiosk/models/kiosk-device.model.js";
import Notification from "../modules/notifications/models/notification.model.js";
import { KioskService } from "../modules/kiosk/services/kiosk.service.js";
import { KioskJourneyRepository } from "../modules/kiosk/repositories/kiosk-journey.repository.js";
import { KioskDeviceRepository } from "../modules/kiosk/repositories/kiosk-device.repository.js";
import { KioskAnalyticsRepository } from "../modules/kiosk/repositories/kiosk-analytics.repository.js";
import { KioskSecurityService } from "../modules/kiosk/services/kiosk-security.service.js";

describe("K-ANA-002: Autonomous Kiosk Fleet Health Sentinel & Multi-Channel Alerting", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let adminUser: any;
  let adminToken: string;
  let kioskService: KioskService;

  // Mock HTTP webhook server for testing outbound webhook dispatch
  let mockWebhookServer: http.Server;
  let webhookPort: number;
  let webhookReceivedPayloads: any[] = [];

  const ts = Date.now();
  const dummyAdminId = new mongoose.Types.ObjectId();

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

    // 1. Setup mock webhook endpoint
    await new Promise<void>((resolve) => {
      mockWebhookServer = http.createServer((req, res) => {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", () => {
          try {
            webhookReceivedPayloads.push(JSON.parse(body));
          } catch {
            webhookReceivedPayloads.push(body);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ received: true }));
        });
      });

      mockWebhookServer.listen(0, "127.0.0.1", () => {
        const address = mockWebhookServer.address() as any;
        webhookPort = address.port;
        resolve();
      });
    });

    // 2. Create Test Organization with configured alert webhook
    testOrg = await Organization.create({
      name: `Sentinel Test Plant ${ts}`,
      slug: `sentinel-plant-${ts}`,
      createdBy: dummyAdminId,
      isDeleted: false,
      integrations: {
        kioskAlertWebhookUrl: `http://127.0.0.1:${webhookPort}/kiosk-alerts`,
      },
    });

    // 3. Create Admin User
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `sentinel-admin-${ts}@talnova.test`,
        passwordHash: "dummy-hash-for-testing",
      },
      profile: {
        firstName: "Fleet",
        lastName: "Administrator",
        fullName: "Fleet Administrator",
      },
      permissions: {
        role: "admin",
        roles: ["admin"],
      },
      role: "admin",
      status: "active",
    });

    adminToken = app.jwt.sign({
      userId: adminUser._id.toString(),
      id: adminUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "admin",
    });
  });

  afterAll(async () => {
    if (mockWebhookServer) {
      await new Promise<void>((resolve) => mockWebhookServer.close(() => resolve()));
    }
  });

  // =========================================================================
  // REQUIREMENT 1 & ACCEPTANCE CRITERIA: Offline Terminal Detection (>15 min)
  // =========================================================================
  describe("1. Offline Terminal Detection (>15 Minutes)", () => {
    it("should detect terminals failing heartbeats for >15 minutes, transition them to offline, and dispatch admin notification", async () => {
      // Create a stale terminal whose last heartbeat was 25 minutes ago
      const staleDevice = await KioskDeviceModel.create({
        organizationId: testOrg._id,
        deviceId: `HW-STALE-${ts}`,
        name: "Gate 1 Turnstile Kiosk",
        location: "Warehouse North Turnstile",
        status: "online",
        deviceType: "wall_mount",
        lastHeartbeatAt: new Date(Date.now() - 25 * 60 * 1000),
        lastSeen: new Date(Date.now() - 25 * 60 * 1000),
        isDeleted: false,
      });

      // Create a fresh terminal whose last heartbeat was 2 minutes ago
      const freshDevice = await KioskDeviceModel.create({
        organizationId: testOrg._id,
        deviceId: `HW-FRESH-${ts}`,
        name: "Reception Kiosk",
        location: "Main Lobby",
        status: "online",
        deviceType: "floor_standing",
        lastHeartbeatAt: new Date(Date.now() - 2 * 60 * 1000),
        lastSeen: new Date(Date.now() - 2 * 60 * 1000),
        isDeleted: false,
      });

      // Run sentinel scan for this organization
      const scanResult = await kioskService.scanKioskFleetHealth(testOrg._id.toString());

      // Verify scan counts
      expect(scanResult.offlineCount).toBeGreaterThanOrEqual(1);

      // Verify stale device transitioned to offline
      const staleAfter = await KioskDeviceModel.findById(staleDevice._id);
      expect(staleAfter?.status).toBe("offline");

      // Verify fresh device stayed online
      const freshAfter = await KioskDeviceModel.findById(freshDevice._id);
      expect(freshAfter?.status).toBe("online");

      // Verify notification in NotificationModel for admin
      const offlineAlert = await Notification.findOne({
        organizationId: testOrg._id,
        recipientUserId: adminUser._id,
        type: "manager_alert",
        channel: "in_app",
        "data.deviceId": `HW-STALE-${ts}`,
        "data.alertType": "terminal_offline",
      });

      expect(offlineAlert).toBeDefined();
      expect(offlineAlert?.title).toContain("Offline Alert");
      expect(offlineAlert?.message).toContain("15 minutes");
      expect(offlineAlert?.priority).toBe("high");
    });
  });

  // =========================================================================
  // REQUIREMENT 2: Tablet Low Battery Detection (<15%)
  // =========================================================================
  describe("2. Tablet Low Battery Alerts (<15%)", () => {
    it("should detect battery levels <15% on tablets and dispatch low battery alerts", async () => {
      // Low battery tablet: 9% battery, not charging
      const lowBatteryTablet = await KioskDeviceModel.create({
        organizationId: testOrg._id,
        deviceId: `HW-TABLET-LOW-${ts}`,
        name: "Forklift Bay Mobile Tablet",
        location: "Warehouse Bay 4",
        status: "online",
        deviceType: "countertop_tablet",
        telemetry: {
          batteryLevel: 9,
          isCharging: false,
        },
        lastHeartbeatAt: new Date(),
        lastSeen: new Date(),
        isDeleted: false,
      });

      // Charging tablet with 10% battery (charging: true -> should not trigger alert)
      const chargingTablet = await KioskDeviceModel.create({
        organizationId: testOrg._id,
        deviceId: `HW-TABLET-CHARGING-${ts}`,
        name: "Docking Station Tablet",
        location: "Breakroom Dock",
        status: "online",
        deviceType: "countertop_tablet",
        telemetry: {
          batteryLevel: 10,
          isCharging: true,
        },
        lastHeartbeatAt: new Date(),
        lastSeen: new Date(),
        isDeleted: false,
      });

      // High battery tablet: 85%
      const fullBatteryTablet = await KioskDeviceModel.create({
        organizationId: testOrg._id,
        deviceId: `HW-TABLET-FULL-${ts}`,
        name: "Inspector Tablet",
        location: "Safety Office",
        status: "online",
        deviceType: "countertop_tablet",
        telemetry: {
          batteryLevel: 85,
          isCharging: false,
        },
        lastHeartbeatAt: new Date(),
        lastSeen: new Date(),
        isDeleted: false,
      });

      const scanResult = await kioskService.scanKioskFleetHealth(testOrg._id.toString());

      expect(scanResult.lowBatteryCount).toBeGreaterThanOrEqual(1);
      const flagged = scanResult.lowBatteryDevices.find((d: any) => d.deviceId === `HW-TABLET-LOW-${ts}`);
      expect(flagged).toBeDefined();
      expect(flagged.batteryLevel).toBe(9);

      // Verify charging tablet was not flagged
      const chargingFlagged = scanResult.lowBatteryDevices.find((d: any) => d.deviceId === `HW-TABLET-CHARGING-${ts}`);
      expect(chargingFlagged).toBeUndefined();

      // Verify full tablet was not flagged
      const fullFlagged = scanResult.lowBatteryDevices.find((d: any) => d.deviceId === `HW-TABLET-FULL-${ts}`);
      expect(fullFlagged).toBeUndefined();

      // Verify low battery notification in DB
      const batteryAlert = await Notification.findOne({
        organizationId: testOrg._id,
        recipientUserId: adminUser._id,
        type: "manager_alert",
        "data.deviceId": `HW-TABLET-LOW-${ts}`,
        "data.alertType": "low_battery",
      });

      expect(batteryAlert).toBeDefined();
      expect(batteryAlert?.title).toContain("Low Battery");
      expect(batteryAlert?.message).toContain("9%");
    });
  });

  // =========================================================================
  // REQUIREMENT 3: Severe Network Latency Detection (>5000ms)
  // =========================================================================
  describe("3. Severe Network Latency Spikes (>5000ms)", () => {
    it("should detect network latency exceeding 5000ms and dispatch latency spike alert", async () => {
      // High latency kiosk: 6400ms
      const highLatencyDevice = await KioskDeviceModel.create({
        organizationId: testOrg._id,
        deviceId: `HW-LATENCY-SPIKE-${ts}`,
        name: "Cold Storage Basement Kiosk",
        location: "Underground Facility B",
        status: "online",
        deviceType: "wall_mount",
        telemetry: {
          networkLatencyMs: 6400,
        },
        lastHeartbeatAt: new Date(),
        lastSeen: new Date(),
        isDeleted: false,
      });

      // Normal latency kiosk: 45ms
      const normalLatencyDevice = await KioskDeviceModel.create({
        organizationId: testOrg._id,
        deviceId: `HW-NORMAL-LATENCY-${ts}`,
        name: "Headquarters Reception",
        location: "Lobby",
        status: "online",
        deviceType: "floor_standing",
        telemetry: {
          networkLatencyMs: 45,
        },
        lastHeartbeatAt: new Date(),
        lastSeen: new Date(),
        isDeleted: false,
      });

      const scanResult = await kioskService.scanKioskFleetHealth(testOrg._id.toString());

      expect(scanResult.latencySpikeCount).toBeGreaterThanOrEqual(1);
      const flagged = scanResult.latencySpikeDevices.find((d: any) => d.deviceId === `HW-LATENCY-SPIKE-${ts}`);
      expect(flagged).toBeDefined();
      expect(flagged.networkLatencyMs).toBe(6400);

      // Verify normal device not flagged
      const normalFlagged = scanResult.latencySpikeDevices.find((d: any) => d.deviceId === `HW-NORMAL-LATENCY-${ts}`);
      expect(normalFlagged).toBeUndefined();

      // Verify notification in DB
      const latencyAlert = await Notification.findOne({
        organizationId: testOrg._id,
        recipientUserId: adminUser._id,
        type: "manager_alert",
        "data.deviceId": `HW-LATENCY-SPIKE-${ts}`,
        "data.alertType": "latency_spike",
      });

      expect(latencyAlert).toBeDefined();
      expect(latencyAlert?.title).toContain("Latency Spike");
      expect(latencyAlert?.message).toContain("6400ms");
    });
  });

  // =========================================================================
  // REQUIREMENT 4: Outbound Multi-Channel Webhook Dispatch
  // =========================================================================
  describe("4. Outbound Webhook Alert Dispatching", () => {
    it("should deliver real-time alert payload to tenant configured webhook URL and record webhook notification", async () => {
      webhookReceivedPayloads = [];

      // Create a device that will trigger an alert
      const offlineAlertDevice = await KioskDeviceModel.create({
        organizationId: testOrg._id,
        deviceId: `HW-WEBHOOK-ALERT-${ts}`,
        name: "Remote Substation Terminal",
        location: "Substation 7",
        status: "online",
        deviceType: "floor_standing",
        lastHeartbeatAt: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
        lastSeen: new Date(Date.now() - 30 * 60 * 1000),
        isDeleted: false,
      });

      await kioskService.scanKioskFleetHealth(testOrg._id.toString());

      // Give webhook network delivery tick to process
      await new Promise((r) => setTimeout(r, 200));

      // Verify mock webhook received outbound HTTP POST
      expect(webhookReceivedPayloads.length).toBeGreaterThanOrEqual(1);
      const offlineWebhook = webhookReceivedPayloads.find(
        (p: any) => p.alertType === "terminal_offline" && p.device?.deviceId === `HW-WEBHOOK-ALERT-${ts}`
      );
      expect(offlineWebhook).toBeDefined();
      expect(offlineWebhook.event).toBe("kiosk_fleet_alert");
      expect(offlineWebhook.severity).toBe("high");
      expect(offlineWebhook.device.name).toBe("Remote Substation Terminal");

      // Verify a Notification entry with channel: 'webhook' was persisted for auditability
      const webhookNotifRecord = await Notification.findOne({
        organizationId: testOrg._id,
        channel: "webhook",
        "data.deviceId": `HW-WEBHOOK-ALERT-${ts}`,
      });
      expect(webhookNotifRecord).toBeDefined();
      expect(webhookNotifRecord?.data?.webhookUrl).toBe(`http://127.0.0.1:${webhookPort}/kiosk-alerts`);
    });
  });

  // =========================================================================
  // REQUIREMENT 5: Fastify Sentinel Plugin & Lifecycle
  // =========================================================================
  describe("5. Fastify Kiosk Sentinel Plugin", () => {
    it("should decorate Fastify app instance with kioskSentinel controller and allow execution", async () => {
      expect(app.kioskSentinel).toBeDefined();
      expect(typeof app.kioskSentinel?.runSentinel).toBe("function");
      expect(typeof app.kioskSentinel?.start).toBe("function");
      expect(typeof app.kioskSentinel?.stop).toBe("function");
      expect(app.kioskSentinel?.getIntervalMs()).toBe(5 * 60 * 1000);

      // Trigger runSentinel via Fastify decorator
      const res = await app.kioskSentinel?.runSentinel(testOrg._id.toString());
      expect(res).toBeDefined();
      expect(res.scannedAt).toBeInstanceOf(Date);
      expect(typeof res.offlineCount).toBe("number");
      expect(typeof res.lowBatteryCount).toBe("number");
      expect(typeof res.latencySpikeCount).toBe("number");
    });
  });

  // =========================================================================
  // REQUIREMENT 6: Manual Trigger via Admin REST Endpoint
  // =========================================================================
  describe("6. Admin REST Endpoint (POST /api/v1/kiosk/devices/sentinel/scan)", () => {
    it("should allow an authenticated administrator to manually trigger fleet health scan", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/sentinel/scan",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          offlineThresholdMinutes: 15,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.offlineCount).toBeDefined();
      expect(body.data.lowBatteryCount).toBeDefined();
      expect(body.data.latencySpikeCount).toBeDefined();
    });

    it("should reject unauthenticated request with 401", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/sentinel/scan",
        payload: {},
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
