import mongoose, { FilterQuery } from "mongoose";
import Deal, { IDeal, IDealStageHistory } from "../models/deal.model.js";
import Pipeline, { IPipeline, IPipelineStage } from "../models/pipeline.model.js";
import Company from "../models/company.model.js";
import Contact from "../models/contact.model.js";
import Lead from "../models/lead.model.js";
import AuditLog from "../../audit-logs/models/audit-log.model.js";
import AppError from "../../../common/errors/app-error.js";
import PipelineService from "./pipeline.service.js";
import OnboardingHandoffService from "./onboarding-handoff.service.js";
import {
  CreateDealInput,
  UpdateDealInput,
  UpdateDealStageInput,
  DealQueryParams,
  KanbanQueryParams,
  PipelineSummaryQueryParams,
} from "../schemas/deal.schemas.js";

const pipelineService = new PipelineService();

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

export class DealService {
  private async logAudit(params: {
    actorId?: string;
    action: "create" | "update" | "delete" | "status_change";
    eventType: string;
    resourceId?: mongoose.Types.ObjectId;
    description: string;
    metadata?: Record<string, any>;
    severity?: "info" | "warning" | "critical";
  }): Promise<void> {
    try {
      await AuditLog.create({
        actorUserId:
          params.actorId && mongoose.Types.ObjectId.isValid(params.actorId)
            ? new mongoose.Types.ObjectId(params.actorId)
            : undefined,
        actorType: params.actorId ? ("user" as const) : ("system" as const),
        eventCategory: "admin" as const,
        eventType: params.eventType,
        resourceType: "sales_deal",
        resourceId: params.resourceId,
        action: params.action,
        description: params.description,
        metadata: params.metadata,
        severity: params.severity || ("info" as const),
      });
    } catch {
      // Do not fail operation if audit log recording fails
    }
  }

  /**
   * Helper to validate stage required fields against deal data
   */
  private validateStageRequirements(
    stageConfig: IPipelineStage,
    dealData: Partial<IDeal>
  ): void {
    const missing: string[] = [];

    if (stageConfig.requiredFields && stageConfig.requiredFields.length > 0) {
      for (const field of stageConfig.requiredFields) {
        if (field === "value") {
          if (dealData.value === undefined || dealData.value === null || dealData.value <= 0) {
            missing.push("value (must be greater than 0)");
          }
        } else if (field === "primaryContactId") {
          if (!dealData.primaryContactId) {
            missing.push("primaryContactId");
          }
        } else if (field === "expectedCloseDate") {
          if (!dealData.expectedCloseDate) {
            missing.push("expectedCloseDate");
          }
        } else if (field === "lossReason") {
          if (!dealData.lossReason || dealData.lossReason.trim() === "") {
            missing.push("lossReason");
          }
        } else if (field === "wonDetails") {
          if (!dealData.wonDetails?.contractSignedDate) {
            missing.push("wonDetails.contractSignedDate");
          }
        }
      }
    }

    // Always enforce lossReason on closed_lost stage
    if (stageConfig.key === "closed_lost") {
      if (!dealData.lossReason || dealData.lossReason.trim() === "") {
        throw new AppError(
          400,
          "MISSING_LOSS_REASON",
          "Closed-lost deals require a documented loss reason."
        );
      }
    }

    if (missing.length > 0) {
      throw new AppError(
        400,
        "STAGE_REQUIREMENTS_NOT_MET",
        `Cannot advance deal to '${stageConfig.name}'. Missing required fields: ${missing.join(", ")}`
      );
    }
  }

