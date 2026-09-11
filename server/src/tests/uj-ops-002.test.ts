import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import OfficeLocation from "../modules/locations/models/office-location.model.js";

describe("Journey Test UJ-OPS-002: Navigate Workplace Map & Desks", () => {
  let app: FastifyInstance;
  let testOrgA: any;
  let testOrgB: any;
  let userA: any;
  let teammateA: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;
  let locationA: any;
  let locationB: any;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const ts = Date.now();
    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization A
    testOrgA = await Organization.create({
      name: "Workplace Map Org A",
      slug: `map-org-a-${ts}`,
      domain: `map-org-a-${ts}.test`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Organization B
    testOrgB = await Organization.create({
      name: "Workplace Map Org B",
      slug: `map-org-b-${ts}`,
      domain: `map-org-b-${ts}.test`,
      plan: "Starter",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });

    // 3. Create User A in Org A
    userA = await User.create({
      organizationId: testOrgA._id,
      auth: {
        email: `newhire-a-${ts}@map.test`,
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
      },
      profile: {
        firstName: "Lucas",
        lastName: "Newhire",
        fullName: "Lucas Newhire",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Software Engineer",
        status: "active",
      },
      permissions: {
        role: "employee",
      },
    });

    // 4. Create Teammate A in Org A (e.g. Sarah Connor)
    teammateA = await User.create({
      organizationId: testOrgA._id,
      auth: {
        email: `sarah-connor-${ts}@map.test`,
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
      },
      profile: {
        firstName: "Sarah",
        lastName: "Connor",
        fullName: "Sarah Connor",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Lead Engineer",
        status: "active",
      },
      permissions: {
        role: "employee",
      },
    });

    // 5. Create User B in Org B
    userB = await User.create({
      organizationId: testOrgB._id,
      auth: {
        email: `employee-b-${ts}@map.test`,
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
      },
      profile: {
        firstName: "Oscar",
        lastName: "TenantB",
        fullName: "Oscar TenantB",
      },
      employment: {
        department: "Operations",
        jobTitle: "Operations Analyst",
        status: "active",
      },
      permissions: {
        role: "employee",
      },
    });

    tokenA = app.jwt.sign({
      userId: userA._id.toString(),
      role: userA.permissions.role,
      organizationId: testOrgA._id.toString(),
    });

    tokenB = app.jwt.sign({
      userId: userB._id.toString(),
      role: userB.permissions.role,
      organizationId: testOrgB._id.toString(),
    });

    // 6. Seed Office Location for Org A with 2 floors & mapped desks
    locationA = await OfficeLocation.create({
      organizationId: testOrgA._id,
      name: "Talnova San Francisco HQ",
      code: `SFO-TEST-${ts}`,
      address: {
        street: "500 Howard Street, Suite 400",
        city: "San Francisco",
        state: "CA",
        zip: "94105",
        country: "USA",
      },
      coordinates: {
        lat: 37.7885,
        lng: -122.3985,
      },
      timezone: "America/Los_Angeles",
      contactEmail: "facilities@talnova.com",
      contactPhone: "+1 (415) 555-0199",
      accessInfo: {
        wifiSsd: "Talnova-Secure-5G",
        wifiPassword: "SFOHQ-Welcome2026!",
        buildingAccessCode: "KEY-5004",
        parkingInfo: "Visitor parking validation available at 2nd floor security desk.",
        arrivalInstructions: "Check in with the lobby iPad terminal to receive your guest visitor badge.",
      },
      floors: [
        {
          floorNumber: 1,
          floorName: "Floor 1 — Engineering & Operations",
          mapImageUrl: "/floor1-map.svg",
          desks: [
            {
              deskNumber: "101-A",
              zone: "DevOps & Cloud",
              x: 370,
              y: 110,
              assignedUserId: userA._id,
              assignedUserName: userA.profile.fullName,
              isAvailable: false,
            },
            {
              deskNumber: "101-B",
              zone: "Engineering Core",
              x: 540,
              y: 110,
              assignedUserId: teammateA._id,
              assignedUserName: teammateA.profile.fullName,
              isAvailable: false,
            },
            {
              deskNumber: "102-A",
              zone: "Flex Hotdesk",
              x: 370,
              y: 230,
              isAvailable: true,
            },
          ],
        },
        {
          floorNumber: 2,
          floorName: "Floor 2 — Executive & Growth",
          mapImageUrl: "/floor2-map.svg",
          desks: [
            {
              deskNumber: "201-A",
              zone: "Marketing Zone",
              x: 370,
              y: 140,
              isAvailable: true,
            },
          ],
        },
      ],
      isPrimary: true,
      createdBy: userA._id,
    });

    // 7. Seed Office Location for Org B
    locationB = await OfficeLocation.create({
      organizationId: testOrgB._id,
      name: "Acme London Satellite Office",
      code: `LON-TEST-${ts}`,
      address: {
        street: "100 Liverpool Street",
        city: "London",
        zip: "EC2M 2RH",
        country: "UK",
      },
      timezone: "Europe/London",
      accessInfo: {
        wifiSsd: "Acme-UK-Guest",
        wifiPassword: "LondonSecret2026!",
        buildingAccessCode: "UK-7721",
      },
      floors: [
        {
          floorNumber: 1,
          floorName: "Floor 1 — Operations",
          desks: [
            {
              deskNumber: "B-101",
              zone: "UK Operations",
              isAvailable: false,
              assignedUserId: userB._id,
              assignedUserName: userB.profile.fullName,
            },
          ],
        },
      ],
      isPrimary: true,
      createdBy: userB._id,
    });
  });

  afterAll(async () => {
    if (testOrgA && testOrgB) {
      await OfficeLocation.deleteMany({ organizationId: { $in: [testOrgA._id, testOrgB._id] } });
      await User.deleteMany({ organizationId: { $in: [testOrgA._id, testOrgB._id] } });
      await Organization.deleteMany({ _id: { $in: [testOrgA._id, testOrgB._id] } });
    }
  });

  it("Step 1-2: GET /api/v1/locations/office-map returns HTTP 200 OK with floor layouts, desks, and access info", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/locations/office-map",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);

    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.name).toBe("Talnova San Francisco HQ");
    expect(body.data.address.city).toBe("San Francisco");

    // Wi-Fi and access credentials
    expect(body.data.accessInfo.wifiSsd).toBe("Talnova-Secure-5G");
    expect(body.data.accessInfo.buildingAccessCode).toBe("KEY-5004");

    // Floors and desk pins
    expect(Array.isArray(body.data.floors)).toBe(true);
    expect(body.data.floors.length).toBe(2);

    const floor1 = body.data.floors.find((f: any) => f.floorNumber === 1);
    expect(floor1).toBeDefined();
    expect(floor1.desks.length).toBe(3);

    // Teammate Sarah Connor at Desk 101-B
    const sarahDesk = floor1.desks.find((d: any) => d.deskNumber === "101-B");
    expect(sarahDesk).toBeDefined();
    expect(sarahDesk.assignedUserName).toBe("Sarah Connor");
    expect(sarahDesk.zone).toBe("Engineering Core");
    expect(sarahDesk.isAvailable).toBe(false);

    // Assigned desk for caller Lucas Newhire
    expect(body.data.assignedDesk).toBeDefined();
    expect(body.data.assignedDesk.deskNumber).toBe("101-A");
    expect(body.data.assignedFloorNumber).toBe(1);
  });

  it("Alternative Path: Multi-floor navigation returns Floor 2 layouts and configurations", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/locations/office-map",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });

    const body = JSON.parse(response.body);
    const floor2 = body.data.floors.find((f: any) => f.floorNumber === 2);
    expect(floor2).toBeDefined();
    expect(floor2.floorName).toBe("Floor 2 — Executive & Growth");
    expect(floor2.desks.length).toBeGreaterThanOrEqual(1);
    expect(floor2.desks[0].deskNumber).toBe("201-A");
  });

  it("Desk Assignment Action: Assigning an employee to a vacant desk via POST /api/v1/locations/:id/assign-desk", async () => {
    const adminToken = app.jwt.sign({
      userId: userA._id.toString(),
      role: "admin",
      organizationId: testOrgA._id.toString(),
    });

    const assignRes = await app.inject({
      method: "POST",
      url: `/api/v1/locations/${locationA._id}/assign-desk`,
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      payload: {
        floorNumber: 1,
        deskNumber: "102-A",
        targetUserId: userA._id.toString(),
      },
    });

    expect(assignRes.statusCode).toBe(200);
    const assignBody = JSON.parse(assignRes.body);
    expect(assignBody.success).toBe(true);

    // Verify desk state updated in database
    const updatedLoc = await OfficeLocation.findById(locationA._id);
    const updatedDesk = updatedLoc?.floors[0].desks.find((d) => d.deskNumber === "102-A");
    expect(updatedDesk?.isAvailable).toBe(false);
    expect(updatedDesk?.assignedUserName).toBe("Lucas Newhire");
  });

  it("Negative Test: Unauthenticated request to /api/v1/locations/office-map is rejected with HTTP 401", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/locations/office-map",
    });

    expect(response.statusCode).toBe(401);
  });

  it("Authorization & Tenant Boundary Isolation: User B in Org B never receives Org A location or desks", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/locations/office-map",
      headers: {
        Authorization: `Bearer ${tokenB}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);

    expect(body.success).toBe(true);
    // User B receives London Satellite Office, not SF HQ
    expect(body.data.name).toBe("Acme London Satellite Office");
    expect(body.data.accessInfo.wifiSsd).toBe("Acme-UK-Guest");
    expect(body.data.floors[0].desks[0].deskNumber).toBe("B-101");

    // Verify no Org A data is present
    expect(body.data.name).not.toContain("Talnova San Francisco HQ");
    expect(body.data.floors.some((f: any) => f.desks.some((d: any) => d.deskNumber === "101-B"))).toBe(false);
  });

  it("Data Integrity Check: All returned desks and location record belong strictly to authenticated organizationId", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/locations/office-map",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });

    const body = JSON.parse(response.body);
    const dbLoc = await OfficeLocation.findById(body.data.locationId);

    expect(dbLoc).toBeDefined();
    expect(dbLoc?.organizationId.toString()).toBe(testOrgA._id.toString());
  });
});
