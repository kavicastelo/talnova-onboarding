import mongoose from "mongoose";
import { QueueService } from "../../../infrastructure/queue/queue.service.js";
import { EventBus } from "../../../infrastructure/events/event-bus.js";
import Lead, { ILead } from "../models/lead.model.js";
import Deal, { IDeal } from "../models/deal.model.js";
import SalesTask from "../models/task.model.js";
import User, { IUser } from "../../auth/models/user.model.js";
import SystemLogBuffer from "../../../infrastructure/telemetry/system-log-buffer.js";
import { AuditLog } from "../../audit-logs/models/audit-log.model.js";
import AppError from "../../../common/errors/app-error.js";

export interface AutomationRuleDefinition {
  id: string;
  name: string;
  description: string;
  triggerEvent: string;
  action: string;
  status: "active" | "paused";
  targetEntities: ("lead" | "deal" | "task" | "communication")[];
}

export class AutomationEngineService {
  private static instance: AutomationEngineService;
  private queue = QueueService.getInstance();
  private eventBus = EventBus.getInstance();
  private roundRobinIndex = 0;

  // Pre-configured automated rules metadata
  private rules: AutomationRuleDefinition[] = [
    {
      id: "auto_followup",
      name: "Immediate Inbound Lead Follow-Up",
      description: "Automatically schedules a high-priority follow-up task due in 24 hours when leads originate from website or product demo.",
      triggerEvent: "lead:created",
      action: "create_task",
      status: "active",
      targetEntities: ["lead", "task"],
    },
    {
      id: "stale_lead_escalation",
      name: "Stale Lead Escalation (>7 Days)",
      description: "Detects untouched leads remaining in 'new' or 'contacted' status for over 7 days, elevates priority to High, and schedules an urgent reminder.",
      triggerEvent: "cron:stale_lead_check",
      action: "escalate_priority",
      status: "active",
      targetEntities: ["lead", "task"],
    },
    {
      id: "stale_deal_warning",
      name: "Stale Deal Pipeline Warning (>14 Days)",
      description: "Identifies open deals stalling in proposal or negotiation stages without movement for over 14 days, flags risk, and creates a pipeline review task.",
      triggerEvent: "cron:stale_deal_check",
      action: "flag_deal_risk",
      status: "active",
      targetEntities: ["deal", "task"],
    },
    {
      id: "round_robin_assignment",
      name: "Round-Robin Lead Assignment",
      description: "Evenly distributes newly qualified unassigned leads across active sales team representatives.",
      triggerEvent: "lead:status_changed",
      action: "assign_owner",
      status: "active",
      targetEntities: ["lead"],
    },
    {
      id: "inbound_comm_responder",
      name: "Inbound Message Task Generation",
      description: "Schedules a task for assigned sales reps when new inbound communication is received from customer.",
      triggerEvent: "comm:inbound_received",
      action: "create_task",
      status: "active",
      targetEntities: ["communication", "task"],
    },
  ];

  constructor() {
    this.registerEventSubscribers();
  }

  public static getInstance(): AutomationEngineService {
    if (!AutomationEngineService.instance) {
      AutomationEngineService.instance = new AutomationEngineService();
    }
    return AutomationEngineService.instance;
  }

  /**
   * Bind event bus subscribers to sales domain events
   */
  public registerEventSubscribers(): void {
    // 1. Lead Created
    this.eventBus.subscribe("lead:created", async (event) => {
      await this.handleLeadCreated(event.payload.leadId, event.payload, event.organizationId);
    });

    // 2. Lead Status Changed
    this.eventBus.subscribe("lead:status_changed", async (event) => {
      await this.handleLeadStatusChanged(
        event.payload.leadId,
        event.payload.fromStatus,
        event.payload.toStatus,
        event.organizationId
      );
    });

    // 3. Deal Stage Changed
    this.eventBus.subscribe("deal:stage_changed", async (event) => {
      await this.handleDealStageChanged(
        event.payload.dealId,
        event.payload.fromStage,
        event.payload.toStage,
        event.organizationId
      );
    });

    // 4. Inbound Communication Received
    this.eventBus.subscribe("comm:inbound_received", async (event) => {
      await this.handleInboundCommReceived(
        event.payload.threadId,
        event.payload,
        event.organizationId
      );
    });
  }

