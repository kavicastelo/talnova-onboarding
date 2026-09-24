import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { closeDemoConnection } from "../modules/demo/database/demo-connection.js";
import {
  getDemoTenantModel,
  getDemoUserModel,
  getDemoFeatureUsageModel,
} from "../modules/demo/models/index.js";
import { hashPassword } from "../utils/crypto.js";

describe("Demo Environment — Feature Usage Telemetry & Analytics", () => {
  let app: any;
  let tenantId: mongoose.Types.ObjectId;
  let userToken: string;
  let superAdminToken: string;
  const pass = "DemoPass123!";

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);

    const DemoTenant = getDemoTenantModel();
    const DemoUser = getDemoUserModel();

    const tenant = await DemoTenant.create({
      name: "Telemetry Test Corp",
      slug: `telemetry-corp-${Date.now()}`,
      domain: "telemetry.com",
      contactEmail: "admin@telemetry.com",
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 86400000),
      allowedFeatures: ["checklist_tasks", "journey_templates"],
    });
    tenantId = tenant._id as mongoose.Types.ObjectId;

    const passHash = await hashPassword(pass);
    const user = await DemoUser.create({
      demoTenantId: tenantId,
      email: `evaluator-${Date.now()}@telemetry.com`,
      fullName: "Evaluator Smith",
      role: "demo_admin",
      passwordHash: passHash,
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 86400000),
    });

    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/demo/auth/login",
      payload: {
        email: user.email,
        password: pass,
        deviceInfo: "Vitest Browser Agent",
      },
    });
    userToken = loginRes.json().data.token;

    // Super Admin token
    superAdminToken = app.jwt.sign({
      id: new mongoose.Types.ObjectId().toString(),
      email: "superadmin@talnova.com",
      role: "super_admin",
    });
  });

  afterAll(async () => {
    await closeDemoConnection(app.log);
    await disconnectDatabase(app.log);
  });

  it("1. Ingests demo feature telemetry event successfully", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/demo/telemetry",
      headers: {
        authorization: `Bearer ${userToken}`,
      },
      payload: {
        featureKey: "journey_templates",
        route: "/demo/journeys",
        action: "view",
        status: "ALLOWED",
        durationSeconds: 15,
        metadata: { journeyId: "eng-roadmap-30" },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();

    const DemoFeatureUsage = getDemoFeatureUsageModel();
    const recorded = await DemoFeatureUsage.findById(body.data.id);
    expect(recorded).not.toBeNull();
    expect(recorded?.featureKey).toBe("journey_templates");
    expect(recorded?.durationSeconds).toBe(15);
    expect(recorded?.status).toBe("ALLOWED");
  });

  it("2. Records restricted feature attempt telemetry with Upgrade Intent signal", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/demo/telemetry",
      headers: {
        authorization: `Bearer ${userToken}`,
      },
      payload: {
        featureKey: "advanced_hris_sync",
        route: "/demo/settings/integrations",
        action: "restricted_attempt",
        status: "RESTRICTED",
        metadata: { attemptedAction: "Connect Workday" },
      },
    });

    expect(res.statusCode).toBe(201);
    const DemoFeatureUsage = getDemoFeatureUsageModel();
    const restricted = await DemoFeatureUsage.findOne({ featureKey: "advanced_hris_sync", status: "RESTRICTED" });
    expect(restricted).not.toBeNull();
    expect(restricted?.action).toBe("restricted_attempt");
    expect(restricted?.companyName).toBe("Telemetry Test Corp");
  });

  it("3. Super Admin retrieves aggregated feature usage and upgrade intent signals", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/demo/telemetry/analytics",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.totalEvents).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(body.data.topFeatures)).toBe(true);
    expect(Array.isArray(body.data.restrictedAttempts)).toBe(true);

    const restrictedSignal = body.data.restrictedAttempts.find(
      (r: any) => r.feature === "advanced_hris_sync"
    );
    expect(restrictedSignal).toBeDefined();
    expect(restrictedSignal.count).toBeGreaterThanOrEqual(1);
  });

  it("4. Rejects telemetry access when unauthenticated or invalid token provided", async () => {
    const unauthedRes = await app.inject({
      method: "POST",
      url: "/api/v1/demo/telemetry",
      payload: {
        featureKey: "journey_templates",
        route: "/demo/journeys",
      },
    });
    expect(unauthedRes.statusCode).toBe(401);

    const superAdminUnauthed = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/demo/telemetry/analytics",
    });
    expect(superAdminUnauthed.statusCode).toBe(401);
  });
});