  /**
   * Create a new sales deal
   */
  public async createDeal(input: CreateDealInput, actorId?: string): Promise<IDeal> {
    // 1. Verify Company exists
    if (!mongoose.Types.ObjectId.isValid(input.companyId)) {
      throw new AppError(400, "INVALID_COMPANY_ID", "Provided company ID is invalid");
    }
    const company = await Company.findById(input.companyId);
    if (!company) {
      throw new AppError(404, "COMPANY_NOT_FOUND", "Associated company not found");
    }

    // 2. Verify Primary Contact if provided
    if (input.primaryContactId) {
      if (!mongoose.Types.ObjectId.isValid(input.primaryContactId)) {
        throw new AppError(400, "INVALID_CONTACT_ID", "Provided contact ID is invalid");
      }
      const contact = await Contact.findById(input.primaryContactId);
      if (!contact) {
        throw new AppError(404, "CONTACT_NOT_FOUND", "Associated contact not found");
      }
    }

    // 3. Verify Lead if provided
    if (input.leadId) {
      if (!mongoose.Types.ObjectId.isValid(input.leadId)) {
        throw new AppError(400, "INVALID_LEAD_ID", "Provided lead ID is invalid");
      }
      const lead = await Lead.findById(input.leadId);
      if (!lead) {
        throw new AppError(404, "LEAD_NOT_FOUND", "Associated lead not found");
      }
    }

    // 4. Resolve Pipeline
    let pipeline: IPipeline;
    if (input.pipelineId) {
      if (!mongoose.Types.ObjectId.isValid(input.pipelineId)) {
        throw new AppError(400, "INVALID_PIPELINE_ID", "Provided pipeline ID is invalid");
      }
      const foundPipeline = await Pipeline.findById(input.pipelineId);
      if (!foundPipeline) {
        throw new AppError(404, "PIPELINE_NOT_FOUND", "Sales pipeline not found");
      }
      pipeline = foundPipeline;
    } else {
      pipeline = await pipelineService.getOrCreateDefaultPipeline();
    }

    // 5. Resolve Stage & Probability
    const initialStageKey = input.stage || pipeline.stages[0]?.key;
    const stageConfig = pipeline.stages.find((s) => s.key === initialStageKey);
    if (!stageConfig) {
      throw new AppError(
        400,
        "INVALID_STAGE",
        `Stage '${initialStageKey}' does not exist in pipeline '${pipeline.name}'`
      );
    }

    const probability = input.probability !== undefined ? input.probability : stageConfig.probability;

    // Validate stage requirements
    this.validateStageRequirements(stageConfig, {
      ...input,
      probability,
      companyId: new mongoose.Types.ObjectId(input.companyId),
      primaryContactId: input.primaryContactId ? new mongoose.Types.ObjectId(input.primaryContactId) : undefined,
      expectedCloseDate: input.expectedCloseDate ? new Date(input.expectedCloseDate) : undefined,
    } as unknown as Partial<IDeal>);

    // Construct stage history
    const initialHistory: IDealStageHistory = {
      fromStage: "created",
      toStage: initialStageKey,
      changedBy: actorId && mongoose.Types.ObjectId.isValid(actorId) ? new mongoose.Types.ObjectId(actorId) : undefined,
      changedAt: new Date(),
      daysInPreviousStage: 0,
    };

    const deal = new Deal({
      name: input.name,
      companyId: new mongoose.Types.ObjectId(input.companyId),
      primaryContactId: input.primaryContactId ? new mongoose.Types.ObjectId(input.primaryContactId) : undefined,
      leadId: input.leadId ? new mongoose.Types.ObjectId(input.leadId) : undefined,
      pipelineId: pipeline._id,
      stage: initialStageKey,
      ownerId: input.ownerId && mongoose.Types.ObjectId.isValid(input.ownerId) ? new mongoose.Types.ObjectId(input.ownerId) : undefined,
      value: input.value ?? 0,
      currency: input.currency ?? "USD",
      annualRecurringRevenue: input.annualRecurringRevenue ?? 0,
      oneTimeImplementationFee: input.oneTimeImplementationFee ?? 0,
      probability,
      expectedCloseDate: input.expectedCloseDate ? new Date(input.expectedCloseDate) : undefined,
      actualCloseDate: input.actualCloseDate ? new Date(input.actualCloseDate) : undefined,
      competitors: input.competitors ?? [],
      nextAction: input.nextAction,
      lossReason: input.lossReason,
      lossDetails: input.lossDetails,
      packageId: input.packageId && mongoose.Types.ObjectId.isValid(input.packageId) ? new mongoose.Types.ObjectId(input.packageId) : undefined,
      stageHistory: [initialHistory],
      notes: input.notes,
    });

    await deal.save();

    await this.logAudit({
      actorId,
      action: "create",
      eventType: "DEAL_CREATED",
      resourceId: deal._id,
      description: `Created deal '${deal.name}' with value ${deal.value} ${deal.currency}`,
      metadata: {
        dealId: deal._id,
        name: deal.name,
        value: deal.value,
        currency: deal.currency,
        stage: deal.stage,
        probability: deal.probability,
      },
    });

    return deal;
  }

