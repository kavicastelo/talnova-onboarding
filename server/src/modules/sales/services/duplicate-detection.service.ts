import mongoose from "mongoose";
import Lead, { ILead } from "../models/lead.model.js";
import SalesTask from "../models/task.model.js";
import CommThread from "../models/comm-thread.model.js";
import AuditLog from "../../audit-logs/models/audit-log.model.js";
import AppError from "../../../common/errors/app-error.js";
import { normalizeEmail, normalizePhone } from "../utils/normalize.js";
import {
  stringSimilarity,
  nameSimilarity,
  cleanCompanyName,
  cleanContactName,
} from "../utils/fuzzy.js";
import { CheckDuplicatesInput } from "../schemas/lead.schemas.js";

export interface DuplicateMatchResult {
  lead: ILead;
  matchType: "email" | "phone" | "fuzzy";
  confidence: number;
  matchReason: string;
}

export class DuplicateDetectionService {
  /**
   * Find potential duplicate leads for an existing lead
   */
  public async findDuplicatesForLead(leadId: string): Promise<DuplicateMatchResult[]> {
    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      throw new AppError(400, "INVALID_ID", `Invalid lead ID: ${leadId}`);
    }

    const lead = await Lead.findById(leadId);
    if (!lead) {
      throw new AppError(404, "LEAD_NOT_FOUND", `Lead with ID ${leadId} not found`);
    }

