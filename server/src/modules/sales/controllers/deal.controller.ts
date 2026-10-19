import { FastifyReply, FastifyRequest } from "fastify";
import DealService from "../services/deal.service.js";
import OnboardingHandoffService from "../services/onboarding-handoff.service.js";
import AppError from "../../../common/errors/app-error.js";
import {
  createDealSchema,
  updateDealSchema,
  updateDealStageSchema,
  dealQuerySchema,
  kanbanQuerySchema,
  pipelineSummaryQuerySchema,
} from "../schemas/deal.schemas.js";

export class DealController {
  constructor(
    private readonly service = new DealService(),
    private readonly handoffService = new OnboardingHandoffService()
  ) {}

  /**
   * GET /api/v1/sales/deals
   */
  getDeals = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = dealQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const result = await this.service.getDeals(parseResult.data);
    return reply.status(200).send({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  };

  /**
   * GET /api/v1/sales/deals/kanban
   */
  getKanbanBoard = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = kanbanQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const kanban = await this.service.getKanbanBoard(parseResult.data);
    return reply.status(200).send({
      success: true,
      data: kanban,
    });
  };

  /**
   * GET /api/v1/sales/deals/summary
   */
  getPipelineSummary = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = pipelineSummaryQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const summary = await this.service.getPipelineSummary(parseResult.data);
    return reply.status(200).send({
      success: true,
      data: summary,
    });
  };

  /**
   * GET /api/v1/sales/deals/:id
   */
  getDealById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const deal = await this.service.getDealById(id);

    return reply.status(200).send({
      success: true,
      data: deal,
    });
  };

  /**
   * POST /api/v1/sales/deals
   */
  createDeal = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createDealSchema.safeParse(request.body);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const actorId =
      (request.user as any)?.id ||
      (request.user as any)?._id?.toString() ||
      (request.user as any)?.userId;

    const deal = await this.service.createDeal(parseResult.data, actorId);

    return reply.status(201).send({
      success: true,
      data: deal,
    });
  };

  /**
   * PATCH /api/v1/sales/deals/:id
   */
  updateDeal = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = updateDealSchema.safeParse(request.body);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const actorId =
      (request.user as any)?.id ||
      (request.user as any)?._id?.toString() ||
      (request.user as any)?.userId;

    const updated = await this.service.updateDeal(id, parseResult.data, actorId);

    return reply.status(200).send({
      success: true,
      data: updated,
    });
  };

  /**
   * PATCH /api/v1/sales/deals/:id/stage
   */
  updateDealStage = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = updateDealStageSchema.safeParse(request.body);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const actorId =
      (request.user as any)?.id ||
      (request.user as any)?._id?.toString() ||
      (request.user as any)?.userId;

    const updated = await this.service.updateDealStage(id, parseResult.data, actorId);

    return reply.status(200).send({
      success: true,
      data: updated,
    });
  };

  /**
   * DELETE /api/v1/sales/deals/:id
   */
  deleteDeal = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const actorId =
      (request.user as any)?.id ||
      (request.user as any)?._id?.toString() ||
      (request.user as any)?.userId;

    const result = await this.service.deleteDeal(id, actorId);

    return reply.status(200).send({
      success: true,
      data: result,
    });
  };

  /**
   * POST /api/v1/sales/deals/:id/handoff
   */
  handoffDeal = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as {
      organizationName?: string;
      adminEmail?: string;
      notes?: string;
    };

    const actorId =
      (request.user as any)?.id ||
      (request.user as any)?._id?.toString() ||
      (request.user as any)?.userId;

    const result = await this.handoffService.handoffDeal(id, actorId, body);

    return reply.status(200).send({
      success: true,
      data: result,
    });
  };
}

export default DealController;
