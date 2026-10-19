import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Company from "../modules/sales/models/company.model.js";
import Contact from "../modules/sales/models/contact.model.js";
import Deal from "../modules/sales/models/deal.model.js";
import Pipeline from "../modules/sales/models/pipeline.model.js";
import Package from "../modules/super-admin/models/package.model.js";
import CustomerAccount from "../modules/super-admin/models/customer-account.model.js";
import AuditLog from "../modules/audit-logs/models/audit-log.model.js";
import { EventBus } from "../infrastructure/events/event-bus.js";

describe("CRM-004: Enterprise Onboarding Handoff Service", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let regularUser: any;
  let testOrg: any;
  let superAdminToken: string;
  let regularToken: string;
  let testPackage: any;
  let defaultPipeline: any;
  let testCompany: any;
  let testContact: any;

  const testPrefix = `handoff-test-${Date.now()}`;
  const createdOrgIds: mongoose.Types.ObjectId[] = [];
  const createdUserIds: mongoose.Types.ObjectId[] = [];
  const createdPackageIds: mongoose.Types.ObjectId[] = [];
  const createdCompanyIds: mongoose.Types.ObjectId[] = [];
  const createdContactIds: mongoose.Types.ObjectId[] = [];
  const createdDealIds: mongoose.Types.ObjectId[] = [];

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Base Organization
    testOrg = await Organization.create({
      name: `Handoff Test Org ${testPrefix}`,
      slug: `handoff-org-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });
    createdOrgIds.push(testOrg._id);

    // 2. Create Users
    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `handoff-admin-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Handoff",
        lastName: "Admin",
        fullName: "Handoff Admin",
      },
      employment: { status: "active" },
      permissions: { role: "super_admin", customRoles: [] },
    });
    createdUserIds.push(superAdminUser._id);

    regularUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `handoff-regular-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Regular",
        lastName: "User",
        fullName: "Regular User",
      },
      employment: { status: "active" },
      permissions: { role: "employee", customRoles: [] },
    });
    createdUserIds.push(regularUser._id);

    superAdminToken = app.jwt.sign({
      userId: superAdminUser._id.toString(),
      email: superAdminUser.auth.email,
      role: superAdminUser.permissions.role,
      organizationId: testOrg._id.toString(),
      tokenVersion: 0,
    });

    regularToken = app.jwt.sign({
      userId: regularUser._id.toString(),
      email: regularUser.auth.email,
      role: regularUser.permissions.role,
      organizationId: testOrg._id.toString(),
      tokenVersion: 0,
    });

    // 3. Create Package
    testPackage = await Package.create({
      name: `Enterprise Suite ${testPrefix}`,
      slug: `enterprise-suite-${testPrefix}`,
      description: "Comprehensive enterprise package for onboarding handoff",
      tier: "enterprise",
      isPublic: true,
      isDefault: false,
      status: "active",
      billing: {
        basePriceMonthly: 499,
        basePriceAnnual: 4990,
        currency: "USD",
      },
      limits: {
        maxUsers: 250,
        maxStorageGb: 100,
        maxJourneys: 50,
        maxKiosks: 10,
        aiTokenMonthlyLimit: 2000000,
      },
      features: [
        { featureKey: "sso", name: "Single Sign-On", module: "enterprise", enabled: true, isAddOn: false },
        { featureKey: "custom_branding", name: "Custom Branding", module: "enterprise", enabled: true, isAddOn: false },
      ],
      createdBy: superAdminUser._id,
    });
    createdPackageIds.push(testPackage._id);

    // 4. Resolve default pipeline
    const existingPipeline = await Pipeline.findOne({ isDefault: true });
    if (existingPipeline) {
      defaultPipeline = existingPipeline;
    } else {
      defaultPipeline = await Pipeline.create({
        name: `Default Pipeline ${testPrefix}`,
        isDefault: true,
        stages: [
          { key: "qualification", name: "Qualification", order: 0, probability: 0.1 },
          { key: "proposal", name: "Proposal", order: 1, probability: 0.5 },
          { key: "closed_won", name: "Closed Won", order: 2, probability: 1.0 },
          { key: "closed_lost", name: "Closed Lost", order: 3, probability: 0.0 },
        ],
      });
    }

    // 5. Create Test Company
    testCompany = await Company.create({
      name: `Acme Corp ${testPrefix}`,
      domain: `acme-${testPrefix}.test`,
      industry: "Technology",
      country: "US",
      tier: "enterprise",
      status: "prospect",
    });
    createdCompanyIds.push(testCompany._id);

    // 6. Create Test Primary Contact
    testContact = await Contact.create({
      companyId: testCompany._id,
      firstName: "Jane",
      lastName: "Doe",
      fullName: "Jane Doe",
      email: `jane.doe.${testPrefix}@acme.test`,
      normalizedEmail: `jane.doe.${testPrefix}@acme.test`,
      role: "buyer",
      isPrimaryDecisionMaker: true,
      phone: "+1-555-0199",
    });
    createdContactIds.push(testContact._id);
  });

  afterAll(async () => {
    if (createdDealIds.length > 0) {
      await Deal.deleteMany({ _id: { $in: createdDealIds } });
    }
    if (createdContactIds.length > 0) {
      await Contact.deleteMany({ _id: { $in: createdContactIds } });
    }
    if (createdCompanyIds.length > 0) {
      await Company.deleteMany({ _id: { $in: createdCompanyIds } });
    }
    if (createdPackageIds.length > 0) {
      await Package.deleteMany({ _id: { $in: createdPackageIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    if (createdOrgIds.length > 0) {
      await Organization.deleteMany({ _id: { $in: createdOrgIds } });
      await CustomerAccount.deleteMany({ organizationId: { $in: createdOrgIds } });
      await AuditLog.deleteMany({ organizationId: { $in: createdOrgIds } });
    }
    await disconnectDatabase(app.log);
    await app.close();
  });

  describe("1. Route Protection & RBAC Guard", () => {
    it("should reject unauthenticated handoff requests with 401", async () => {
      const dummyDealId = new mongoose.Types.ObjectId();
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/sales/deals/${dummyDealId}/handoff`,
      });
      expect(response.statusCode).toBe(401);
    });

    it("should reject non-super_admin users with 403 Forbidden", async () => {
      const dummyDealId = new mongoose.Types.ObjectId();
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/sales/deals/${dummyDealId}/handoff`,
        headers: { authorization: `Bearer ${regularToken}` },
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe("2. Validation & Readiness Checks", () => {
    it("should return 400 when deal ID is malformed", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/deals/invalid-deal-id/handoff",
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("INVALID_DEAL_ID");
    });

    it("should return 404 when deal does not exist", async () => {
      const nonExistentDealId = new mongoose.Types.ObjectId();
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/sales/deals/${nonExistentDealId}/handoff`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("DEAL_NOT_FOUND");
    });

    it("should return 400 MISSING_PACKAGE_ID if deal has no packageId", async () => {
      const dealWithoutPkg = await Deal.create({
        name: `Deal No Package ${testPrefix}`,
        companyId: testCompany._id,
        primaryContactId: testContact._id,
        pipelineId: defaultPipeline._id,
        stage: "proposal",
        value: 50000,
        probability: 0.5,
      });
      createdDealIds.push(dealWithoutPkg._id);

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/sales/deals/${dealWithoutPkg._id}/handoff`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("MISSING_PACKAGE_ID");
    });

    it("should return 400 MISSING_PRIMARY_CONTACT if deal has no primary contact", async () => {
      const dealWithoutContact = await Deal.create({
        name: `Deal No Contact ${testPrefix}`,
        companyId: testCompany._id,
        packageId: testPackage._id,
        pipelineId: defaultPipeline._id,
        stage: "proposal",
        value: 65000,
        probability: 0.5,
      });
      createdDealIds.push(dealWithoutContact._id);

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/sales/deals/${dealWithoutContact._id}/handoff`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("MISSING_PRIMARY_CONTACT");
    });
  });

  describe("3. Core Enterprise Handoff Execution & Platform Provisioning", () => {
    let closedWonDeal: any;
    let handoffResultData: any;
    let wonEventEmitted: any = null;
    let handoffEventEmitted: any = null;

    beforeAll(async () => {
      // Subscribe to eventBus to capture emissions
      const bus = EventBus.getInstance();
      bus.subscribe("sales.deal.won" as any, (event) => {
        wonEventEmitted = event;
      });
      bus.subscribe("sales.onboarding.handoff_initiated" as any, (event) => {
        handoffEventEmitted = event;
      });

      // Create valid deal ready for handoff
      closedWonDeal = await Deal.create({
        name: `Acme Enterprise Deal ${testPrefix}`,
        companyId: testCompany._id,
        primaryContactId: testContact._id,
        packageId: testPackage._id,
        pipelineId: defaultPipeline._id,
        stage: "proposal",
        value: 120000,
        currency: "USD",
        annualRecurringRevenue: 100000,
        oneTimeImplementationFee: 20000,
        probability: 0.8,
      });
      createdDealIds.push(closedWonDeal._id);
    });

    it("should successfully execute handoff via POST /api/v1/sales/deals/:id/handoff", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/sales/deals/${closedWonDeal._id}/handoff`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          organizationName: `Acme International ${testPrefix}`,
          notes: "Priority enterprise rollout with Q4 kickoff",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();

      handoffResultData = body.data;
      expect(handoffResultData.dealId).toBe(closedWonDeal._id.toString());
      expect(handoffResultData.organizationId).toBeDefined();
      expect(handoffResultData.customerAccountId).toBeDefined();
      expect(handoffResultData.packageName).toBe(testPackage.name);
      expect(handoffResultData.alreadyCompleted).toBe(false);

      createdOrgIds.push(new mongoose.Types.ObjectId(handoffResultData.organizationId));
    });

    it("should verify Organization was provisioned with contracted package limits & details", async () => {
      const provisionedOrg = await Organization.findById(handoffResultData.organizationId);
      expect(provisionedOrg).toBeDefined();
      expect(provisionedOrg?.name).toBe(`Acme International ${testPrefix}`);
      expect(provisionedOrg?.domain).toBe(testCompany.domain);
      expect(provisionedOrg?.status).toBe("Active");
      expect(provisionedOrg?.plan).toBe(testPackage.name);
      expect(provisionedOrg?.packageId?.toString()).toBe(testPackage._id.toString());
      expect(provisionedOrg?.limits?.maxUsers).toBe(250);
      expect(provisionedOrg?.limits?.maxStorageGb).toBe(100);
      expect(provisionedOrg?.subscription?.status).toBe("active");
    });

    it("should verify Owner User was created with primary contact details", async () => {
      const ownerUser = await User.findOne({
        organizationId: handoffResultData.organizationId,
        "permissions.role": "owner",
      });
      expect(ownerUser).toBeDefined();
      expect(ownerUser?.auth.email).toBe(testContact.email.toLowerCase());
      expect(ownerUser?.profile?.firstName).toBe(testContact.firstName);
      expect(ownerUser?.profile?.lastName).toBe(testContact.lastName);
      expect(ownerUser?.permissions.role).toBe("owner");

      if (ownerUser) {
        createdUserIds.push(ownerUser._id);
      }
    });

    it("should verify CustomerAccount was created in super admin finance collection", async () => {
      const customerAccount = await CustomerAccount.findOne({
        organizationId: handoffResultData.organizationId,
      });
      expect(customerAccount).toBeDefined();
      expect(customerAccount?._id.toString()).toBe(handoffResultData.customerAccountId);
      expect(customerAccount?.accountStatus).toBe("good_standing");
      expect(customerAccount?.preferredCurrency).toBe("USD");
      expect(customerAccount?.billingContact?.email).toBe(testContact.email.toLowerCase());
      expect(customerAccount?.billingContact?.name).toBe(testContact.fullName);
    });

    it("should verify Deal and Company were linked and statuses updated", async () => {
      const updatedDeal = await Deal.findById(closedWonDeal._id);
      expect(updatedDeal?.stage).toBe("closed_won");
      expect(updatedDeal?.probability).toBe(1.0);
      expect(updatedDeal?.actualCloseDate).toBeDefined();
      expect(updatedDeal?.wonDetails?.onboardingHandedOff).toBe(true);
      expect(updatedDeal?.wonDetails?.organizationId?.toString()).toBe(handoffResultData.organizationId);

      const updatedCompany = await Company.findById(testCompany._id);
      expect(updatedCompany?.status).toBe("customer");
      expect(updatedCompany?.convertedOrganizationId?.toString()).toBe(handoffResultData.organizationId);
    });

    it("should verify EventBus received sales.deal.won and sales.onboarding.handoff_initiated events", async () => {
      expect(wonEventEmitted).toBeDefined();
      expect(wonEventEmitted.eventName).toBe("sales.deal.won");
      expect(wonEventEmitted.payload.dealId.toString()).toBe(closedWonDeal._id.toString());
      expect(wonEventEmitted.payload.organizationId.toString()).toBe(handoffResultData.organizationId);

      expect(handoffEventEmitted).toBeDefined();
      expect(handoffEventEmitted.eventName).toBe("sales.onboarding.handoff_initiated");
      expect(handoffEventEmitted.payload.dealId.toString()).toBe(closedWonDeal._id.toString());
      expect(handoffEventEmitted.payload.contactEmail).toBe(testContact.email.toLowerCase());
      expect(handoffEventEmitted.payload.packageId.toString()).toBe(testPackage._id.toString());
    });

    it("should verify AuditLog entry was recorded for HANDOFF_INITIATED", async () => {
      const auditLog = await AuditLog.findOne({
        eventType: "HANDOFF_INITIATED",
        resourceId: closedWonDeal._id,
      });
      expect(auditLog).toBeDefined();
      expect(auditLog?.eventCategory).toBe("sales");
      expect(auditLog?.resourceType).toBe("sales_deal");
      expect(auditLog?.organizationId?.toString()).toBe(handoffResultData.organizationId);
    });
  });

  describe("4. Idempotency Safeguard & Retry Handling", () => {
    it("should return existing handoff metadata on retry and avoid duplicate orgs or customer accounts", async () => {
      const existingDeal = await Deal.findOne({
        "wonDetails.onboardingHandedOff": true,
        companyId: testCompany._id,
      });
      expect(existingDeal).toBeDefined();

      const initialOrgsCount = await Organization.countDocuments({ domain: testCompany.domain });
      const initialAccountsCount = await CustomerAccount.countDocuments({
        organizationId: existingDeal?.wonDetails?.organizationId,
      });

      // Call handoff second time on already handed-off deal
      const retryResponse = await app.inject({
        method: "POST",
        url: `/api/v1/sales/deals/${existingDeal!._id}/handoff`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: { notes: "Retry call" },
      });

      expect(retryResponse.statusCode).toBe(200);
      const body = JSON.parse(retryResponse.body);
      expect(body.success).toBe(true);
      expect(body.data.alreadyCompleted).toBe(true);
      expect(body.data.dealId).toBe(existingDeal!._id.toString());
      expect(body.data.organizationId).toBe(existingDeal?.wonDetails?.organizationId?.toString());

      // Assert database counts remain strictly unchanged
      const afterOrgsCount = await Organization.countDocuments({ domain: testCompany.domain });
      const afterAccountsCount = await CustomerAccount.countDocuments({
        organizationId: existingDeal?.wonDetails?.organizationId,
      });

      expect(afterOrgsCount).toBe(initialOrgsCount);
      expect(afterAccountsCount).toBe(initialAccountsCount);
    });
  });

  describe("5. Stage Update with Auto-Handoff Trigger", () => {
    it("should trigger handoff when PATCH /deals/:id/stage transitions to closed_won with onboardingHandedOff=true", async () => {
      // Create separate company and contact for auto-stage handoff test
      const autoCompany = await Company.create({
        name: `Beta Corp ${testPrefix}`,
        domain: `beta-${testPrefix}.test`,
        industry: "Finance",
        tier: "growth",
        status: "qualified",
      });
      createdCompanyIds.push(autoCompany._id);

      const autoContact = await Contact.create({
        companyId: autoCompany._id,
        firstName: "Bob",
        lastName: "Smith",
        fullName: "Bob Smith",
        email: `bob.smith.${testPrefix}@beta.test`,
        normalizedEmail: `bob.smith.${testPrefix}@beta.test`,
        role: "approver",
        isPrimaryDecisionMaker: true,
      });
      createdContactIds.push(autoContact._id);

      const stageDeal = await Deal.create({
        name: `Beta Growth Deal ${testPrefix}`,
        companyId: autoCompany._id,
        primaryContactId: autoContact._id,
        packageId: testPackage._id,
        pipelineId: defaultPipeline._id,
        stage: "proposal",
        value: 80000,
        currency: "USD",
        probability: 0.6,
      });
      createdDealIds.push(stageDeal._id);

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/deals/${stageDeal._id}/stage`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          stage: "closed_won",
          wonDetails: {
            contractSignedDate: new Date().toISOString(),
            approvedBy: superAdminUser._id.toString(),
            onboardingHandedOff: true,
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.stage).toBe("closed_won");
      expect(body.data.probability).toBe(1.0);
      expect(body.data.wonDetails.onboardingHandedOff).toBe(true);
      expect(body.data.wonDetails.organizationId).toBeDefined();

      createdOrgIds.push(new mongoose.Types.ObjectId(body.data.wonDetails.organizationId));

      // Verify the organization and customer accounts exist
      const provisionedOrg = await Organization.findById(body.data.wonDetails.organizationId);
      expect(provisionedOrg).toBeDefined();
      expect(provisionedOrg?.name).toBe(autoCompany.name);

      const account = await CustomerAccount.findOne({ organizationId: provisionedOrg?._id });
      expect(account).toBeDefined();
      expect(account?.billingContact?.email).toBe(autoContact.email.toLowerCase());
    });
  });
});
