import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import { hashPassword } from "../utils/crypto.js";

describe("Phase 4: Multi-Identifier Bulk Import Engine & Smart Ingestion", () => {
  let app: FastifyInstance;
  let testOrgId: string;
  let adminToken: string;
  let testOrgSlug = "multi-id-bulk-test-org";

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    // Clean up any remnants
    await Organization.deleteMany({ slug: testOrgSlug });

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create test tenant
    const org = await Organization.create({
      name: "Multi-ID Bulk Import Test Org",
      slug: testOrgSlug,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      departments: [
        { name: "Field Logistics", active: true },
        { name: "Manufacturing", active: true },
      ],
      limits: { maxUsers: 50 },
    });
    testOrgId = org._id.toString();

    // 2. Create Admin user
    const passwordHash = await hashPassword("AdminSecret123!");
    await User.create({
      organizationId: org._id,
      auth: { email: "admin@multi-import.com", passwordHash, emailVerified: true },
      profile: { firstName: "Admin", lastName: "Importer", fullName: "Admin Importer" },
      permissions: { role: "admin", customRoles: [] },
      isDeleted: false,
    });

    // 3. Create existing Employee with Employee ID and Phone for conflict checking
    await User.create({
      organizationId: org._id,
      auth: { passwordHash },
      profile: { firstName: "Existing", lastName: "Staff", fullName: "Existing Staff", phone: "+15550009999" },
      employment: { employeeId: "EMP-PREEXISTING-99", department: "Manufacturing", status: "active" },
      permissions: { role: "employee", customRoles: [] },
      isDeleted: false,
    });

    // 4. Authenticate admin
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "admin@multi-import.com", password: "AdminSecret123!" },
    });
    const loginBody = JSON.parse(loginRes.body);
    adminToken = loginBody.data?.accessToken;
  });

  afterAll(async () => {
    await User.deleteMany({ organizationId: new mongoose.Types.ObjectId(testOrgId) });
    await Organization.deleteMany({ _id: new mongoose.Types.ObjectId(testOrgId) });
    await app.close();
  });

  it("Test 1: validateBulkImport validates mixed batch with email, employeeId, phone, and rejects rows missing all 3", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/employees/bulk/validate",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        users: [
          // Row 1: Corporate worker with email
          {
            email: "corp.alex@multi-import.com",
            name: "Alex Corporate",
            employeeId: "CORP-101",
            phone: "+15551112222",
            department: "Field Logistics",
          },
          // Row 2: Frontline worker with NO email (Employee ID + Phone)
          {
            email: "",
            name: "Bao Frontline",
            employeeId: "FRONT-202",
            phone: "+15553334444",
            department: "Manufacturing",
            badgeId: "BDG-202",
          },
          // Row 3: Ground worker with NO email and NO employeeId (Phone only)
          {
            email: "",
            name: "Maria Ground",
            employeeId: "",
            phone: "+15555556666",
            department: "Manufacturing",
          },
          // Row 4: Completely invalid row missing all 3 identifiers
          {
            email: "",
            name: "Invalid NoIdentifier",
            employeeId: "",
            phone: "",
            department: "Field Logistics",
          },
        ],
        options: { updateExisting: false },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.totalRows).toBe(4);
    expect(body.data.validCount).toBe(3);
    expect(body.data.invalidCount).toBe(1);
    expect(body.data.errorCount).toBe(1);

    const missingIdError = body.data.errors.find((e: any) => e.row === 4);
    expect(missingIdError).toBeDefined();
    expect(missingIdError.field).toBe("identifier");
    expect(missingIdError.reason).toContain("at least one identifier");
  });

  it("Test 2: validateBulkImport detects in-batch duplicate employeeId and duplicate phone numbers", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/employees/bulk/validate",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        users: [
          { name: "Worker A", employeeId: "EMP-DUP-777", phone: "+15557770001" },
          { name: "Worker B", employeeId: "EMP-DUP-777", phone: "+15557770002" }, // Duplicate employeeId
          { name: "Worker C", employeeId: "EMP-DIFF-888", phone: "+15557770003" },
          { name: "Worker D", employeeId: "EMP-DIFF-999", phone: "+15557770003" }, // Duplicate phone
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.errorCount).toBe(2);

    const dupEmpIdErr = body.data.errors.find((e: any) => e.row === 2 && e.field === "employeeId");
    expect(dupEmpIdErr).toBeDefined();
    expect(dupEmpIdErr.reason).toContain("Duplicate employee ID");

    const dupPhoneErr = body.data.errors.find((e: any) => e.row === 4 && e.field === "phone");
    expect(dupPhoneErr).toBeDefined();
    expect(dupPhoneErr.reason).toContain("Duplicate phone number");
  });

  it("Test 3: validateBulkImport detects conflict with pre-existing database employeeId & phone", async () => {
    // Conflict mode (updateExisting: false)
    const resConflict = await app.inject({
      method: "POST",
      url: "/api/v1/employees/bulk/validate",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        users: [
          { name: "Attempt Existing EmpId", employeeId: "EMP-PREEXISTING-99" },
          { name: "Attempt Existing Phone", phone: "+15550009999" },
        ],
        options: { updateExisting: false },
      },
    });

    const bodyConflict = JSON.parse(resConflict.body);
    expect(bodyConflict.data.conflicts).toHaveLength(2);
    expect(bodyConflict.data.conflicts[0].reason).toContain("employee ID");
    expect(bodyConflict.data.conflicts[1].reason).toContain("phone number");

    // Upsert mode (updateExisting: true)
    const resUpdate = await app.inject({
      method: "POST",
      url: "/api/v1/employees/bulk/validate",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        users: [
          { name: "Attempt Existing EmpId", employeeId: "EMP-PREEXISTING-99" },
        ],
        options: { updateExisting: true },
      },
    });

    const bodyUpdate = JSON.parse(resUpdate.body);
    expect(bodyUpdate.data.willUpdateCount).toBe(1);
    expect(bodyUpdate.data.conflicts).toHaveLength(0);
  });

  it("Test 4: bulkImportEmployees successfully imports mixed batch (with email, without email, phone only auto-assigned)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/employees/import",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        users: [
          // Row 1: Email worker
          {
            email: "import.office@multi-import.com",
            name: "Office Worker",
            employeeId: "EMP-OFF-01",
            phone: "+15556661111",
            department: "Field Logistics",
            role: "employee",
          },
          // Row 2: Frontline worker with only employeeId and phone (NO EMAIL)
          {
            email: "",
            name: "Frontline Ground Worker",
            employeeId: "GW-FLOOR-42",
            phone: "+15556662222",
            badgeId: "BDG-FL42",
            department: "Manufacturing",
            role: "employee",
          },
          // Row 3: Phone-only worker (NO EMAIL, NO EMPLOYEE ID - must auto-provision EMP-XXXXXX)
          {
            email: "",
            name: "Phone Only Worker",
            employeeId: "",
            phone: "+15556663333",
            department: "Manufacturing",
            role: "employee",
          },
        ],
        options: {
          updateExisting: false,
          triggerWorkflows: false,
          autoAssignRoleChecklists: false,
          sendInvites: false,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.imported).toBe(3);
    expect(body.errors).toHaveLength(0);

    // Verify DB records
    // 1. Office worker
    const officeUser = await User.findOne({ "auth.email": "import.office@multi-import.com" });
    expect(officeUser).toBeDefined();
    expect(officeUser?.employment?.employeeId).toBe("EMP-OFF-01");

    // 2. Frontline worker
    const frontlineUser = await User.findOne({ "employment.employeeId": "GW-FLOOR-42" });
    expect(frontlineUser).toBeDefined();
    expect(frontlineUser?.auth?.email).toBeUndefined();
    expect(frontlineUser?.profile?.phone).toBe("+15556662222");
    expect(frontlineUser?.employment?.badgeId).toBe("BDG-FL42");

    // 3. Phone-only worker
    const phoneUser = await User.findOne({ "profile.phone": "+15556663333" });
    expect(phoneUser).toBeDefined();
    expect(phoneUser?.auth?.email).toBeUndefined();
    expect(phoneUser?.employment?.employeeId).toBeDefined();
    expect(phoneUser?.employment?.employeeId).toMatch(/^EMP-[A-F0-9]{6}$/);
  });

  it("Test 5: Imported non-email workers can immediately authenticate via Universal Web Login", async () => {
    // Authenticate GW-FLOOR-42 via Employee ID
    const loginByEmpId = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: "GW-FLOOR-42",
        password: "Password@123!",
      },
    });
    expect(loginByEmpId.statusCode).toBe(200);
    const bodyEmpId = JSON.parse(loginByEmpId.body);
    expect(bodyEmpId.success).toBe(true);
    expect(bodyEmpId.data?.user?.firstName).toBe("Frontline");
    expect(bodyEmpId.data?.user?.lastName).toBe("Ground Worker");

    // Authenticate GW-FLOOR-42 via Phone number
    const loginByPhone = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: "+15556662222",
        password: "Password@123!",
      },
    });
    expect(loginByPhone.statusCode).toBe(200);
    const bodyPhone = JSON.parse(loginByPhone.body);
    expect(bodyPhone.success).toBe(true);
    expect(bodyPhone.data?.user?.firstName).toBe("Frontline");

    // Authenticate Phone-only worker via Phone number
    const loginPhoneOnly = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: "+15556663333",
        password: "Password@123!",
      },
    });
    expect(loginPhoneOnly.statusCode).toBe(200);
    const bodyPhoneOnly = JSON.parse(loginPhoneOnly.body);
    expect(bodyPhoneOnly.success).toBe(true);
    expect(bodyPhoneOnly.data?.user?.firstName).toBe("Phone");
    expect(bodyPhoneOnly.data?.user?.lastName).toBe("Only Worker");
  }, 60000);

  it("Test 6: Imported frontline workers can immediately identify at Frontline Kiosk Terminals", async () => {
    // 1. Identify via Employee ID
    const kioskEmpIdRes = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/identify",
      payload: {
        identifier: "GW-FLOOR-42",
        organizationId: testOrgId,
      },
    });
    expect(kioskEmpIdRes.statusCode).toBe(200);
    const kioskEmpIdBody = JSON.parse(kioskEmpIdRes.body);
    expect(kioskEmpIdBody.success).toBe(true);
    expect(kioskEmpIdBody.data?.worker?.name).toBe("Frontline Ground Worker");

    // 2. Identify via Badge ID
    const kioskBadgeRes = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/identify",
      payload: {
        identifier: "BDG-FL42",
        organizationId: testOrgId,
      },
    });
    expect(kioskBadgeRes.statusCode).toBe(200);
    const kioskBadgeBody = JSON.parse(kioskBadgeRes.body);
    expect(kioskBadgeBody.success).toBe(true);
    expect(kioskBadgeBody.data?.worker?.name).toBe("Frontline Ground Worker");

    // 3. Identify via Phone number
    const kioskPhoneRes = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/identify",
      payload: {
        identifier: "+15556663333",
        organizationId: testOrgId,
      },
    });
    expect(kioskPhoneRes.statusCode).toBe(200);
    const kioskPhoneBody = JSON.parse(kioskPhoneRes.body);
    expect(kioskPhoneBody.success).toBe(true);
    expect(kioskPhoneBody.data?.worker?.name).toBe("Phone Only Worker");
  });
});
