import mongoose from "mongoose";
import SystemJob, { ISystemJob } from "./system-job.model.js";

export interface JobOptions {
  maxRetries?: number;
  backoffDelayMs?: number;
  idempotencyKey?: string;
  organizationId: mongoose.Types.ObjectId | string;
  availableAt?: Date;
  delayMs?: number;
}

export interface Job<T = any> {
  id: string;
  name: string;
  data: T;
  options: JobOptions;
  status: "pending" | "processing" | "completed" | "failed";
  attempts: number;
  lastError?: string;
  availableAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type JobHandler<T = any> = (job: Job<T>) => Promise<void>;

export class QueueService {
  private static instance: QueueService;
  private jobHandlers: Map<string, JobHandler> = new Map();
  private processedKeys: Set<string> = new Set();
  private isProcessing = false;
  private jobQueue: Job[] = [];
  private completedJobs: Job[] = [];
  private failedJobs: Job[] = [];

  private constructor() {
    // Singleton
  }

  public static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  public registerWorker<T = any>(jobName: string, handler: JobHandler<T>): void {
    this.jobHandlers.set(jobName, handler as JobHandler);
  }

  public async enqueue<T = any>(
    jobName: string,
    data: T,
    options: JobOptions
  ): Promise<Job<T> | null> {
    if (options.idempotencyKey) {
      const uniqueKey = `${options.organizationId.toString()}:${options.idempotencyKey}`;
      if (this.processedKeys.has(uniqueKey)) {
        console.warn(`[QueueService] Job ${jobName} suppressed by idempotency key: ${uniqueKey}`);
        return null;
      }
      this.processedKeys.add(uniqueKey);
    }

    const jobId = new mongoose.Types.ObjectId();
    const effectiveAvailableAt = options.availableAt
      ? new Date(options.availableAt)
      : options.delayMs
        ? new Date(Date.now() + options.delayMs)
        : new Date();

    const job: Job<T> = {
      id: jobId.toString(),
      name: jobName,
      data,
      options: {
        maxRetries: options.maxRetries ?? 3,
        backoffDelayMs: options.backoffDelayMs ?? 1000,
        organizationId: options.organizationId,
        idempotencyKey: options.idempotencyKey,
        availableAt: effectiveAvailableAt,
        delayMs: options.delayMs,
      },
      status: "pending",
      attempts: 0,
      availableAt: effectiveAvailableAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Persist to MongoDB before enqueuing to in-memory processing loop
    if (mongoose.connection.readyState === 1) {
      try {
        await SystemJob.create({
          _id: jobId,
          organizationId: options.organizationId,
          name: jobName,
          data: data as any,
          status: "pending",
          attempts: 0,
          maxRetries: options.maxRetries ?? 3,
          backoffDelayMs: options.backoffDelayMs ?? 1000,
          idempotencyKey: options.idempotencyKey,
          availableAt: effectiveAvailableAt,
        });
      } catch (err) {
        // Suppress duplicate key errors quietly
      }
    }

    this.jobQueue.push(job);
    this.processQueue();
    return job;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.jobQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.jobQueue.length > 0) {
      const now = Date.now();
      const readyIndex = this.jobQueue.findIndex(
        (j) => !j.availableAt || j.availableAt.getTime() <= now
      );

      if (readyIndex === -1) {
        // Find earliest scheduled job to awaken queue
        const nextJob = this.jobQueue.reduce(
          (earliest, j) =>
            !earliest || (j.availableAt && j.availableAt.getTime() < earliest.availableAt.getTime())
              ? j
              : earliest,
          null as Job | null
        );
        if (nextJob && nextJob.availableAt) {
          const delay = Math.max(50, nextJob.availableAt.getTime() - now);
          setTimeout(() => {
            this.processQueue();
          }, Math.min(delay, 2147483647));
        }
        break;
      }

      const [job] = this.jobQueue.splice(readyIndex, 1);
      const handler = this.jobHandlers.get(job.name);

      if (!handler) {
        console.error(`[QueueService] No registered handler for job: ${job.name}`);
        job.status = "failed";
        job.lastError = `No handler registered for ${job.name}`;
        job.updatedAt = new Date();
        this.failedJobs.push(job);

        if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(job.id)) {
          SystemJob.updateOne(
            { _id: new mongoose.Types.ObjectId(job.id) },
            { $set: { status: "failed", lastError: job.lastError } }
          ).catch(() => {});
        }
        continue;
      }

      job.status = "processing";
      job.attempts += 1;
      job.updatedAt = new Date();

      if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(job.id)) {
        await SystemJob.updateOne(
          { _id: new mongoose.Types.ObjectId(job.id) },
          {
            $set: { status: "processing", lockedAt: new Date() },
            $inc: { attempts: 1 },
          }
        ).catch(() => {});
      }

