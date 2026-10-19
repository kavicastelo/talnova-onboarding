import mongoose from "mongoose";
import { Lead, ILead } from "../models/lead.model.js";
import { Contact, IContact } from "../models/contact.model.js";
import { Company } from "../models/company.model.js";
import { Campaign } from "../models/campaign.model.js";
import { Suppression, ISuppression } from "../models/suppression.model.js";
import { normalizeToE164 } from "../integrations/whatsapp/whatsapp-provider.interface.js";
import {
  AudienceFilterInput,
  AudienceEstimateInput,
  AudienceResolveInput,
} from "../schemas/campaign.schemas.js";

export interface CandidateRecipient {
  leadId?: mongoose.Types.ObjectId;
  contactId?: mongoose.Types.ObjectId;
  recipientEmail?: string;
  recipientPhone?: string;
  recipientName?: string;
  type: "lead" | "contact";
  consent: {
    emailMarketing: boolean;
    whatsappMarketing: boolean;
    optedOutAt?: Date;
  };
}

export interface SuppressionBreakdown {
  noConsent: number;
  optedOut: number;
  suppressionList: number;
  bounced: number;
  frequencyCapped: number;
  missingContactInfo: number;
}

export interface AudienceEstimationResult {
  totalMatching: number;
  netDeliverable: number;
  suppressedCount: number;
  breakdown: SuppressionBreakdown;
  sampleRecipients: Array<{
    recipientEmail?: string;
    recipientPhone?: string;
    recipientName?: string;
    leadId?: string;
    contactId?: string;
    type: "lead" | "contact";
  }>;
}

