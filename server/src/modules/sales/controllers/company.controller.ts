import { FastifyReply, FastifyRequest } from "fastify";
import CompanyService from "../services/company.service.js";
import AppError from "../../../common/errors/app-error.js";
import {
  createCompanySchema,
  updateCompanySchema,
  companyQuerySchema,
  addCompanyNoteSchema,
} from "../schemas/company.schemas.js";

export class CompanyController {
  constructor(private readonly service = new CompanyService()) {}

  /**
   * GET /api/v1/sales/companies
   */
  getCompanies = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = companyQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const result = await this.service.getCompanies(parseResult.data);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  };

  /**
   * GET /api/v1/sales/companies/:id
   */
  getCompanyById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const company = await this.service.getCompanyById(id);

    return reply.status(200).send({
      success: true,
      data: company,
    });
  };

  /**
   * GET /api/v1/sales/companies/:id/360
   */
  getCompany360 = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const overview = await this.service.getCompany360(id);

    return reply.status(200).send({
      success: true,
      data: overview,
    });
  };

  /**
   * POST /api/v1/sales/companies
   */
  createCompany = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createCompanySchema.safeParse(request.body);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const actorUserId = (request as any).user?.userId;
    const company = await this.service.createCompany(parseResult.data, actorUserId);

    return reply.status(201).send({
      success: true,
      message: "Company created successfully",
      data: company,
    });
  };

  /**
   * PATCH /api/v1/sales/companies/:id
   */
  updateCompany = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = updateCompanySchema.safeParse(request.body);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const actorUserId = (request as any).user?.userId;
    const company = await this.service.updateCompany(id, parseResult.data, actorUserId);

    return reply.status(200).send({
      success: true,
      message: "Company updated successfully",
      data: company,
    });
  };

  /**
   * DELETE /api/v1/sales/companies/:id
   */
  deleteCompany = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const actorUserId = (request as any).user?.userId;
    const result = await this.service.deleteCompany(id, actorUserId);

    return reply.status(200).send({
      success: true,
      message: "Company deleted successfully",
      data: result,
    });
  };

  /**
   * POST /api/v1/sales/companies/:id/notes
   */
  addNote = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = addCompanyNoteSchema.safeParse(request.body);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const actorUserId = (request as any).user?.userId;
    const company = await this.service.addNote(id, parseResult.data.content, actorUserId);

    return reply.status(200).send({
      success: true,
      message: "Note added successfully",
      data: company,
    });
  };
}

export default CompanyController;