  /**
   * Rule 1: Auto Follow-Up on Inbound Leads (Website / Product Demo)
   */
  public async handleLeadCreated(
    leadId: string,
    leadData: Partial<ILead>,
    organizationId?: any
  ): Promise<boolean> {
    const lead = await Lead.findById(leadId);
    if (!lead) return false;

    const source = lead.source || leadData.source;
    if (source === "website" || source === "product_demo") {
      const idempotencyKey = `auto_followup:${lead._id.toString()}`;
      const effectiveOrgId = organizationId || lead.organizationId || new mongoose.Types.ObjectId();

      await this.queue.enqueue(
        "sales:workflow:trigger",
        {
          ruleId: "auto_followup",
          triggerType: "lead_created",
          targetId: lead._id.toString(),
          action: "create_task",
          actionPayload: {
            title: `Initial Outreach: ${lead.name || "Inbound Lead"}`,
            description: `Auto-generated follow up for new inbound lead from ${source}. Follow up within 24 hours.`,
            type: "follow_up",
            priority: "high",
            dueInHours: 24,
            leadId: lead._id,
            companyName: lead.companyName,
            assignedTo: lead.assignedOwnerId,
          },
          organizationId: effectiveOrgId.toString(),
          idempotencyKey,
        },
        {
          organizationId: effectiveOrgId,
          idempotencyKey,
        }
      );

      return true;
    }

    // Check if created directly as qualified
    if (lead.status === "qualified" && !lead.assignedOwnerId) {
      await this.handleRoundRobinAssignment(lead, organizationId);
    }

    return false;
  }

  /**
   * Rule 4: Round-Robin Distribution when Lead transitions to 'qualified'
   */
  public async handleLeadStatusChanged(
    leadId: string,
    fromStatus: string,
    toStatus: string,
    organizationId?: any
  ): Promise<boolean> {
    if (toStatus === "qualified") {
      const lead = await Lead.findById(leadId);
      if (lead && !lead.assignedOwnerId) {
        return this.handleRoundRobinAssignment(lead, organizationId);
      }
    }
    return false;
  }

  /**
   * Round-Robin Assignment Logic
   */
  public async handleRoundRobinAssignment(
    lead: ILead,
    organizationId?: any
  ): Promise<boolean> {
    // Find active sales reps or team members
    const orgQuery: any = { isDeleted: false };
    if (organizationId && mongoose.Types.ObjectId.isValid(organizationId)) {
      orgQuery.organizationId = new mongoose.Types.ObjectId(organizationId);
    }

    const eligibleUsers = await User.find({
      ...orgQuery,
      $or: [
        { "employment.status": "active" },
        { status: "Active" },
      ],
    }).select("_id auth.email profile.fullName roles permissions");

    if (eligibleUsers.length === 0) {
      return false;
    }

    // Pick round-robin user
    const selectedUser = eligibleUsers[this.roundRobinIndex % eligibleUsers.length];
    this.roundRobinIndex++;

    const idempotencyKey = `round_robin:${lead._id.toString()}`;
    const effectiveOrgId = organizationId || lead.organizationId || eligibleUsers[0].organizationId;

    await this.queue.enqueue(
      "sales:workflow:trigger",
      {
        ruleId: "round_robin_assignment",
        triggerType: "lead_status_changed",
        targetId: lead._id.toString(),
        action: "assign_owner",
        actionPayload: {
          ownerId: selectedUser._id.toString(),
          ownerName: selectedUser.profile?.fullName,
        },
        organizationId: effectiveOrgId?.toString(),
        idempotencyKey,
      },
      {
        organizationId: effectiveOrgId || new mongoose.Types.ObjectId(),
        idempotencyKey,
      }
    );

    return true;
  }