export class AudienceSegmentationService {
  /**
   * Compiles the MongoDB query filter for Leads based on criteria
   */
  public compileLeadQuery(filter: AudienceFilterInput): Record<string, any> {
    const query: Record<string, any> = {
      mergedIntoLeadId: { $in: [null, undefined] },
    };

    if (filter.statuses && filter.statuses.length > 0) {
      query.status = { $in: filter.statuses };
    } else {
      // By default exclude terminal non-deliverable statuses
      query.status = { $nin: ["duplicate", "disqualified"] };
    }

    if (filter.minScore !== undefined || filter.maxScore !== undefined) {
      query.score = {};
      if (filter.minScore !== undefined) query.score.$gte = filter.minScore;
      if (filter.maxScore !== undefined) query.score.$lte = filter.maxScore;
    }

    if (filter.industries && filter.industries.length > 0) {
      query.industry = { $in: filter.industries };
    }

    if (filter.companySizes && filter.companySizes.length > 0) {
      query.companySize = { $in: filter.companySizes };
    }

    if (filter.sources && filter.sources.length > 0) {
      query.source = { $in: filter.sources };
    }

    if (filter.country) {
      query.country = { $regex: `^${filter.country.trim()}$`, $options: "i" };
    }

    if (filter.region) {
      query.region = { $regex: `^${filter.region.trim()}$`, $options: "i" };
    }

    if (filter.includeTags && filter.includeTags.length > 0) {
      query.tags = { $in: filter.includeTags };
    }

    if (filter.excludeTags && filter.excludeTags.length > 0) {
      if (query.tags) {
        query.tags.$nin = filter.excludeTags;
      } else {
        query.tags = { $nin: filter.excludeTags };
      }
    }

    if (filter.inactiveDays && filter.inactiveDays > 0) {
      const cutoff = new Date(Date.now() - filter.inactiveDays * 86400000);
      query.$or = [
        { lastContactDate: { $lte: cutoff } },
        {
          lastContactDate: { $exists: false },
          updatedAt: { $lte: cutoff },
        },
      ];
    }

    // Required channel identifier
    if (filter.channel === "email") {
      query.email = { $exists: true, $ne: "" };
    } else if (filter.channel === "whatsapp") {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { phone: { $exists: true, $ne: "" } },
          { whatsapp: { $exists: true, $ne: "" } },
        ],
      });
    }

    return query;
  }

  /**
   * Compiles the MongoDB query filter for Contacts based on criteria
   */
  public async compileContactQuery(filter: AudienceFilterInput): Promise<Record<string, any>> {
    const query: Record<string, any> = {};

    if (filter.roles && filter.roles.length > 0) {
      query.role = { $in: filter.roles };
    }

    if (filter.includeTags && filter.includeTags.length > 0) {
      query.tags = { $in: filter.includeTags };
    }

    if (filter.excludeTags && filter.excludeTags.length > 0) {
      if (query.tags) {
        query.tags.$nin = filter.excludeTags;
      } else {
        query.tags = { $nin: filter.excludeTags };
      }
    }

    // Filter through associated Company criteria
    const companyFilter: Record<string, any> = {};
    if (filter.industries && filter.industries.length > 0) {
      companyFilter.industry = { $in: filter.industries };
    }
    if (filter.country) {
      companyFilter.country = { $regex: `^${filter.country.trim()}$`, $options: "i" };
    }
    if (filter.region) {
      companyFilter.region = { $regex: `^${filter.region.trim()}$`, $options: "i" };
    }

    if (Object.keys(companyFilter).length > 0) {
      const companies = await Company.find(companyFilter).select("_id").lean();
      const companyIds = companies.map((c) => c._id);
      query.companyId = { $in: companyIds };
    }

    // Required channel identifier
    if (filter.channel === "email") {
      query.email = { $exists: true, $ne: "" };
    } else if (filter.channel === "whatsapp") {
      query.$or = [
        { phone: { $exists: true, $ne: "" } },
        { whatsapp: { $exists: true, $ne: "" } },
      ];
    }

    return query;
  }

  /**
   * Fetches raw matching candidates from Leads and/or Contacts
   */
  private async fetchMatchingCandidates(filter: AudienceFilterInput): Promise<CandidateRecipient[]> {
    const candidates: CandidateRecipient[] = [];
    const target = filter.target || "leads";

    if (target === "leads" || target === "both") {
      const leadQuery = this.compileLeadQuery(filter);
      const leads = await Lead.find(leadQuery)
        .select("name email phone whatsapp consent")
        .lean();

      for (const lead of leads) {
        candidates.push({
          leadId: lead._id,
          recipientEmail: (lead.email || "").trim().toLowerCase(),
          recipientPhone: lead.phone || lead.whatsapp || undefined,
          recipientName: lead.name,
          type: "lead",
          consent: {
            emailMarketing: Boolean(lead.consent?.emailMarketing),
            whatsappMarketing: Boolean(lead.consent?.whatsappMarketing),
            optedOutAt: lead.consent?.optedOutAt,
          },
        });
      }
    }

    if (target === "contacts" || target === "both") {
      const contactQuery = await this.compileContactQuery(filter);
      const contacts = await Contact.find(contactQuery)
        .select("firstName lastName fullName email phone whatsapp consent")
        .lean();

      for (const contact of contacts) {
        candidates.push({
          contactId: contact._id,
          recipientEmail: (contact.email || "").trim().toLowerCase(),
          recipientPhone: contact.phone || contact.whatsapp || undefined,
          recipientName: contact.fullName || `${contact.firstName || ""} ${contact.lastName || ""}`.trim(),
          type: "contact",
          consent: {
            emailMarketing: Boolean(contact.consent?.emailMarketing),
            whatsappMarketing: Boolean(contact.consent?.whatsappMarketing),
            optedOutAt: contact.consent?.optedOutAt,
          },
        });
      }
    }

    return candidates;
  }

  /**
   * Builds the suppression state maps for high-performance in-memory evaluation
   */
  private async loadSuppressionSets(
    channel: "email" | "whatsapp",
    frequencyCap?: { maxMessages: number; windowDays: number }
  ): Promise<{
    suppressionListSet: Set<string>;
    bouncedSet: Set<string>;
    frequencyCappedSet: Set<string>;
  }> {
    const idType = channel === "email" ? "email" : "phone";

    // 1. Global Suppression Registry (unsubscribes, manual blacklists, complaints)
    const suppressions = await Suppression.find({ type: idType }).select("identifier").lean();
    const suppressionListSet = new Set(suppressions.map((s) => s.identifier.toLowerCase().trim()));

    // 2. Historical bounces in campaigns
    const bouncedAgg = await Campaign.aggregate([
      { $unwind: "$recipients" },
      {
        $match: {
          "recipients.status": "bounced",
        },
      },
      {
        $group: {
          _id: channel === "email" ? "$recipients.recipientEmail" : "$recipients.recipientPhone",
        },
      },
    ]);
    const bouncedSet = new Set(
      bouncedAgg
        .map((b) => (b._id || "").toString().toLowerCase().trim())
        .filter((val) => val.length > 0)
    );

    // 3. Rolling frequency cap calculation (default: <= 2 messages in 7 days)
    const maxMessages = frequencyCap?.maxMessages ?? 2;
    const windowDays = frequencyCap?.windowDays ?? 7;
    const windowCutoff = new Date(Date.now() - windowDays * 86400000);

    const freqAgg = await Campaign.aggregate([
      { $unwind: "$recipients" },
      {
        $match: {
          channel,
          "recipients.status": { $in: ["sent", "delivered", "read", "opened", "clicked"] },
          "recipients.sentAt": { $gte: windowCutoff },
        },
      },
      {
        $group: {
          _id: channel === "email" ? "$recipients.recipientEmail" : "$recipients.recipientPhone",
          count: { $sum: 1 },
        },
      },
      {
        $match: {
          count: { $gte: maxMessages },
        },
      },
    ]);

    const frequencyCappedSet = new Set(
      freqAgg
        .map((f) => (f._id || "").toString().toLowerCase().trim())
        .filter((val) => val.length > 0)
    );

    return {
      suppressionListSet,
      bouncedSet,
      frequencyCappedSet,
    };
  }

  /**
   * Evaluates audience matching and suppression breakdown
   */
  public async estimateAudience(
    filter: AudienceFilterInput,
    sampleSize = 5
  ): Promise<AudienceEstimationResult> {
    const candidates = await this.fetchMatchingCandidates(filter);
    const { suppressionListSet, bouncedSet, frequencyCappedSet } = await this.loadSuppressionSets(
      filter.channel,
      filter.frequencyCap
    );

    const breakdown: SuppressionBreakdown = {
      noConsent: 0,
      optedOut: 0,
      suppressionList: 0,
      bounced: 0,
      frequencyCapped: 0,
      missingContactInfo: 0,
    };

    const deliverableRecipients: CandidateRecipient[] = [];

    // Deduplication key set within the campaign audience
    const seenIdentifiers = new Set<string>();

    for (const candidate of candidates) {
      let identifier = "";

      if (filter.channel === "email") {
        identifier = (candidate.recipientEmail || "").trim().toLowerCase();
        if (!identifier || !identifier.includes("@")) {
          breakdown.missingContactInfo++;
          continue;
        }
      } else {
        const rawPhone = candidate.recipientPhone || "";
        if (!rawPhone.trim()) {
          breakdown.missingContactInfo++;
          continue;
        }
        try {
          identifier = normalizeToE164(rawPhone);
        } catch {
          breakdown.missingContactInfo++;
          continue;
        }
      }

      // Check opt-out first (absolute zero-exception)
      if (candidate.consent.optedOutAt) {
        breakdown.optedOut++;
        continue;
      }

      // Check marketing consent
      const hasConsent =
        filter.channel === "email"
          ? candidate.consent.emailMarketing === true
          : candidate.consent.whatsappMarketing === true;

      if (!hasConsent) {
        breakdown.noConsent++;
        continue;
      }

      // Check global suppression list (unsubscribe registry)
      if (suppressionListSet.has(identifier)) {
        breakdown.suppressionList++;
        continue;
      }

      // Check historical bounces
      if (bouncedSet.has(identifier)) {
        breakdown.bounced++;
        continue;
      }

      // Check rolling frequency cap
      if (frequencyCappedSet.has(identifier)) {
        breakdown.frequencyCapped++;
        continue;
      }

      // Prevent duplicate sends to same address within single campaign
      if (seenIdentifiers.has(identifier)) {
        continue;
      }
      seenIdentifiers.add(identifier);

      deliverableRecipients.push(candidate);
    }

    const totalMatching = candidates.length;
    const netDeliverable = deliverableRecipients.length;
    const suppressedCount = totalMatching - netDeliverable;

    const sample = deliverableRecipients.slice(0, sampleSize).map((r) => ({
      recipientEmail: r.recipientEmail,
      recipientPhone: r.recipientPhone,
      recipientName: r.recipientName,
      leadId: r.leadId?.toString(),
      contactId: r.contactId?.toString(),
      type: r.type,
    }));

    return {
      totalMatching,
      netDeliverable,
      suppressedCount,
      breakdown,
      sampleRecipients: sample,
    };
  }

  /**
   * Resolves and formats deliverable campaign recipients directly from segmentation criteria
   */
  public async resolveAudienceRecipients(
    filter: AudienceFilterInput,
    limit?: number
  ) {
    const candidates = await this.fetchMatchingCandidates(filter);
    const { suppressionListSet, bouncedSet, frequencyCappedSet } = await this.loadSuppressionSets(
      filter.channel,
      filter.frequencyCap
    );

    const deliverable: Array<{
      contactId?: mongoose.Types.ObjectId;
      leadId?: mongoose.Types.ObjectId;
      recipientEmail?: string;
      recipientPhone?: string;
      recipientName?: string;
      status: "pending";
    }> = [];

    const seenIdentifiers = new Set<string>();

    for (const candidate of candidates) {
      let identifier = "";

      if (filter.channel === "email") {
        identifier = (candidate.recipientEmail || "").trim().toLowerCase();
        if (!identifier || !identifier.includes("@")) continue;
      } else {
        const rawPhone = candidate.recipientPhone || "";
        if (!rawPhone.trim()) continue;
        try {
          identifier = normalizeToE164(rawPhone);
        } catch {
          continue;
        }
      }

      // Suppression filters
      if (candidate.consent.optedOutAt) continue;
      const hasConsent =
        filter.channel === "email"
          ? candidate.consent.emailMarketing === true
          : candidate.consent.whatsappMarketing === true;
      if (!hasConsent) continue;
      if (suppressionListSet.has(identifier)) continue;
      if (bouncedSet.has(identifier)) continue;
      if (frequencyCappedSet.has(identifier)) continue;

      if (seenIdentifiers.has(identifier)) continue;
      seenIdentifiers.add(identifier);

      deliverable.push({
        contactId: candidate.contactId,
        leadId: candidate.leadId,
        recipientEmail: candidate.recipientEmail,
        recipientPhone:
          filter.channel === "whatsapp" && identifier ? identifier : candidate.recipientPhone,
        recipientName: candidate.recipientName,
        status: "pending",
      });

      if (limit && deliverable.length >= limit) {
        break;
      }
    }

    return {
      totalMatching: candidates.length,
      netDeliverable: deliverable.length,
      recipients: deliverable,
    };
  }

  /**
   * Suppress an email or phone number in the global suppression registry
   */
  public async suppressRecipient(
    identifier: string,
    type: "email" | "phone",
    reason: "unsubscribe" | "hard_bounce" | "spam_complaint" | "manual" = "unsubscribe",
    source?: string,
    metadata?: Record<string, any>
  ): Promise<ISuppression> {
    const cleanId = type === "email" ? identifier.toLowerCase().trim() : normalizeToE164(identifier);

    const suppression = await Suppression.findOneAndUpdate(
      { identifier: cleanId, type },
      {
        identifier: cleanId,
        type,
        reason,
        source,
        metadata,
      },
      { upsert: true, new: true }
    );

    return suppression;
  }

  /**
   * Checks if an identifier is in the global suppression list
   */
  public async isSuppressed(identifier: string, type: "email" | "phone"): Promise<boolean> {
    const cleanId = type === "email" ? identifier.toLowerCase().trim() : normalizeToE164(identifier);
    const found = await Suppression.findOne({ identifier: cleanId, type }).lean();
    return !!found;
  }
}

export default AudienceSegmentationService;
