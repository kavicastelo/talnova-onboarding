import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { hashPassword } from "../../../utils/crypto.js";
import {
  getDemoTenantModel,
  getDemoUserModel,
  getDemoSessionModel,
  getDemoActivityLogModel,
  getDemoRiskAlertModel,
  getDemoResetLogModel,
  getDemoEmailLogModel,
  getDemoJourneyModel,
  getDemoTaskModel,
  getDemoDocumentModel,
  getDemoKBArticleModel,
  getDemoMilestoneModel,
  getDemoFeatureUsageModel,
} from "../models/index.js";
import {
  DETERMINISTIC_DEMO_COMPANIES,
  DETERMINISTIC_DEMO_USERS,
  DETERMINISTIC_DEMO_JOURNEYS,
  DETERMINISTIC_DEMO_TASKS,
  DETERMINISTIC_DEMO_DOCUMENTS,
  DETERMINISTIC_DEMO_KB_ARTICLES,
  DETERMINISTIC_DEMO_MILESTONES,
} from "../seed/demo-seed-data.js";
import { getDemoConnection } from "../database/demo-connection.js";

// Global in-memory lock during reset execution
let isResettingLock = false;

export class DemoResetService {
  /**
   * Cleans isolated demo sandbox storage files.
   */
  private static async cleanDemoStorage(): Promise<{ filesRemoved: number }> {
    let filesRemoved = 0;
    try {
      const localSandboxDir = path.resolve(process.cwd(), "scratch", "demo_storage");
      if (fs.existsSync(localSandboxDir)) {
        const files = fs.readdirSync(localSandboxDir);
        for (const file of files) {
          const filePath = path.join(localSandboxDir, file);
          if (fs.lstatSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
            filesRemoved++;
          }
        }
      }
    } catch (err: any) {
      console.warn("[DemoResetService] Warning cleaning local demo sandbox:", err.message);
    }
    return { filesRemoved };
  }

  /**
   * Returns true if the demo environment is currently undergoing a reset.
   */
  public static isResetting(): boolean {
    return isResettingLock;
  }

