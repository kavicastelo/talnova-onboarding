import { FastifyReply, FastifyRequest } from "fastify";
import { DocumentService } from "../services/document.service.js";

export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  createTemplate = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;

    const template = await this.documentService.createTemplate(user.organizationId, user.userId, body);

    return reply.status(201).send({
      success: true,
      message: "Document template created successfully",
      data: template,
    });
  };

  listTemplates = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const templates = await this.documentService.listTemplates(user.organizationId);

    return reply.status(200).send({
      success: true,
      message: "Document templates retrieved successfully",
      data: templates,
    });
  };

  updateTemplate = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = request.body as any;

    const template = await this.documentService.updateTemplate(
      user.organizationId,
      params.id,
      user.userId,
      body
    );

    return reply.status(200).send({
      success: true,
      message: "Document template updated successfully",
      data: template,
    });
  };

  deleteTemplate = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    await this.documentService.deleteTemplate(user.organizationId, params.id);

    return reply.status(200).send({
      success: true,
      message: "Document template deleted successfully",
    });
  };

  assignDocument = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;

    const assignment = await this.documentService.assignDocument(
      user.organizationId,
      body.templateId,
      body.employeeId,
      user.userId,
      body.dueDate ? new Date(body.dueDate) : undefined
    );

    return reply.status(201).send({
      success: true,
      message: "Document assigned successfully",
      data: assignment,
    });
  };

  getEmployeeInbox = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const assignments = await this.documentService.getEmployeeDocumentInbox(user.organizationId, user.userId);

    return reply.status(200).send({
      success: true,
      message: "Employee document inbox retrieved successfully",
      data: assignments,
    });
  };

  getDocumentAssignment = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    const reqMetadata = {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    };

    const assignment = await this.documentService.getDocumentAssignment(
      user.organizationId,
      params.id,
      user.userId,
      user.role,
      reqMetadata
    );

    return reply.status(200).send({
      success: true,
      message: "Document assignment retrieved successfully",
      data: assignment,
    });
  };

  signDocument = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = request.body as any;

    const reqMetadata = {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    };

    const assignment = await this.documentService.signDocument(
      user.organizationId,
      params.id,
      user.userId,
      body,
      reqMetadata
    );

    return reply.status(200).send({
      success: true,
      message: "Document signed successfully with SHA-256 cryptographic audit trail",
      data: assignment,
    });
  };
}