      try {
        await handler(job);
        job.status = "completed";
        job.updatedAt = new Date();
        this.completedJobs.push(job);

        if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(job.id)) {
          await SystemJob.updateOne(
            { _id: new mongoose.Types.ObjectId(job.id) },
            {
              $set: {
                status: "completed",
                completedAt: new Date(),
                lockedAt: null,
              },
            }
          ).catch(() => {});
        }
      } catch (error: any) {
        job.lastError = error?.message || String(error);
        job.updatedAt = new Date();

        if (job.attempts < (job.options.maxRetries || 3)) {
          const backoff = (job.options.backoffDelayMs || 1000) * Math.pow(2, job.attempts - 1);
          console.warn(
            `[QueueService] Job ${job.name} (${job.id}) failed (attempt ${job.attempts}). Retrying in ${backoff}ms...`
          );
          job.status = "pending";

          if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(job.id)) {
            SystemJob.updateOne(
              { _id: new mongoose.Types.ObjectId(job.id) },
              {
                $set: {
                  status: "pending",
                  availableAt: new Date(Date.now() + backoff),
                  lastError: job.lastError,
                  lockedAt: null,
                },
              }
            ).catch(() => {});
          }

          await new Promise((resolve) => setTimeout(resolve, backoff));
          this.jobQueue.push(job);
        } else {
          console.error(
            `[QueueService] Job ${job.name} (${job.id}) failed permanently after ${job.attempts} attempts:`,
            error
          );
          job.status = "failed";
          this.failedJobs.push(job);

          if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(job.id)) {
            SystemJob.updateOne(
              { _id: new mongoose.Types.ObjectId(job.id) },
              {
                $set: {
                  status: "failed",
                  lastError: job.lastError,
                  lockedAt: null,
                },
              }
            ).catch(() => {});
          }
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Resumes any pending or stalled jobs persisted in MongoDB upon startup/reboot
   */
  public async resumePendingJobs(): Promise<number> {
    if (mongoose.connection.readyState !== 1) return 0;

    try {
      const stalledOrPending = await SystemJob.find({
        status: { $in: ["pending", "processing"] },
        $or: [
          { lockedAt: null },
          { lockedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } }, // Lock expired after 5 mins
        ],
        availableAt: { $lte: new Date() },
      }).limit(100);

      let resumed = 0;
      for (const record of stalledOrPending) {
        if (!this.jobQueue.some((j) => j.id === record._id.toString())) {
          this.jobQueue.push({
            id: record._id.toString(),
            name: record.name,
            data: record.data,
            options: {
              organizationId: record.organizationId,
              maxRetries: record.maxRetries,
              backoffDelayMs: record.backoffDelayMs,
              idempotencyKey: record.idempotencyKey,
            },
            status: "pending",
            attempts: record.attempts,
            availableAt: record.availableAt || record.createdAt,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
          });
          resumed++;
        }
      }

      if (resumed > 0) {
        console.log(`[QueueService] Resumed ${resumed} persistent jobs from MongoDB.`);
        this.processQueue();
      }

      return resumed;
    } catch (err: any) {
      console.warn("[QueueService] Could not resume persistent jobs:", err.message);
      return 0;
    }
  }

  public getStats() {
    return {
      pending: this.jobQueue.length,
      completed: this.completedJobs.length,
      failed: this.failedJobs.length,
    };
  }

  public clear(): void {
    this.jobQueue = [];
    this.completedJobs = [];
    this.failedJobs = [];
    this.processedKeys.clear();
  }
}

export const queueService = QueueService.getInstance();
export default queueService;
