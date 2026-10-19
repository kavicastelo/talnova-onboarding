import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { QueueService } from "../infrastructure/queue/queue.service.js";
import { registerSalesWorkers } from "../modules/sales/workers/index.js";
import Campaign from "../modules/sales/models/campaign.model.js";
import Lead from "../modules/sales/models/lead.model.js";
import SalesTask from "../modules/sales/models/task.model.js";
import SystemLogBuffer from "../infrastructure/telemetry/system-log-buffer.js";

describe("FOUND-004: Background Queue Workers & Job Registration", () => {
  const queue = QueueService.getInstance();
  const testPrefix = `queue-test-${Date.now()}`;
  const dummyOrgId = new mongoose.Types.ObjectId();

  async function waitFor(fn: () => Promise<boolean>, timeoutMs = 4000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await fn()) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  }

  beforeAll(async () => {
    await connectDatabase();
    registerSalesWorkers();
  });

  afterAll(async () => {
    // Clean up test data
    await Campaign.deleteMany({ name: { $regex: testPrefix } });
    await Lead.deleteMany({ companyName: { $regex: testPrefix } });
    await SalesTask.deleteMany({ title: { $regex: testPrefix } });
    await disconnectDatabase();
  });

  it("should process sales:campaign:dispatch_batch job and update recipient statuses", async () => {
    // Create test campaign
    const recipientId1 = new mongoose.Types.ObjectId();
    const recipientId2 = new mongoose.Types.ObjectId();

    const campaign = await Campaign.create({
      name: `Batch Campaign ${testPrefix}`,
      channel: "email",
      createdBy: new mongoose.Types.ObjectId(),
      status: "scheduled",
      stats: {
        totalRecipients: 2,
        sentCount: 0,
        deliveredCount: 0,
        openedCount: 0,
        clickedCount: 0,
        bouncedCount: 0,
        repliedCount: 0,
        failedCount: 0,
      },
      recipients: [
        {
          _id: recipientId1,
          recipientEmail: "alice@acme.test",
          recipientName: "Alice",
          status: "pending",
        },
        {
          _id: recipientId2,
          recipientEmail: "bob@acme.test",
          recipientName: "Bob",
          status: "pending",
        },
      ],
    });

    // Enqueue batch job
    const job = await queue.enqueue(
      "sales:campaign:dispatch_batch",
      {
        campaignId: campaign._id.toString(),
        batchIndex: 0,
        recipientIds: [recipientId1.toString(), recipientId2.toString()],
      },
      {
        organizationId: dummyOrgId,
        idempotencyKey: `campaign-${campaign._id}-batch-0`,
      }
    );

    expect(job).toBeDefined();

    // Poll until campaign finishes processing
    const completed = await waitFor(async () => {
      const doc = await Campaign.findById(campaign._id);
      return doc?.status === "completed";
    }, 5000);

    expect(completed).toBe(true);

    const updated = await Campaign.findById(campaign._id);
    expect(updated).toBeDefined();
    expect(updated!.status).toBe("completed");
    expect(updated!.stats.sentCount).toBe(2);
    expect(updated!.recipients[0].status).toBe("sent");
    expect(updated!.recipients[1].status).toBe("sent");
  });

  it("should process sales:workflow:trigger and create an automated follow-up task", async () => {
    const dummyLeadId = new mongoose.Types.ObjectId();

    const job = await queue.enqueue(
      "sales:workflow:trigger",
      {
        triggerType: "demo_completed",
        targetId: dummyLeadId.toString(),
        action: "create_task",
        actionPayload: {
          title: `Automated Task ${testPrefix}`,
          type: "demo",
          priority: "high",
          leadId: dummyLeadId,
        },
      },
      {
        organizationId: dummyOrgId,
        idempotencyKey: `auto-task-${dummyLeadId}`,
      }
    );

    expect(job).toBeDefined();
    const taskFound = await waitFor(async () => {
      const doc = await SalesTask.findOne({ title: `Automated Task ${testPrefix}` });
      return !!doc;
    }, 5000);
    expect(taskFound).toBe(true);

    const task = await SalesTask.findOne({ title: `Automated Task ${testPrefix}` });
    expect(task).toBeDefined();
    expect(task!.type).toBe("demo");
    expect(task!.priority).toBe("high");
    expect(task!.status).toBe("pending");
  });

  it("should process sales:lead:import_csv and insert new leads safely", async () => {
    const job = await queue.enqueue(
      "sales:lead:import_csv",
      {
        importBatchId: `batch-${Date.now()}`,
        leads: [
          {
            name: "Carol White",
            email: `carol-${testPrefix}@beta.test`,
            companyName: `Company ${testPrefix}`,
            jobTitle: "CTO",
            source: "import",
          },
        ],
      },
      {
        organizationId: dummyOrgId,
        idempotencyKey: `import-${testPrefix}`,
      }
    );

    expect(job).toBeDefined();
    const leadFound = await waitFor(async () => {
      const doc = await Lead.findOne({ normalizedEmail: `carol-${testPrefix}@beta.test` });
      return !!doc;
    }, 5000);
    expect(leadFound).toBe(true);

    const lead = await Lead.findOne({ normalizedEmail: `carol-${testPrefix}@beta.test` });
    expect(lead).toBeDefined();
    expect(lead!.name).toBe("Carol White");
    expect(lead!.companyName).toBe(`Company ${testPrefix}`);
    expect(lead!.status).toBe("new");
  });

  it("should suppress duplicate jobs when idempotency key is repeated", async () => {
    const duplicateKey = `idempotency-check-${testPrefix}`;

    const job1 = await queue.enqueue(
      "sales:workflow:trigger",
      {
        triggerType: "stale_lead",
        targetId: new mongoose.Types.ObjectId().toString(),
        action: "create_task",
      },
      {
        organizationId: dummyOrgId,
        idempotencyKey: duplicateKey,
      }
    );

    // Second enqueue with identical key should return null (suppressed)
    const job2 = await queue.enqueue(
      "sales:workflow:trigger",
      {
        triggerType: "stale_lead",
        targetId: new mongoose.Types.ObjectId().toString(),
        action: "create_task",
      },
      {
        organizationId: dummyOrgId,
        idempotencyKey: duplicateKey,
      }
    );

    expect(job1).toBeDefined();
    expect(job2).toBeNull();
  });

  it("should retry failing jobs with backoff and succeed after transient errors", async () => {
    let attempts = 0;
    const transientJobName = `sales:test:retry_${Date.now()}`;

    queue.registerWorker(transientJobName, async () => {
      attempts++;
      if (attempts < 2) {
        throw new Error("Simulated transient network timeout");
      }
    });

    const job = await queue.enqueue(
      transientJobName,
      { data: "transient" },
      {
        organizationId: dummyOrgId,
        maxRetries: 3,
        backoffDelayMs: 50,
      }
    );

    expect(job).toBeDefined();

    const succeeded = await waitFor(async () => {
      return attempts >= 2 && job?.status === "completed";
    }, 5000);

    expect(succeeded).toBe(true);
    expect(attempts).toBe(2);
    expect(job?.status).toBe("completed");
  });

  it("should exhaust retries and log dead-letter failure to SystemLogBuffer", async () => {
    let attempts = 0;
    const failingJobName = `sales:test:fail_${Date.now()}`;

    queue.registerWorker(failingJobName, async () => {
      attempts++;
      throw new Error("Permanent fatal exception");
    });

    const job = await queue.enqueue(
      failingJobName,
      { data: "permanent_failure" },
      {
        organizationId: dummyOrgId,
        maxRetries: 3,
        backoffDelayMs: 50,
      }
    );

    expect(job).toBeDefined();

    const failed = await waitFor(async () => {
      return attempts >= 3 && job?.status === "failed";
    }, 5000);

    expect(failed).toBe(true);
    expect(attempts).toBe(3);
    expect(job?.status).toBe("failed");
    expect(job?.lastError).toContain("Permanent fatal exception");

    // Verify dead letter logged to SystemLogBuffer
    const deadLetterLogs = SystemLogBuffer.getLogs({ limit: 20 }).filter(
      (log) => log.eventType === "DEAD_LETTER_JOB_FAILED" && log.metadata?.jobName === failingJobName
    );
    expect(deadLetterLogs.length).toBeGreaterThan(0);
    expect(deadLetterLogs[0].level).toBe("critical");
    expect(deadLetterLogs[0].metadata?.attempts).toBe(3);
  });
});
