import { FastifyReply, FastifyRequest } from "fastify";
import LeadService from "../services/lead.service.js";
import DuplicateDetectionService from "../services/duplicate-detection.service.js";
import LeadScoringService from "../services/lead-scoring.service.js";
import LeadImportService from "../services/lead-import.service.js";
import AppError from "../../../common/errors/app-error.js";
import {
  createLeadSchema,
  updateLeadSchema,
  updateLeadStatusSchema,
  leadQuerySchema,
  addLeadNoteSchema,
  mergeLeadsSchema,
  checkDuplicatesSchema,
  recordScoreEventSchema,
  importPreviewSchema,
  importExecuteSchema,
} from "../schemas/lead.schemas.js";

export class LeadController {
  constructor(
    private readonly service = new LeadService(),
    private readonly duplicateService = new DuplicateDetectionService(),
    private readonly scoringService = new LeadScoringService(),
    private readonly importService = new LeadImportService()
  ) {}

  /**
   * GET /api/v1/sales/leads
   */
  getLeads = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = leadQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const result = await this.service.getLeads(parseResult.data);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  };

  /**
   * GET /api/v1/sales/leads/:id
   */
  getLeadById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lead = await this.service.getLeadById(id);
    return reply.status(200).send({
      success: true,
      data: lead,
    });
  };

  /**
   * POST /api/v1/sales/leads
   */
  createLead = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createLeadSchema.safeParse(request.body);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const actorUserId = (request as any).user?.userId;
    const lead = await this.service.createLead(parseResult.data, actorUserId);

    return reply.status(201).send({
      success: true,
      message: "Lead created successfully",
      data: lead,
    });
  };

  /**
   * PATCH /api/v1/sales/leads/:id
   */
  updateLead = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = updateLeadSchema.safeParse(request.body);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const actorUserId = (request as any).user?.userId;
    const lead = await this.service.updateLead(id, parseResult.data, actorUserId);

    return reply.status(200).send({
      success: true,
      message: "Lead updated successfully",
      data: lead,
    });
  };

  /**
   * PATCH /api/v1/sales/leads/:id/status
   */
  updateLeadStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = updateLeadStatusSchema.safeParse(request.body);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const actorUserId = (request as any).user?.userId;
    const lead = await this.service.updateLeadStatus(id, parseResult.data, actorUserId);

    return reply.status(200).send({
      success: true,
      message: "Lead status updated successfully",
      data: lead,
    });
  };

  /**
   * DELETE /api/v1/sales/leads/:id
   */
  deleteLead = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const actorUserId = (request as any).user?.userId;
    const result = await this.service.deleteLead(id, actorUserId);

    return reply.status(200).send({
      success: true,
      message: "Lead deleted successfully",
      data: result,
    });
  };

  /**
   * POST /api/v1/sales/leads/:id/notes
   */
  addLeadNote = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = addLeadNoteSchema.safeParse(request.body);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const actorUserId = (request as any).user?.userId;
    const lead = await this.service.addNote(id, parseResult.data.content, actorUserId);

    return reply.status(200).send({
      success: true,
      message: "Note added successfully",
      data: lead,
    });
  };

  /**
   * GET /api/v1/sales/leads/:id/duplicates
   */
  getDuplicatesForLead = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const duplicates = await this.duplicateService.findDuplicatesForLead(id);

    return reply.status(200).send({
      success: true,
      data: duplicates,
    });
  };

  /**
   * POST /api/v1/sales/leads/check-duplicates
   */
  checkDuplicates = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = checkDuplicatesSchema.safeParse(request.body);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const duplicates = await this.duplicateService.checkDuplicates(parseResult.data);

    return reply.status(200).send({
      success: true,
      data: duplicates,
    });
  };

  /**
   * POST /api/v1/sales/leads/merge
   */
  mergeLeads = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = mergeLeadsSchema.safeParse(request.body);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const { primaryLeadId, secondaryLeadIds, fieldOverrides } = parseResult.data;
    const actorUserId = (request as any).user?.userId;
    const merged = await this.duplicateService.mergeLeads(
      primaryLeadId,
      secondaryLeadIds,
      fieldOverrides,
      actorUserId
    );

    return reply.status(200).send({
      success: true,
      message: `Successfully merged ${secondaryLeadIds.length} lead(s) into primary record.`,
      data: merged,
    });
  };

  /**
   * POST /api/v1/sales/leads/:id/recalculate-score
   */
  recalculateLeadScore = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lead = await this.scoringService.recalculateLeadScore(id);

    return reply.status(200).send({
      success: true,
      message: "Lead score recalculated successfully",
      data: lead,
    });
  };

  /**
   * POST /api/v1/sales/leads/:id/score-event
   */
  recordScoreEvent = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = recordScoreEventSchema.safeParse(request.body);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const actorUserId = (request as any).user?.userId;
    const lead = await this.scoringService.recordScoreEvent(
      id,
      parseResult.data.rule,
      parseResult.data.points,
      actorUserId
    );

    return reply.status(200).send({
      success: true,
      message: "Score event recorded successfully",
      data: lead,
    });
  };

  /**
   * POST /api/v1/sales/leads/import/preview
   */
  previewImport = async (request: FastifyRequest, reply: FastifyReply) => {
    let csvContent = "";

    if (request.isMultipart()) {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === "file") {
          const buf = await part.toBuffer();
          csvContent = buf.toString("utf-8");
        } else if (part.fieldname === "csvContent") {
          csvContent = part.value as string;
        }
      }
    } else {
      const parseResult = importPreviewSchema.safeParse(request.body);
      if (!parseResult.success) {
        const details = parseResult.error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));
        throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
      }
      csvContent = parseResult.data.csvContent;
    }

    if (!csvContent || !csvContent.trim()) {
      throw new AppError(400, "EMPTY_CSV", "CSV content cannot be empty");
    }

    const preview = this.importService.parsePreview(csvContent);

    return reply.status(200).send({
      success: true,
      data: preview,
    });
  };

  /**
   * POST /api/v1/sales/leads/import/execute
   */
  executeImport = async (request: FastifyRequest, reply: FastifyReply) => {
    let csvContent = "";
    let mapping: Record<string, string> | undefined;
    let duplicateStrategy: "skip" | "overwrite" | "create_duplicate" | undefined;
    let defaultValues: any;

    if (request.isMultipart()) {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === "file") {
          const buf = await part.toBuffer();
          csvContent = buf.toString("utf-8");
        } else if (part.fieldname === "csvContent") {
          csvContent = part.value as string;
        } else if (part.fieldname === "mapping") {
          try {
            mapping = JSON.parse(part.value as string);
          } catch {}
        } else if (part.fieldname === "duplicateStrategy") {
          duplicateStrategy = part.value as any;
        } else if (part.fieldname === "defaultValues") {
          try {
            defaultValues = JSON.parse(part.value as string);
          } catch {}
        }
      }
    } else {
      const parseResult = importExecuteSchema.safeParse(request.body);
      if (!parseResult.success) {
        const details = parseResult.error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));
        throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
      }
      csvContent = parseResult.data.csvContent;
      mapping = parseResult.data.mapping;
      duplicateStrategy = parseResult.data.duplicateStrategy;
      defaultValues = parseResult.data.defaultValues;
    }

    if (!csvContent || !csvContent.trim()) {
      throw new AppError(400, "EMPTY_CSV", "CSV content cannot be empty");
    }

    const actorUserId = (request as any).user?.userId;
    const organizationId = (request as any).user?.organizationId;

    const result = await this.importService.executeImport({
      csvContent,
      mapping,
      duplicateStrategy,
      defaultValues,
      actorUserId,
      organizationId,
    });

    return reply.status(200).send({
      success: true,
      message: `Import completed: ${result.created} created, ${result.updated} updated, ${result.duplicatesSkipped} skipped, ${result.invalidCount} invalid rows.`,
      data: result,
    });
  };
}

export default LeadController;