  /**
   * Deal Stage Changed Trigger
   */
  public async handleDealStageChanged(
    dealId: string,
    fromStage: string,
    toStage: string,
    organizationId?: any
  ): Promise<boolean> {
    const deal = await Deal.findById(dealId);
    if (!deal) return false;

    // When deal moves to negotiation or proposal, ensure a high priority milestone task exists
    if (toStage === "negotiation" || toStage === "proposal") {
      const idempotencyKey = `deal_stage:${deal._id.toString()}:${toStage}`;
      const effectiveOrgId = organizationId || new mongoose.Types.ObjectId();

      await this.queue.enqueue(
        "sales:workflow:trigger",
        {
          ruleId: "deal_stage_progress",
          triggerType: "deal_stage_changed",
          targetId: deal._id.toString(),
          action: "create_task",
          actionPayload: {
            title: `Prepare ${toStage.toUpperCase()} Terms: ${deal.name}`,
            type: "proposal",
            priority: "high",
            dueInHours: 48,
            dealId: deal._id,
            companyId: deal.companyId,
            assignedTo: deal.ownerId,
          },
          organizationId: effectiveOrgId.toString(),
          idempotencyKey,
        },
        {
          organizationId: effectiveOrgId,
          idempotencyKey,
        }
      );
      return true;
    }

    return false;
  }

  /**
   * Rule 5: Inbound Communication Task Trigger
   */
  public async handleInboundCommReceived(
    threadId: string,
    payload: Record<string, any>,
    organizationId?: any
  ): Promise<boolean> {
    const idempotencyKey = `inbound_comm:${threadId}:${payload.providerMessageId || Date.now()}`;
    const effectiveOrgId = organizationId || new mongoose.Types.ObjectId();

    await this.queue.enqueue(
      "sales:workflow:trigger",
      {
        ruleId: "inbound_comm_responder",
        triggerType: "comm_inbound_received",
        targetId: threadId,
        action: "create_task",
        actionPayload: {
          title: `Reply to Customer Message: ${payload.subject || "Inbound message"}`,
          type: "email",
          priority: "high",
          dueInHours: 4,
          leadId: payload.leadId,
          contactId: payload.contactId,
          companyId: payload.companyId,
          assignedTo: payload.assignedTo,
        },
        organizationId: effectiveOrgId.toString(),
        idempotencyKey,
      },
      {
        organizationId: effectiveOrgId,
        idempotencyKey,
      }
    );

    return true;
  }

  /**
   * Rule 2: Scan and Escalate Stale Leads (> 7 days without update)
   */
  public async runStaleLeadCheck(
    organizationId?: any,
    daysThreshold = 7
  ): Promise<{ scanned: number; escalated: number }> {
    const cutoffDate = new Date(Date.now() - daysThreshold * 24 * 3600 * 1000);
    const dateTag = new Date().toISOString().slice(0, 10);

    const query: any = {
      status: { $in: ["new", "contacted"] },
      updatedAt: { $lte: cutoffDate },
      priority: { $ne: "urgent" },
    };

    if (organizationId && mongoose.Types.ObjectId.isValid(organizationId)) {
      query.$or = [
        { organizationId: new mongoose.Types.ObjectId(organizationId) },
        { organizationId: { $exists: false } },
        { organizationId: null },
      ];
    }

    const staleLeads = await Lead.find(query).limit(100);
    let escalatedCount = 0;

    for (const lead of staleLeads) {
      const idempotencyKey = `stale_lead:${lead._id.toString()}:${dateTag}`;
      const effectiveOrgId = organizationId || lead.organizationId || new mongoose.Types.ObjectId();

      const job = await this.queue.enqueue(
        "sales:workflow:trigger",
        {
          ruleId: "stale_lead_escalation",
          triggerType: "stale_lead_check",
          targetId: lead._id.toString(),
          action: "escalate_priority",
          actionPayload: {
            title: `Urgent: Stale Lead Escalation (${lead.name})`,
            description: `Lead has had no recorded activity for > ${daysThreshold} days. Follow up required immediately.`,
            priority: "urgent",
            assignedTo: lead.assignedOwnerId,
          },
          organizationId: effectiveOrgId.toString(),
          idempotencyKey,
        },
        {
          organizationId: effectiveOrgId,
          idempotencyKey,
        }
      );

      if (job) escalatedCount++;
    }

    return { scanned: staleLeads.length, escalated: escalatedCount };
  }

