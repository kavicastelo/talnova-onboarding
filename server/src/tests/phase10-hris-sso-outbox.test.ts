import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import crypto from "crypto";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import HRISIntegration from "../modules/integrations/models/hris-integration.model.js";
import HRISWebhookLog from "../modules/integrations/models/hris-webhook-log.model.js";
import OutboxEvent from "../modules/onboarding/models/outbox-event.model.js";
import OnboardingCase from "../modules/onboarding/models/onboarding-case.model.js";
import Task from "../modules/tasks/models/task.model.js";
import DocumentTemplate from "../modules/documents/models/document-template.model.js";
import DocumentAssignment from "../modules/documents/models/document-assignment.model.js";
import { Journey } from "../modules/journeys/models/journey.model.js";
import EmployeeAssignment from "../modules/assignments/models/assignment.model.js";
import SSOConfig from "../modules/auth/models/sso-config.model.js";
import outboxPublisherService from "../modules/onboarding/services/outbox-publisher.service.js";

describe("Phase 10 — Enterprise HRIS Webhook Ingestion, JIT SSO & Outbox Sync", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let adminUser: any;
  let adminToken: string;
  let integration: any;
  let engineeringJourney: any;

  const ts = Date.now();
  const dummyId = new mongoose.Types.ObjectId();
  const webhookSecret = "bamboohr_prod_secret_key_987654";

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: "Global Enterprise Holdings",
      slug: `global-enterprise-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Admin User
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `admin-${ts}@globalenterprise.com`,
        passwordHash: "hashed_admin_pass",
      },
      profile: {
        firstName: "Victoria",
        lastName: "Administrator",
        fullName: "Victoria Administrator",
      },
      permissions: {
        role: "admin",
      },
      employment: {
        status: "active",
        employmentType: "full_time",
      },
    });

    adminToken = app.jwt.sign({
      userId: adminUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "admin",
    });

    // 3. Create BambooHR Integration Connector with Secret
    integration = await HRISIntegration.create({
      organizationId: testOrg._id,
      provider: "bamboohr",
      name: "BambooHR Production Sync",
      status: "active",
      apiKey: "bamboo_api_key_test_123",
      webhookSecret,
      subdomain: "globalenterprise",
      fieldMappings: [
        { externalField: "work_email", internalField: "email" },
        { externalField: "first_name", internalField: "firstName" },
        { externalField: "last_name", internalField: "lastName" },
        { externalField: "department", internalField: "department" },
        { externalField: "job_title", internalField: "jobTitle" },
      ],
      conflictPolicy: "hris_wins",
      autoProvisionJourneys: true,
      createdBy: adminUser._id,
    });

    // 4. Create Engineering Journey Template
    engineeringJourney = await Journey.create({
      organizationId: testOrg._id,
      title: "Engineering Core Onboarding Journey",
      slug: `engineering-core-${ts}`,
      description: "Standard onboarding roadmap for software engineers",
      department: "Engineering",
      audience: {
        departmentNames: ["Engineering"],
        autoEnrollNewHires: true,
      },
      publishing: {
        status: "published",
        version: 1,
      },
      createdBy: adminUser._id,
      isDeleted: false,
    });

    // 5. Configure SSO Configuration
    await SSOConfig.create({
      organizationId: testOrg._id,
      enabled: true,
      provider: "saml2",
      domain: "globalenterprise.com",
      entryPoint: "https://idp.globalenterprise.com/sso",
      defaultRole: "employee",
      roleMappings: [
        { idpGroup: "Engineering-Leads", role: "manager" },
        { idpGroup: "HR-Admins", role: "admin" },
      ],
      createdBy: adminUser._id,
    });
  });

  afterAll(async () => {
    await User.deleteMany({ organizationId: testOrg._id });
    await Organization.deleteMany({ _id: testOrg._id });
    await HRISIntegration.deleteMany({ organizationId: testOrg._id });
    await HRISWebhookLog.deleteMany({ organizationId: testOrg._id });
    await OutboxEvent.deleteMany({ organizationId: testOrg._id });
    await OnboardingCase.deleteMany({ organizationId: testOrg._id });
    await Task.deleteMany({ organizationId: testOrg._id });
    await DocumentTemplate.deleteMany({ organizationId: testOrg._id });
    await DocumentAssignment.deleteMany({ organizationId: testOrg._id });
    await Journey.deleteMany({ organizationId: testOrg._id });
    await EmployeeAssignment.deleteMany({ organizationId: testOrg._id });
    await SSOConfig.deleteMany({ organizationId: testOrg._id });
    await app.close();
  });

  describe("1. Webhook HMAC Signature Verification Test (INT-002)", () => {
    it("should reject webhook request missing HMAC signature with HTTP 401", async () => {
      const payload = {
        event: "employee.created",
        eventId: `evt-missing-sig-${Date.now()}`,
        data: {
          email: "unsigned@globalenterprise.com",
          first_name: "Unsigned",
          last_name: "User",
        },
      };

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/integrations/webhooks/bamboohr",
        payload,
      });

      expect(res.statusCode).toBe(401);
      const json = res.json();
      expect(json.success).toBe(false);
      expect(json.message).toContain("signature");
    });

    it("should reject webhook request with invalid HMAC signature with HTTP 401", async () => {
      const payload = {
        event: "employee.created",
        eventId: `evt-invalid-sig-${Date.now()}`,
        data: {
          email: "hacker@globalenterprise.com",
          first_name: "Tampered",
          last_name: "Payload",
        },
      };

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/integrations/webhooks/bamboohr",
        headers: {
          "x-signature": "invalid_fake_hmac_signature_hex",
        },
        payload,
      });

      expect(res.statusCode).toBe(401);
      const json = res.json();
      expect(json.success).toBe(false);
      expect(json.message).toContain("Invalid webhook HMAC signature");
    });

    it("should accept webhook request with valid HMAC-SHA256 signature with HTTP 200", async () => {
      const payload = {
        event: "employee.created",
        eventId: `evt-valid-sig-${Date.now()}`,
        data: {
          work_email: `valid-hire-${Date.now()}@globalenterprise.com`,
          first_name: "Arthur",
          last_name: "Dent",
          department: "Engineering",
        },
      };

      const payloadStr = JSON.stringify(payload);
      const validSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(payloadStr)
        .digest("hex");

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/integrations/webhooks/bamboohr",
        headers: {
          "x-signature": validSignature,
        },
        payload,
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("received");
    });
  });

  describe("2. Webhook Idempotency & Transactional Outbox Ingestion", () => {
    it("should store event in HRISWebhookLog and write to outbox_events", async () => {
      const eventId = `bamboo-evt-${Date.now()}`;
      const payload = {
        event: "employee.created",
        eventId,
        data: {
          work_email: `idempotent-hire-${Date.now()}@globalenterprise.com`,
          first_name: "Ford",
          last_name: "Prefect",
          department: "Engineering",
        },
      };

      const payloadStr = JSON.stringify(payload);
      const signature = crypto.createHmac("sha256", webhookSecret).update(payloadStr).digest("hex");

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/integrations/webhooks/bamboohr",
        headers: {
          "x-signature": signature,
        },
        payload,
      });

      expect(res.statusCode).toBe(200);

      // Verify HRISWebhookLog record exists
      const log = await HRISWebhookLog.findOne({
        organizationId: testOrg._id,
        eventId,
      });
      expect(log).toBeDefined();
      expect(log?.status).toBe("received");
      expect(log?.provider).toBe("bamboohr");

      // Verify OutboxEvent record exists
      const outbox = await OutboxEvent.findOne({
        organizationId: testOrg._id,
        aggregateType: "hris_integration",
        "payload.eventId": eventId,
      });
      expect(outbox).toBeDefined();
      expect(outbox?.eventName).toBe("hris.employee.created");
    });

    it("should idempotently deduplicate redundant webhook deliveries without creating duplicate outbox events", async () => {
      const eventId = `bamboo-duplicate-${Date.now()}`;
      const payload = {
        event: "employee.created",
        eventId,
        data: {
          work_email: `duplicate-test-${Date.now()}@globalenterprise.com`,
          first_name: "Tricia",
          last_name: "McMillan",
        },
      };

      const signature = crypto.createHmac("sha256", webhookSecret).update(JSON.stringify(payload)).digest("hex");

      // First delivery
      const res1 = await app.inject({
        method: "POST",
        url: "/api/v1/integrations/webhooks/bamboohr",
        headers: { "x-signature": signature },
        payload,
      });
      expect(res1.statusCode).toBe(200);

      // Duplicate delivery
      const res2 = await app.inject({
        method: "POST",
        url: "/api/v1/integrations/webhooks/bamboohr",
        headers: { "x-signature": signature },
        payload,
      });
      expect(res2.statusCode).toBe(200);
      const json2 = res2.json();
      expect(json2.data.duplicate).toBe(true);

      // Assert only 1 OutboxEvent exists
      const count = await OutboxEvent.countDocuments({
        organizationId: testOrg._id,
        "payload.eventId": eventId,
      });
      expect(count).toBe(1);
    });
  });

  describe("3. Outbox Worker Lifecycle Ingestion & State Machine Orchestration", () => {
    it("should process hris.employee.created outbox event, create User, OnboardingCase, and mark log processed", async () => {
      const email = `outbox-worker-emp-${Date.now()}@globalenterprise.com`;
      const eventId = `worker-evt-${Date.now()}`;
      const payload = {
        event: "employee.created",
        eventId,
        data: {
          work_email: email,
          first_name: "Zaphod",
          last_name: "Beeblebrox",
          department: "Engineering",
          job_title: "President of Galaxy",
        },
      };

      const signature = crypto.createHmac("sha256", webhookSecret).update(JSON.stringify(payload)).digest("hex");

      await app.inject({
        method: "POST",
        url: "/api/v1/integrations/webhooks/bamboohr",
        headers: { "x-signature": signature },
        payload,
      });

      // Execute outbox publisher worker
      const outboxRes = await outboxPublisherService.publishPending();
      expect(outboxRes.published).toBeGreaterThanOrEqual(1);

      // Verify User was created
      const user = await User.findOne({
        organizationId: testOrg._id,
        "auth.email": email.toLowerCase(),
      });
      expect(user).toBeDefined();
      expect(user?.profile.firstName).toBe("Zaphod");
      expect(user?.employment.department).toBe("Engineering");

      // Verify OnboardingCase was created with source "hris"
      const onboardingCase = await OnboardingCase.findOne({
        organizationId: testOrg._id,
        employeeId: user?._id,
      });
      expect(onboardingCase).toBeDefined();
      expect(onboardingCase?.source).toBe("hris");

      // Verify HRISWebhookLog was updated to processed
      const webhookLog = await HRISWebhookLog.findOne({
        organizationId: testOrg._id,
        eventId,
      });
      expect(webhookLog?.status).toBe("processed");
    });
  });

  describe("4. UQ-03 Formal Termination & Legal Retention Policy Verification", () => {
    it("should cancel OnboardingCase, cancel pending tasks, revoke incomplete documents, and preserve signed NDA with immutable SHA-256 hash", async () => {
      const termEmail = `term-employee-${Date.now()}@globalenterprise.com`;

      // 1. Seed Target Employee
      const terminatedUser = await User.create({
        organizationId: testOrg._id,
        auth: {
          email: termEmail,
          passwordHash: "hash_term_123",
        },
        profile: {
          firstName: "Marvin",
          lastName: "Paranoid",
          fullName: "Marvin Paranoid",
        },
        employment: {
          department: "Engineering",
          jobTitle: "Android",
          status: "onboarding",
          onboardingState: "active",
          employmentType: "full_time",
        },
        permissions: {
          role: "employee",
        },
      });

      // 2. Seed OnboardingCase
      const onboardingCase = await OnboardingCase.create({
        organizationId: testOrg._id,
        employeeId: terminatedUser._id,
        source: "hris",
        idempotencyKey: `term-case-${terminatedUser._id}`,
        state: "active",
        transitions: [
          { from: null, to: "created", at: new Date() },
          { from: "created", to: "active", at: new Date() },
        ],
        isDeleted: false,
      });

      // 3. Seed 2 Operational Tasks (1 pending, 1 in_progress)
      const pendingTask = await Task.create({
        organizationId: testOrg._id,
        employeeId: terminatedUser._id,
        assignedToUserId: adminUser._id,
        createdBy: adminUser._id,
        title: "Provision Workstation & Credentials",
        category: "it_setup",
        stage: "preboarding",
        status: "pending",
        isDeleted: false,
      });

      const inProgressTask = await Task.create({
        organizationId: testOrg._id,
        employeeId: terminatedUser._id,
        assignedToUserId: adminUser._id,
        createdBy: adminUser._id,
        title: "Manager 1-on-1 Introduction",
        category: "general",
        stage: "day_1",
        status: "in_progress",
        isDeleted: false,
      });

      // 4. Seed Document Template & Signed NDA Assignment
      const ndaTemplate = await DocumentTemplate.create({
        organizationId: testOrg._id,
        title: "Employee Non-Disclosure Agreement (NDA)",
        category: "nda",
        content: "Strict Confidentiality Terms...",
        signatureRequired: true,
        version: 1,
        createdBy: adminUser._id,
      });

      const originalHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
      const signedNDA = await DocumentAssignment.create({
        organizationId: testOrg._id,
        templateId: ndaTemplate._id,
        templateTitle: ndaTemplate.title,
        templateVersion: 1,
        employeeId: terminatedUser._id,
        assignedBy: adminUser._id,
        status: "signed",
        signedAt: new Date(),
        renderedContent: "Signed Agreement Content",
        signatureData: {
          type: "draw",
          signerName: "Marvin Paranoid",
          signedAt: new Date(),
          ipAddress: "192.168.1.50",
          sha256Hash: originalHash,
        },
        isDeleted: false,
      });

      // 5. Seed Incomplete Compliance Document (pending signature)
      const incompleteDoc = await DocumentAssignment.create({
        organizationId: testOrg._id,
        templateId: ndaTemplate._id,
        templateTitle: "Direct Deposit Payroll Form",
        templateVersion: 1,
        employeeId: terminatedUser._id,
        assignedBy: adminUser._id,
        status: "pending",
        isDeleted: false,
      });

      // 6. Dispatch EMPLOYEE_TERMINATED Webhook
      const termEventId = `term-evt-${Date.now()}`;
      const termPayload = {
        event: "employee.terminated",
        eventId: termEventId,
        data: {
          work_email: termEmail,
          employeeId: terminatedUser._id.toString(),
          terminatedAt: new Date().toISOString(),
          terminationReason: "Contract Expiration",
        },
      };

      const termSig = crypto.createHmac("sha256", webhookSecret).update(JSON.stringify(termPayload)).digest("hex");

      const webhookRes = await app.inject({
        method: "POST",
        url: "/api/v1/integrations/webhooks/bamboohr",
        headers: { "x-signature": termSig },
        payload: termPayload,
      });
      expect(webhookRes.statusCode).toBe(200);

      // 7. Trigger Outbox Publisher Worker to execute termination lifecycle
      await outboxPublisherService.publishPending();

      // ==========================================
      // UQ-03 Authoritative Verification Assertions
      // ==========================================

      // A. OnboardingCase must transition to 'cancelled' with 'hris_termination_event'
      const updatedCase = await OnboardingCase.findById(onboardingCase._id);
      expect(updatedCase?.state).toBe("cancelled");
      expect(updatedCase?.stateReason).toBe("hris_termination_event");

      // B. Pending and in-progress tasks must transition to 'cancelled'
      const checkTask1 = await Task.findById(pendingTask._id);
      expect(checkTask1?.status).toBe("cancelled");
      expect(checkTask1?.statusHistory?.[checkTask1.statusHistory.length - 1]?.note).toContain(
        "HRIS termination event"
      );

      const checkTask2 = await Task.findById(inProgressTask._id);
      expect(checkTask2?.status).toBe("cancelled");

      // C. Incomplete document must transition to 'revoked' with audit trail entry
      const checkIncomplete = await DocumentAssignment.findById(incompleteDoc._id);
      expect(checkIncomplete?.status).toBe("revoked");
      expect(checkIncomplete?.revokedReason).toBe("employee_terminated");
      const auditEntry = checkIncomplete?.auditTrail?.find((a) => a.action === "revoked");
      expect(auditEntry).toBeDefined();
      expect(auditEntry?.details).toContain(
        "Document assignment revoked due to employee termination prior to signature."
      );

      // D. Signed NDA must remain intact with status 'signed' and unchanged cryptographic hash
      const checkSignedNDA = await DocumentAssignment.findById(signedNDA._id);
      expect(checkSignedNDA?.status).toBe("signed");
      expect(checkSignedNDA?.signatureData?.sha256Hash).toBe(originalHash);
      expect(checkSignedNDA?.signatureData?.ipAddress).toBe("192.168.1.50");
      expect(checkSignedNDA?.complianceRetention).toBe(true);
      expect(checkSignedNDA?.archivedAt).toBeDefined();

      // E. User record must transition to terminated & isDeleted true
      const checkUser = await User.findById(terminatedUser._id);
      expect(checkUser?.employment.status).toBe("terminated");
      expect(checkUser?.isDeleted).toBe(true);
    });
  });

  describe("5. Manual Guardrail: HR Ops Legal Hold Override", () => {
    it("should place manual Legal Hold via POST /api/v1/employees/:id/legal-hold and prevent automated revocation/archiving", async () => {
      const holdEmail = `legal-hold-${Date.now()}@globalenterprise.com`;

      // 1. Create Employee
      const protectedUser = await User.create({
        organizationId: testOrg._id,
        auth: { email: holdEmail, passwordHash: "pass123" },
        profile: { firstName: "Trillian", lastName: "Astra", fullName: "Trillian Astra" },
        employment: { department: "Engineering", status: "active", employmentType: "full_time" },
        permissions: { role: "employee" },
      });

      // 2. Seed Pending Document
      const pendingDoc = await DocumentAssignment.create({
        organizationId: testOrg._id,
        templateId: new mongoose.Types.ObjectId(),
        templateTitle: "Compliance Policy Acknowledgment",
        templateVersion: 1,
        employeeId: protectedUser._id,
        assignedBy: adminUser._id,
        status: "pending",
        isDeleted: false,
      });

      // 3. HR Admin places Legal Hold
      const holdRes = await app.inject({
        method: "POST",
        url: `/api/v1/employees/${protectedUser._id}/legal-hold`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          legalHold: true,
          reason: "Pending litigation subpoena compliance inspection",
        },
      });

      expect(holdRes.statusCode).toBe(200);
      const holdJson = holdRes.json();
      expect(holdJson.success).toBe(true);
      expect(holdJson.data.compliance.legalHold).toBe(true);
      expect(holdJson.data.compliance.legalHoldReason).toContain("litigation subpoena");

      // 4. Simulate inbound termination event for employee under Legal Hold
      const termPayload = {
        event: "employee.terminated",
        eventId: `term-hold-${Date.now()}`,
        data: {
          work_email: holdEmail,
          employeeId: protectedUser._id.toString(),
        },
      };

      const termSig = crypto.createHmac("sha256", webhookSecret).update(JSON.stringify(termPayload)).digest("hex");

      await app.inject({
        method: "POST",
        url: "/api/v1/integrations/webhooks/bamboohr",
        headers: { "x-signature": termSig },
        payload: termPayload,
      });

      await outboxPublisherService.publishPending();

      // 5. Assert: Document must NOT be revoked due to active Legal Hold
      const docCheck = await DocumentAssignment.findById(pendingDoc._id);
      expect(docCheck?.status).toBe("pending"); // Preserved under legal hold
      expect(docCheck?.status).not.toBe("revoked");
    });
  });

  describe("6. Enterprise SSO JIT Provisioning Pipeline & Journey Auto-Assignment", () => {
    it("should provision user Just-In-Time with authProvider 'saml2', create OnboardingCase with source 'sso', and assign Engineering Journey", async () => {
      const ssoEmail = `sso-jit-engineer-${Date.now()}@globalenterprise.com`;

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/sso/callback",
        payload: {
          organizationId: testOrg._id.toString(),
          email: ssoEmail,
          firstName: "Slartibartfast",
          lastName: "Magrathea",
          department: "Engineering",
          role: "employee",
          authProvider: "saml2",
          ssoId: `saml_assertion_${Date.now()}`,
          idpGroups: ["Engineering-Contributors"],
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.user.auth.email).toBe(ssoEmail.toLowerCase());
      expect(json.data.user.auth.authProvider).toBe("saml2");
      expect(json.data.user.employment.department).toBe("Engineering");
      expect(json.data.token).toBeDefined();

      const createdUser = await User.findOne({
        organizationId: testOrg._id,
        "auth.email": ssoEmail.toLowerCase(),
      });
      expect(createdUser).toBeDefined();

      // Assert OnboardingCase was instantiated with source "sso"
      const onboardingCase = await OnboardingCase.findOne({
        organizationId: testOrg._id,
        employeeId: createdUser?._id,
      });
      expect(onboardingCase).toBeDefined();
      expect(onboardingCase?.source).toBe("sso");
      expect(["resolving", "provisioning", "ready", "active"]).toContain(onboardingCase?.state);

      // Assert Engineering Journey was auto-assigned based on SAML department claim
      const journeyAssignment = await EmployeeAssignment.findOne({
        organizationId: testOrg._id,
        employeeId: createdUser?._id,
      });
      expect(journeyAssignment).toBeDefined();
      const assignedJourneyId =
        (journeyAssignment as any)?.journey?.journeyId ||
        (journeyAssignment as any)?.journeyId;
      expect(assignedJourneyId?.toString()).toBe(engineeringJourney._id.toString());
    });
  });
});
