import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { retentionService, RETENTION_POLICIES } from "../infrastructure/database/retention.service.js";
import { backupPurgeService } from "../infrastructure/database/backup-purge.service.js";
import Notification from "../modules/notifications/models/notification.model.js";
import SystemJob from "../infrastructure/queue/system-job.model.js";
import OutboxEvent from "../modules/onboarding/models/outbox-event.model.js";

describe("Database Retention & Storage Optimization Engine", () => {
  describe("Retention Policy Service", () => {
    it("should return valid policies for critical operational collections", () => {
      const policies = retentionService.getPolicies();
      expect(policies.length).toBeGreaterThanOrEqual(6);

      const jobPolicy = policies.find((p) => p.collectionName === "system_jobs");
      expect(jobPolicy).toBeDefined();
      expect(jobPolicy?.strategy).toBe("C");
      expect(jobPolicy?.recommendedRetentionDays).toBe(7);
      expect(jobPolicy?.requiresBackupBeforePurge).toBe(true);

      const notifPolicy = policies.find((p) => p.collectionName === "notifications");
      expect(notifPolicy).toBeDefined();
      expect(notifPolicy?.strategy).toBe("C");

      const outboxPolicy = policies.find((p) => p.collectionName === "outbox_events");
      expect(outboxPolicy).toBeDefined();
      expect(outboxPolicy?.strategy).toBe("A");
    });

    it("should reject purge preview for non-allowlisted collections", async () => {
      await expect(
        retentionService.previewPurge("users", 30)
      ).rejects.toThrow("not authorized for retention operations");

      await expect(
        retentionService.previewPurge("organizations", 30)
      ).rejects.toThrow("not authorized for retention operations");
    });
  });

  describe("Safety Gates & Bounded Batch Purging", () => {
    it("should reject purge execution if confirmation phrase is incorrect", async () => {
      await expect(
        backupPurgeService.executePurge(
          "man_test_123",
          new mongoose.Types.ObjectId().toString(),
          "wrong_phrase"
        )
      ).rejects.toThrow("Invalid confirmation phrase");
    });

    it("should reject purge execution if manifest is missing or unverified", async () => {
      await expect(
        backupPurgeService.executePurge(
          "man_non_existent",
          new mongoose.Types.ObjectId().toString(),
          "CONFIRM_PURGE"
        )
      ).rejects.toThrow("Backup manifest 'man_non_existent' not found");
    });
  });

  describe("Schema Definitions & Model TTL Index Verification", () => {
    it("system_jobs schema should declare partial TTL index on completedAt", () => {
      const indexes = SystemJob.schema.indexes();
      const ttlIndex = indexes.find(
        (idx) => (idx[0] as any).completedAt === 1 && idx[1]?.name === "system_jobs_completedAt_ttl"
      );
      expect(ttlIndex).toBeDefined();
      expect(ttlIndex![1]?.expireAfterSeconds).toBe(7 * 24 * 60 * 60);
      expect(ttlIndex![1]?.partialFilterExpression).toEqual({ status: "completed" });
    });

    it("outbox_events schema should declare partial TTL index on publishedAt", () => {
      const indexes = OutboxEvent.schema.indexes();
      const ttlIndex = indexes.find(
        (idx) => (idx[0] as any).publishedAt === 1 && idx[1]?.name === "outbox_events_published_ttl"
      );
      expect(ttlIndex).toBeDefined();
      expect(ttlIndex![1]?.expireAfterSeconds).toBe(7 * 24 * 60 * 60);
      expect(ttlIndex![1]?.partialFilterExpression).toEqual({ status: "published" });
    });

    it("notifications pre-validate hook should compute expiresAt automatically", async () => {
      const notif = new Notification({
        organizationId: new mongoose.Types.ObjectId(),
        recipientUserId: new mongoose.Types.ObjectId(),
        type: "system",
        title: "Test Alert",
        message: "Retention validation message",
        priority: "medium",
      });

      // Validate without saving to DB
      await notif.validate();
      expect(notif.expiresAt).toBeDefined();
      expect(notif.expiresAt instanceof Date).toBe(true);

      // Verify expiration is roughly 30 days in the future
      const expectedDiffMs = 30 * 24 * 60 * 60 * 1000;
      const actualDiffMs = notif.expiresAt!.getTime() - Date.now();
      expect(Math.abs(actualDiffMs - expectedDiffMs)).toBeLessThan(5000);
    });

    it("notifications pre-validate hook should compute 180 days for critical alerts", async () => {
      const notif = new Notification({
        organizationId: new mongoose.Types.ObjectId(),
        recipientUserId: new mongoose.Types.ObjectId(),
        type: "system",
        title: "Critical Security Alert",
        message: "Action required",
        priority: "critical",
      });

      await notif.validate();
      expect(notif.expiresAt).toBeDefined();
      const expectedDiffMs = 180 * 24 * 60 * 60 * 1000;
      const actualDiffMs = notif.expiresAt!.getTime() - Date.now();
      expect(Math.abs(actualDiffMs - expectedDiffMs)).toBeLessThan(5000);
    });
  });
});
