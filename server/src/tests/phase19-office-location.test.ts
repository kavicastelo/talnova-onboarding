import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import OfficeLocation from "../modules/locations/models/office-location.model.js";

describe("Phase 19 — Office Map & Location Experience Test Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let adminUser: any;
  let adminToken: string;
  let employeeUser: any;
  let employeeToken: string;

  let createdLocationId: string;

  let otherOrg: any;
  let otherAdminToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();
    const ts = Date.now();

    await User.deleteMany({ "auth.email": { $regex: "^phase19-" } });

    // 1. Create Primary Tenant Organization
    testOrg = await Organization.create({
      name: "Phase 19 Location Org",
      slug: `phase19-org-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Admin User
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `phase19-admin-${ts}@test.com`,
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Phase19",
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

    // 3. Create Employee User
    employeeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `phase19-employee-${ts}@test.com`,
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Marcus",
        lastName: "FieldUser",
      },
      permissions: {
        role: "employee",
      },
    });

    employeeToken = app.jwt.sign({
      userId: employeeUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "employee",
    });

    // 4. Create Secondary Tenant
    otherOrg = await Organization.create({
      name: "Phase 19 Other Org",
      slug: `phase19-other-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    otherAdminToken = app.jwt.sign({
      userId: new mongoose.Types.ObjectId().toString(),
      organizationId: otherOrg._id.toString(),
      role: "admin",
    });
  });

  afterAll(async () => {
    if (testOrg) {
      await OfficeLocation.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    }
    if (otherOrg) {
      await User.deleteMany({ organizationId: otherOrg._id });
      await Organization.deleteOne({ _id: otherOrg._id });
    }
    await app.close();
  });

  describe("1. Facility & Location Management (LOC-001)", () => {
    it("should create office location facility via POST /api/v1/locations", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/locations",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: "San Francisco Innovation Hub",
          code: `SF-HQ-${Date.now().toString().slice(-4)}`,
          address: {
            street: "500 Howard Street",
            city: "San Francisco",
            state: "CA",
            zip: "94105",
            country: "USA",
          },
          accessInfo: {
            wifiSsd: "Talnova-SF-5G",
            wifiPassword: "SFInnovation2026!",
            buildingAccessCode: "PASS-9988",
            parkingInfo: "Level B1 Reserved Parking",
            arrivalInstructions: "Check in with lobby reception on 1st Floor.",
          },
          floors: [
            {
              floorNumber: 1,
              floorName: "Floor 1 — Engineering & Operations",
              desks: [
                { deskNumber: "101-A", zone: "DevOps", isAvailable: true },
                { deskNumber: "101-B", zone: "DevOps", isAvailable: true },
              ],
            },
          ],
          isPrimary: true,
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.name).toBe("San Francisco Innovation Hub");

      createdLocationId = json.data._id;
    });

    it("should list office locations via GET /api/v1/locations", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/locations",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("2. Employee Desk Assignment (LOC-003)", () => {
    it("should assign employee to specific desk seat via POST /api/v1/locations/:id/assign-desk", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/locations/${createdLocationId}/assign-desk`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          floorNumber: 1,
          deskNumber: "101-A",
          targetUserId: employeeUser._id.toString(),
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.assignedDesk.assignedUserName).toContain("Marcus");
    });
  });

  describe("3. Personalized Employee Location Guidance & Directions (LOC-004)", () => {
    it("should fetch assigned office location guidance & credentials via GET /api/v1/locations/my-location", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/locations/my-location",
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.name).toBe("San Francisco Innovation Hub");
      expect(json.data.accessInfo.wifiSsd).toBe("Talnova-SF-5G");
      expect(json.data.googleMapsDirectionsUrl).toContain("maps/dir");
      expect(json.data.assignedDesk.deskNumber).toBe("101-A");
    });
  });

  describe("4. Multi-Tenant Boundary Isolation", () => {
    it("should return empty locations list for Tenant B", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/locations",
        headers: {
          authorization: `Bearer ${otherAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.length).toBe(0);
    });
  });
});
