import fs from "fs";
import path from "path";
import zlib from "zlib";
import crypto from "crypto";
import { promisify } from "util";
import mongoose from "mongoose";
import { RETENTION_POLICIES } from "./retention.service.js";
import AuditLog from "../../modules/audit-logs/models/audit-log.model.js";

const gzipAsync = promisify(zlib.gzip);
const gunzipAsync = promisify(zlib.gunzip);

export interface IBackupManifest {
  manifestId: string;
  collectionName: string;
  databaseName: string;
  initiatedByUserId: string;
  initiatedByUserEmail?: string;
  createdAt: string;
  filter: Record<string, any>;
  olderThanDays: number;
  documentCount: number;
  uncompressedSizeBytes: number;
  compressedSizeBytes: number;
  sha256Checksum: string;
  archiveFilePath: string;
  verification: {
    status: "PENDING" | "VERIFIED" | "FAILED";
    verifiedAt?: string;
    verifiedCount?: number;
    checksumMatch: boolean;
    error?: string;
  };
  purgeExecution?: {
    purgedAt: string;
    purgedCount: number;
    durationMs: number;
    executedByUserId: string;
  };
}

export class BackupPurgeService {
  private static archiveDir = path.resolve(process.cwd(), "tmp/database-archives");
  private static manifestRegistry: Map<string, IBackupManifest> = new Map();

  constructor() {
    if (!fs.existsSync(BackupPurgeService.archiveDir)) {
      fs.mkdirSync(BackupPurgeService.archiveDir, { recursive: true });
    }
  }

  /**
   * Export documents matching retention filter into a verified, compressed archive with SHA-256 manifest
   */
  public async createVerifiedBackup(
    collectionName: string,
    olderThanDays: number,
    adminUserId: string,
    adminEmail?: string,
    orgId?: string,
    maxDocuments?: number
  ): Promise<IBackupManifest> {
    const policy = RETENTION_POLICIES[collectionName];
    if (!policy) {
      throw new Error(`Collection '${collectionName}' is not eligible for archival.`);
    }

    const filter = policy.filterFactory(olderThanDays, orgId);
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database connection is not ready.");

    const coll = db.collection(collectionName);
    const totalMatching = await coll.countDocuments(filter);
    if (totalMatching === 0) {
      throw new Error(`No records match the specified retention criteria (${olderThanDays} days) for '${collectionName}'.`);
    }

    // Default safe batch cap to 10,000 if not specified to prevent WAN/heap lockup on large collections
    const limit = maxDocuments && maxDocuments > 0 ? maxDocuments : (totalMatching > 10000 ? 10000 : totalMatching);

    const manifestId = `man_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const archiveFileName = `${collectionName}_${timestamp}_${manifestId}.json.gz`;
    const archiveFilePath = path.join(BackupPurgeService.archiveDir, archiveFileName);

    let query = coll.find(filter);
    if (limit < totalMatching) {
      query = query.limit(limit);
    }
    const docs = await query.toArray();
    const count = docs.length;

    // Async compression on thread pool to keep event loop responsive
    const rawJson = JSON.stringify(docs);
    const uncompressedBytes = Buffer.byteLength(rawJson, "utf8");

    const compressedBuffer = await gzipAsync(rawJson);
    const compressedBytes = compressedBuffer.length;
    const sha256Checksum = crypto.createHash("sha256").update(compressedBuffer).digest("hex");

    await fs.promises.writeFile(archiveFilePath, compressedBuffer);

    // Immediate Verification: decompress and verify integrity
    let verificationStatus: "VERIFIED" | "FAILED" = "FAILED";
    let verifiedCount = 0;
    let checksumMatch = false;

    try {
      const readBack = await fs.promises.readFile(archiveFilePath);
      const readBackHash = crypto.createHash("sha256").update(readBack).digest("hex");
      checksumMatch = readBackHash === sha256Checksum;

      const uncompressedReadBack = await gunzipAsync(readBack);
      const parsedDocs = JSON.parse(uncompressedReadBack.toString("utf8"));
      verifiedCount = parsedDocs.length;

      if (checksumMatch && verifiedCount === count) {
        verificationStatus = "VERIFIED";
      }
    } catch (err: any) {
      verificationStatus = "FAILED";
    }

    const manifest: IBackupManifest = {
      manifestId,
      collectionName,
      databaseName: mongoose.connection.name || "Talnova-Onboarding",
      initiatedByUserId: adminUserId,
      initiatedByUserEmail: adminEmail,
      createdAt: new Date().toISOString(),
      filter,
      olderThanDays,
      documentCount: count,
      uncompressedSizeBytes: uncompressedBytes,
      compressedSizeBytes: compressedBytes,
      sha256Checksum,
      archiveFilePath,
      verification: {
        status: verificationStatus,
        verifiedAt: new Date().toISOString(),
        verifiedCount,
        checksumMatch,
      },
    };

    // Save manifest file alongside archive
    const manifestPath = path.join(BackupPurgeService.archiveDir, `${manifestId}.manifest.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    BackupPurgeService.manifestRegistry.set(manifestId, manifest);

    // Audit Log
    try {
      await AuditLog.create({
        organizationId: orgId ? new mongoose.Types.ObjectId(orgId) : undefined,
        actorUserId: new mongoose.Types.ObjectId(adminUserId),
        actorType: "user",
        eventCategory: "admin",
        eventType: "database.backup_created",
        resourceType: collectionName,
        action: "export",
        description: `Created verified backup for collection '${collectionName}' (${count} records, ${(compressedBytes / 1024).toFixed(1)} KB compressed)`,
        metadata: {
          manifestId,
          documentCount: count,
          checksum: sha256Checksum,
          verificationStatus,
        },
        severity: "info",
      });
    } catch (e) {
      // non-fatal if audit logging fails in test environment
    }

    return manifest;
  }

