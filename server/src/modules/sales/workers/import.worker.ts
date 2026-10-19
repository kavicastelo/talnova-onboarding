import { Job } from "../../../infrastructure/queue/queue.service.js";
import Lead from "../models/lead.model.js";
import SystemLogBuffer from "../../../infrastructure/telemetry/system-log-buffer.js";

export interface LeadImportJobData {
  importBatchId: string;
  duplicateStrategy?: "skip" | "overwrite" | "create_duplicate";
  leads: Array<{
    name: string;
    email: string;
    phone?: string;
    companyName: string;
    jobTitle?: string;
    industry?: string;
    source?: string;
  }>;
}

export async function processLeadImportJob(job: Job<LeadImportJobData>): Promise<void> {
  const { importBatchId, leads, duplicateStrategy = "skip" } = job.data;

  try {
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const leadData of leads) {
      if (!leadData.email || !leadData.name || !leadData.companyName) {
        skipped++;
        continue;
      }

      const normalized = leadData.email.toLowerCase().trim();
      const existing = await Lead.findOne({ normalizedEmail: normalized });
      if (existing) {
        if (duplicateStrategy === "skip") {
          skipped++;
          continue;
        }
        if (duplicateStrategy === "overwrite") {
          existing.name = leadData.name.trim();
          existing.companyName = leadData.companyName.trim();
          if (leadData.phone) existing.phone = leadData.phone.trim();
          if (leadData.jobTitle) existing.jobTitle = leadData.jobTitle.trim();
          if (leadData.industry) existing.industry = leadData.industry.trim();
          await existing.save();
          updated++;
          continue;
        }
        // if create_duplicate, continue to create
      }

      await Lead.create({
        name: leadData.name.trim(),
        email: leadData.email.trim(),
        normalizedEmail: normalized,
        phone: leadData.phone?.trim(),
        companyName: leadData.companyName.trim(),
        jobTitle: leadData.jobTitle?.trim(),
        industry: leadData.industry?.trim(),
        source: leadData.source || "import",
        status: "new",
        score: 0,
      });
      imported++;
    }

    SystemLogBuffer.record({
      level: "info",
      source: "sales:import:worker",
      eventType: "LEAD_IMPORT_COMPLETED",
      description: `Import batch ${importBatchId} completed: ${imported} imported, ${skipped} skipped.`,
    });
  } catch (error: any) {
    SystemLogBuffer.record({
      level: "critical",
      source: "sales:import:worker",
      eventType: "LEAD_IMPORT_ERROR",
      description: `Import batch ${importBatchId} failed: ${error.message}`,
    });
    throw error;
  }
}

export default processLeadImportJob;
