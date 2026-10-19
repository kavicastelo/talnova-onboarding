import mongoose from "mongoose";
import Pipeline, { IPipeline, IPipelineStage } from "../models/pipeline.model.js";
import Deal from "../models/deal.model.js";
import AuditLog from "../../audit-logs/models/audit-log.model.js";
import AppError from "../../../common/errors/app-error.js";
import {
  CreatePipelineInput,
  UpdatePipelineInput,
  PipelineStageInput,
  UpdateStageInput,
} from "../schemas/pipeline.schemas.js";

export const DEFAULT_PIPELINE_STAGES: IPipelineStage[] = [
  {
    key: "qualification",
    name: "Qualification",
    probability: 0.1,
    order: 0,
    requiredFields: ["value", "primaryContactId"],
    slaDays: 7,
  },
  {
    key: "discovery_completed",
    name: "Discovery Completed",
    probability: 0.25,
    order: 1,
    requiredFields: ["value", "primaryContactId", "expectedCloseDate"],
    slaDays: 14,
  },
  {
    key: "demo_completed",
    name: "Demo Completed",
    probability: 0.5,
    order: 2,
    requiredFields: ["value", "primaryContactId", "expectedCloseDate"],
    slaDays: 14,
  },
  {
    key: "proposal_sent",
    name: "Proposal Sent",
    probability: 0.7,
    order: 3,
    requiredFields: ["value", "expectedCloseDate"],
    slaDays: 10,
  },
  {
    key: "negotiation",
    name: "Negotiation",
    probability: 0.85,
    order: 4,
    requiredFields: ["value", "expectedCloseDate"],
    slaDays: 7,
  },
  {
    key: "closed_won",
    name: "Closed Won",
    probability: 1.0,
    order: 5,
    requiredFields: ["wonDetails"],
    slaDays: 0,
  },
  {
    key: "closed_lost",
    name: "Closed Lost",
    probability: 0.0,
    order: 6,
    requiredFields: ["lossReason"],
    slaDays: 0,
  },
];

export class PipelineService {
  private async logAudit(params: {
    actorId?: string;
    action: "create" | "update" | "delete";
    eventType: string;
    resourceId?: mongoose.Types.ObjectId;
    description: string;
    metadata?: Record<string, any>;
    severity?: "info" | "warning" | "critical";
    session?: mongoose.ClientSession;
  }): Promise<void> {
    try {
      const doc = {
        actorUserId:
          params.actorId && mongoose.Types.ObjectId.isValid(params.actorId)
            ? new mongoose.Types.ObjectId(params.actorId)
            : undefined,
        actorType: params.actorId ? ("user" as const) : ("system" as const),
        eventCategory: "admin" as const,
        eventType: params.eventType,
        resourceType: "sales_pipeline",
        resourceId: params.resourceId,
        action: params.action,
        description: params.description,
        metadata: params.metadata,
        severity: params.severity || ("info" as const),
      };

      if (params.session) {
        await AuditLog.create([doc], { session: params.session });
      } else {
        await AuditLog.create(doc);
      }
    } catch {
      // Do not fail operation if audit log fails
    }
  }

  /**
   * Retrieves default pipeline or automatically seeds standard stages if none exists.
   */
  public async getOrCreateDefaultPipeline(): Promise<IPipeline> {
    let defaultPipeline = await Pipeline.findOne({ isDefault: true });

    if (!defaultPipeline) {
      // Check if any pipeline exists
      const firstPipeline = await Pipeline.findOne().sort({ createdAt: 1 });
      if (firstPipeline) {
        firstPipeline.isDefault = true;
        await firstPipeline.save();
        return firstPipeline;
      }

      // Seed standard pipeline
      defaultPipeline = await Pipeline.create({
        name: "Standard Enterprise Sales Pipeline",
        isDefault: true,
        stages: DEFAULT_PIPELINE_STAGES,
      });

      await this.logAudit({
        action: "create",
        eventType: "PIPELINE_DEFAULT_SEEDED",
        resourceId: defaultPipeline._id,
        description: `Seeded default sales pipeline: ${defaultPipeline.name}`,
        metadata: {
          name: defaultPipeline.name,
          stagesCount: defaultPipeline.stages.length,
        },
        severity: "info",
      });
    }

    return defaultPipeline;
  }

  /**
   * List all sales pipelines (auto-seeds default if collection is empty)
   */
  public async getPipelines(): Promise<IPipeline[]> {
    let pipelines = await Pipeline.find().sort({ isDefault: -1, createdAt: 1 });

    if (pipelines.length === 0) {
      await this.getOrCreateDefaultPipeline();
      pipelines = await Pipeline.find().sort({ isDefault: -1, createdAt: 1 });
    }

    return pipelines;
  }

