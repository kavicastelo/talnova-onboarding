import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import Task from "../modules/tasks/models/task.model.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import itHardwareService from "../modules/tasks/services/it-hardware.service.js";

describe("Phase 8 — IT Ops Hardware Provisioning & MDM Lifecycle Test Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let otherOrg: any;
  let adminUser: any;
  let itAdminUser: any;
  let otherAdminUser: any;
  let newHireUser: any;

  let adminToken: string;
  let itAdminToken: string;
  let otherAdminToken: string;
  let newHireToken: string;

  let createdHardwareTask: any;
  const hireDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days in future

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Primary Tenant Organization
    testOrg = await Organization.create({
      name: "Phase 8 IT Ops Test Org",
      slug: `phase8-it-org-${Date.now()}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Secondary Tenant Organization
    otherOrg = await Organization.create({
      name: "Phase 8 IT Ops Other Org",
      slug: `phase8-it-other-${Date.now()}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 3. Create Org Admin User
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `it-org-admin-${Date.now()}@test.com`,
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "HQ",
        lastName: "Admin",
      },
      permissions: {
        role: "admin",
      },
    });

    adminToken = app.jwt.sign({
      userId: adminUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "admin",
    });

    // 4. Create IT Admin User with role "it_admin"
    itAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `it-specialist-${Date.now()}@test.com`,
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Alex",
        lastName: "Sysadmin",
      },
      permissions: {
        role: "it_admin",
      },
    });

    itAdminToken = app.jwt.sign({
      userId: itAdminUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "it_admin",
    });

    // 5. Create New Hire Employee with employment.startDate set to 14 days from now
    newHireUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `newhire-it-${Date.now()}@test.com`,
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Jordan",
        lastName: "DevOps",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Cloud Engineer",
        startDate: hireDate,
      },
      permissions: {
        role: "employee",
      },
    });

    newHireToken = app.jwt.sign({
      userId: newHireUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "employee",
    });

    // 6. Create Other Org Admin
    otherAdminUser = await User.create({
      organizationId: otherOrg._id,
      auth: {
        email: `other-tenant-admin-${Date.now()}@test.com`,
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Foreign",
        lastName: "Admin",
      },
      permissions: {
        role: "admin",
      },
    });

    otherAdminToken = app.jwt.sign({
      userId: otherAdminUser._id.toString(),
      organizationId: otherOrg._id.toString(),
      role: "admin",
    });
  });

  afterAll(async () => {
    // Cleanup collections
    await Task.deleteMany({
      organizationId: { $in: [testOrg._id, otherOrg._id] },
    });
    await User.deleteMany({
      organizationId: { $in: [testOrg._id, otherOrg._id] },
    });
    await Organization.deleteMany({
      _id: { $in: [testOrg._id, otherOrg._id] },
    });
    await app.close();
  });

  it("Test 1: Lead-Time Calculation & Event-Driven Preboarding IT Setup", async () => {
    // Trigger preboarding IT hardware provisioning task
    const task = await itHardwareService.triggerPreboardingItSetup(
      testOrg._id.toString(),
      newHireUser._id.toString(),
      hireDate
    );

    expect(task).toBeDefined();
    expect(task._id).toBeDefined();
    expect(task.category).toBe("it_setup");
    expect(task.stage).toBe("preboarding");
    expect(task.priority).toBe("high");
    expect(task.assignedToUserId.toString()).toBe(itAdminUser._id.toString());
    expect(task.employeeId.toString()).toBe(newHireUser._id.toString());

    // Verify lead time: due date must be exactly hireDate - 7 days
    const expectedDueDate = new Date(hireDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(new Date(task.dueDate!).getTime()).toBe(expectedDueDate.getTime());

    // Verify default hardware metadata
    expect(task.hardwareMetadata).toBeDefined();
    expect(task.hardwareMetadata?.deviceType).toBe("laptop");
    expect(task.hardwareMetadata?.mdmStatus).toBe("pending_dispatch");

    createdHardwareTask = task;
  });

  it("Test 2: Asset Receipt Upload & Structured Metadata Mutation", async () => {
    const taskId = createdHardwareTask._id.toString();

    // 1. Update hardware metadata
    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/tasks/${taskId}/hardware`,
      headers: {
        Authorization: `Bearer ${itAdminToken}`,
      },
      payload: {
        deviceType: "laptop",
        serialNumber: "C02G41KSMD6T",
        assetTag: "TAL-AST-9021",
        courierProvider: "FedEx Priority",
        courierTrackingUrl: "https://track.fedex.com/track/123456789",
        mdmStatus: "dispatched",
      },
    });

    expect(patchRes.statusCode).toBe(200);
    const patchData = JSON.parse(patchRes.payload);
    expect(patchData.success).toBe(true);
    expect(patchData.data.hardwareMetadata.serialNumber).toBe("C02G41KSMD6T");
    expect(patchData.data.hardwareMetadata.assetTag).toBe("TAL-AST-9021");
    expect(patchData.data.hardwareMetadata.courierProvider).toBe("FedEx Priority");
    expect(patchData.data.hardwareMetadata.mdmStatus).toBe("dispatched");

    // 2. Attach purchase / serial receipt
    const receiptRes = await app.inject({
      method: "POST",
      url: `/api/v1/tasks/${taskId}/hardware/receipt`,
      headers: {
        Authorization: `Bearer ${itAdminToken}`,
      },
      payload: {
        fileName: "macbook_pro_serial_receipt.pdf",
        fileUrl: "https://storage.talnova.com/receipts/mbp-9021.pdf",
      },
    });

    expect(receiptRes.statusCode).toBe(200);
    const receiptData = JSON.parse(receiptRes.payload);
    expect(receiptData.success).toBe(true);
    expect(receiptData.data.hardwareMetadata.receiptAttachment).toBeDefined();
    expect(receiptData.data.hardwareMetadata.receiptAttachment.fileName).toBe(
      "macbook_pro_serial_receipt.pdf"
    );
    expect(receiptData.data.hardwareMetadata.receiptAttachment.fileUrl).toBe(
      "https://storage.talnova.com/receipts/mbp-9021.pdf"
    );
    expect(receiptData.data.hardwareMetadata.receiptAttachment.uploadedAt).toBeDefined();

    // 3. Confirm persistence by fetching task details
    const getRes = await app.inject({
      method: "GET",
      url: `/api/v1/tasks/${taskId}`,
      headers: {
        Authorization: `Bearer ${itAdminToken}`,
      },
    });

    expect(getRes.statusCode).toBe(200);
    const retrieved = JSON.parse(getRes.payload).data;
    expect(retrieved.hardwareMetadata.serialNumber).toBe("C02G41KSMD6T");
    expect(retrieved.hardwareMetadata.receiptAttachment.fileName).toBe(
      "macbook_pro_serial_receipt.pdf"
    );
  });

  it("Test 3: RBAC IT Queue Isolation & Privilege Boundaries", async () => {
    // 1. it_admin can query IT Setup tasks
    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/tasks?category=it_setup",
      headers: {
        Authorization: `Bearer ${itAdminToken}`,
      },
    });

    expect(listRes.statusCode).toBe(200);
    const listData = JSON.parse(listRes.payload);
    expect(listData.success).toBe(true);
    const tasks = Array.isArray(listData.data) ? listData.data : listData.data.tasks;
    expect(tasks.length).toBeGreaterThanOrEqual(1);
    expect(tasks[0].category).toBe("it_setup");

    // 2. it_admin is strictly blocked with 403 from executing super-admin/restricted routes
    const restrictedRes = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/telemetry",
      headers: {
        Authorization: `Bearer ${itAdminToken}`,
      },
    });

    expect(restrictedRes.statusCode).toBe(403);
    const errorBody = JSON.parse(restrictedRes.payload);
    expect(errorBody.message || errorBody.code).toMatch(/FORBIDDEN|Access denied/i);
  });

  it("Test 4: Outbound MDM Dispatch & Inbound Callback Lifecycle", async () => {
    const taskId = createdHardwareTask._id.toString();

    // 1. Outbound MDM Webhook Dispatch
    const dispatchRes = await app.inject({
      method: "POST",
      url: `/api/v1/tasks/mdm/dispatch/${taskId}`,
      headers: {
        Authorization: `Bearer ${itAdminToken}`,
      },
    });

    expect(dispatchRes.statusCode).toBe(200);
    const dispatchData = JSON.parse(dispatchRes.payload);
    expect(dispatchData.success).toBe(true);
    expect(dispatchData.data.webhookDispatched).toBe(true);
    expect(dispatchData.data.mdmPayload).toBeDefined();
    expect(dispatchData.data.mdmPayload.deviceType).toBe("laptop");
    expect(dispatchData.data.mdmPayload.serialNumber).toBe("C02G41KSMD6T");
    expect(dispatchData.data.mdmPayload.userEmail).toBe(newHireUser.auth.email);

    // 2. Inbound MDM Webhook Callback (Public endpoint with NO Authorization header)
    const callbackRes = await app.inject({
      method: "POST",
      url: "/api/v1/tasks/mdm/callback",
      payload: {
        taskId: taskId,
        serialNumber: "C02G41KSMD6T-ENROLLED",
        assetTag: "TAL-AST-9021-JAMF",
        courierTrackingUrl: "https://track.fedex.com/track/999888777",
        mdmStatus: "enrolled",
        mdmExternalId: "JAMF-DEV-ENROLLED-88912",
      },
    });

    expect(callbackRes.statusCode).toBe(200);
    const callbackData = JSON.parse(callbackRes.payload);
    expect(callbackData.success).toBe(true);
    expect(callbackData.data.hardwareMetadata.mdmStatus).toBe("enrolled");
    expect(callbackData.data.hardwareMetadata.mdmExternalId).toBe("JAMF-DEV-ENROLLED-88912");
    expect(callbackData.data.hardwareMetadata.serialNumber).toBe("C02G41KSMD6T-ENROLLED");
    expect(callbackData.data.status).toBe("in_progress");
  });

  it("Test 5: Multi-Tenant Boundary Isolation for IT Hardware Provisioning", async () => {
    const taskId = createdHardwareTask._id.toString();

    // Tenant B attempts to mutate Tenant A's hardware task -> must return 404 (or 403)
    const crossTenantPatch = await app.inject({
      method: "PATCH",
      url: `/api/v1/tasks/${taskId}/hardware`,
      headers: {
        Authorization: `Bearer ${otherAdminToken}`,
      },
      payload: {
        serialNumber: "HACKED_SERIAL_TENANT_B",
      },
    });

    expect(crossTenantPatch.statusCode).toBe(404);

    // Tenant B attempts to attach receipt to Tenant A's hardware task -> 404
    const crossTenantReceipt = await app.inject({
      method: "POST",
      url: `/api/v1/tasks/${taskId}/hardware/receipt`,
      headers: {
        Authorization: `Bearer ${otherAdminToken}`,
      },
      payload: {
        fileName: "malicious.pdf",
        fileUrl: "https://evil.com/receipt.pdf",
      },
    });

    expect(crossTenantReceipt.statusCode).toBe(404);

    // Tenant B listing tasks does NOT see Tenant A's hardware task
    const tenantBList = await app.inject({
      method: "GET",
      url: "/api/v1/tasks?category=it_setup",
      headers: {
        Authorization: `Bearer ${otherAdminToken}`,
      },
    });

    expect(tenantBList.statusCode).toBe(200);
    const tenantBData = JSON.parse(tenantBList.payload);
    const tenantBTasks = Array.isArray(tenantBData.data) ? tenantBData.data : (tenantBData.data?.tasks || []);
    const found = tenantBTasks.find((t: any) => t._id === taskId);
    expect(found).toBeUndefined();
  });
});
