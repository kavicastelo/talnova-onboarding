import mongoose from "mongoose";
import Lead, { ILead, ILeadScoreEvent } from "../models/lead.model.js";
import CommThread from "../models/comm-thread.model.js";
import { QueueService } from "../../../infrastructure/queue/queue.service.js";
import AppError from "../../../common/errors/app-error.js";
import AuditLog from "../../audit-logs/models/audit-log.model.js";

export const VALID_LIFECYCLE_TRANSITIONS: Record<string, string[]> = {
  new: ["contacted", "engaged", "qualified", "disqualified", "unresponsive", "duplicate"],
  contacted: ["engaged", "qualified", "nurturing", "disqualified", "unresponsive", "lost", "duplicate"],
  engaged: ["qualified", "opportunity", "nurturing", "disqualified", "unresponsive", "lost", "duplicate"],
  qualified: ["opportunity", "converted", "nurturing", "disqualified", "lost", "duplicate"],
  opportunity: ["converted", "lost", "nurturing", "disqualified", "duplicate"],
  nurturing: ["contacted", "engaged", "qualified", "disqualified", "unresponsive", "lost"],
  unresponsive: ["contacted", "nurturing", "lost", "disqualified"],
  disqualified: ["nurturing", "contacted"],
  lost: ["nurturing", "contacted"],
  converted: [], // Terminal
  duplicate: [], // Terminal
};

export function determinePriorityFromScore(score: number): "low" | "normal" | "high" | "urgent" {
  if (score >= 80) return "urgent";
  if (score >= 50) return "high";
  if (score >= 25) return "normal";
  return "low";
}

export function validateLifecycleTransition(currentStatus: string, newStatus: string): void {
  if (currentStatus === newStatus) return;

  const allowed = VALID_LIFECYCLE_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new AppError(
      400,
      "ILLEGAL_STATUS_TRANSITION",
      `Cannot transition lead status from '${currentStatus}' to '${newStatus}'. Allowed transitions: [${(allowed || []).join(", ")}]`
    );
  }
}

export class LeadScoringService {
  constructor(private readonly queue = QueueService.getInstance()) {}

  /**
   * Idempotently recalculates score and updates priority for a lead based on rules
   */
  public async recalculateLeadScore(leadId: string): Promise<ILead> {
    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      throw new AppError(400, "INVALID_ID", `Invalid lead ID: ${leadId}`);
    }

    const lead = await Lead.findById(leadId);
    if (!lead) {
      throw new AppError(404, "LEAD_NOT_FOUND", `Lead ${leadId} not found`);
    }

    const events: ILeadScoreEvent[] = [];
    const now = new Date();

    // 1. Profile Completeness Rules
    if (lead.phone && lead.phone.trim()) {
      events.push({ rule: "PROFILE_PHONE_PROVIDED", points: 10, timestamp: now });
    }
    if (lead.jobTitle && lead.jobTitle.trim()) {
      events.push({ rule: "PROFILE_TITLE_PROVIDED", points: 5, timestamp: now });
    }
    if (lead.industry && lead.industry.trim()) {
      events.push({ rule: "PROFILE_INDUSTRY_PROVIDED", points: 5, timestamp: now });
    }
    if (lead.companySize) {
      events.push({ rule: "PROFILE_SIZE_PROVIDED", points: 5, timestamp: now });
    }

    // 2. High-Value Source Rules
    if (lead.source === "product_demo") {
      events.push({ rule: "SOURCE_PRODUCT_DEMO", points: 25, timestamp: now });
    } else if (lead.source === "referral") {
      events.push({ rule: "SOURCE_REFERRAL", points: 20, timestamp: now });
    } else if (lead.source === "inbound_email") {
      events.push({ rule: "SOURCE_INBOUND", points: 15, timestamp: now });
    } else if (lead.source === "campaign") {
      events.push({ rule: "SOURCE_CAMPAIGN", points: 10, timestamp: now });
    } else if (lead.source === "website") {
      events.push({ rule: "SOURCE_WEBSITE", points: 5, timestamp: now });
    }

    // 3. Company Size Multipliers
    if (lead.companySize === "1000+") {
      events.push({ rule: "ENTERPRISE_COMPANY_SIZE", points: 25, timestamp: now });
    } else if (lead.companySize === "501-1000" || lead.companySize === "201-500") {
      events.push({ rule: "MID_MARKET_COMPANY_SIZE", points: 20, timestamp: now });
    } else if (lead.companySize === "51-200") {
      events.push({ rule: "SMB_COMPANY_SIZE", points: 10, timestamp: now });
    } else if (lead.companySize === "11-50") {
      events.push({ rule: "SMALL_COMPANY_SIZE", points: 5, timestamp: now });
    }

    // 4. Budget / Deal Potential
    if (lead.estimatedBudget && lead.estimatedBudget >= 100000) {
      events.push({ rule: "HIGH_ESTIMATED_BUDGET", points: 20, timestamp: now });
    } else if (lead.estimatedBudget && lead.estimatedBudget >= 50000) {
      events.push({ rule: "MEDIUM_ESTIMATED_BUDGET", points: 10, timestamp: now });
    }

