import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import OutboxEvent from "../modules/onboarding/models/outbox-event.model.js";
import OnboardingCase from "../modules/onboarding/models/onboarding-case.model.js";
import outboxPublisherService from "../modules/onboarding/services/outbox-publisher.service.js";
import queueService from "../infrastructure/queue/queue.service.js";
import SystemJob from "../infrastructure/queue/system-job.model.js";
import EmployeeService from "../modules/employees/services/employee.service.js";
import EmployeeRepository from "../modules/employees/repositories/employee.repository.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import eventBus from "../infrastructure/events/event-bus.js";

describe("Phase 1 — Durable Event-Driven Architecture & Outbox Resilience", () => {
  let app: FastifyInstance;
  let orgId: mongoose.Types.ObjectId;
  let adminId: mongoose.Types.ObjectId;
  let employeeService: EmployeeService;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    employeeService = new EmployeeService(new EmployeeRepository());

    orgId = new mongoose.Types.ObjectId();
    adminId = new mongoose.Types.ObjectId();

    await Organization.create({
      _id: orgId,
      name: "Outbox Resilience Corp",
      slug: `resilience-${Date.now()}`,
      departments: [{ _id: new mongoose.Types.ObjectId(), name: "Engineering", active: true }],
      active: true,
      createdBy: adminId,
    });

    await User.create({
      _id: adminId,
      organizationId: orgId,
      auth: { email: `admin-${Date.now()}@resilience.corp`, passwordHash: "dummyHash" },
      profile: { firstName: "Admin", lastName: "Owner", fullName: "Admin Owner" },
      permissions: { role: "admin", customRoles: [] },
      employment: { status: "active", employmentType: "full_time" },
      createdBy: adminId,
    });
  });

  afterAll(async () => {
    if (orgId) {
      await OutboxEvent.deleteMany({ organizationId: orgId });
      await OnboardingCase.deleteMany({ organizationId: orgId });
      await SystemJob.deleteMany({ organizationId: orgId });
      await User.deleteMany({ organizationId: orgId });
      await Organization.deleteMany({ _id: orgId });
    }
    if (app) await app.close();
    await disconnectDatabase(app?.log);
  });

  describe("1. Outbox Event Publishing & Dead-Letter Handling", () => {
    it("should atomically publish pending outbox events", async () => {
      const caseId = new mongoose.Types.ObjectId();
      const correlationId = `corr-${Date.now()}`;

      await OutboxEvent.create({
        organizationId: orgId,
        aggregateType: "onboarding_case",
        aggregateId: caseId,
        eventName: "onboarding.case.created",
        correlationId,
        payload: { caseId: caseId.toString(), test: true },
        status: "pending",
      });

      const { published, failed } = await outboxPublisherService.publishPending(10);
      expect(published).toBeGreaterThanOrEqual(1);

      const publishedEvent = await OutboxEvent.findOne({ correlationId });
      expect(publishedEvent?.status).toBe("published");
      expect(publishedEvent?.publishedAt).toBeDefined();
    });

    it("should transition events to dead_letter after exceeding max retry attempts", async () => {
      const caseId = new mongoose.Types.ObjectId();
      const correlationId = `dlq-${Date.now()}`;

      // Temporarily register a subscriber that throws to simulate downstream failure
      const unsub = eventBus.subscribe("ONBOARDING_CASE_CREATED", async (event) => {
        if (event.correlationId === correlationId) {
          throw new Error("Simulated subscriber crash");
        }
      });

      const event = await OutboxEvent.create({
        organizationId: orgId,
        aggregateType: "onboarding_case",
        aggregateId: caseId,
        eventName: "onboarding.case.created",
        correlationId,
        payload: { failureTest: true },
        status: "pending",
        attempts: 4, // Next failure makes it attempt 5 -> dead_letter
      });

      const res = await outboxPublisherService.publishPending(10);
      expect(res.failed).toBeGreaterThanOrEqual(1);

      const deadLetterEvent = await OutboxEvent.findById(event._id);
      expect(deadLetterEvent?.status).toBe("dead_letter");
      expect(deadLetterEvent?.lastError).toContain("Dead letter");

      unsub();
    });
  });

  describe("2. Persistent Queue & SystemJob Resiliency", () => {
    it("should persist queued jobs in MongoDB SystemJob collection", async () => {
      const uniqueId = `job-${Date.now()}`;
      let executed = false;

      queueService.registerWorker("test_persistent_worker", async (job) => {
        executed = true;
      });

      const job = await queueService.enqueue(
        "test_persistent_worker",
        { taskId: uniqueId },
        {
          organizationId: orgId,
          idempotencyKey: uniqueId,
        }
      );

      expect(job).not.toBeNull();

      // Wait for queue and DB update to complete
      let attempts = 0;
      let dbJob = null;
      while (attempts++ < 20) {
        await new Promise((r) => setTimeout(r, 100));
        dbJob = await SystemJob.findOne({ organizationId: orgId, idempotencyKey: uniqueId });
        if (dbJob?.status === "completed") break;
      }

      expect(executed).toBe(true);
      expect(dbJob).not.toBeNull();
      expect(dbJob?.status).toBe("completed");
    });
  });

  describe("3. Employee Ingestion & Reactive State Machine Integration", () => {
    it("should create User, OnboardingCase, and OutboxEvent upon employee invitation", async () => {
      const email = `newhire-${Date.now()}@resilience.corp`;

      const newHire = await employeeService.inviteEmployee(
        orgId,
        {
          email,
          firstName: "John",
          lastName: "Doe",
          role: "employee",
          departmentId: "Engineering",
          employmentType: "full_time",
        },
        adminId
      );

      expect(newHire).toBeDefined();
      expect(newHire._id).toBeDefined();

      // Verify OnboardingCase was created and transitioned
      const onboardingCase = await OnboardingCase.findOne({
        organizationId: orgId,
        employeeId: newHire._id,
        isDeleted: false,
      });

      expect(onboardingCase).not.toBeNull();
      expect(["created", "resolving", "provisioning", "ready", "active"]).toContain(onboardingCase?.state);

      // Verify OutboxEvent exists
      const outboxRecord = await OutboxEvent.findOne({
        organizationId: orgId,
        aggregateId: onboardingCase?._id,
      });

      expect(outboxRecord).not.toBeNull();
      expect(outboxRecord?.aggregateType).toBe("onboarding_case");
    });

    it("should emit USER_UPDATED and USER_DEPARTMENT_CHANGED on department mutation", async () => {
      const email = `deptchange-${Date.now()}@resilience.corp`;
      const newHire = await employeeService.inviteEmployee(
        orgId,
        {
          email,
          firstName: "Jane",
          lastName: "Smith",
          role: "employee",
          departmentId: "Engineering",
          employmentType: "full_time",
        },
        adminId
      );

      let departmentChangedFired = false;
      let userUpdatedFired = false;

      const unsub1 = eventBus.subscribe("USER_DEPARTMENT_CHANGED", async (env) => {
        if (env.actorId?.toString() === newHire._id.toString()) {
          departmentChangedFired = true;
        }
      });

      const unsub2 = eventBus.subscribe("USER_UPDATED", async (env) => {
        if (env.actorId?.toString() === newHire._id.toString()) {
          userUpdatedFired = true;
        }
      });

      const newDeptId = new mongoose.Types.ObjectId();
      await employeeService.updateEmployee(newHire._id, orgId, {
        departmentId: newDeptId.toString(),
      });

      expect(userUpdatedFired).toBe(true);
      expect(departmentChangedFired).toBe(true);

      // Verify outbox event was recorded
      const outboxMutation = await OutboxEvent.findOne({
        organizationId: orgId,
        aggregateId: newHire._id,
        eventName: "employee.profile_updated",
      });
      expect(outboxMutation).not.toBeNull();

      unsub1();
      unsub2();
    });
  });
});
