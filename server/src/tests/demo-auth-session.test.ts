import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { closeDemoConnection } from "../modules/demo/database/demo-connection.js";
import {
  getDemoTenantModel,
  getDemoUserModel,
  getDemoSessionModel,
  getDemoRiskAlertModel,
} from "../modules/demo/models/index.js";
import { hashPassword } from "../utils/crypto.js";
import { demoSessionService } from "../modules/demo/services/demo-session.service.js";

describe("Demo Environment — Attributable Auth, Sessions & Anomaly Detection", () => {
  let app: any;
  let tenantId: mongoose.Types.ObjectId;
  let testUserId: mongoose.Types.ObjectId;
  const testEmail = `auth-test-${Date.now()}@acme-demo.com`;
  const testPass = "DemoSecret123!";

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);

    const DemoTenant = getDemoTenantModel();
    const DemoUser = getDemoUserModel();

    const tenant = await DemoTenant.create({
      name: "Auth Test Corp",
      slug: `auth-corp-${Date.now()}`,
      domain: "auth-test.com",
      contactEmail: "admin@auth-test.com",
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 86400000),
      sessionLimit: 1,
      allowedFeatures: ["checklist_tasks", "journey_templates"],
    });
    tenantId = tenant._id as mongoose.Types.ObjectId;

    const passHash = await hashPassword(testPass);
    const user = await DemoUser.create({
      demoTenantId: tenantId,
      email: testEmail,
      fullName: "Auth Test User",
      role: "demo_employee",
      passwordHash: passHash,
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 86400000),
    });
    testUserId = user._id as mongoose.Types.ObjectId;
  });

  afterAll(async () => {
    const DemoTenant = getDemoTenantModel();
    const DemoUser = getDemoUserModel();
    const DemoSession = getDemoSessionModel();
    const DemoRiskAlert = getDemoRiskAlertModel();

    await Promise.all([
      DemoTenant.deleteOne({ _id: tenantId }),
      DemoUser.deleteOne({ _id: testUserId }),
      DemoSession.deleteMany({ demoTenantId: tenantId }),
      DemoRiskAlert.deleteMany({ demoTenantId: tenantId }),
    ]);

    await closeDemoConnection(app.log);
    await disconnectDatabase(app.log);
  });

  it("1. Successfully authenticates valid attributable user and returns session and watermark", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/demo/auth/login",
      payload: {
        email: testEmail,
        password: testPass,
        deviceInfo: "Chrome on macOS",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.token).toBeDefined();
    expect(body.data.user.email).toBe(testEmail);
    expect(body.data.watermark.text).toContain("AUTH TEST CORP");
    expect(body.data.watermark.text).toContain("DEMO");
    expect(body.data.session.sessionId).toBeDefined();
  });

  it("2. Rejects incorrect password with 401 UNAUTHORIZED", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/demo/auth/login",
      payload: {
        email: testEmail,
        password: "WrongPassword999!",
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it("3. Detects concurrent session anomaly on new device/IP and creates Risk Alert", async () => {
    const DemoRiskAlert = getDemoRiskAlertModel();

    // First login from IP 1.1.1.1
    const res1 = await app.inject({
      method: "POST",
      url: "/api/v1/demo/auth/login",
      payload: { email: testEmail, password: testPass, deviceInfo: "Device A" },
      headers: { "x-forwarded-for": "10.0.0.1" },
    });
    expect(res1.statusCode).toBe(200);

    // Second login from DIFFERENT IP 10.0.0.2
    const res2 = await app.inject({
      method: "POST",
      url: "/api/v1/demo/auth/login",
      payload: { email: testEmail, password: testPass, deviceInfo: "Device B" },
      headers: { "x-forwarded-for": "10.0.0.2" },
    });
    expect(res2.statusCode).toBe(200);
    const body2 = res2.json();

    // Verify session flagged as SUSPICIOUS
    expect(body2.data.session.riskStatus).toBe("SUSPICIOUS");

    // Verify DemoRiskAlert was recorded
    const alert = await DemoRiskAlert.findOne({
      demoUserId: testUserId,
      alertType: "CONCURRENT_SESSIONS",
    });
    expect(alert).toBeDefined();
    expect(alert?.severity).toBe("HIGH");
  });

  it("4. Rejects request when session is terminated by Super Admin", async () => {
    // Login to get a valid token
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/demo/auth/login",
      payload: { email: testEmail, password: testPass },
    });
    const { token, session } = loginRes.json().data;

    // Verify access works
    const check1 = await app.inject({
      method: "GET",
      url: "/api/v1/demo/auth/me",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(check1.statusCode).toBe(200);

    // Terminate session
    await demoSessionService.terminateSession(session.sessionId, "Super Admin Integration Test");

    // Verify subsequent access is rejected
    const check2 = await app.inject({
      method: "GET",
      url: "/api/v1/demo/auth/me",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(check2.statusCode).toBe(401);
    expect(check2.json().code).toBe("SESSION_REVOKED");
  });

  it("5. Rejects login if demo user account is suspended or expired", async () => {
    const DemoUser = getDemoUserModel();
    await DemoUser.updateOne({ _id: testUserId }, { status: "SUSPENDED" });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/demo/auth/login",
      payload: { email: testEmail, password: testPass },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("DEMO_USER_SUSPENDED");

    // Restore to active
    await DemoUser.updateOne({ _id: testUserId }, { status: "ACTIVE" });
  });

  it("6. Rejects login if demo tenant company is revoked or suspended", async () => {
    const DemoTenant = getDemoTenantModel();
    await DemoTenant.updateOne({ _id: tenantId }, { status: "REVOKED" });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/demo/auth/login",
      payload: { email: testEmail, password: testPass },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("DEMO_TENANT_SUSPENDED");

    // Restore to active
    await DemoTenant.updateOne({ _id: tenantId }, { status: "ACTIVE" });
  });
});
