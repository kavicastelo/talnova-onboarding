import { FastifyRequest, FastifyReply } from "fastify";
import roleChecklistService from "../services/role-checklist.service.js";

export class RoleChecklistController {
  listTemplates = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const query = request.query as any;
    const templates = await roleChecklistService.listTemplates(user.organizationId, {
      role: query.role,
      department: query.department,
      isActive: query.isActive !== undefined ? query.isActive === "true" || query.isActive === true : undefined,
    });

    return reply.status(200).send({
      success: true,
      data: templates,
    });
  };

  getTemplate = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const template = await roleChecklistService.getTemplate(user.organizationId, params.id);

    return reply.status(200).send({
      success: true,
      data: template,
    });
  };

  createTemplate = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;
    const template = await roleChecklistService.createTemplate(
      user.organizationId,
      user.userId,
      body
    );

    return reply.status(201).send({
      success: true,
      message: "Checklist template created successfully",
      data: template,
    });
  };

  updateTemplate = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = request.body as any;
    const template = await roleChecklistService.updateTemplate(
      user.organizationId,
      params.id,
      user.userId,
      body
    );

    return reply.status(200).send({
      success: true,
      message: "Checklist template updated successfully",
      data: template,
    });
  };

  deleteTemplate = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const result = await roleChecklistService.deleteTemplate(user.organizationId, params.id);

    return reply.status(200).send(result);
  };

  applyTemplate = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = (request.body as any) || {};

    const targetUserId = params.userId || body.userId || body.employeeId;
    const refDate = body.referenceDate || body.baseDate;

    const result = await roleChecklistService.applyTemplateToUser(
      user.organizationId,
      params.id,
      targetUserId,
      user.userId,
      refDate
    );

    return reply.status(200).send(result);
  };
}

export const roleChecklistController = new RoleChecklistController();
export default roleChecklistController;