  /**
   * List deals with filtering, search, pagination, and weighted aggregations
   */
  public async getDeals(params: DealQueryParams) {
    const filter: FilterQuery<IDeal> = {};

    if (params.search && params.search.trim()) {
      const escaped = escapeRegex(params.search.trim());
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { nextAction: { $regex: escaped, $options: "i" } },
        { notes: { $regex: escaped, $options: "i" } },
      ];
    }

    if (params.companyId && mongoose.Types.ObjectId.isValid(params.companyId)) {
      filter.companyId = new mongoose.Types.ObjectId(params.companyId);
    }

    if (params.pipelineId && mongoose.Types.ObjectId.isValid(params.pipelineId)) {
      filter.pipelineId = new mongoose.Types.ObjectId(params.pipelineId);
    }

    if (params.stage) {
      filter.stage = params.stage;
    }

    if (params.ownerId && mongoose.Types.ObjectId.isValid(params.ownerId)) {
      filter.ownerId = new mongoose.Types.ObjectId(params.ownerId);
    }

    if (params.currency) {
      filter.currency = params.currency.toUpperCase();
    }

    if (params.minProbability !== undefined || params.maxProbability !== undefined) {
      filter.probability = {};
      if (params.minProbability !== undefined) filter.probability.$gte = params.minProbability;
      if (params.maxProbability !== undefined) filter.probability.$lte = params.maxProbability;
    }

    if (params.minValue !== undefined || params.maxValue !== undefined) {
      filter.value = {};
      if (params.minValue !== undefined) filter.value.$gte = params.minValue;
      if (params.maxValue !== undefined) filter.value.$lte = params.maxValue;
    }

    if (params.minExpectedCloseDate || params.maxExpectedCloseDate) {
      filter.expectedCloseDate = {};
      if (params.minExpectedCloseDate) filter.expectedCloseDate.$gte = new Date(params.minExpectedCloseDate);
      if (params.maxExpectedCloseDate) filter.expectedCloseDate.$lte = new Date(params.maxExpectedCloseDate);
    }

    const page = params.page || 1;
    const limit = params.limit || 25;
    const skip = (page - 1) * limit;

    const sort: Record<string, any> = {};
    sort[params.sortBy] = params.sortOrder === "asc" ? 1 : -1;

    const [items, total] = await Promise.all([
      Deal.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("companyId", "name domain industry tier")
        .populate("primaryContactId", "firstName lastName email phone jobTitle")
        .populate("ownerId", "name email")
        .populate("leadId", "name companyName status")
        .populate("pipelineId", "name isDefault")
        .lean(),
      Deal.countDocuments(filter),
    ]);

