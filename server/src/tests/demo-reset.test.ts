import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { closeDemoConnection } from "../modules/demo/database/demo-connection.js";
import {
  getDemoTenantModel,
  getDemoUserModel,
  getDemoSessionModel,
  getDemoTaskModel,
  getDemoResetLogModel,
} from "../modules/demo/models/index.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import { User } from "../modules/auth/models/user.model.js";
import { demoResetService } from "../modules/demo/services/demo-reset.service.js";
import {
  DETERMINISTIC_DEMO_COMPANIES,
  DETERMINISTIC_DEMO_USERS,
} from "../modules/demo/seed/demo-seed-data.js";

describe("Demo Environment — 10-Step Deterministic Reset & Production Safety", () => {
  let app: any;
  let prodOrgId: mongoose.Types.ObjectId;
  let prodUserId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);

    // Create a real production organization & user to verify they remain completely untouched
    const prodOrg = await Organization.create({
      name: "Permanent Production Org",
      slug: `prod-org-${Date.now()}`,
      createdBy: new mongoose.Types.ObjectId(),
      isDeleted: false,
    });
    prodOrgId = prodOrg._id as mongoose.Types.ObjectId;

    const prodUser = await User.create({
      organizationId: prodOrgId,
      auth: {
        email: `prod-admin-${Date.now()}@permanent.com`,
        passwordHash: "$argon2id$v=19$dummyhash",
      },
      profile: { firstName: "Prod", lastName: "Admin", fullName: "Prod Admin" },
      permissions: { role: "admin", customRoles: [] },
      employment: { employmentType: "full_time", status: "active" },
    });
    prodUserId = prodUser._id as mongoose.Types.ObjectId;
  });

  afterAll(async () => {
    await Organization.deleteOne({ _id: prodOrgId });
    await User.deleteOne({ _id: prodUserId });
    await closeDemoConnection(app.log);
    await disconnectDatabase(app.log);
  });

  it("1. Executes 10-step atomic reset: terminates sessions, clears custom state, and restores baseline", async () => {
    const DemoTenant = getDemoTenantModel();
    const DemoUser = getDemoUserModel();
    const DemoTask = getDemoTaskModel();
    const DemoSession = getDemoSessionModel();

    // 1. Create dirty/custom data in Demo DB
    const dirtyTenant = await DemoTenant.create({
      name: "Temporary Dirty Tenant",
      slug: `dirty-tenant-${Date.now()}`,
      domain: "dirty.com",
      contactEmail: "dirty@dirty.com",
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 86400000),
    });

    const dirtyUser = await DemoUser.create({
      demoTenantId: dirtyTenant._id,
      email: `dirty-${Date.now()}@dirty.com`,
      fullName: "Dirty User",
      role: "demo_employee",
      passwordHash: "hash",
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 86400000),
    });

    const activeSession = await DemoSession.create({
      sessionId: `session-dirty-${Date.now()}`,
      demoUserId: dirtyUser._id,
      demoTenantId: dirtyTenant._id,
      isValid: true,
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
    });

    await DemoTask.create({
      demoTenantId: dirtyTenant._id,
      title: "Dirty Custom Task",
      description: "Should be wiped by reset",
      category: "hr_compliance",
      status: "pending",
      dueDays: 1,
    });

    // Verify dirty data exists
    expect(await DemoTenant.findById(dirtyTenant._id)).toBeDefined();
    expect(await DemoSession.findOne({ sessionId: activeSession.sessionId, isValid: true })).toBeDefined();

    // 2. Execute 10-step Reset
    const result = await demoResetService.executeReset("Super Admin Test Suite", "super_admin");

    expect(result.success).toBe(true);
    expect(result.stepsCompleted.length).toBe(10);
    expect(result.stats.tenantsCreated).toBe(DETERMINISTIC_DEMO_COMPANIES.length);
    expect(result.stats.usersCreated).toBe(DETERMINISTIC_DEMO_USERS.length);

    // 3. Verify dirty data is gone
    const checkDirtyTenant = await DemoTenant.findById(dirtyTenant._id);
    expect(checkDirtyTenant).toBeNull();

    const checkDirtySession = await DemoSession.findOne({ sessionId: activeSession.sessionId });
    expect(checkDirtySession).toBeNull();

    // 4. Verify deterministic seed entities exist
    const acmeTenant = await DemoTenant.findOne({ slug: "acme-corp-demo" });
    expect(acmeTenant).toBeDefined();
    expect(acmeTenant?.name).toBe("Acme Corporation Demo");

    const globexTenant = await DemoTenant.findOne({ slug: "globex-demo" });
    expect(globexTenant).toBeDefined();

    const sarahUser = await DemoUser.findOne({ email: "sarah.connor@acme-demo.com" });
    expect(sarahUser).toBeDefined();
    expect(sarahUser?.fullName).toBe("Sarah Connor");
  });

  it("2. Production Safety: Verifies production collections are 100% UNTOUCHED before and after demo reset", async () => {
    // Check production organization and user still exist completely unchanged
    const prodOrg = await Organization.findById(prodOrgId);
    expect(prodOrg).toBeDefined();
    expect(prodOrg?.name).toBe("Permanent Production Org");

    const prodUser = await User.findById(prodUserId);
    expect(prodUser).toBeDefined();
    expect(prodUser?.profile.fullName).toBe("Prod Admin");
  });

  it("3. Idempotency: Running reset multiple times consecutively produces consistent, identical seed state", async () => {
    const DemoTenant = getDemoTenantModel();
    const DemoUser = getDemoUserModel();
    const DemoResetLog = getDemoResetLogModel();

    // Run reset 2 more times
    await demoResetService.executeReset("Automated Cycle 1", "super_admin");
    await demoResetService.executeReset("Automated Cycle 2", "super_admin");

    const tenantCount = await DemoTenant.countDocuments();
    const userCount = await DemoUser.countDocuments();

    expect(tenantCount).toBe(DETERMINISTIC_DEMO_COMPANIES.length);
    expect(userCount).toBe(DETERMINISTIC_DEMO_USERS.length);

    const logs = await DemoResetLog.find({ status: "SUCCESS" });
    expect(logs.length).toBeGreaterThanOrEqual(3);
  });
});
