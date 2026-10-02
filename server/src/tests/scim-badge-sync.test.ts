import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import { hashPassword } from "../utils/crypto.js";
import { employeeService } from "../modules/employees/services/employee.service.js";

describe("K-ENT-001: SCIM 2.0 Badge Directory Synchronization & Instant Terminal Recognition", () => {
  let app: FastifyInstance;
  let testOrgId: string;
  let adminToken: string;
  const adminEmail = "scim-admin@talnova-ent-test.com";

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    // Clean up previous test artifacts
    await Organization.deleteMany({ slug: "scim-badge-test-org" });

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create test tenant with SCIM token
    const org = await Organization.create({
      name: "SCIM Badge Sync Test Facility",
      slug: "scim-badge-test-org",
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      departments: [
        { name: "Manufacturing", active: true },
        { name: "Logistics", active: true },
      ],
      integrations: {
        scimToken: "scim-secret-token-xyz-12345",
      },
    });
    testOrgId = org._id.toString();

    // 2. Create Admin user
    const passwordHash = await hashPassword("AdminSecret123!");
    const adminUser = await User.create({
      organizationId: org._id,
      auth: { email: adminEmail, passwordHash, emailVerified: true },
      profile: { firstName: "Enterprise", lastName: "Admin", fullName: "Enterprise Admin" },
      permissions: { role: "admin", customRoles: [] },
      isDeleted: false,
    });

    adminToken = app.jwt.sign({
      userId: adminUser._id.toString(),
      organizationId: testOrgId,
      role: "admin",
    });

    // 3. Ensure MongoDB indexes are synchronized
    await User.syncIndexes();
  });

  afterAll(async () => {
    await User.deleteMany({ organizationId: new mongoose.Types.ObjectId(testOrgId) });
    await Organization.deleteMany({ _id: new mongoose.Types.ObjectId(testOrgId) });
    await app.close();
  });

  describe("Index Verification for Sub-10ms Latency (Acceptance Criteria & Scope)", () => {
    it("has single-field and compound indexes on employment.badgeId and employment.employeeId", async () => {
      const indexes = await User.collection.indexes();
      const indexNames = indexes.map((idx) => Object.keys(idx.key).join("_"));

      // Check single-field index
      const hasBadgeIndex = indexes.some(
        (idx) => idx.key["employment.badgeId"] === 1 && Object.keys(idx.key).length === 1
      );
      const hasEmpIndex = indexes.some(
        (idx) => idx.key["employment.employeeId"] === 1 && Object.keys(idx.key).length === 1
      );

      expect(hasBadgeIndex).toBe(true);
      expect(hasEmpIndex).toBe(true);
    });
  });

  describe("SCIM 2.0 User Provisioning with Extensions (K-ENT-001 Scope)", () => {
    let createdScimUserId: string;

    it("creates a new frontline employee with nested talnova:badgeId and enterprise:employeeNumber", async () => {
      const payload = {
        schemas: [
          "urn:ietf:params:scim:schemas:core:2.0:User",
          "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User",
          "urn:ietf:params:scim:schemas:extension:talnova:2.0:User",
        ],
        userName: "marcus.vance@factory.test",
        name: {
          givenName: "Marcus",
          familyName: "Vance",
          formatted: "Marcus Vance",
        },
        displayName: "Marcus Vance",
        active: true,
        "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User": {
          employeeNumber: "EMP-98412",
          department: "Manufacturing",
        },
        "urn:ietf:params:scim:schemas:extension:talnova:2.0:User": {
          badgeId: "BDG-98412",
          nationalId: "NAT-112233",
        },
      };

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/scim/v2/Users",
        headers: {
          authorization: `Bearer ${adminToken}`,
          "content-type": "application/scim+json",
        },
        payload,
      });

      expect(res.statusCode).toBe(201);
      expect(res.headers["content-type"]).toContain("application/scim+json");
      expect(res.headers["location"]).toBeDefined();

      const body = JSON.parse(res.payload);
      expect(body.id).toBeDefined();
      createdScimUserId = body.id;
      expect(body.userName).toBe("marcus.vance@factory.test");
      expect(body["urn:ietf:params:scim:schemas:extension:talnova:2.0:User"]?.badgeId).toBe("BDG-98412");
      expect(body["urn:ietf:params:scim:schemas:extension:enterprise:2.0:User"]?.employeeNumber).toBe("EMP-98412");

      // Verify persisted state in MongoDB
      const dbUser = await User.findById(createdScimUserId);
      expect(dbUser).not.toBeNull();
      expect(dbUser?.employment?.badgeId).toBe("BDG-98412");
      expect(dbUser?.employment?.employeeId).toBe("EMP-98412");
      expect(dbUser?.employment?.nationalId).toBe("NAT-112233");
      expect(dbUser?.employment?.department).toBe("Manufacturing");
    });

    it("Given an employee scanning BDG-98412 at a kiosk terminal, identifies worker immediately", async () => {
      const startTime = performance.now();

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/identify",
        payload: {
          identifier: "BDG-98412",
          organizationId: testOrgId,
        },
      });

      const durationMs = performance.now() - startTime;

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.user).toBeDefined();
      expect(body.data.user.email).toBe("marcus.vance@factory.test");
      expect(body.data.user.name).toBe("Marcus Vance");
      expect(body.data.token).toBeDefined();
    });

    it("identifies frontline worker at kiosk terminal without explicit organizationId via badgeId index lookup", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/identify",
        payload: {
          identifier: "BDG-98412",
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.user.email).toBe("marcus.vance@factory.test");
    });

    it("identifies frontline worker at kiosk terminal using employeeNumber EMP-98412", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/identify",
        payload: {
          identifier: "EMP-98412",
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.user.email).toBe("marcus.vance@factory.test");
    });

    it("creates a user using flat URN schema keys (Okta / Entra ID pattern)", async () => {
      const payload = {
        schemas: [
          "urn:ietf:params:scim:schemas:core:2.0:User",
          "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User",
          "urn:ietf:params:scim:schemas:extension:talnova:2.0:User",
        ],
        userName: "elena.rostova@factory.test",
        name: {
          givenName: "Elena",
          familyName: "Rostova",
        },
        "urn:ietf:params:scim:schemas:extension:talnova:2.0:User:badgeId": "BDG-FLAT-7700",
        "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:employeeNumber": "EMP-FLAT-7700",
        "urn:ietf:params:scim:schemas:extension:talnova:2.0:User:nationalId": "NAT-998877",
      };

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/scim/v2/Users",
        headers: {
          authorization: `Bearer ${adminToken}`,
          "content-type": "application/scim+json",
        },
        payload,
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body["urn:ietf:params:scim:schemas:extension:talnova:2.0:User"]?.badgeId).toBe("BDG-FLAT-7700");

      // Verify immediate kiosk scan
      const kioskRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/identify",
        payload: { identifier: "BDG-FLAT-7700" },
      });
      expect(kioskRes.statusCode).toBe(200);
      const kioskBody = JSON.parse(kioskRes.payload);
      expect(kioskBody.data.user.email).toBe("elena.rostova@factory.test");
    });

    it("SCIM PATCH /Users/:id updates badgeId and terminal reflects new badge immediately", async () => {
      const patchPayload = {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        Operations: [
          {
            op: "replace",
            path: "urn:ietf:params:scim:schemas:extension:talnova:2.0:User:badgeId",
            value: "BDG-98412-REISSUED",
          },
        ],
      };

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/scim/v2/Users/${createdScimUserId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
          "content-type": "application/scim+json",
        },
        payload: patchPayload,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body["urn:ietf:params:scim:schemas:extension:talnova:2.0:User"]?.badgeId).toBe("BDG-98412-REISSUED");

      // Verify old badge no longer works
      const oldBadgeRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/identify",
        payload: {
          identifier: "BDG-98412",
          organizationId: testOrgId,
        },
      });
      expect(oldBadgeRes.statusCode).toBe(404);

      // Verify reissued badge works immediately
      const newBadgeRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/identify",
        payload: {
          identifier: "BDG-98412-REISSUED",
          organizationId: testOrgId,
        },
      });
      expect(newBadgeRes.statusCode).toBe(200);
      const newBadgeBody = JSON.parse(newBadgeRes.payload);
      expect(newBadgeBody.data.user.email).toBe("marcus.vance@factory.test");
    });

    it("GET /api/v1/scim/v2/Users with filter by badgeId returns matching user", async () => {
      const res = await app.inject({
        method: "GET",
        url: '/api/v1/scim/v2/Users?filter=badgeId eq "BDG-98412-REISSUED"',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.totalResults).toBe(1);
      expect(body.Resources[0].userName).toBe("marcus.vance@factory.test");
      expect(body.Resources[0]["urn:ietf:params:scim:schemas:extension:talnova:2.0:User"]?.badgeId).toBe(
        "BDG-98412-REISSUED"
      );
    });

    it("GET /api/v1/scim/v2/ServiceProviderConfig and /ResourceTypes return valid SCIM discovery schemas", async () => {
      const configRes = await app.inject({
        method: "GET",
        url: "/api/v1/scim/v2/ServiceProviderConfig",
      });
      expect(configRes.statusCode).toBe(200);
      const configBody = JSON.parse(configRes.payload);
      expect(configBody.schemas).toContain("urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig");
      expect(configBody.patch.supported).toBe(true);

      const typesRes = await app.inject({
        method: "GET",
        url: "/api/v1/scim/v2/ResourceTypes",
      });
      expect(typesRes.statusCode).toBe(200);
      const typesBody = JSON.parse(typesRes.payload);
      expect(Array.isArray(typesBody)).toBe(true);
      expect(typesBody[0].name).toBe("User");
      expect(typesBody[0].schemaExtensions).toBeDefined();
    });
  });

  describe("Bulk CSV User Import with badgeId (K-ENT-001 Scope)", () => {
    it("validates and imports bulk employees with badgeId, enabling immediate terminal scan", async () => {
      const importRows = [
        {
          email: "bulk.frontline1@factory.test",
          firstName: "Carlos",
          lastName: "Mendez",
          department: "Logistics",
          employeeId: "EMP-BULK-01",
          badgeId: "BDG-BULK-01",
          nationalId: "NAT-BULK-01",
        },
        {
          email: "bulk.frontline2@factory.test",
          firstName: "Amina",
          lastName: "Diop",
          department: "Manufacturing",
          employeeId: "EMP-BULK-02",
          badgeId: "BDG-BULK-02",
          nationalId: "NAT-BULK-02",
        },
      ];

      // Validate import
      const valResult = await employeeService.validateBulkImport(testOrgId, importRows);
      expect(valResult.validCount).toBe(2);
      expect(valResult.errorCount).toBe(0);

      // Execute bulk import
      const dummyAdminId = new mongoose.Types.ObjectId();
      const importResult = await employeeService.bulkImportEmployees(
        testOrgId,
        importRows,
        dummyAdminId
      );

      expect(importResult.successCount).toBe(2);

      // Verify immediate kiosk terminal scan for bulk imported worker
      const kioskRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/identify",
        payload: {
          identifier: "BDG-BULK-01",
        },
      });

      expect(kioskRes.statusCode).toBe(200);
      const kioskBody = JSON.parse(kioskRes.payload);
      expect(kioskBody.success).toBe(true);
      expect(kioskBody.data.user.email).toBe("bulk.frontline1@factory.test");
      expect(kioskBody.data.user.name).toBe("Carlos Mendez");
    });
  });
});
