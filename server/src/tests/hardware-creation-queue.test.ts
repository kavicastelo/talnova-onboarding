import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Task from "../modules/tasks/models/task.model.js";
import Organization from "../modules/organizations/models/organization.model.js";

describe("Hardware Task Creation & IT Hardware Queue E2E Test", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let adminId: mongoose.Types.ObjectId;
  let employeeId: mongoose.Types.ObjectId;
  let adminToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    adminId = new mongoose.Types.ObjectId();
    employeeId = new mongoose.Types.ObjectId();

    testOrg = await Organization.create({
      name: "Hardware Test Org",
      slug: `hw-test-${Date.now()}`,
      isActive: true,
      subscriptionPlan: "enterprise",
      createdBy: adminId,
      featureFlags: {
        checklist_tasks: true,
      },
    });

    await User.create([
      {
        _id: adminId,
        organizationId: testOrg._id,
        auth: { email: `admin-${Date.now()}@hardware.test`, passwordHash: "dummy" },
        profile: { firstName: "IT", lastName: "Admin" },
        permissions: { role: "it_admin" },
        roles: ["it_admin"],
        isDeleted: false,
      },
      {
        _id: employeeId,
        organizationId: testOrg._id,
        auth: { email: `emp-${Date.now()}@hardware.test`, passwordHash: "dummy" },
        profile: { firstName: "New", lastName: "Hire" },
        permissions: { role: "employee" },
        roles: ["employee"],
        isDeleted: false,
      },
    ]);

    adminToken = app.jwt.sign({
      userId: adminId.toString(),
      organizationId: testOrg._id.toString(),
      role: "it_admin",
      roles: ["it_admin"],
    });
  });

  afterAll(async () => {
    await Task.deleteMany({ organizationId: testOrg._id });
    await User.deleteMany({ organizationId: testOrg._id });
    await Organization.deleteOne({ _id: testOrg._id });
  });

  it("should create an operational task with full hardware metadata and persist it", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/tasks",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        title: "Provision MacBook Pro M3 & Security Fob",
        description: "Configure MDM profile and courier dispatch",
        assignedToUserId: adminId.toString(),
        employeeId: employeeId.toString(),
        category: "equipment",
        stage: "preboarding",
        priority: "high",
        hardwareMetadata: {
          deviceType: "laptop",
          serialNumber: "MBP-2026-X99",
          assetTag: "TAL-AST-7711",
          courierProvider: "FedEx Express",
          courierTrackingUrl: "https://track.fedex.com/tracking?id=998877",
          mdmStatus: "pending_dispatch",
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.title).toBe("Provision MacBook Pro M3 & Security Fob");
    expect(body.data.hardwareMetadata).toBeDefined();
    expect(body.data.hardwareMetadata.deviceType).toBe("laptop");
    expect(body.data.hardwareMetadata.serialNumber).toBe("MBP-2026-X99");
    expect(body.data.hardwareMetadata.assetTag).toBe("TAL-AST-7711");
    expect(body.data.hardwareMetadata.courierProvider).toBe("FedEx Express");
    expect(body.data.hardwareMetadata.courierTrackingUrl).toBe("https://track.fedex.com/tracking?id=998877");
    expect(body.data.hardwareMetadata.mdmStatus).toBe("pending_dispatch");

    // Check DB directly
    const persisted = await Task.findById(body.data._id);
    expect(persisted).not.toBeNull();
    expect(persisted?.hardwareMetadata?.serialNumber).toBe("MBP-2026-X99");
  });

  it("should retrieve hardware tasks when querying with isHardwareQueue=true", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/tasks?isHardwareQueue=true",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);

    const hwTask = body.data.find((t: any) => t.hardwareMetadata?.serialNumber === "MBP-2026-X99");
    expect(hwTask).toBeDefined();
    expect(hwTask.hardwareMetadata.deviceType).toBe("laptop");
  });
});