  /**
   * Get single pipeline by ID
   */
  public async getPipelineById(id: string): Promise<IPipeline> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "INVALID_ID", "Provided pipeline ID is invalid");
    }

    const pipeline = await Pipeline.findById(id);
    if (!pipeline) {
      throw new AppError(404, "PIPELINE_NOT_FOUND", "Sales pipeline not found");
    }

    return pipeline;
  }

  /**
   * Create a new sales pipeline
   */
  public async createPipeline(
    input: CreatePipelineInput,
    actorId?: string
  ): Promise<IPipeline> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // If setting as default, clear previous default
      if (input.isDefault) {
        await Pipeline.updateMany({ isDefault: true }, { isDefault: false }, { session });
      }

      const stagesToUse =
        input.stages && input.stages.length > 0 ? input.stages : DEFAULT_PIPELINE_STAGES;

      // Ensure stage keys are unique within pipeline
      const stageKeys = new Set<string>();
      for (const st of stagesToUse) {
        if (stageKeys.has(st.key)) {
          throw new AppError(
            400,
            "DUPLICATE_STAGE_KEY",
            `Stage keys must be unique within a pipeline`
          );
        }
        stageKeys.add(st.key);
      }

      const pipeline = new Pipeline({
        name: input.name,
        isDefault: input.isDefault ?? false,
        stages: stagesToUse.map((st, idx) => ({
          ...st,
          order: st.order ?? idx,
        })),
      });

      await pipeline.save({ session });

      await this.logAudit({
        actorId,
        action: "create",
        eventType: "PIPELINE_CREATED",
        resourceId: pipeline._id,
        description: `Created sales pipeline: ${pipeline.name}`,
        metadata: {
          name: pipeline.name,
          isDefault: pipeline.isDefault,
          stagesCount: pipeline.stages.length,
        },
        severity: "info",
        session,
      });

      await session.commitTransaction();
      return pipeline;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Update pipeline metadata (name, isDefault)
   */
  public async updatePipeline(
    id: string,
    input: UpdatePipelineInput,
    actorId?: string
  ): Promise<IPipeline> {
    const pipeline = await this.getPipelineById(id);

    if (input.isDefault === true && !pipeline.isDefault) {
      await Pipeline.updateMany({ _id: { $ne: pipeline._id } }, { isDefault: false });
      pipeline.isDefault = true;
    } else if (input.isDefault === false && pipeline.isDefault) {
      // Ensure at least one pipeline remains default
      const otherPipeline = await Pipeline.findOne({ _id: { $ne: pipeline._id } });
      if (!otherPipeline) {
        throw new AppError(
          400,
          "CANNOT_UNSET_ONLY_DEFAULT_PIPELINE",
          "Cannot unset the only available default pipeline. Make another pipeline default instead."
        );
      }
      otherPipeline.isDefault = true;
      await otherPipeline.save();
      pipeline.isDefault = false;
    }

    if (input.name) {
      pipeline.name = input.name;
    }

    await pipeline.save();

    await this.logAudit({
      actorId,
      action: "update",
      eventType: "PIPELINE_UPDATED",
      resourceId: pipeline._id,
      description: `Updated sales pipeline: ${pipeline.name}`,
      metadata: { updates: input },
      severity: "info",
    });

    return pipeline;
  }

  /**
   * Replace or reorder entire stages array for a pipeline.
   * Dynamically synchronizes stage default probabilities to active deals in this stage.
   */
  public async setStages(
    id: string,
    stages: PipelineStageInput[],
    actorId?: string
  ): Promise<IPipeline> {
    const pipeline = await this.getPipelineById(id);

    // Validate unique keys
    const seen = new Set<string>();
    for (const s of stages) {
      if (seen.has(s.key)) {
        throw new AppError(
          400,
          "DUPLICATE_STAGE_KEY",
          `Stage keys must be unique within a pipeline`
        );
      }
      seen.add(s.key);
    }

    // Sort stages by order
    const sortedStages = [...stages].sort((a, b) => a.order - b.order);
    pipeline.stages = sortedStages as unknown as IPipelineStage[];
    await pipeline.save();

    // Synchronize deal probabilities dynamically across modified stages
    const updates = sortedStages.map((stage) =>
      Deal.updateMany(
        {
          pipelineId: pipeline._id,
          stage: stage.key,
        },
        {
          probability: stage.probability,
        }
      )
    );
    await Promise.all(updates);

    await this.logAudit({
      actorId,
      action: "update",
      eventType: "PIPELINE_STAGES_UPDATED",
      resourceId: pipeline._id,
      description: `Updated stages for sales pipeline: ${pipeline.name}`,
      metadata: {
        stagesCount: sortedStages.length,
        stages: sortedStages.map((s) => ({ key: s.key, prob: s.probability })),
      },
      severity: "info",
    });

    return pipeline;
  }

  /**
   * Update a single stage's settings and dynamically update deals in that stage
   */
  public async updateSingleStage(
    pipelineId: string,
    stageKey: string,
    input: UpdateStageInput,
    actorId?: string
  ): Promise<IPipeline> {
    const pipeline = await this.getPipelineById(pipelineId);

    const stage = pipeline.stages.find((s) => s.key === stageKey);
    if (!stage) {
      throw new AppError(404, "STAGE_NOT_FOUND", `Stage '${stageKey}' not found in pipeline`);
    }

    if (input.name !== undefined) stage.name = input.name;
    if (input.order !== undefined) stage.order = input.order;
    if (input.requiredFields !== undefined) stage.requiredFields = input.requiredFields;
    if (input.slaDays !== undefined) stage.slaDays = input.slaDays;

    if (input.probability !== undefined) {
      stage.probability = input.probability;

      // Update probability dynamically on existing active deals in this stage
      await Deal.updateMany(
        {
          pipelineId: pipeline._id,
          stage: stageKey,
        },
        {
          probability: input.probability,
        }
      );
    }

    pipeline.stages.sort((a, b) => a.order - b.order);
    await pipeline.save();

    await this.logAudit({
      actorId,
      action: "update",
      eventType: "PIPELINE_STAGE_UPDATED",
      resourceId: pipeline._id,
      description: `Updated stage '${stageKey}' in sales pipeline: ${pipeline.name}`,
      metadata: { stageKey, updates: input },
      severity: "info",
    });

    return pipeline;
  }

  /**
   * Append a new stage to an existing pipeline
   */
  public async addStage(
    pipelineId: string,
    stage: PipelineStageInput,
    actorId?: string
  ): Promise<IPipeline> {
    const pipeline = await this.getPipelineById(pipelineId);

    const exists = pipeline.stages.some((s) => s.key === stage.key);
    if (exists) {
      throw new AppError(
        400,
        "STAGE_ALREADY_EXISTS",
        `Stage key '${stage.key}' already exists in pipeline '${pipeline.name}'`
      );
    }

    pipeline.stages.push(stage as unknown as IPipelineStage);
    pipeline.stages.sort((a, b) => a.order - b.order);
    await pipeline.save();

    await this.logAudit({
      actorId,
      action: "update",
      eventType: "PIPELINE_STAGE_ADDED",
      resourceId: pipeline._id,
      description: `Added stage '${stage.key}' to sales pipeline: ${pipeline.name}`,
      metadata: { stageKey: stage.key, name: stage.name },
      severity: "info",
    });

    return pipeline;
  }

  /**
   * Delete a stage from a pipeline.
   * Safety guard: prevents deletion if deals are currently residing in this stage.
   */
  public async deleteStage(
    pipelineId: string,
    stageKey: string,
    actorId?: string
  ): Promise<IPipeline> {
    const pipeline = await this.getPipelineById(pipelineId);

    const stageIndex = pipeline.stages.findIndex((s) => s.key === stageKey);
    if (stageIndex === -1) {
      throw new AppError(404, "STAGE_NOT_FOUND", `Stage '${stageKey}' not found in pipeline`);
    }

    if (pipeline.stages.length <= 1) {
      throw new AppError(
        400,
        "CANNOT_EMPTY_PIPELINE",
        "A sales pipeline must contain at least one stage."
      );
    }

    // Safety guard: reject if active deals occupy this stage
    const dealsCount = await Deal.countDocuments({
      pipelineId: pipeline._id,
      stage: stageKey,
    });

    if (dealsCount > 0) {
      throw new AppError(
        400,
        "CANNOT_DELETE_STAGE_WITH_ACTIVE_DEALS",
        `Cannot delete stage '${stageKey}' because ${dealsCount} deal(s) currently occupy it. Reassign or transition the deals first.`
      );
    }

    pipeline.stages.splice(stageIndex, 1);
    await pipeline.save();

    await this.logAudit({
      actorId,
      action: "update",
      eventType: "PIPELINE_STAGE_DELETED",
      resourceId: pipeline._id,
      description: `Deleted stage '${stageKey}' from sales pipeline: ${pipeline.name}`,
      metadata: { stageKey },
      severity: "info",
    });

    return pipeline;
  }

  /**
   * Delete a pipeline.
   * Safety guard: cannot delete if default or if active deals are assigned.
   */
  public async deletePipeline(id: string, actorId?: string): Promise<{ success: boolean; id: string }> {
    const pipeline = await this.getPipelineById(id);

    if (pipeline.isDefault) {
      throw new AppError(
        400,
        "CANNOT_DELETE_DEFAULT_PIPELINE",
        "Cannot delete the default sales pipeline. Assign another pipeline as default before deleting this one."
      );
    }

    const dealsCount = await Deal.countDocuments({ pipelineId: pipeline._id });
    if (dealsCount > 0) {
      throw new AppError(
        400,
        "CANNOT_DELETE_PIPELINE_WITH_DEALS",
        `Cannot delete pipeline '${pipeline.name}' because ${dealsCount} deal(s) are assigned to it. Move or archive the deals first.`
      );
    }

    await Pipeline.findByIdAndDelete(pipeline._id);

    await this.logAudit({
      actorId,
      action: "delete",
      eventType: "PIPELINE_DELETED",
      resourceId: pipeline._id,
      description: `Deleted sales pipeline: ${pipeline.name}`,
      metadata: { name: pipeline.name },
      severity: "warning",
    });

    return { success: true, id: pipeline._id.toString() };
  }
}

export default PipelineService;
