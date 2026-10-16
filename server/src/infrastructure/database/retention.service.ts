import mongoose from "mongoose";

export interface ICollectionRetentionPolicy {
  collectionName: string;
  businessPurpose: string;
  owningModule: string;
  strategy: "A" | "B" | "C" | "D" | "E";
  strategyLabel: string;
  recommendedRetentionDays: number;
  timestampField: string;
  isPurgeable: boolean;
  requiresBackupBeforePurge: boolean;
  riskOfDeletion: "low" | "medium" | "high" | "critical";
  filterFactory: (olderThanDays: number, orgId?: string) => Record<string, any>;
}

export const RETENTION_POLICIES: Record<string, ICollectionRetentionPolicy> = {
  system_jobs: {
    collectionName: "system_jobs",
    businessPurpose: "Background task queue and job processing state machine",
    owningModule: "infrastructure/queue",
    strategy: "C",
    strategyLabel: "Automatic TTL + Super Admin Purge",
    recommendedRetentionDays: 7,
    timestampField: "completedAt",
    isPurgeable: true,
    requiresBackupBeforePurge: true,
    riskOfDeletion: "medium",
    filterFactory: (olderThanDays: number) => {
      const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
      return {
        status: { $in: ["completed", "failed"] },
        $or: [
          { completedAt: { $lt: cutoff } },
          { completedAt: { $exists: false }, updatedAt: { $lt: cutoff } },
        ],
      };
    },
  },
  notifications: {
    collectionName: "notifications",
    businessPurpose: "User alerts, reminders, and automated onboarding nudges",
    owningModule: "modules/notifications",
    strategy: "C",
    strategyLabel: "Automatic TTL + Super Admin Purge",
    recommendedRetentionDays: 90,
    timestampField: "createdAt",
    isPurgeable: true,
    requiresBackupBeforePurge: true,
    riskOfDeletion: "medium",
    filterFactory: (olderThanDays: number, orgId?: string) => {
      const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
      const readCutoff = new Date(Date.now() - Math.min(olderThanDays, 30) * 24 * 60 * 60 * 1000);
      const filter: Record<string, any> = {
        $or: [
          { isRead: true, readAt: { $lt: readCutoff } },
          { isRead: false, createdAt: { $lt: cutoff } },
        ],
      };
      if (orgId) {
        filter.organizationId = new mongoose.Types.ObjectId(orgId);
      }
      return filter;
    },
  },
  outbox_events: {
    collectionName: "outbox_events",
    businessPurpose: "Transactional outbox events for messaging",
    owningModule: "modules/onboarding",
    strategy: "A",
    strategyLabel: "Automatic Expiration",
    recommendedRetentionDays: 7,
    timestampField: "publishedAt",
    isPurgeable: true,
    requiresBackupBeforePurge: false,
    riskOfDeletion: "low",
    filterFactory: (olderThanDays: number) => {
      const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
      return {
        status: "published",
        publishedAt: { $lt: cutoff },
      };
    },
  },
  kiosk_device_telemetry: {
    collectionName: "kiosk_device_telemetry",
    businessPurpose: "Kiosk hardware pings, battery, and network telemetry",
    owningModule: "modules/kiosk",
    strategy: "A",
    strategyLabel: "Automatic Expiration (30d TTL)",
    recommendedRetentionDays: 30,
    timestampField: "createdAt",
    isPurgeable: true,
    requiresBackupBeforePurge: false,
    riskOfDeletion: "low",
    filterFactory: (olderThanDays: number, orgId?: string) => {
      const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
      const filter: Record<string, any> = { createdAt: { $lt: cutoff } };
      if (orgId) filter.organizationId = new mongoose.Types.ObjectId(orgId);
      return filter;
    },
  },
  onboarding_health: {
    collectionName: "onboarding_health",
    businessPurpose: "Daily velocity sentinel health score snapshots",
    owningModule: "modules/analytics",
    strategy: "B",
    strategyLabel: "Super Admin Backup & Purge",
    recommendedRetentionDays: 180,
    timestampField: "createdAt",
    isPurgeable: true,
    requiresBackupBeforePurge: true,
    riskOfDeletion: "low",
    filterFactory: (olderThanDays: number, orgId?: string) => {
      const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
      const filter: Record<string, any> = { createdAt: { $lt: cutoff } };
      if (orgId) filter.organizationId = new mongoose.Types.ObjectId(orgId);
      return filter;
    },
  },
  auditLogs: {
    collectionName: "auditLogs",
    businessPurpose: "Immutable audit trail of system, security, and administrative operations",
    owningModule: "modules/audit-logs",
    strategy: "B",
    strategyLabel: "Super Admin Backup & Purge (7yr Compliance Archive)",
    recommendedRetentionDays: 365,
    timestampField: "createdAt",
    isPurgeable: true,
    requiresBackupBeforePurge: true,
    riskOfDeletion: "high",
    filterFactory: (olderThanDays: number, orgId?: string) => {
      // Must enforce minimum 365 days in active DB before purge eligibility
      const effectiveDays = Math.max(olderThanDays, 365);
      const cutoff = new Date(Date.now() - effectiveDays * 24 * 60 * 60 * 1000);
      const filter: Record<string, any> = { createdAt: { $lt: cutoff } };
      if (orgId) filter.organizationId = new mongoose.Types.ObjectId(orgId);
      return filter;
    },
  },
};

export class RetentionService {
  /**
   * Returns list of configured retention policies
   */
  public getPolicies(): ICollectionRetentionPolicy[] {
    return Object.values(RETENTION_POLICIES);
  }

  /**
   * Preview purgeable documents count and estimated data size without performing any deletion
   */
  public async previewPurge(collectionName: string, olderThanDays?: number, orgId?: string) {
    const policy = RETENTION_POLICIES[collectionName];
    if (!policy) {
      throw new Error(`Collection '${collectionName}' is not authorized for retention operations.`);
    }

    const days = olderThanDays ?? policy.recommendedRetentionDays;
    const filter = policy.filterFactory(days, orgId);

    const db = mongoose.connection.db;
    if (!db) throw new Error("Database connection is not ready.");

    const coll = db.collection(collectionName);
    const count = await coll.countDocuments(filter);

    let estimatedBytes = 0;
    if (count > 0) {
      const sample = await coll.findOne(filter);
      const sampleSize = sample ? Buffer.byteLength(JSON.stringify(sample), "utf8") : 300;
      estimatedBytes = count * sampleSize;
    }

    return {
      collectionName,
      strategy: policy.strategy,
      strategyLabel: policy.strategyLabel,
      olderThanDays: days,
      filter,
      purgeableDocuments: count,
      estimatedLogicalSizeBytes: estimatedBytes,
      estimatedLogicalSizeMB: Number((estimatedBytes / (1024 * 1024)).toFixed(2)),
      requiresBackupBeforePurge: policy.requiresBackupBeforePurge,
      riskOfDeletion: policy.riskOfDeletion,
    };
  }
}

export const retentionService = new RetentionService();
export default retentionService;
