import { FastifyReply, FastifyRequest } from "fastify";
import PipelineService from "../services/pipeline.service.js";
import AppError from "../../../common/errors/app-error.js";
import {
  createPipelineSchema,
  updatePipelineSchema,
  setStagesSchema,
  pipelineStageSchema,
  updateStageSchema,
} from "../schemas/pipeline.schemas.js";

export class PipelineController {
  constructor(private readonly service = new PipelineService()) {}

  /**
   * GET /api/v1/sales/pipelines
   */
  getPipelines = async (_request: FastifyRequest, reply: FastifyReply) => {
    const pipelines = await this.service.getPipelines();
    return reply.status(200).send({
      success: true,
      data: pipelines,
    });
  };

  /**
   * GET /api/v1/sales/pipelines/default
   */
  getDefaultPipeline = async (_request: FastifyRequest, reply: FastifyReply) => {
    const pipeline = await this.service.getOrCreateDefaultPipeline();
    return reply.status(200).send({
      success: true,
      data: pipeline,
    });
  };

  /**
   * GET /api/v1/sales/pipelines/:id
   */
  getPipelineById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const pipeline = await this.service.getPipelineById(id);

    return reply.status(200).send({
      success: true,
      data: pipeline,
    });
  };

  /**
   * POST /api/v1/sales/pipelines
   */
  createPipeline = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createPipelineSchema.safeParse(request.body);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const actorId = (request as any).user?.id || (request as any).user?._id;
    const pipeline = await this.service.createPipeline(parseResult.data, actorId);

    return reply.status(201).send({
      success: true,
      data: pipeline,
    });
  };

  /**
   * PATCH /api/v1/sales/pipelines/:id
   */
  updatePipeline = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = updatePipelineSchema.safeParse(request.body);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const actorId = (request as any).user?.id || (request as any).user?._id;
    const pipeline = await this.service.updatePipeline(id, parseResult.data, actorId);

    return reply.status(200).send({
      success: true,
      data: pipeline,
    });
  };

  /**
   * PUT /api/v1/sales/pipelines/:id/stages
   * Bulk replaces/reorders stages and synchronizes deal probabilities
   */
  setStages = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = setStagesSchema.safeParse(request.body);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const actorId = (request as any).user?.id || (request as any).user?._id;
    const pipeline = await this.service.setStages(id, parseResult.data.stages, actorId);

    return reply.status(200).send({
      success: true,
      data: pipeline,
    });
  };

  /**
   * POST /api/v1/sales/pipelines/:id/stages
   * Append a new stage
   */
  addStage = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = pipelineStageSchema.safeParse(request.body);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const actorId = (request as any).user?.id || (request as any).user?._id;
    const pipeline = await this.service.addStage(id, parseResult.data, actorId);

    return reply.status(201).send({
      success: true,
      data: pipeline,
    });
  };

  /**
   * PATCH /api/v1/sales/pipelines/:id/stages/:stageKey
   * Update single stage
   */
  updateSingleStage = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, stageKey } = request.params as { id: string; stageKey: string };
    const parseResult = updateStageSchema.safeParse(request.body);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const actorId = (request as any).user?.id || (request as any).user?._id;
    const pipeline = await this.service.updateSingleStage(id, stageKey, parseResult.data, actorId);

    return reply.status(200).send({
      success: true,
      data: pipeline,
    });
  };

  /**
   * DELETE /api/v1/sales/pipelines/:id/stages/:stageKey
   */
  deleteStage = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, stageKey } = request.params as { id: string; stageKey: string };
    const actorId = (request as any).user?.id || (request as any).user?._id;
    const pipeline = await this.service.deleteStage(id, stageKey, actorId);

    return reply.status(200).send({
      success: true,
      data: pipeline,
    });
  };

  /**
   * DELETE /api/v1/sales/pipelines/:id
   */
  deletePipeline = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const actorId = (request as any).user?.id || (request as any).user?._id;
    const result = await this.service.deletePipeline(id, actorId);

    return reply.status(200).send({
      success: true,
      data: result,
    });
  };
}

export default PipelineController;
