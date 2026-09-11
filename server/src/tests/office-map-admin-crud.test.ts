import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import OfficeLocation from "../modules/locations/models/office-location.model.js";

describe("Office Map Admin & Owner Create/Edit Feature Test Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let adminUser: any;
  let adminToken: string;
  let ownerUser: any;
  let ownerToken: string;
  let employeeUser: any;
  let employeeToken: string;

  let createdLocationId: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();
    const ts = Date.now();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: "Map Admin Test Org",
      slug: `map-admin-org-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Admin User
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `map-admin-${ts}@test.com`,
        passwordHash: "hashedpass123",
      },
      profile: {
        firstName: "Admin",
        lastName: "User",
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

    // 3. Create Owner User
    ownerUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `map-owner-${ts}@test.com`,
        passwordHash: "hashedpass123",
      },
      profile: {
        firstName: "Owner",
        lastName: "Boss",
      },
      permissions: {
        role: "owner",
      },
    });

    ownerToken = app.jwt.sign({
      userId: ownerUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "owner",
    });

    // 4. Create Standard Employee User
    employeeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `map-employee-${ts}@test.com`,
        passwordHash: "hashedpass123",
      },
      profile: {
        firstName: "Employee",
        lastName: "Junior",
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
  });

  afterAll(async () => {
    if (testOrg) {
      await OfficeLocation.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    }
    await app.close();
  });

  describe("1. Role-based Creation Security", () => {
    it("should reject map creation by standard employee with 403 Forbidden", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/locations",
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
        payload: {
          name: "Unauthorized Employee Map",
          code: "UNAUTH-01",
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should allow admin to create a new office map location", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/locations",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: "Austin Innovation Campus",
          code: `ATX-CAMPUS-${Date.now().toString().slice(-4)}`,
          address: {
            street: "200 Congress Avenue",
            city: "Austin",
            state: "TX",
            zip: "78701",
            country: "USA",
          },
          accessInfo: {
            wifiSsd: "Talnova-Austin-5G",
            wifiPassword: "ATXInnovation2026!",
            buildingAccessCode: "KEY-2026",
            arrivalInstructions: "Take elevator to 4th floor reception.",
          },
          floors: [
            {
              floorNumber: 1,
              floorName: "Floor 1 — Lobby & Engineering",
              desks: [
                { deskNumber: "101-A", zone: "Engineering", isAvailable: true, x: 370, y: 110 },
                { deskNumber: "101-B", zone: "Engineering", isAvailable: true, x: 540, y: 110 },
              ],
            },
          ],
          isPrimary: true,
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.name).toBe("Austin Innovation Campus");
      expect(json.data.floors.length).toBe(1);
      expect(json.data.floors[0].desks.length).toBe(2);

      createdLocationId = json.data._id;
    });

    it("should allow owner to create another office location", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/locations",
        headers: {
          authorization: `Bearer ${ownerToken}`,
        },
        payload: {
          name: "London Design Studio",
          code: `LDN-01-${Date.now().toString().slice(-4)}`,
          address: {
            street: "10 Finsbury Square",
            city: "London",
            state: "Greater London",
            zip: "EC2A 1AF",
            country: "United Kingdom",
          },
          accessInfo: {
            wifiSsd: "Talnova-London-WiFi",
            wifiPassword: "LondonDesign2026",
            buildingAccessCode: "PIN-7733",
          },
          floors: [
            {
              floorNumber: 1,
              floorName: "Floor 1 — Creative Studio",
              desks: [{ deskNumber: "L1-A", zone: "Design", isAvailable: true }],
            },
          ],
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.data.name).toBe("London Design Studio");
    });
  });

  describe("2. Role-based Editing Security & Persistence", () => {
    it("should reject map updates by standard employee with 403 Forbidden", async () => {
      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/locations/${createdLocationId}`,
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
        payload: {
          name: "Hacked Map Name",
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should allow admin to edit office map and add a second floor with new desks", async () => {
      const updatedFloors = [
        {
          floorNumber: 1,
          floorName: "Floor 1 — Lobby & Engineering Hub",
          desks: [
            { deskNumber: "101-A", zone: "Engineering", isAvailable: true, x: 370, y: 110 },
            { deskNumber: "101-B", zone: "Engineering", isAvailable: true, x: 540, y: 110 },
            { deskNumber: "102-A", zone: "DevOps", isAvailable: true, x: 370, y: 230 },
          ],
        },
        {
          floorNumber: 2,
          floorName: "Floor 2 — Executive & Product Suite",
          desks: [
            { deskNumber: "201-A", zone: "Product", isAvailable: true, x: 370, y: 110 },
            { deskNumber: "201-B", zone: "Design", isAvailable: true, x: 540, y: 110 },
          ],
        },
      ];

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/locations/${createdLocationId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: "Austin Innovation Campus — Flagship",
          accessInfo: {
            wifiSsd: "Talnova-Austin-Ultra5G",
            wifiPassword: "UpdatedPassword2026!",
            buildingAccessCode: "KEY-9900",
            arrivalInstructions: "Check in with 1st floor receptionist Marcus.",
          },
          floors: updatedFloors,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.name).toBe("Austin Innovation Campus — Flagship");
      expect(json.data.accessInfo.wifiSsd).toBe("Talnova-Austin-Ultra5G");
      expect(json.data.floors.length).toBe(2);
      expect(json.data.floors[1].floorName).toBe("Floor 2 — Executive & Product Suite");
      expect(json.data.floors[1].desks.length).toBe(2);
      expect(json.data.floors[1].desks[0].deskNumber).toBe("201-A");

      // Verify persistence in MongoDB
      const savedDoc = await OfficeLocation.findById(createdLocationId);
      expect(savedDoc?.name).toBe("Austin Innovation Campus — Flagship");
      expect(savedDoc?.floors.length).toBe(2);
      expect(savedDoc?.floors[0].desks.length).toBe(3);
      expect(savedDoc?.floors[1].desks.length).toBe(2);
    });

    it("should allow owner to edit office map facility details", async () => {
      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/locations/${createdLocationId}`,
        headers: {
          authorization: `Bearer ${ownerToken}`,
        },
        payload: {
          accessInfo: {
            wifiSsd: "Talnova-Austin-OwnerNetwork",
            wifiPassword: "OwnerSuperSecret2026",
            buildingAccessCode: "VIP-1234",
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.accessInfo.wifiSsd).toBe("Talnova-Austin-OwnerNetwork");
      expect(json.data.accessInfo.buildingAccessCode).toBe("VIP-1234");
    });
  });
});