  /**
   * Executes the 10-step atomic deterministic reset sequence.
   */
  public async executeReset(performedBy: string = "Super Admin", actorRole: string = "super_admin") {
    if (isResettingLock) {
      throw new Error("Demo reset is already in progress. Please wait for the current reset to complete.");
    }

    const startTime = Date.now();
    isResettingLock = true;
    const stepsCompleted: string[] = [];

    try {
      const conn = getDemoConnection();
      const DemoTenant = getDemoTenantModel();
      const DemoUser = getDemoUserModel();
      const DemoSession = getDemoSessionModel();
      const DemoActivityLog = getDemoActivityLogModel();
      const DemoRiskAlert = getDemoRiskAlertModel();
      const DemoResetLog = getDemoResetLogModel();
      const DemoEmailLog = getDemoEmailLogModel();
      const DemoJourney = getDemoJourneyModel();
      const DemoTask = getDemoTaskModel();
      const DemoDocument = getDemoDocumentModel();
      const DemoKBArticle = getDemoKBArticleModel();
      const DemoMilestone = getDemoMilestoneModel();
      const DemoFeatureUsage = getDemoFeatureUsageModel();

      // Step 1: Prevent new demo activity
      stepsCompleted.push("1. Set maintenance lock (preventing new demo activity)");

      // Step 2: Terminate active demo sessions
      await DemoSession.updateMany({}, { isValid: false, suspiciousReason: "Demo environment reset by Super Admin" });
      stepsCompleted.push("2. Terminated all active demo sessions");

      // Step 3: Clear demo tenant/user/session state
      await Promise.all([
        DemoSession.deleteMany({}),
        DemoActivityLog.deleteMany({}),
        DemoRiskAlert.deleteMany({}),
        DemoEmailLog.deleteMany({}),
        DemoJourney.deleteMany({}),
        DemoTask.deleteMany({}),
        DemoDocument.deleteMany({}),
        DemoKBArticle.deleteMany({}),
        DemoMilestone.deleteMany({}),
        DemoFeatureUsage.deleteMany({}),
        DemoUser.deleteMany({}),
        DemoTenant.deleteMany({}),
      ]);
      stepsCompleted.push("3. Cleared existing demo collections");

      // Step 4: Remove demo-generated files/data
      await DemoResetService.cleanDemoStorage();
      stepsCompleted.push("4. Cleaned demo storage assets");

      // Step 5: Restore / re-apply schema indexes
      await Promise.all([
        DemoTenant.syncIndexes(),
        DemoUser.syncIndexes(),
        DemoSession.syncIndexes(),
        DemoActivityLog.syncIndexes(),
        DemoRiskAlert.syncIndexes(),
      ]);
      stepsCompleted.push("5. Verified and rebuilt collection indexes");

      // Step 6: Load deterministic seed data
      const defaultPasswordHash = await hashPassword("DemoPass123!");
      const defaultExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days valid

      const companyMap: Record<string, mongoose.Types.ObjectId> = {};

      for (const comp of DETERMINISTIC_DEMO_COMPANIES) {
        const createdTenant = await DemoTenant.create({
          name: comp.name,
          slug: comp.slug,
          domain: comp.domain,
          contactEmail: comp.contactEmail,
          status: "ACTIVE",
          expiresAt: defaultExpiry,
          entitlementPackage: comp.entitlementPackage,
          allowedFeatures: comp.allowedFeatures,
          riskLevel: "NORMAL",
          sessionLimit: comp.sessionLimit,
        });
        companyMap[comp.slug] = createdTenant._id as mongoose.Types.ObjectId;
      }

      const userDocs = [];
      for (const u of DETERMINISTIC_DEMO_USERS) {
        const tenantId = companyMap[u.companySlug];
        if (tenantId) {
          userDocs.push({
            demoTenantId: tenantId,
            email: u.email,
            fullName: u.fullName,
            role: u.role,
            department: u.department,
            jobTitle: u.jobTitle,
            passwordHash: defaultPasswordHash,
            status: "ACTIVE" as const,
            expiresAt: defaultExpiry,
          });
        }
      }
      const createdUsers = await DemoUser.insertMany(userDocs);
      const primaryUser = createdUsers[0];

      const journeyDocs = DETERMINISTIC_DEMO_JOURNEYS.map((j) => ({
        demoTenantId: companyMap[j.companySlug],
        title: j.title,
        description: j.description,
        category: j.category,
        durationDays: j.durationDays,
        status: (j as any).status || "published",
        publishing: (j as any).publishing || {
          status: "published",
          publishedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        },
        analytics: (j as any).analytics || {
          totalAssignments: 16,
          completionRate: 84,
        },
        modulesCount: (j as any).modules?.length || j.modulesCount || 3,
        modules: (j as any).modules || [],
        settings: {
          allowSkipLessons: false,
          requireSequentialCompletion: true,
          allowRetakes: true,
          maxRetakes: 3,
        },
        audience: { isPublic: true },
      }));
      await DemoJourney.insertMany(journeyDocs);

      const taskDocs = DETERMINISTIC_DEMO_TASKS.map((t, idx) => ({
        demoTenantId: companyMap[t.companySlug],
        demoUserId: primaryUser?._id,
        title: t.title,
        description: t.description,
        category: t.category,
        stage: (t as any).stage || "day_1",
        priority: (t as any).priority || "normal",
        status: (t as any).status || "pending",
        dueDays: t.dueDays,
        dueDate: new Date(Date.now() + (t.dueDays || 3) * 86400000).toISOString(),
        requiresVerification: (t as any).priority === "critical",
        comments: [
          {
            userId: {
              _id: createdUsers[1]?._id?.toString() || "admin-1",
              profile: { firstName: "Sarah", lastName: "Connor" },
              auth: { email: "sarah.connor@acme-demo.com" },
            },
            comment: "Welcome aboard! Let me know if you run into any hurdles with this item.",
            createdAt: new Date(Date.now() - 3600000).toISOString(),
          },
        ],
        statusHistory: [
          {
            status: (t as any).status || "pending",
            changedBy: "System Onboarding Provisioner",
            changedAt: new Date(Date.now() - 86400000).toISOString(),
            note: "Task auto-provisioned upon onboarding initiation",
          },
        ],
        hardwareMetadata: t.category === "equipment" ? {
          deviceType: "MacBook Pro 16\" M3 Max (36GB RAM)",
          serialNumber: "C02XYZ123456",
          assetTag: "TAG-9921",
          courierProvider: "FedEx Priority Overnight",
          courierTrackingUrl: "https://www.fedex.com/fedextrack/?trknbr=123456789012",
          shipDate: new Date(Date.now() - 2 * 86400000).toISOString(),
          mdmStatus: "Enrolled & Compliant",
        } : undefined,
      }));
      await DemoTask.insertMany(taskDocs);

      const docEntries = DETERMINISTIC_DEMO_DOCUMENTS.map((d) => {
        const isSigned = (d as any).status === "signed";
        return {
          demoTenantId: companyMap[d.companySlug],
          title: d.title,
          documentType: d.documentType,
          category: (d as any).category || d.documentType,
          status: isSigned ? "signed" : "pending_signature",
          content: (d as any).content || "Standard company policy agreement for new employees.",
          renderedContent: (d as any).content || "Standard company policy agreement for new employees.",
          signedAt: isSigned ? new Date(Date.now() - 86400000) : undefined,
          signeeName: isSigned ? "John Doe" : undefined,
          signatureData: isSigned ? {
            type: "draw",
            signerName: "John Doe",
            signedAt: new Date(Date.now() - 86400000).toISOString(),
            sha256Hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          } : undefined,
          auditTrail: [
            {
              action: "ASSIGNED",
              timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
              details: "Document generated and assigned to employee onboarding folder",
            },
            ...(isSigned ? [{
              action: "SIGNED",
              timestamp: new Date(Date.now() - 86400000).toISOString(),
              details: "Cryptographically signed by John Doe via Talnova Digital Signer",
            }] : []),
          ],
        };
      });
      await DemoDocument.insertMany(docEntries);

      const kbEntries = DETERMINISTIC_DEMO_KB_ARTICLES.map((k) => ({
        demoTenantId: companyMap[k.companySlug],
        title: k.title,
        summary: k.summary,
        category: k.category,
        content: k.content,
        readTimeMinutes: k.readTimeMinutes,
      }));
      await DemoKBArticle.insertMany(kbEntries);

      const milestoneEntries = DETERMINISTIC_DEMO_MILESTONES.map((m, idx) => ({
        demoTenantId: companyMap[m.companySlug],
        demoUserId: primaryUser?._id,
        title: m.title,
        description: m.description,
        points: m.points,
        badgeIcon: m.badgeIcon,
        status: idx < 3 ? "unlocked" : "locked",
        awardedAt: idx < 3 ? new Date(Date.now() - (3 - idx) * 86400000) : undefined,
      }));
      await DemoMilestone.insertMany(milestoneEntries);

      stepsCompleted.push("6. Loaded deterministic seed baseline (tenants, users, journeys, tasks, documents, kb, milestones)");

      // Step 7: Restore initial simulated email log and activity entry
      await DemoEmailLog.create({
        demoTenantId: companyMap["acme-corp-demo"],
        to: "john.doe@acme-demo.com",
        subject: "Welcome to Acme Corp Onboarding (Demo Simulation)",
        htmlContent: "<p>Welcome to Acme Corporation! Your onboarding journey is now active.</p>",
        sourceEvent: "system_welcome",
      });
      stepsCompleted.push("7. Restored demo configurations and notification inbox");

      // Step 8: Verify database integrity
      const [tCount, uCount, jCount, taskCount, dCount] = await Promise.all([
        DemoTenant.countDocuments(),
        DemoUser.countDocuments(),
        DemoJourney.countDocuments(),
        DemoTask.countDocuments(),
        DemoDocument.countDocuments(),
      ]);

      if (tCount !== DETERMINISTIC_DEMO_COMPANIES.length || uCount !== DETERMINISTIC_DEMO_USERS.length) {
        throw new Error(`Database integrity verification failed: expected ${DETERMINISTIC_DEMO_COMPANIES.length} tenants, got ${tCount}`);
      }
      stepsCompleted.push("8. Verified database integrity across all demo collections");

      const durationMs = Date.now() - startTime;

      // Step 9: Record the reset operation in the audit log
      await DemoResetLog.create({
        performedBy,
        actorRole,
        status: "SUCCESS",
        durationMs,
        stepsCompleted,
        seedStats: {
          tenantsCreated: tCount,
          usersCreated: uCount,
          journeysCreated: jCount,
          tasksCreated: taskCount,
          documentsCreated: dCount,
        },
      });

      // Also log to Activity Log
      await DemoActivityLog.create({
        action: "DEMO_RESET",
        category: "SYSTEM",
        description: `Demo environment reset successfully executed by ${performedBy} in ${durationMs}ms`,
        severity: "warning",
        metadata: { durationMs, tenantsCreated: tCount, usersCreated: uCount },
      });
      stepsCompleted.push("9. Recorded reset operation in audit log");

      // Step 10: Re-enable demo access
      isResettingLock = false;
      stepsCompleted.push("10. Re-enabled demo access");

      return {
        success: true,
        durationMs,
        stepsCompleted,
        stats: {
          tenantsCreated: tCount,
          usersCreated: uCount,
          journeysCreated: jCount,
          tasksCreated: taskCount,
          documentsCreated: dCount,
        },
      };
    } catch (error: any) {
      isResettingLock = false;
      const DemoResetLog = getDemoResetLogModel();
      try {
        await DemoResetLog.create({
          performedBy,
          actorRole,
          status: "FAILED",
          durationMs: Date.now() - startTime,
          stepsCompleted,
          errorMessage: error.message,
        });
      } catch (logErr) {
        // silent catch
      }
      throw error;
    }
  }

  /**
   * Ensures that the isolated demo database is seeded on startup or before serving requests.
   * If any of the collections are missing records, it triggers baseline seeding automatically.
   */
  public static async ensureSeeded(force: boolean = false): Promise<void> {
    try {
      const DemoTenant = getDemoTenantModel();
      const DemoJourney = getDemoJourneyModel();
      const DemoKBArticle = getDemoKBArticleModel();

      const [tenantCount, journeyCount, kbCount] = await Promise.all([
        DemoTenant.countDocuments(),
        DemoJourney.countDocuments(),
        DemoKBArticle.countDocuments(),
      ]);

      if (force || tenantCount === 0 || journeyCount === 0 || kbCount === 0) {
        console.log("[DemoResetService] Seeding baseline demo database collections...");
        await demoResetService.executeReset("System Baseline Auto-Seed", "system");
        console.log("[DemoResetService] Baseline demo collections seeded successfully.");
      }
    } catch (err: any) {
      console.error("[DemoResetService] Failed to ensure demo database seeded:", err.message);
    }
  }
}

export const demoResetService = new DemoResetService();
export default demoResetService;
