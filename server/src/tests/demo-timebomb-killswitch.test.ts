import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { closeDemoConnection } from "../modules/demo/database/demo-connection.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import { User } from "../modules/auth/models/user.model.js";
import { hashPassword } from "../utils/crypto.js";
import {
  getDemoTenantModel,
  getDemoUserModel,
  getDemoSessionModel,
  getDemoRiskAlertModel,
} from "../modules/demo/models/index.js";
import { demoSessionService } from "../modules/demo/services/demo-session.service.js";

describe("Phase 5: Time-Bombed Invites, Expiring Sessions & Remote Killswitch", () => {
  let app: any;
  let superAdminToken: string;
  let regularEmployeeToken: string;
  let platformOrg: any;
  let superAdminUser: any;
  let regularUser: any;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);

    platformOrg = await Organization.create({
      name: "Platform Management HQ",
      slug: `platform-hq-p5-${Date.now()}`,
      createdBy: new mongoose.Types.ObjectId(),
      isDeleted: false,
    });

    const passHash = await hashPassword("AdminPass123!");

    superAdminUser = await User.create({
      organizationId: platformOrg._id,
      auth: {
        email: `superadmin-p5-${Date.now()}@platform.com`,
        passwordHash: passHash,
      },
      profile: { firstName: "Chief", lastName: "Admin", fullName: "Chief Admin" },
      permissions: { role: "super_admin", customRoles: [] },
      employment: { employmentType: "full_time", status: "active" },
    });

    regularUser = await User.create({
      organizationId: platformOrg._id,
      auth: {
        email: `employee-p5-${Date.now()}@platform.com`,
        passwordHash: passHash,
      },
      profile: { firstName: "Regular", lastName: "Staff", fullName: "Regular Staff" },
      permissions: { role: "employee", customRoles: [] },
      employment: { employmentType: "full_time", status: "active" },
    });

    superAdminToken = app.jwt.sign({
      userId: superAdminUser._id.toString(),
      organizationId: platformOrg._id.toString(),
      role: "super_admin",
      tokenVersion: 1,
    });

    regularEmployeeToken = app.jwt.sign({
      userId: regularUser._id.toString(),
      organizationId: platformOrg._id.toString(),
      role: "employee",
      tokenVersion: 1,
    });
  });

  afterAll(async () => {
    await Organization.deleteOne({ _id: platformOrg._id });
    await User.deleteMany({ _id: { $in: [superAdminUser._id, regularUser._id] } });
    await closeDemoConnection(app.log);
    await disconnectDatabase(app.log);
  });

  describe("1. Time-Limited Signed Invite Links", () => {
    it("rejects non-super-admins from generating invite links", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/super-admin/demo/invites",
        headers: { Authorization: `Bearer ${regularEmployeeToken}` },
        payload: {
          prospectEmail: "hacker@evilcorp.com",
          prospectCompany: "Evil Corp",
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe("FORBIDDEN");
    });

    it("generates a signed invite token and URL with custom TTL", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/super-admin/demo/invites",
        headers: { Authorization: `Bearer ${superAdminToken}` },
        payload: {
          prospectEmail: "prospect@cyberdyne.com",
          prospectCompany: "Cyberdyne Systems",
          assignedPersona: "admin",
          durationHours: 24,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.token).toBeDefined();
      expect(body.data.inviteUrl).toContain("/invite?token=");
      expect(body.data.expiresAt).toBeDefined();
    });

    it("successfully redeems valid invite token and bootstraps demo session", async () => {
      // 1. Generate invite
      const inviteRes = await app.inject({
        method: "POST",
        url: "/api/v1/super-admin/demo/invites",
        headers: { Authorization: `Bearer ${superAdminToken}` },
        payload: {
          prospectEmail: `eval-${Date.now()}@weyland-yutani.com`,
          prospectCompany: "Weyland Yutani Corp",
          assignedPersona: "manager",
          durationHours: 2,
        },
      });
      const inviteToken = inviteRes.json().data.token;

      // 2. Verify invite endpoint
      const verifyRes = await app.inject({
        method: "GET",
        url: `/api/v1/demo/auth/invite/verify?token=${inviteToken}`,
      });
      expect(verifyRes.statusCode).toBe(200);
      expect(verifyRes.json().data.valid).toBe(true);
      expect(verifyRes.json().data.prospectCompany).toBe("Weyland Yutani Corp");

      // 3. Redeem invite
      const redeemRes = await app.inject({
        method: "POST",
        url: "/api/v1/demo/auth/invite/redeem",
        payload: { token: inviteToken },
      });

      expect(redeemRes.statusCode).toBe(200);
      const redeemBody = redeemRes.json();
      expect(redeemBody.success).toBe(true);
      expect(redeemBody.data.token).toBeDefined();
      expect(redeemBody.data.user.role).toBe("demo_manager");
      expect(redeemBody.data.session.sessionId).toBeDefined();
      expect(redeemBody.data.tenant.name).toBe("Weyland Yutani Corp");
    });

    it("rejects an expired invite token with exact branded message", async () => {
      // Generate an already-expired token with past exp timestamp
      const expiredToken = app.jwt.sign({
        prospectEmail: "late@prospect.com",
        prospectCompany: "Late Corp",
        assignedPersona: "admin",
        isDemoInvite: true,
        exp: Math.floor(Date.now() / 1000) - 60,
      });

      // Verify endpoint
      const verifyRes = await app.inject({
        method: "GET",
        url: `/api/v1/demo/auth/invite/verify?token=${expiredToken}`,
      });
      expect(verifyRes.statusCode).toBe(401);
      expect(verifyRes.json().code).toBe("INVITE_EXPIRED");
      expect(verifyRes.json().message).toBe(
        "This demonstration link has expired. Request an extension from the Talnova team"
      );

      // Redeem endpoint
      const redeemRes = await app.inject({
        method: "POST",
        url: "/api/v1/demo/auth/invite/redeem",
        payload: { token: expiredToken },
      });
      expect(redeemRes.statusCode).toBe(401);
      expect(redeemRes.json().code).toBe("INVITE_EXPIRED");
      expect(redeemRes.json().message).toBe(
        "This demonstration link has expired. Request an extension from the Talnova team"
      );
    });
  });

  describe("2. Session Heartbeat & Remote Killswitch", () => {
    let prospectSessionToken: string;
    let prospectSessionId: string;

    beforeAll(async () => {
      const inviteRes = await app.inject({
        method: "POST",
        url: "/api/v1/super-admin/demo/invites",
        headers: { Authorization: `Bearer ${superAdminToken}` },
        payload: {
          prospectEmail: `killswitch-${Date.now()}@target.com`,
          prospectCompany: "Killswitch Target LLC",
          assignedPersona: "admin",
          durationHours: 24,
        },
      });
      const inviteToken = inviteRes.json().data.token;

      const redeemRes = await app.inject({
        method: "POST",
        url: "/api/v1/demo/auth/invite/redeem",
        payload: { token: inviteToken },
      });

      prospectSessionToken = redeemRes.json().data.token;
      prospectSessionId = redeemRes.json().data.session.sessionId;
    });

    it("returns active: true and command: CONTINUE for normal heartbeat", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/demo/auth/heartbeat",
        headers: { Authorization: `Bearer ${prospectSessionToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.active).toBe(true);
      expect(body.data.command).toBe("CONTINUE");
    });

    it("remotely freezes session when Super Admin invokes Freeze", async () => {
      // Super Admin triggers remote freeze
      const freezeRes = await app.inject({
        method: "POST",
        url: `/api/v1/super-admin/demo/sessions/${prospectSessionId}/freeze`,
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      expect(freezeRes.statusCode).toBe(200);
      expect(freezeRes.json().data.killCommand).toBe("FREEZE");

      // Heartbeat now returns active: false and command: FREEZE
      const heartbeatRes = await app.inject({
        method: "POST",
        url: "/api/v1/demo/auth/heartbeat",
        headers: { Authorization: `Bearer ${prospectSessionToken}` },
      });

      expect(heartbeatRes.statusCode).toBe(200);
      const hbBody = heartbeatRes.json();
      expect(hbBody.data.active).toBe(false);
      expect(hbBody.data.command).toBe("FREEZE");
    });

    it("remotely terminates session when Super Admin revokes it", async () => {
      // Create fresh session
      const inviteRes = await app.inject({
        method: "POST",
        url: "/api/v1/super-admin/demo/invites",
        headers: { Authorization: `Bearer ${superAdminToken}` },
        payload: {
          prospectEmail: `terminate-${Date.now()}@target.com`,
          prospectCompany: "Terminate Target LLC",
          assignedPersona: "admin",
          durationHours: 24,
        },
      });
      const inviteToken = inviteRes.json().data.token;

      const redeemRes = await app.inject({
        method: "POST",
        url: "/api/v1/demo/auth/invite/redeem",
        payload: { token: inviteToken },
      });

      const sessionToken = redeemRes.json().data.token;
      const sessionId = redeemRes.json().data.session.sessionId;

      // Revoke session
      const revokeRes = await app.inject({
        method: "DELETE",
        url: `/api/v1/super-admin/demo/sessions/${sessionId}`,
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      expect(revokeRes.statusCode).toBe(200);

      // Heartbeat now returns active: false and command: TERMINATE
      const heartbeatRes = await app.inject({
        method: "POST",
        url: "/api/v1/demo/auth/heartbeat",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      expect(heartbeatRes.statusCode).toBe(200);
      const hbBody = heartbeatRes.json();
      expect(hbBody.data.active).toBe(false);
      expect(hbBody.data.command).toBe("TERMINATE");
    });
  });

  describe("3. Concurrent Anomaly Enforcement", () => {
    it("freezes session and creates security alert when accessed from differing IP addresses", async () => {
      // 1. Create a session initialized from IP 198.51.100.1
      const inviteRes = await app.inject({
        method: "POST",
        url: "/api/v1/super-admin/demo/invites",
        headers: { Authorization: `Bearer ${superAdminToken}` },
        payload: {
          prospectEmail: `concurrent-${Date.now()}@target.com`,
          prospectCompany: "Anomaly Target LLC",
          assignedPersona: "admin",
          durationHours: 24,
        },
      });
      const inviteToken = inviteRes.json().data.token;

      const redeemRes = await app.inject({
        method: "POST",
        url: "/api/v1/demo/auth/invite/redeem",
        headers: { "x-forwarded-for": "198.51.100.1" },
        payload: { token: inviteToken },
      });

      const sessionToken = redeemRes.json().data.token;
      const sessionId = redeemRes.json().data.session.sessionId;

      // 2. Validate session from the same IP (198.51.100.1) -> Passes
      const validCheck = await demoSessionService.validateSession(sessionId, "198.51.100.1");
      expect(validCheck.isValid).toBe(true);

      // 3. Validate session from a DIFFERENT IP (203.0.113.42) -> Anomaly triggered!
      await expect(
        demoSessionService.validateSession(sessionId, "203.0.113.42")
      ).rejects.toThrow();

      // 4. Verify session state in DB is marked frozen and invalid
      const DemoSession = getDemoSessionModel();
      const updatedSession = await DemoSession.findOne({ sessionId });
      expect(updatedSession?.isValid).toBe(false);
      expect(updatedSession?.killCommand).toBe("FREEZE");
      expect(updatedSession?.suspiciousReason).toContain("Concurrent anomaly detected");

      // 5. Verify a CRITICAL security alert was logged
      const DemoRiskAlert = getDemoRiskAlertModel();
      const alert = await DemoRiskAlert.findOne({
        sessionId,
        alertType: "CONCURRENT_SESSION_ANOMALY",
      });
      expect(alert).toBeDefined();
      expect(alert?.severity).toBe("CRITICAL");
    });
  });
});
