import mongoose from "mongoose";

export interface JobOptions {
  maxRetries?: number;
  backoffDelayMs?: number;
  idempotencyKey?: string;
  organizationId: mongoose.Types.ObjectId | string;
}

export interface Job<T = any> {
  id: string;
  name: string;
  data: T;
  options: JobOptions;
  status: "pending" | "processing" | "completed" | "failed";
  attempts: number;
  lastError?: string;
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

  private constructor() {}

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

    const job: Job<T> = {
      id: new mongoose.Types.ObjectId().toString(),
      name: jobName,
      data,
      options: {
        maxRetries: options.maxRetries ?? 3,
        backoffDelayMs: options.backoffDelayMs ?? 1000,
        organizationId: options.organizationId,
        idempotencyKey: options.idempotencyKey,
      },
      status: "pending",
      attempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

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
      const job = this.jobQueue.shift()!;
      const handler = this.jobHandlers.get(job.name);

      if (!handler) {
        console.error(`[QueueService] No registered handler for job: ${job.name}`);
        job.status = "failed";
        job.lastError = `No handler registered for ${job.name}`;
        job.updatedAt = new Date();
        this.failedJobs.push(job);
        continue;
      }

      job.status = "processing";
      job.attempts += 1;
      job.updatedAt = new Date();

      try {
        await handler(job);
        job.status = "completed";
        job.updatedAt = new Date();
        this.completedJobs.push(job);
      } catch (error: any) {
        job.lastError = error?.message || String(error);
        job.updatedAt = new Date();

        if (job.attempts < (job.options.maxRetries || 3)) {
          const backoff = (job.options.backoffDelayMs || 1000) * Math.pow(2, job.attempts - 1);
          console.warn(
            `[QueueService] Job ${job.name} (${job.id}) failed (attempt ${job.attempts}). Retrying in ${backoff}ms...`
          );
          job.status = "pending";
          await new Promise((resolve) => setTimeout(resolve, backoff));
          this.jobQueue.push(job);
        } else {
          console.error(
            `[QueueService] Job ${job.name} (${job.id}) failed permanently after ${job.attempts} attempts:`,
            error
          );
          job.status = "failed";
          this.failedJobs.push(job);
        }
      }
    }

    this.isProcessing = false;
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
