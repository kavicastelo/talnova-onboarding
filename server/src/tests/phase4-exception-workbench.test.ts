import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Journey from "../modules/journeys/models/journey.model.js";
import EmployeeAssignment from "../modules/assignments/models/assignment.model.js";
import Task from "../modules/tasks/models/task.model.js";
import DocumentAssignment from "../modules/documents/models/document-assignment.model.js";
import OnboardingCase from "../modules/onboarding/models/onboarding-case.model.js";
import OutboxEvent from "../modules/onboarding/models/outbox-event.model.js";
import AuditLog from "../modules/audit-logs/models/audit-log.model.js";
import OnboardingHealth from "../modules/analytics/models/onboarding-health.model.js";
import Notification from "../modules/notifications/models/notification.model.js";
import onboardingCaseService from "../modules/onboarding/services/onboarding-case.service.js";
import registerEventSubscribers from "../infrastructure/events/event-subscribers.js";

describe("Phase 4 — Hybrid Manual Override Layer & HR Exception Workbench", () => {
  let app: FastifyInstance;
  let orgId: mongoose.Types.ObjectId;
  let adminId: mongoose.Types.ObjectId;
  let managerId: mongoose.Types.ObjectId;
  let employeeId: mongoose.Types.ObjectId;
  let adminToken: string;
  let employeeToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();
    registerEventSubscribers();

    orgId = new mongoose.Types.ObjectId();
    adminId = new mongoose.Types.ObjectId();
    managerId = new mongoose.Types.ObjectId();
    employeeId = new mongoose.Types.ObjectId();

    await Organization.create({
      _id: orgId,
      name: "Workbench Apex Corp",
      slug: `workbench-corp-${Date.now()}`,
      active: true,
      createdBy: adminId,
    });

    await User.create([
      {
        _id: adminId,
        organizationId: orgId,
        auth: { email: `admin-${Date.now()}@workbench.corp`, passwordHash: "dummy" },
        profile: { firstName: "Admin", lastName: "Officer", fullName: "Admin Officer", timezone: "UTC" },
        permissions: { role: "admin", customRoles: [] },
        employment: { status: "active", employmentType: "full_time" },
      },
      {
        _id: managerId,
        organizationId: orgId,
        auth: { email: `manager-${Date.now()}@workbench.corp`, passwordHash: "dummy" },
        profile: { firstName: "Team", lastName: "Lead", fullName: "Team Lead", timezone: "UTC" },
        permissions: { role: "manager", customRoles: [] },
        employment: { status: "active", employmentType: "full_time" },
      },
      {
        _id: employeeId,
        organizationId: orgId,
        auth: { email: `emp-bench-${Date.now()}@workbench.corp`, passwordHash: "dummy" },
        profile: { firstName: "Quarantined", lastName: "Hire", fullName: "Quarantined Hire", timezone: "UTC" },
        permissions: { role: "employee", customRoles: [] },
        employment: {
          status: "onboarding",
          department: "Special Operations",
          jobTitle: "Prompt Engineer",
          managerId,
          employmentType: "full_time",
        },
      },
    ]);

    adminToken = (app as any).jwt.sign({
      userId: adminId.toString(),
      organizationId: orgId.toString(),
      role: "admin",
      permissions: ["admin"],
    });

    employeeToken = (app as any).jwt.sign({
      userId: employeeId.toString(),
      organizationId: orgId.toString(),
      role: "employee",
      permissions: ["employee"],
    });
  });

  beforeEach(async () => {
    await OnboardingCase.deleteMany({ organizationId: orgId });
    await OutboxEvent.deleteMany({ organizationId: orgId });
    await AuditLog.deleteMany({ organizationId: orgId });
    await EmployeeAssignment.deleteMany({ organizationId: orgId });
    await Task.deleteMany({ organizationId: orgId });
    await DocumentAssignment.deleteMany({ organizationId: orgId });
    await OnboardingHealth.deleteMany({ organizationId: orgId });
    await Notification.deleteMany({ organizationId: orgId });
  });

  afterAll(async () => {
    await OnboardingCase.deleteMany({ organizationId: orgId });
    await User.deleteMany({ organizationId: orgId });
    await Organization.deleteOne({ _id: orgId });
    await disconnectDatabase(app.log);
    await app.close();
  });

  it("1. Quarantine Simulation: Quarantined case appears in Exception Workbench triage queue with diagnostic telemetry", async () => {
    const quarantinedCase = await OnboardingCase.create({
      organizationId: orgId,
      employeeId,
      source: "manual",
      idempotencyKey: `quarantine-${Date.now()}`,
      state: "paused",
      stateReason: "Rule conflict: Ambiguous department 'Special Operations' matched 0 audience criteria",
      failure: {
        resourceKey: "journey_template",
        message: "No matching workflow rule found for jobTitle: 'Prompt Engineer'",
        attempts: 1,
        lastAttemptAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      },
      transitions: [
        {
          from: "created",
          to: "resolving",
          at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        },
        {
          from: "resolving",
          to: "paused",
          at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
          reason: "Quarantined due to rule conflict",
        },
      ],
      isDeleted: false,
    });

    // Query via service directly
    const triage = await onboardingCaseService.getExceptionCases(orgId, { state: "all" });
    expect(triage.total).toBe(1);
    expect(triage.cases[0]._id).toBe(quarantinedCase._id.toString());
    expect(triage.cases[0].employee?.name).toBe("Quarantined Hire");
    expect(triage.cases[0].employee?.department).toBe("Special Operations");
    expect(triage.cases[0].daysQuarantined).toBeGreaterThanOrEqual(4);
    expect(["high", "critical"]).toContain(triage.cases[0].severity);

    // Query via Fastify HTTP endpoint
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/onboarding/exceptions?state=all",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const json = JSON.parse(response.body);
    expect(json.success).toBe(true);
    expect(json.data.length).toBe(1);
    expect(json.data[0]._id).toBe(quarantinedCase._id.toString());
    expect(json.data[0].state).toBe("paused");
  });

  it("2. Resolution & Resumption: Overrides journey, transitions case to active, assigns template, and emits outbox event", async () => {
    // Create an authoritative target journey
    const targetJourney = await Journey.create({
      organizationId: orgId,
      title: "Engineering Onboarding v2",
      slug: `eng-onboarding-v2-${Date.now()}`,
      description: "Authoritative engineering onboarding program",
      publishing: { status: "published", version: 2 },
      modules: [],
      createdBy: adminId,
    });

    const quarantinedCase = await OnboardingCase.create({
      organizationId: orgId,
      employeeId,
      source: "manual",
      idempotencyKey: `quarantine-override-${Date.now()}`,
      state: "paused",
      stateReason: "Awaiting HR manual roadmap resolution",
      transitions: [
        {
          from: "created",
          to: "paused",
          at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          reason: "Quarantined",
        },
      ],
      isDeleted: false,
    });

    const resolutionReason = "Manually verified employment contract and assigned Engineering v2 roadmap.";

    // Execute override via HTTP endpoint
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/onboarding/exceptions/${quarantinedCase._id}/resolve`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        action: "override_journey",
        targetTemplateId: targetJourney._id.toString(),
        reason: resolutionReason,
      },
    });

    expect(response.statusCode).toBe(200);
    const json = JSON.parse(response.body);
    expect(json.success).toBe(true);

    // Verify OnboardingCase state and resolvedPlan
    const updatedCase = await OnboardingCase.findById(quarantinedCase._id);
    expect(updatedCase?.state).toBe("active");
    expect(updatedCase?.resolvedPlan?.planId).toBe(targetJourney._id.toString());
    expect(updatedCase?.resolvedPlan?.reason).toBe(resolutionReason);

    // Verify Journey Assignment was created
    const assignment = await EmployeeAssignment.findOne({
      organizationId: orgId,
      employeeId,
      "journey.journeyId": targetJourney._id,
    });
    expect(assignment).not.toBeNull();
    expect(assignment?.source).toBe("manual");

    // Verify OutboxEvent emitted
    const outboxEvent = await OutboxEvent.findOne({
      organizationId: orgId,
      aggregateId: quarantinedCase._id,
      eventName: "onboarding.case.overridden",
    });
    expect(outboxEvent).not.toBeNull();
    expect(outboxEvent?.payload?.targetTemplateId).toBe(targetJourney._id.toString());
  });

  it("3. Audit Immutability: Creates immutable AuditLog entry with admin user, timestamp, and mandatory reason", async () => {
    const quarantinedCase = await OnboardingCase.create({
      organizationId: orgId,
      employeeId,
      source: "manual",
      idempotencyKey: `audit-test-${Date.now()}`,
      state: "paused",
      transitions: [],
      isDeleted: false,
    });

    const mandatoryReason = "SOC 2 Audit Override: Exception approved by HR Operations Lead";

    await onboardingCaseService.resolveException(
      quarantinedCase._id.toString(),
      orgId,
      adminId,
      {
        action: "force_activate",
        reason: mandatoryReason,
      },
      { ipAddress: "192.168.1.100", userAgent: "Mozilla/5.0 AuditBot" }
    );

    const auditEntry = await AuditLog.findOne({
      organizationId: orgId,
      resourceId: quarantinedCase._id,
      eventType: "ONBOARDING_CASE_MANUALLY_RESOLVED",
    });

    expect(auditEntry).not.toBeNull();
    expect(auditEntry?.actorUserId?.toString()).toBe(adminId.toString());
    expect(auditEntry?.action).toBe("update");
    expect(auditEntry?.metadata?.reason).toBe(mandatoryReason);
    expect(auditEntry?.request?.ipAddress).toBe("192.168.1.100");
    expect(auditEntry?.request?.userAgent).toBe("Mozilla/5.0 AuditBot");
  });

  it("4. Artifact Preservation: Pre-existing signed documents and completed tasks remain untouched", async () => {
    const targetJourney = await Journey.create({
      organizationId: orgId,
      title: "Preservation Journey",
      slug: `preservation-journey-${Date.now()}`,
      description: "Preservation test roadmap",
      publishing: { status: "published", version: 1 },
      modules: [],
      createdBy: adminId,
    });

    // Create a pre-existing signed NDA document
    const signedDoc = await DocumentAssignment.create({
      organizationId: orgId,
      templateId: new mongoose.Types.ObjectId(),
      templateTitle: "Confidentiality & NDA Agreement",
      templateVersion: 1,
      employeeId,
      assignedBy: adminId,
      status: "signed",
      signedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      signatureData: {
        type: "type",
        signerName: "Quarantined Hire",
        signedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        sha256Hash: "abcdef1234567890abcdef1234567890abcdef1234567890",
      },
      auditTrail: [
        {
          action: "signed",
          performedBy: employeeId,
          timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        },
      ],
      isDeleted: false,
    });

    // Create a completed IT setup task
    const completedTask = await Task.create({
      organizationId: orgId,
      employeeId,
      assignedToUserId: employeeId,
      createdBy: adminId,
      title: "Receive Laptop and YubiKey",
      category: "equipment",
      stage: "day_1",
      status: "completed",
      completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      comments: [],
      statusHistory: [],
      isDeleted: false,
    });

    const quarantinedCase = await OnboardingCase.create({
      organizationId: orgId,
      employeeId,
      source: "manual",
      idempotencyKey: `preservation-test-${Date.now()}`,
      state: "paused",
      transitions: [],
      isDeleted: false,
    });

    // Execute override to new journey
    await onboardingCaseService.resolveException(
      quarantinedCase._id.toString(),
      orgId,
      adminId,
      {
        action: "override_journey",
        targetTemplateId: targetJourney._id.toString(),
        reason: "Grandfathering existing signed artifacts while re-anchoring to updated path",
      }
    );

    // Verify signed document remains signed with signature data and audit trail intact
    const preservedDoc = await DocumentAssignment.findById(signedDoc._id);
    expect(preservedDoc).not.toBeNull();
    expect(preservedDoc?.status).toBe("signed");
    expect(preservedDoc?.signatureData?.sha256Hash).toBe("abcdef1234567890abcdef1234567890abcdef1234567890");
    expect(preservedDoc?.isDeleted).toBe(false);

    // Verify task remains completed
    const preservedTask = await Task.findById(completedTask._id);
    expect(preservedTask).not.toBeNull();
    expect(preservedTask?.status).toBe("completed");
    expect(preservedTask?.isDeleted).toBe(false);
  });

  it("5. Re-anchoring & Safe Reconciliation: Notifies manager and resets Velocity Sentinel baseline", async () => {
    const targetJourney = await Journey.create({
      organizationId: orgId,
      title: "Re-anchor Roadmap",
      slug: `reanchor-roadmap-${Date.now()}`,
      description: "Re-anchor test roadmap",
      publishing: { status: "published", version: 1 },
      modules: [],
      createdBy: adminId,
    });

    // Setup an existing stale OnboardingHealth record showing drop-off risk
    await OnboardingHealth.create({
      organizationId: orgId,
      employeeId,
      velocity: 0,
      expectedVelocity: 0.8,
      dropOffRiskScore: 0.9,
      riskLevel: "critical",
      daysInactive: 10,
      nudgeLevel: 3,
      suppressedReason: "Suppressed: Stalled",
    });

    const quarantinedCase = await OnboardingCase.create({
      organizationId: orgId,
      employeeId,
      source: "manual",
      idempotencyKey: `reanchor-${Date.now()}`,
      state: "paused",
      transitions: [],
      isDeleted: false,
    });

    const overrideReason = "Re-anchoring employee timeline with dedicated manager alignment";

    await onboardingCaseService.resolveException(
      quarantinedCase._id.toString(),
      orgId,
      adminId,
      {
        action: "override_journey",
        targetTemplateId: targetJourney._id.toString(),
        reason: overrideReason,
      }
    );

    // Verify Manager received alert notification
    const managerNotif = await Notification.findOne({
      recipientUserId: managerId,
      organizationId: orgId,
      type: "manager_alert",
    });
    expect(managerNotif).not.toBeNull();
    expect(managerNotif?.title).toContain("Onboarding Plan Updated");
    expect(managerNotif?.message).toContain(overrideReason);

    // Verify OnboardingHealth baseline was re-anchored
    const reanchoredHealth = await OnboardingHealth.findOne({ organizationId: orgId, employeeId });
    expect(reanchoredHealth?.riskLevel).toBe("on_track");
    expect(reanchoredHealth?.dropOffRiskScore).toBe(0.0);
    expect(reanchoredHealth?.nudgeLevel).toBe(0);
    expect(reanchoredHealth?.suppressedReason).toBeUndefined();
  });

  it("6. Regulatory Validation & Authorization Guard: Enforces 10-char reason and rejects unauthorized roles", async () => {
    const quarantinedCase = await OnboardingCase.create({
      organizationId: orgId,
      employeeId,
      source: "manual",
      idempotencyKey: `guard-test-${Date.now()}`,
      state: "paused",
      transitions: [],
      isDeleted: false,
    });

    // Test reason < 10 characters -> 400 or 422 Unprocessable Entity
    const shortReasonResponse = await app.inject({
      method: "POST",
      url: `/api/v1/onboarding/exceptions/${quarantinedCase._id}/resolve`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        action: "force_activate",
        reason: "Too short",
      },
    });

    expect([400, 422]).toContain(shortReasonResponse.statusCode);
    const jsonShort = JSON.parse(shortReasonResponse.body);
    expect(JSON.stringify(jsonShort)).toContain("Resolution reason must be at least 10 characters");

    // Test unauthorized role (employee attempting to access workbench) -> 403 Forbidden
    const unauthorizedResponse = await app.inject({
      method: "GET",
      url: "/api/v1/onboarding/exceptions",
      headers: {
        authorization: `Bearer ${employeeToken}`,
      },
    });

    expect(unauthorizedResponse.statusCode).toBe(403);
  });
});