  /**
   * Rule 3: Scan and Warn for Stale Deals (> 14 days without stage progression)
   */
  public async runStaleDealCheck(
    organizationId?: any,
    daysThreshold = 14
  ): Promise<{ scanned: number; flagged: number }> {
    const cutoffDate = new Date(Date.now() - daysThreshold * 24 * 3600 * 1000);
    const dateTag = new Date().toISOString().slice(0, 10);

    const query: any = {
      stage: { $in: ["proposal", "proposal_sent", "negotiation"] },
      updatedAt: { $lte: cutoffDate },
    };

    if (organizationId && mongoose.Types.ObjectId.isValid(organizationId)) {
      query.$or = [
        { organizationId: new mongoose.Types.ObjectId(organizationId) },
        { organizationId: { $exists: false } },
        { organizationId: null },
      ];
    }

    const staleDeals = await Deal.find(query).limit(100);
    let flaggedCount = 0;

    for (const deal of staleDeals) {
      const idempotencyKey = `stale_deal:${deal._id.toString()}:${dateTag}`;
      const effectiveOrgId = organizationId || new mongoose.Types.ObjectId();

      const job = await this.queue.enqueue(
        "sales:workflow:trigger",
        {
          ruleId: "stale_deal_warning",
          triggerType: "stale_deal_check",
          targetId: deal._id.toString(),
          action: "flag_deal_risk",
          actionPayload: {
            title: `Stale Deal Pipeline Review: ${deal.name}`,
            description: `Deal has remained in stage '${deal.stage}' for > ${daysThreshold} days without progression.`,
            nextAction: `Urgent: Schedule pipeline review meeting with deal owner.`,
            assignedTo: deal.ownerId,
          },
          organizationId: effectiveOrgId.toString(),
          idempotencyKey,
        },
        {
          organizationId: effectiveOrgId,
          idempotencyKey,
        }
      );

      if (job) flaggedCount++;
    }

    return { scanned: staleDeals.length, flagged: flaggedCount };
  }

  /**
   * Run full stale scan (both leads and deals)
   */
  public async runStaleScan(
    organizationId?: any
  ): Promise<{
    leads: { scanned: number; escalated: number };
    deals: { scanned: number; flagged: number };
  }> {
    const [leads, deals] = await Promise.all([
      this.runStaleLeadCheck(organizationId),
      this.runStaleDealCheck(organizationId),
    ]);

    return { leads, deals };
  }

  /**
   * Get configured rules inventory
   */
  public getRules(): AutomationRuleDefinition[] {
    return this.rules;
  }

  /**
   * Manually trigger an automation rule for a target entity
   */
  public async triggerRule(
    ruleId: string,
    targetId: string,
    organizationId?: any
  ): Promise<{ enqueued: boolean; ruleId: string; targetId: string }> {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) {
      throw new AppError(404, "RULE_NOT_FOUND", `Automation rule '${ruleId}' not found`);
    }

    const effectiveOrgId = organizationId || new mongoose.Types.ObjectId();
    const idempotencyKey = `manual:${ruleId}:${targetId}:${Date.now()}`;

    const job = await this.queue.enqueue(
      "sales:workflow:trigger",
      {
        ruleId,
        triggerType: rule.triggerEvent,
        targetId,
        action: rule.action as any,
        actionPayload: {
          title: `Manual Trigger: ${rule.name}`,
          description: `Dispatched manually via administrative automation control`,
        },
        organizationId: effectiveOrgId.toString(),
        idempotencyKey,
      },
      {
        organizationId: effectiveOrgId,
        idempotencyKey,
      }
    );

    return { enqueued: !!job, ruleId, targetId };
  }

  /**
   * Fetch recent automation execution logs from AuditLog
   */
  public async getRecentLogs(organizationId?: any, limit = 20): Promise<any[]> {
    const query: any = {
      eventCategory: "sales",
      eventType: "SALES_AUTOMATION_EXECUTED",
    };

    if (organizationId && mongoose.Types.ObjectId.isValid(organizationId)) {
      query.organizationId = new mongoose.Types.ObjectId(organizationId);
    }

    return AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("eventType description metadata createdAt severity")
      .lean();
  }
}

export default AutomationEngineService;