  /**
   * Execute a bounded, paced batch purge strictly requiring a previously verified backup manifest
   */
  public async executePurge(
    manifestId: string,
    adminUserId: string,
    confirmationText: string,
    batchSize = 1000,
    batchPauseMs = 50
  ) {
    if (confirmationText !== "CONFIRM_PURGE") {
      throw new Error("Purge rejected: Invalid confirmation phrase. You must pass 'CONFIRM_PURGE'.");
    }

    let manifest = BackupPurgeService.manifestRegistry.get(manifestId);
    if (!manifest) {
      const manifestPath = path.join(BackupPurgeService.archiveDir, `${manifestId}.manifest.json`);
      if (fs.existsSync(manifestPath)) {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        BackupPurgeService.manifestRegistry.set(manifestId, manifest!);
      }
    }

    if (!manifest) {
      throw new Error(`Backup manifest '${manifestId}' not found.`);
    }

    if (manifest.verification.status !== "VERIFIED" || !manifest.verification.checksumMatch) {
      throw new Error("Purge blocked: Backup manifest has not been verified or checksum failed.");
    }

    if (manifest.purgeExecution) {
      throw new Error(`Purge already completed for manifest '${manifestId}' on ${manifest.purgeExecution.purgedAt}`);
    }

    const db = mongoose.connection.db;
    if (!db) throw new Error("Database connection is not ready.");

    const coll = db.collection(manifest.collectionName);
    const startTime = Date.now();
    let totalPurged = 0;

    // Execute bounded batch deletions strictly up to the verified archive count
    const targetPurgeCount = manifest.documentCount;
    while (totalPurged < targetPurgeCount) {
      const remaining = targetPurgeCount - totalPurged;
      const currentBatchSize = Math.min(batchSize, remaining);
      const docsToDelete = await coll
        .find(manifest.filter)
        .limit(currentBatchSize)
        .project({ _id: 1 })
        .toArray();

      if (docsToDelete.length === 0) break;

      const ids = docsToDelete.map((d) => d._id);
      const res = await coll.deleteMany({ _id: { $in: ids } });
      totalPurged += res.deletedCount || 0;

      // Yield event loop to prevent lock contention on replica set
      if (batchPauseMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, batchPauseMs));
      }
    }

    const durationMs = Date.now() - startTime;

    manifest.purgeExecution = {
      purgedAt: new Date().toISOString(),
      purgedCount: totalPurged,
      durationMs,
      executedByUserId: adminUserId,
    };

    // Update manifest file
    const manifestPath = path.join(BackupPurgeService.archiveDir, `${manifestId}.manifest.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    // Audit Log
    try {
      await AuditLog.create({
        actorUserId: new mongoose.Types.ObjectId(adminUserId),
        actorType: "user",
        eventCategory: "admin",
        eventType: "database.purge_executed",
        resourceType: manifest.collectionName,
        action: "delete",
        description: `Executed bounded purge on '${manifest.collectionName}' (${totalPurged} documents purged in ${durationMs}ms)`,
        metadata: {
          manifestId,
          totalPurged,
          durationMs,
        },
        severity: "critical",
      });
    } catch (e) {
      // non-fatal
    }

    return {
      manifestId,
      collectionName: manifest.collectionName,
      purgedCount: totalPurged,
      durationMs,
      verifiedBackupChecksum: manifest.sha256Checksum,
    };
  }

  /**
   * Restore documents from verified archive into the collection idempotently
   */
  public async restoreFromBackup(manifestId: string, adminUserId: string) {
    let manifest = BackupPurgeService.manifestRegistry.get(manifestId);
    if (!manifest) {
      const manifestPath = path.join(BackupPurgeService.archiveDir, `${manifestId}.manifest.json`);
      if (fs.existsSync(manifestPath)) {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      }
    }

    if (!manifest) {
      throw new Error(`Manifest '${manifestId}' not found.`);
    }

    const db = mongoose.connection.db;
    if (!db) throw new Error("Database connection is not ready.");

    const coll = db.collection(manifest.collectionName);
    const compressedBuffer = fs.readFileSync(manifest.archiveFilePath);

    // Verify hash
    const hash = crypto.createHash("sha256").update(compressedBuffer).digest("hex");
    if (hash !== manifest.sha256Checksum) {
      throw new Error("Restore aborted: Archive checksum mismatch. File may be corrupted.");
    }

    const uncompressed = zlib.gunzipSync(compressedBuffer);
    const docs: any[] = JSON.parse(uncompressed.toString("utf8"));

    if (docs.length === 0) {
      return { restoredCount: 0 };
    }

    // Idempotent upsert in batches
    const ops = docs.map((doc) => {
      // Preserve original _id
      const id = doc._id;
      if (typeof id === "string" && mongoose.Types.ObjectId.isValid(id)) {
        doc._id = new mongoose.Types.ObjectId(id);
      }
      return {
        updateOne: {
          filter: { _id: doc._id },
          update: { $setOnInsert: doc },
          upsert: true,
        },
      };
    });

    const result = await coll.bulkWrite(ops);
    const restoredCount = (result.upsertedCount || 0) + (result.matchedCount || 0);

    try {
      await AuditLog.create({
        actorUserId: new mongoose.Types.ObjectId(adminUserId),
        actorType: "user",
        eventCategory: "admin",
        eventType: "database.restore_executed",
        resourceType: manifest.collectionName,
        action: "restore",
        description: `Restored ${restoredCount} documents to '${manifest.collectionName}' from manifest ${manifestId}`,
        metadata: {
          manifestId,
          restoredCount,
        },
        severity: "critical",
      });
    } catch (e) {
      // non-fatal
    }

    return {
      manifestId,
      collectionName: manifest.collectionName,
      restoredCount,
    };
  }

  /**
   * List all stored backup manifests
   */
  public listManifests(): IBackupManifest[] {
    const list: IBackupManifest[] = [];
    if (!fs.existsSync(BackupPurgeService.archiveDir)) return list;

    const files = fs.readdirSync(BackupPurgeService.archiveDir);
    for (const f of files) {
      if (f.endsWith(".manifest.json")) {
        try {
          const content = fs.readFileSync(path.join(BackupPurgeService.archiveDir, f), "utf8");
          list.push(JSON.parse(content));
        } catch (e) {
          // ignore invalid
        }
      }
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getManifest(manifestId: string): IBackupManifest | null {
    if (BackupPurgeService.manifestRegistry.has(manifestId)) {
      return BackupPurgeService.manifestRegistry.get(manifestId)!;
    }
    const manifestPath = path.join(BackupPurgeService.archiveDir, `${manifestId}.manifest.json`);
    if (fs.existsSync(manifestPath)) {
      try {
        return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export const backupPurgeService = new BackupPurgeService();
export default backupPurgeService;