    // Calculate weighted values for items
    const enrichedItems = items.map((deal) => ({
      ...deal,
      weightedValue: Number(((deal.value || 0) * (deal.probability || 0)).toFixed(2)),
    }));

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: enrichedItems,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Get single deal by ID
   */
  public async getDealById(id: string): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "INVALID_DEAL_ID", "Provided deal ID is invalid");
    }

    const deal = await Deal.findById(id)
      .populate("companyId", "name domain industry tier address phone")
      .populate("primaryContactId", "firstName lastName email phone jobTitle isPrimaryDecisionMaker")
      .populate("ownerId", "name email")
      .populate("leadId", "name companyName email score priority status")
      .populate("pipelineId", "name isDefault stages")
      .populate("stageHistory.changedBy", "name email");

    if (!deal) {
      throw new AppError(404, "DEAL_NOT_FOUND", "Sales deal not found");
    }

    const plain = deal.toObject();
    return {
      ...plain,
      weightedValue: Number(((plain.value || 0) * (plain.probability || 0)).toFixed(2)),
    };
  }

  /**
   * Update deal attributes (and handles stage updates if included)
   */
  public async updateDeal(
    id: string,
    input: UpdateDealInput,
    actorId?: string
  ): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "INVALID_DEAL_ID", "Provided deal ID is invalid");
    }

    const deal = await Deal.findById(id);
    if (!deal) {
      throw new AppError(404, "DEAL_NOT_FOUND", "Sales deal not found");
    }

    // If stage is being changed, invoke updateDealStage logic
    if (input.stage && input.stage !== deal.stage) {
      return this.updateDealStage(
        id,
        {
          stage: input.stage,
          probability: input.probability,
          lossReason: input.lossReason ?? undefined,
          lossDetails: input.lossDetails ?? undefined,
          actualCloseDate: input.actualCloseDate ?? undefined,
        },
        actorId
      );
    }

    if (input.name !== undefined) deal.name = input.name;
    if (input.value !== undefined) deal.value = input.value;
    if (input.currency !== undefined) deal.currency = input.currency;
    if (input.annualRecurringRevenue !== undefined) deal.annualRecurringRevenue = input.annualRecurringRevenue;
    if (input.oneTimeImplementationFee !== undefined) deal.oneTimeImplementationFee = input.oneTimeImplementationFee;
    if (input.probability !== undefined) deal.probability = input.probability;
    if (input.expectedCloseDate !== undefined) deal.expectedCloseDate = input.expectedCloseDate ? new Date(input.expectedCloseDate) : undefined;
    if (input.actualCloseDate !== undefined) deal.actualCloseDate = input.actualCloseDate ? new Date(input.actualCloseDate) : undefined;
    if (input.competitors !== undefined) deal.competitors = input.competitors;
    if (input.nextAction !== undefined) deal.nextAction = input.nextAction ?? undefined;
    if (input.lossReason !== undefined) deal.lossReason = input.lossReason ?? undefined;
    if (input.lossDetails !== undefined) deal.lossDetails = input.lossDetails ?? undefined;
    if (input.notes !== undefined) deal.notes = input.notes ?? undefined;

    if (input.companyId && mongoose.Types.ObjectId.isValid(input.companyId)) {
      deal.companyId = new mongoose.Types.ObjectId(input.companyId);
    }
    if (input.primaryContactId !== undefined) {
      deal.primaryContactId = input.primaryContactId && mongoose.Types.ObjectId.isValid(input.primaryContactId)
        ? new mongoose.Types.ObjectId(input.primaryContactId)
        : undefined;
    }
    if (input.ownerId !== undefined) {
      deal.ownerId = input.ownerId && mongoose.Types.ObjectId.isValid(input.ownerId)
        ? new mongoose.Types.ObjectId(input.ownerId)
        : undefined;
    }
    if (input.packageId !== undefined) {
      deal.packageId = input.packageId && mongoose.Types.ObjectId.isValid(input.packageId)
        ? new mongoose.Types.ObjectId(input.packageId)
        : undefined;
    }

    await deal.save();

    await this.logAudit({
      actorId,
      action: "update",
      eventType: "DEAL_UPDATED",
      resourceId: deal._id,
      description: `Updated deal '${deal.name}'`,
      metadata: { updates: input },
    });

    return this.getDealById(deal._id.toString());
  }

  /**
   * Update deal stage with history tracking, validation, and lossReason enforcement
   */
  public async updateDealStage(
    id: string,
    input: UpdateDealStageInput,
    actorId?: string
  ): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "INVALID_DEAL_ID", "Provided deal ID is invalid");
    }

    const deal = await Deal.findById(id);
    if (!deal) {
      throw new AppError(404, "DEAL_NOT_FOUND", "Sales deal not found");
    }

    const pipeline = await Pipeline.findById(deal.pipelineId);
    if (!pipeline) {
      throw new AppError(404, "PIPELINE_NOT_FOUND", "Associated pipeline not found");
    }

    const targetStageConfig = pipeline.stages.find((s) => s.key === input.stage);
    if (!targetStageConfig) {
      throw new AppError(
        400,
        "INVALID_STAGE",
        `Stage '${input.stage}' does not exist in pipeline '${pipeline.name}'`
      );
    }

    // Merge prospective data for requirement validation
    const prospectiveData: Partial<IDeal> = {
      ...deal.toObject(),
      stage: input.stage,
      lossReason: input.lossReason !== undefined ? input.lossReason : deal.lossReason,
      lossDetails: input.lossDetails !== undefined ? input.lossDetails : deal.lossDetails,
      actualCloseDate: input.actualCloseDate ? new Date(input.actualCloseDate) : deal.actualCloseDate,
      wonDetails: input.wonDetails ? { ...deal.wonDetails, ...input.wonDetails } as any : deal.wonDetails,
    };

    // Validate requirements
    this.validateStageRequirements(targetStageConfig, prospectiveData);

    const oldStage = deal.stage;
    const now = new Date();

    // Calculate days in previous stage
    let daysInPreviousStage = 0;
    if (deal.stageHistory && deal.stageHistory.length > 0) {
      const lastEntry = deal.stageHistory[deal.stageHistory.length - 1];
      if (lastEntry.changedAt) {
        const diffMs = now.getTime() - new Date(lastEntry.changedAt).getTime();
        daysInPreviousStage = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      }
    }

    // Record stage history
    const historyEntry: IDealStageHistory = {
      fromStage: oldStage,
      toStage: input.stage,
      changedBy: actorId && mongoose.Types.ObjectId.isValid(actorId) ? new mongoose.Types.ObjectId(actorId) : undefined,
      changedAt: now,
      daysInPreviousStage,
    };
    deal.stageHistory.push(historyEntry);

    // Apply stage updates
    deal.stage = input.stage;
    deal.probability = input.probability !== undefined ? input.probability : targetStageConfig.probability;

    if (input.stage === "closed_lost") {
      deal.lossReason = input.lossReason;
      if (input.lossDetails) deal.lossDetails = input.lossDetails;
      deal.actualCloseDate = input.actualCloseDate ? new Date(input.actualCloseDate) : now;
    } else if (input.stage === "closed_won") {
      deal.actualCloseDate = input.actualCloseDate ? new Date(input.actualCloseDate) : now;
      if (input.wonDetails) {
        deal.wonDetails = {
          contractSignedDate: input.wonDetails.contractSignedDate ? new Date(input.wonDetails.contractSignedDate) : now,
          approvedBy: input.wonDetails.approvedBy && mongoose.Types.ObjectId.isValid(input.wonDetails.approvedBy)
            ? new mongoose.Types.ObjectId(input.wonDetails.approvedBy)
            : undefined,
          organizationId: input.wonDetails.organizationId && mongoose.Types.ObjectId.isValid(input.wonDetails.organizationId)
            ? new mongoose.Types.ObjectId(input.wonDetails.organizationId)
            : undefined,
          onboardingHandedOff: input.wonDetails.onboardingHandedOff ?? false,
          handoffDate: input.wonDetails.handoffDate ? new Date(input.wonDetails.handoffDate) : undefined,
        };
      }
    }

    await deal.save();

    // If transitioning to closed_won and handoff is requested, trigger onboarding handoff
    if (
      input.stage === "closed_won" &&
      (input.wonDetails?.onboardingHandedOff === true || (input as any).triggerHandoff === true)
    ) {
      try {
        const handoffService = new OnboardingHandoffService();
        await handoffService.handoffDeal(deal._id.toString(), actorId);
      } catch (err) {
        // If handoff fails, rethrow or log
        throw err;
      }
    }

    await this.logAudit({
      actorId,
      action: "status_change",
      eventType: "DEAL_STAGE_CHANGED",
      resourceId: deal._id,
      description: `Transitioned deal '${deal.name}' from '${oldStage}' to '${input.stage}'`,
      metadata: {
        dealId: deal._id,
        fromStage: oldStage,
        toStage: input.stage,
        probability: deal.probability,
        daysInPreviousStage,
      },
    });

    return this.getDealById(deal._id.toString());
  }

  /**
   * Delete deal
   */
  public async deleteDeal(id: string, actorId?: string): Promise<{ success: boolean; id: string }> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "INVALID_DEAL_ID", "Provided deal ID is invalid");
    }

    const deal = await Deal.findById(id);
    if (!deal) {
      throw new AppError(404, "DEAL_NOT_FOUND", "Sales deal not found");
    }

    await Deal.findByIdAndDelete(deal._id);

    await this.logAudit({
      actorId,
      action: "delete",
      eventType: "DEAL_DELETED",
      resourceId: deal._id,
      description: `Deleted deal '${deal.name}'`,
      metadata: { name: deal.name, value: deal.value, currency: deal.currency },
      severity: "warning",
    });

    return { success: true, id: deal._id.toString() };
  }

  /**
   * Get Kanban Board payload grouped by pipeline stages
   */
  public async getKanbanBoard(params: KanbanQueryParams) {
    let pipeline: IPipeline;
    if (params.pipelineId && mongoose.Types.ObjectId.isValid(params.pipelineId)) {
      const found = await Pipeline.findById(params.pipelineId);
      if (!found) {
        throw new AppError(404, "PIPELINE_NOT_FOUND", "Sales pipeline not found");
      }
      pipeline = found;
    } else {
      pipeline = await pipelineService.getOrCreateDefaultPipeline();
    }

    // Build filter for deals
    const filter: FilterQuery<IDeal> = {
      pipelineId: pipeline._id,
    };

    if (params.ownerId && mongoose.Types.ObjectId.isValid(params.ownerId)) {
      filter.ownerId = new mongoose.Types.ObjectId(params.ownerId);
    }

    if (params.currency) {
      filter.currency = params.currency.toUpperCase();
    }

    if (params.search && params.search.trim()) {
      const escaped = escapeRegex(params.search.trim());
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { nextAction: { $regex: escaped, $options: "i" } },
      ];
    }

    const deals = await Deal.find(filter)
      .populate("companyId", "name domain industry")
      .populate("primaryContactId", "firstName lastName email phone")
      .populate("ownerId", "name email")
      .lean();

    // Sort stages by order
    const sortedStages = [...pipeline.stages].sort((a, b) => a.order - b.order);

    let boardTotalValue = 0;
    let boardWeightedValue = 0;

    const stagesData = sortedStages.map((stage) => {
      const stageDeals = deals.filter((d) => d.stage === stage.key);
      const stageTotalValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);
      const stageWeightedValue = stageDeals.reduce(
        (sum, d) => sum + (d.value || 0) * (d.probability !== undefined ? d.probability : stage.probability),
        0
      );

      boardTotalValue += stageTotalValue;
      boardWeightedValue += stageWeightedValue;

      return {
        key: stage.key,
        name: stage.name,
        order: stage.order,
        probability: stage.probability,
        slaDays: stage.slaDays,
        requiredFields: stage.requiredFields,
        dealCount: stageDeals.length,
        totalValue: Number(stageTotalValue.toFixed(2)),
        weightedValue: Number(stageWeightedValue.toFixed(2)),
        deals: stageDeals.map((d) => ({
          ...d,
          weightedValue: Number(((d.value || 0) * (d.probability || 0)).toFixed(2)),
        })),
      };
    });

    return {
      pipeline: {
        _id: pipeline._id,
        name: pipeline.name,
        isDefault: pipeline.isDefault,
      },
      stages: stagesData,
      totals: {
        dealCount: deals.length,
        totalValue: Number(boardTotalValue.toFixed(2)),
        weightedValue: Number(boardWeightedValue.toFixed(2)),
      },
    };
  }

  /**
   * Calculate comprehensive weighted pipeline metrics & currency breakdowns
   */
  public async getPipelineSummary(params: PipelineSummaryQueryParams) {
    const filter: FilterQuery<IDeal> = {};

    if (params.pipelineId && mongoose.Types.ObjectId.isValid(params.pipelineId)) {
      filter.pipelineId = new mongoose.Types.ObjectId(params.pipelineId);
    }
    if (params.ownerId && mongoose.Types.ObjectId.isValid(params.ownerId)) {
      filter.ownerId = new mongoose.Types.ObjectId(params.ownerId);
    }
    if (params.currency) {
      filter.currency = params.currency.toUpperCase();
    }

    const deals = await Deal.find(filter).lean();

    let totalValue = 0;
    let weightedValue = 0;
    let closedWonCount = 0;
    let closedLostCount = 0;

    const currencyMap: Record<string, { totalValue: number; weightedValue: number; count: number }> = {};
    const stageMap: Record<string, { count: number; totalValue: number; weightedValue: number }> = {};

    for (const d of deals) {
      const val = d.value || 0;
      const prob = d.probability || 0;
      const weighted = val * prob;

      totalValue += val;
      weightedValue += weighted;

      if (d.stage === "closed_won") closedWonCount++;
      if (d.stage === "closed_lost") closedLostCount++;

      // Currency breakdown
      const curr = d.currency || "USD";
      if (!currencyMap[curr]) {
        currencyMap[curr] = { totalValue: 0, weightedValue: 0, count: 0 };
      }
      currencyMap[curr].totalValue += val;
      currencyMap[curr].weightedValue += weighted;
      currencyMap[curr].count++;

      // Stage breakdown
      const st = d.stage;
      if (!stageMap[st]) {
        stageMap[st] = { count: 0, totalValue: 0, weightedValue: 0 };
      }
      stageMap[st].count++;
      stageMap[st].totalValue += val;
      stageMap[st].weightedValue += weighted;
    }

    const decidedDeals = closedWonCount + closedLostCount;
    const winRate = decidedDeals > 0 ? Number((closedWonCount / decidedDeals).toFixed(4)) : 0;
    const avgDealSize = deals.length > 0 ? Number((totalValue / deals.length).toFixed(2)) : 0;

    const formattedCurrencyBreakdown = Object.entries(currencyMap).map(([currency, data]) => ({
      currency,
      count: data.count,
      totalValue: Number(data.totalValue.toFixed(2)),
      weightedValue: Number(data.weightedValue.toFixed(2)),
    }));

    const formattedStageBreakdown = Object.entries(stageMap).map(([stage, data]) => ({
      stage,
      count: data.count,
      totalValue: Number(data.totalValue.toFixed(2)),
      weightedValue: Number(data.weightedValue.toFixed(2)),
    }));

    return {
      totalDeals: deals.length,
      totalValue: Number(totalValue.toFixed(2)),
      weightedValue: Number(weightedValue.toFixed(2)),
      avgDealSize,
      winRate,
      closedWonCount,
      closedLostCount,
      currencyBreakdown: formattedCurrencyBreakdown,
      stageBreakdown: formattedStageBreakdown,
    };
  }
}

export default DealService;
