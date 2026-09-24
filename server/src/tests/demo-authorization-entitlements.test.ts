import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { closeDemoConnection } from "../modules/demo/database/demo-connection.js";
import {
  getDemoTenantModel,
  getDemoUserModel,
  getDemoTaskModel,
  getDemoDocumentModel,
  getDemoEmailLogModel,
} from "../modules/demo/models/index.js";
import { hashPassword } from "../utils/crypto.js";

describe("Demo Environment — Feature Entitlements, Isolation & High-Risk Guards", () => {
  let app: any;
  let tenantAId: mongoose.Types.ObjectId;
  let tenantBId: mongoose.Types.ObjectId;
  let userAToken: string;
  const pass = "DemoPass123!";

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);

    const DemoTenant = getDemoTenantModel();
    const DemoUser = getDemoUserModel();
    const DemoTask = getDemoTaskModel();

    // Tenant A: Only entitled to "checklist_tasks", NOT "digital_signatures"
    const tenantA = await DemoTenant.create({
      name: "Tenant Alpha",
      slug: `tenant-a-${Date.now()}`,
      domain: "alpha.com",
      contactEmail: "admin@alpha.com",
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 86400000),
      allowedFeatures: ["checklist_tasks"], // Notice: no digital_signatures!
    });
    tenantAId = tenantA._id as mongoose.Types.ObjectId;

    // Tenant B: Separate isolated tenant
    const tenantB = await DemoTenant.create({
      name: "Tenant Beta",
      slug: `tenant-b-${Date.now()}`,
      domain: "beta.com",
      contactEmail: "admin@beta.com",
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 86400000),
      allowedFeatures: ["checklist_tasks", "digital_signatures"],
    });
    tenantBId = tenantB._id as mongoose.Types.ObjectId;

    const passHash = await hashPassword(pass);
    const userA = await DemoUser.create({
      demoTenantId: tenantAId,
      email: `usera-${Date.now()}@alpha.com`,
      fullName: "User Alpha",
      role: "demo_employee",
      passwordHash: passHash,
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 86400000),
    });

    // Create a task for Tenant A
    await DemoTask.create({
      demoTenantId: tenantAId,
      title: "Alpha Initial Task",
      description: "Complete setup",
      category: "hr_compliance",
      status: "pending",
      dueDays: 3,
    });

    // Login user A to get token
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/demo/auth/login",
      payload: { email: userA.email, password: pass },
    });
    userAToken = loginRes.json().data.token;
  });

  afterAll(async () => {
    const DemoTenant = getDemoTenantModel();
    const DemoUser = getDemoUserModel();
    const DemoTask = getDemoTaskModel();
    const DemoDocument = getDemoDocumentModel();
    const DemoEmailLog = getDemoEmailLogModel();

    await Promise.all([
      DemoTenant.deleteMany({ _id: { $in: [tenantAId, tenantBId] } }),
      DemoUser.deleteMany({ demoTenantId: { $in: [tenantAId, tenantBId] } }),
      DemoTask.deleteMany({ demoTenantId: { $in: [tenantAId, tenantBId] } }),
      DemoDocument.deleteMany({ demoTenantId: { $in: [tenantAId, tenantBId] } }),
      DemoEmailLog.deleteMany({ demoTenantId: { $in: [tenantAId, tenantBId] } }),
    ]);

    await closeDemoConnection(app.log);
    await disconnectDatabase(app.log);
  });

  it("1. Allows access to entitled feature ('checklist_tasks') with attribution headers", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/demo/tasks",
      headers: { Authorization: `Bearer ${userAToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["x-demo-environment"]).toBe("true");
    expect(res.headers["x-demo-attribution"]).toBeDefined();

    const data = res.json().data;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].title).toBe("Alpha Initial Task");
  });

  it("2. Blocks unentitled feature ('digital_signatures') with friendly guided demo status", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/demo/documents",
      headers: { Authorization: `Bearer ${userAToken}` },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.code).toBe("DEMO_FEATURE_RESTRICTED");
    expect(body.message).toContain("available in a full guided demonstration");
    expect(body.details.guidedDemoAvailable).toBe(true);
  });

  it("3. Cross-Tenant Violation: Rejects access when trying to query another tenant's data", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/demo/tasks?tenantId=${tenantBId.toString()}`,
      headers: { Authorization: `Bearer ${userAToken}` },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("DEMO_TENANT_ISOLATION_VIOLATION");
  });

  it("4. Blocks administrative & high-risk routes in demo mode", async () => {
    const res1 = await app.inject({
      method: "GET",
      url: "/api/v1/demo/admin/settings",
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    expect(res1.statusCode).toBe(403);
    expect(res1.json().code).toBe("DEMO_ACTION_RESTRICTED");

    const res2 = await app.inject({
      method: "POST",
      url: "/api/v1/demo/api-keys/generate",
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    expect(res2.statusCode).toBe(403);
    expect(res2.json().code).toBe("DEMO_ACTION_RESTRICTED");
  });

  it("5. Captures notifications into isolated email sink without outbound transmission", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/demo/inbox/simulate",
      headers: { Authorization: `Bearer ${userAToken}` },
      payload: {
        subject: "Isolation Sink Test Email",
        htmlContent: "<p>Isolated demo message content</p>",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.subject).toBe("Isolation Sink Test Email");

    // Fetch inbox
    const inboxRes = await app.inject({
      method: "GET",
      url: "/api/v1/demo/inbox",
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    expect(inboxRes.statusCode).toBe(200);
    const inbox = inboxRes.json().data;
    expect(inbox.some((m: any) => m.subject === "Isolation Sink Test Email")).toBe(true);
  });

  it("6. Generates controlled watermarked synthetic export", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/demo/export",
      headers: { Authorization: `Bearer ${userAToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.watermark).toContain("SYNTHETIC DEMO DATA ONLY");
    expect(body.sampleRecords).toBeDefined();
    expect(body.notice).toContain("Production database records are completely isolated");
  });
});
