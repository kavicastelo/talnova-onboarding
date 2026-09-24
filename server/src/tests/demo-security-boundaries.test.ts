import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { closeDemoConnection } from "../modules/demo/database/demo-connection.js";
import {
  getDemoTenantModel,
  getDemoUserModel,
  getDemoSessionModel,
} from "../modules/demo/models/index.js";
import { hashPassword } from "../utils/crypto.js";
import { DemoResetService } from "../modules/demo/services/demo-reset.service.js";

describe("Demo Security Boundaries — Penetration & Hardening Tests", () => {
  let app: any;
  let tenant1Id: mongoose.Types.ObjectId;
  let tenant2Id: mongoose.Types.ObjectId;
  let user1Token: string;
  let user2Token: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);

    const DemoTenant = getDemoTenantModel();
    const DemoUser = getDemoUserModel();
    const passHash = await hashPassword("SecurePass123!");

    const t1 = await DemoTenant.create({
      name: "Security Company 1",
      slug: `sec-comp-1-${Date.now()}`,
      domain: "sec1.com",
      contactEmail: "admin@sec1.com",
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 86400000),
      allowedFeatures: ["checklist_tasks"],
    });
    tenant1Id = t1._id as mongoose.Types.ObjectId;

    const t2 = await DemoTenant.create({
      name: "Security Company 2",
      slug: `sec-comp-2-${Date.now()}`,
      domain: "sec2.com",
      contactEmail: "admin@sec2.com",
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 86400000),
      allowedFeatures: ["checklist_tasks"],
    });
    tenant2Id = t2._id as mongoose.Types.ObjectId;

    const u1 = await DemoUser.create({
      demoTenantId: tenant1Id,
      email: `u1-${Date.now()}@sec1.com`,
      fullName: "User 1",
      role: "demo_employee",
      passwordHash: passHash,
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 86400000),
    });

    const u2 = await DemoUser.create({
      demoTenantId: tenant2Id,
      email: `u2-${Date.now()}@sec2.com`,
      fullName: "User 2",
      role: "demo_employee",
      passwordHash: passHash,
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 86400000),
    });

    const l1 = await app.inject({
      method: "POST",
      url: "/api/v1/demo/auth/login",
      payload: { email: u1.email, password: "SecurePass123!" },
    });
    user1Token = l1.json().data.token;

    const l2 = await app.inject({
      method: "POST",
      url: "/api/v1/demo/auth/login",
      payload: { email: u2.email, password: "SecurePass123!" },
    });
    user2Token = l2.json().data.token;
  });

  afterAll(async () => {
    const DemoTenant = getDemoTenantModel();
    const DemoUser = getDemoUserModel();
    const DemoSession = getDemoSessionModel();

    await Promise.all([
      DemoTenant.deleteMany({ _id: { $in: [tenant1Id, tenant2Id] } }),
      DemoUser.deleteMany({ demoTenantId: { $in: [tenant1Id, tenant2Id] } }),
      DemoSession.deleteMany({ demoTenantId: { $in: [tenant1Id, tenant2Id] } }),
    ]);

    await closeDemoConnection(app.log);
    await disconnectDatabase(app.log);
  });

  it("1. Token Tampering: Rejects forged or corrupted demo tokens", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/demo/auth/me",
      headers: { Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.forged.payload" },
    });

    expect(res.statusCode).toBe(401);
  });

  it("2. Production Token Injection: Rejects valid production JWTs on demo routes", async () => {
    // Generate token without isDemo: true
    const prodToken = app.jwt.sign({
      userId: new mongoose.Types.ObjectId().toString(),
      organizationId: new mongoose.Types.ObjectId().toString(),
      role: "admin",
      // isDemo omitted!
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/demo/auth/me",
      headers: { Authorization: `Bearer ${prodToken}` },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("INVALID_DEMO_TOKEN");
  });

  it("3. IDOR Protection: User 1 cannot access or modify User 2's tasks even with forged params", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/demo/tasks?tenantId=${tenant2Id.toString()}`,
      headers: { Authorization: `Bearer ${user1Token}` },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("DEMO_TENANT_ISOLATION_VIOLATION");
  });

  it("4. Direct API bypass: Administrative endpoints reject demo callers", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/demo/admin/danger-zone",
      headers: { Authorization: `Bearer ${user1Token}` },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("DEMO_ACTION_RESTRICTED");
  });
});