    // 5. Notes / Sales Activity
    if (lead.notes && lead.notes.length > 0) {
      events.push({ rule: "SALES_NOTES_LOGGED", points: Math.min(15, lead.notes.length * 5), timestamp: now });
    }

    // 6. Inbound Communication Activity (from CommThread)
    const commThreads = await CommThread.find({ leadId: lead._id }).lean();
    let totalInbound = 0;
    for (const thread of commThreads) {
      if (thread.messages) {
        for (const msg of thread.messages) {
          if (msg.direction === "inbound") totalInbound++;
        }
      }
    }
    if (totalInbound > 0) {
      events.push({
        rule: "INBOUND_COMM_ACTIVITY",
        points: Math.min(30, totalInbound * 10),
        timestamp: now,
      });
    }

    // 7. Inactivity Decay (-5 pts per 14 days without interaction)
    const lastActive = lead.lastContactDate || lead.createdAt;
    if (lastActive) {
      const daysInactive = Math.floor((Date.now() - new Date(lastActive).getTime()) / (1000 * 3600 * 24));
      if (daysInactive >= 14) {
        const decayUnits = Math.min(6, Math.floor(daysInactive / 14)); // max -30
        events.push({
          rule: "INACTIVITY_DECAY",
          points: -1 * decayUnits * 5,
          timestamp: now,
        });
      }
    }

    // Compute net score (floored at 0)
    const calculatedScore = Math.max(
      0,
      events.reduce((acc, ev) => acc + ev.points, 0)
    );

    const oldScore = lead.score;
    const oldPriority = lead.priority;

    lead.score = calculatedScore;
    lead.scoreBreakdown = events;
    lead.priority = determinePriorityFromScore(calculatedScore);

    await lead.save();

    try {
      await AuditLog.create({
        actorUserId: undefined,
        actorType: "system",
        eventCategory: "admin",
        eventType: "LEAD_SCORE_RECALCULATED",
        resourceType: "sales_lead",
        resourceId: lead._id,
        action: "update",
        description: `Lead score recalculated: ${oldScore} -> ${calculatedScore} (Priority: ${lead.priority})`,
        metadata: { leadId: lead._id, oldScore, newScore: calculatedScore, priority: lead.priority },
        severity: "info",
      });
    } catch {}

    // Check Qualification Threshold (score >= 70)
    if (calculatedScore >= 70 && oldScore < 70) {
      await this.triggerQualificationWorkflow(lead);
    }

    return lead;
  }

  /**
   * Record a custom point delta event (e.g. from external webhook or action)
   */
  public async recordScoreEvent(
    leadId: string,
    rule: string,
    points: number,
    actorUserId?: string
  ): Promise<ILead> {
    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      throw new AppError(400, "INVALID_ID", `Invalid lead ID: ${leadId}`);
    }

    const lead = await Lead.findById(leadId);
    if (!lead) {
      throw new AppError(404, "LEAD_NOT_FOUND", `Lead ${leadId} not found`);
    }

    const oldScore = lead.score;
    const newScore = Math.max(0, lead.score + points);

    lead.score = newScore;
    lead.scoreBreakdown.push({
      rule,
      points,
      timestamp: new Date(),
    });

    lead.priority = determinePriorityFromScore(newScore);
    await lead.save();

    // If threshold crossed into qualification
    if (newScore >= 70 && oldScore < 70) {
      await this.triggerQualificationWorkflow(lead);
    }

    try {
      await AuditLog.create({
        actorUserId: actorUserId && mongoose.Types.ObjectId.isValid(actorUserId)
          ? new mongoose.Types.ObjectId(actorUserId)
          : undefined,
        actorType: actorUserId ? "user" : "system",
        eventCategory: "admin",
        eventType: "LEAD_SCORE_UPDATED",
        resourceType: "sales_lead",
        resourceId: lead._id,
        action: "update",
        description: `Lead score adjusted by ${points > 0 ? "+" : ""}${points} via rule '${rule}' (Score: ${newScore})`,
        metadata: { leadId: lead._id, rule, points, newScore },
        severity: "info",
      });
    } catch {}

    return lead;
  }

  /**
   * Triggers an automated qualification workflow job in QueueService
   */
  private async triggerQualificationWorkflow(lead: ILead): Promise<void> {
    try {
      await this.queue.enqueue(
        "sales:workflow:trigger",
        {
          triggerType: "lead_created",
          targetId: lead._id.toString(),
          action: "create_task",
          actionPayload: {
            title: `High-Value Lead Qualified: ${lead.name} (${lead.companyName})`,
            type: "demo",
            priority: "urgent",
            leadId: lead._id,
            assignedTo: lead.assignedOwnerId,
          },
        },
        {
          organizationId: new mongoose.Types.ObjectId(),
          idempotencyKey: `lead-qualified-${lead._id}`,
        }
      );
    } catch {}
  }
}

export default LeadScoringService;
