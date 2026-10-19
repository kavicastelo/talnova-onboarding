import { FastifyReply, FastifyRequest } from "fastify";
import CampaignService from "../services/campaign.service.js";
import AudienceSegmentationService from "../services/audience-segmentation.service.js";
import CampaignDispatcherService from "../services/campaign-dispatcher.service.js";
import AppError from "../../../common/errors/app-error.js";
import {
  createCampaignSchema,
  updateCampaignSchema,
  updateCampaignStatusSchema,
  cloneCampaignSchema,
  addRecipientsSchema,
  campaignQuerySchema,
  createTemplateSchema,
  updateTemplateSchema,
  templateQuerySchema,
  previewTemplateSchema,
  audienceEstimateSchema,
  audienceResolveSchema,
  launchCampaignOptionsSchema,
} from "../schemas/campaign.schemas.js";

export class CampaignController {
  constructor(
    private readonly service = new CampaignService(),
    private readonly audienceService = new AudienceSegmentationService(),
    private readonly dispatcherService = new CampaignDispatcherService()
  ) {}

  // ==========================================
  // CAMPAIGNS
  // ==========================================

  getCampaigns = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = campaignQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const result = await this.service.getCampaigns(parseResult.data);
    return reply.status(200).send({
      success: true,
      data: result.items,
      pagination: result.pagination,
      counters: result.statusCounters,
    });
  };

  getCampaignById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const campaign = await this.service.getCampaignById(id);

    return reply.status(200).send({
      success: true,
      data: campaign,
    });
  };

  createCampaign = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createCampaignSchema.safeParse(request.body);
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

    const campaign = await this.service.createCampaign(parseResult.data, actorId);

    return reply.status(201).send({
      success: true,
      data: campaign,
    });
  };

  updateCampaign = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = updateCampaignSchema.safeParse(request.body);
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

    const campaign = await this.service.updateCampaign(id, parseResult.data, actorId);

    return reply.status(200).send({
      success: true,
      data: campaign,
    });
  };

  updateCampaignStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = updateCampaignStatusSchema.safeParse(request.body);
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

    const campaign = await this.service.updateCampaignStatus(id, parseResult.data.status, actorId);

    return reply.status(200).send({
      success: true,
      data: campaign,
    });
  };

  cloneCampaign = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = cloneCampaignSchema.safeParse(request.body || {});
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

    const campaign = await this.service.cloneCampaign(id, parseResult.data, actorId);

    return reply.status(201).send({
      success: true,
      data: campaign,
    });
  };

  addRecipients = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = addRecipientsSchema.safeParse(request.body);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const result = await this.service.addRecipients(id, parseResult.data.recipients);

    return reply.status(200).send({
      success: true,
      data: result,
    });
  };

  deleteCampaign = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const actorId =
      (request.user as any)?.id ||
      (request.user as any)?._id?.toString() ||
      (request.user as any)?.userId;

    const result = await this.service.deleteCampaign(id, actorId);

    return reply.status(200).send({
      success: true,
      data: result,
    });
  };

  // ==========================================
  // TEMPLATES
  // ==========================================

  getTemplates = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = templateQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const result = await this.service.getTemplates(parseResult.data);
    return reply.status(200).send({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  };

  getTemplateById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const template = await this.service.getTemplateById(id);

    return reply.status(200).send({
      success: true,
      data: template,
    });
  };

  createTemplate = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createTemplateSchema.safeParse(request.body);
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

    const template = await this.service.createTemplate(parseResult.data, actorId);

    return reply.status(201).send({
      success: true,
      data: template,
    });
  };

  updateTemplate = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = updateTemplateSchema.safeParse(request.body);
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

    const template = await this.service.updateTemplate(id, parseResult.data, actorId);

    return reply.status(200).send({
      success: true,
      data: template,
    });
  };

  deleteTemplate = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const actorId =
      (request.user as any)?.id ||
      (request.user as any)?._id?.toString() ||
      (request.user as any)?.userId;

    const result = await this.service.deleteTemplate(id, actorId);

    return reply.status(200).send({
      success: true,
      data: result,
    });
  };

  previewTemplate = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = previewTemplateSchema.safeParse(request.body);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const result = await this.service.previewTemplate(parseResult.data);

    return reply.status(200).send({
      success: true,
      data: result,
    });
  };

  // ==========================================
  // AUDIENCE SEGMENTATION & SUPPRESSION
  // ==========================================

  estimateAudience = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = audienceEstimateSchema.safeParse(request.body);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const result = await this.audienceService.estimateAudience(
      parseResult.data.filter,
      parseResult.data.sampleSize
    );

    return reply.status(200).send({
      success: true,
      data: result,
    });
  };

  resolveAudience = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = audienceResolveSchema.safeParse(request.body);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const result = await this.audienceService.resolveAudienceRecipients(
      parseResult.data.filter,
      parseResult.data.limit
    );

    return reply.status(200).send({
      success: true,
      data: result,
    });
  };

  // ==========================================
  // DISPATCHER & BATCH EXECUTION
  // ==========================================

  launchCampaign = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = launchCampaignOptionsSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const result = await this.dispatcherService.launchCampaign(id, parseResult.data);

    return reply.status(200).send({
      success: true,
      data: result,
    });
  };

  pauseCampaign = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const result = await this.dispatcherService.pauseCampaign(id);

    return reply.status(200).send({
      success: true,
      data: result,
    });
  };

  resumeCampaign = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = launchCampaignOptionsSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const result = await this.dispatcherService.resumeCampaign(id, parseResult.data);

    return reply.status(200).send({
      success: true,
      data: result,
    });
  };

  cancelCampaign = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const result = await this.dispatcherService.cancelCampaign(id);

    return reply.status(200).send({
      success: true,
      data: result,
    });
  };

  getExecutionStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const result = await this.dispatcherService.getCampaignExecutionStatus(id);

    return reply.status(200).send({
      success: true,
      data: result,
    });
  };
}

export default CampaignController;