    return this.checkDuplicates({
      email: lead.email,
      phone: lead.phone,
      name: lead.name,
      companyName: lead.companyName,
      excludeLeadId: lead._id.toString(),
    });
  }

  /**
   * Check duplicate leads given raw attributes (useful during lead capture or imports)
   */
  public async checkDuplicates(input: CheckDuplicatesInput): Promise<DuplicateMatchResult[]> {
    const normalizedEmail = input.email ? normalizeEmail(input.email) : undefined;
    const normalizedPhone = input.phone ? normalizePhone(input.phone) : undefined;

    const baseFilter: Record<string, any> = {
      status: { $ne: "duplicate" },
    };

    if (input.excludeLeadId && mongoose.Types.ObjectId.isValid(input.excludeLeadId)) {
      baseFilter._id = { $ne: new mongoose.Types.ObjectId(input.excludeLeadId) };
    }

    // Build candidate search conditions
    const orClauses: Record<string, any>[] = [];
    if (normalizedEmail) {
      orClauses.push({ normalizedEmail });
    }
    if (normalizedPhone) {
      orClauses.push({ normalizedPhone });
    }

    if (input.companyName && input.companyName.trim()) {
      const cleanComp = cleanCompanyName(input.companyName);
      if (cleanComp.length >= 3) {
        orClauses.push({ companyName: { $regex: cleanComp.split(" ")[0], $options: "i" } });
      }
    }

    if (input.name && input.name.trim()) {
      const cleanName = cleanContactName(input.name);
      if (cleanName.length >= 3) {
        orClauses.push({ name: { $regex: cleanName.split(" ")[0], $options: "i" } });
      }
    }

    if (orClauses.length === 0) {
      return [];
    }

    const query = {
      ...baseFilter,
      $or: orClauses,
    };

    const candidates = await Lead.find(query).limit(50).lean();
    const results: DuplicateMatchResult[] = [];
    const seenIds = new Set<string>();

    for (const c of candidates) {
      const cId = (c as any)._id.toString();
      if (seenIds.has(cId)) continue;

      // 1. Exact Email Match
      if (normalizedEmail && c.normalizedEmail === normalizedEmail) {
        results.push({
          lead: c as unknown as ILead,
          matchType: "email",
          confidence: 1.0,
          matchReason: `Exact email match (${normalizedEmail})`,
        });
        seenIds.add(cId);
        continue;
      }

      // 2. Exact Phone Match
      if (normalizedPhone && c.normalizedPhone === normalizedPhone) {
        results.push({
          lead: c as unknown as ILead,
          matchType: "phone",
          confidence: 0.95,
          matchReason: `Exact phone match (${normalizedPhone})`,
        });
        seenIds.add(cId);
        continue;
      }

      // 3. Fuzzy Match (Company name and Contact name)
      if (input.companyName && input.name) {
        const compSim = stringSimilarity(cleanCompanyName(c.companyName), cleanCompanyName(input.companyName));
        const nameSim = nameSimilarity(c.name, input.name);

        if (compSim >= 0.75 && nameSim >= 0.75) {
          const confidence = Math.round(((compSim * 0.5) + (nameSim * 0.5)) * 100) / 100;
          results.push({
            lead: c as unknown as ILead,
            matchType: "fuzzy",
            confidence,
            matchReason: `Fuzzy match: company (${Math.round(compSim * 100)}%) and name (${Math.round(nameSim * 100)}%)`,
          });
          seenIds.add(cId);
        }
      }
    }

    // Sort by confidence descending
    results.sort((a, b) => b.confidence - a.confidence);
    return results;
  }

  /**
   * Transaction-safe merge workflow:
   * Consolidates secondary leads into the primary lead, reassigns tasks, threads, notes,
   * updates tags/scores, archives secondary leads, and writes an AuditLog record.
   */
  public async mergeLeads(
    primaryLeadId: string,
    secondaryLeadIds: string[],
    fieldOverrides?: Record<string, any>,
    actorUserId?: string
  ): Promise<ILead> {
    if (!mongoose.Types.ObjectId.isValid(primaryLeadId)) {
      throw new AppError(400, "INVALID_ID", `Invalid primary lead ID: ${primaryLeadId}`);
    }

    if (!Array.isArray(secondaryLeadIds) || secondaryLeadIds.length === 0) {
      throw new AppError(400, "INVALID_PAYLOAD", "At least one secondary lead ID is required to merge");
    }

    for (const secId of secondaryLeadIds) {
      if (!mongoose.Types.ObjectId.isValid(secId)) {
        throw new AppError(400, "INVALID_ID", `Invalid secondary lead ID: ${secId}`);
      }
      if (secId === primaryLeadId) {
        throw new AppError(400, "INVALID_OPERATION", "Cannot merge a lead into itself");
      }
    }

    const session = await mongoose.startSession();
    let updatedPrimaryLead: ILead;

    try {
      await session.withTransaction(async () => {
        // 1. Fetch primary lead
        const primary = await Lead.findById(primaryLeadId).session(session);
        if (!primary) {
          throw new AppError(404, "PRIMARY_LEAD_NOT_FOUND", `Primary lead ${primaryLeadId} not found`);
        }

        // 2. Fetch all secondary leads
        const secondaryLeads = await Lead.find({
          _id: { $in: secondaryLeadIds.map((id) => new mongoose.Types.ObjectId(id)) },
        }).session(session);

        if (secondaryLeads.length !== secondaryLeadIds.length) {
          throw new AppError(
            404,
            "SECONDARY_LEAD_NOT_FOUND",
            "One or more secondary leads could not be found"
          );
        }

        // 3. Consolidate notes from secondary leads
        const mergedNotes = [...primary.notes];
        for (const sec of secondaryLeads) {
          for (const note of sec.notes) {
            mergedNotes.push({
              content: `[Merged from ${sec.name} <${sec.email}>]: ${note.content}`,
              createdBy: note.createdBy,
              createdAt: note.createdAt || new Date(),
            });
          }
        }
        primary.notes = mergedNotes;

        // 4. Consolidate tags (deduplicated union)
        const tagSet = new Set(primary.tags || []);
        for (const sec of secondaryLeads) {
          if (sec.tags) {
            for (const t of sec.tags) tagSet.add(t);
          }
        }
        primary.tags = Array.from(tagSet);

        // 5. Consolidate scores (take highest score)
        let maxScore = primary.score;
        for (const sec of secondaryLeads) {
          if (sec.score > maxScore) maxScore = sec.score;
        }
        primary.score = maxScore;

        // 6. Apply explicit field overrides if provided
        if (fieldOverrides && typeof fieldOverrides === "object") {
          const allowedOverrides = [
            "name",
            "email",
            "phone",
            "whatsapp",
            "companyName",
            "jobTitle",
            "industry",
            "status",
            "priority",
            "assignedOwnerId",
            "estimatedBudget",
          ];
          for (const key of allowedOverrides) {
            if (fieldOverrides[key] !== undefined) {
              (primary as any)[key] = fieldOverrides[key];
            }
          }
          if (fieldOverrides.email) {
            primary.normalizedEmail = normalizeEmail(fieldOverrides.email);
          }
          if (fieldOverrides.phone) {
            primary.normalizedPhone = normalizePhone(fieldOverrides.phone);
          }
        }

        await primary.save({ session });

        const secObjectIds = secondaryLeadIds.map((id) => new mongoose.Types.ObjectId(id));

        // 7. Reassign associated SalesTasks
        await SalesTask.updateMany(
          { leadId: { $in: secObjectIds } },
          { $set: { leadId: primary._id } },
          { session }
        );

        // 8. Reassign associated CommThreads
        await CommThread.updateMany(
          { leadId: { $in: secObjectIds } },
          { $set: { leadId: primary._id } },
          { session }
        );

        // 9. Archive secondary leads (status: "duplicate", mergedIntoLeadId: primary._id)
        await Lead.updateMany(
          { _id: { $in: secObjectIds } },
          {
            $set: {
              status: "duplicate",
              mergedIntoLeadId: primary._id,
              disqualificationReason: `Merged into primary lead ${primary._id}`,
            },
          },
          { session }
        );

        updatedPrimaryLead = primary;
      });
    } finally {
      await session.endSession();
    }

    // 10. Record immutable merge entry in AuditLog
    try {
      await AuditLog.create({
        actorUserId: actorUserId && mongoose.Types.ObjectId.isValid(actorUserId)
          ? new mongoose.Types.ObjectId(actorUserId)
          : undefined,
        actorType: actorUserId ? "user" : "system",
        eventCategory: "admin",
        eventType: "LEAD_MERGED",
        resourceType: "sales_lead",
        resourceId: updatedPrimaryLead!._id,
        action: "update",
        description: `Merged leads [${secondaryLeadIds.join(", ")}] into primary lead ${updatedPrimaryLead!.name} (${updatedPrimaryLead!._id})`,
        metadata: {
          primaryLeadId: updatedPrimaryLead!._id,
          secondaryLeadIds,
          fieldOverrides,
        },
        severity: "warning",
      });
    } catch {}

    return updatedPrimaryLead!;
  }
}

export default DuplicateDetectionService;
