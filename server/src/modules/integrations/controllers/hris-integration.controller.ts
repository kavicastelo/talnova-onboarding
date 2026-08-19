import { FastifyReply, FastifyRequest } from "fastify";
import { HRISIntegrationService } from "../services/hris-integration.service.js";

export class HRISIntegrationController {
  constructor(private readonly service: HRISIntegrationService) {}

  getIntegrations = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const integrations = await this.service.getIntegrations(user.organizationId);

    return reply.status(200).send({
      success: true,
      message: "HRIS integrations retrieved successfully",
      data: integrations,
    });
  };

  createIntegration = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;

    const integration = await this.service.createIntegration(user.organizationId, user.userId, body);

    return reply.status(201).send({
      success: true,
      message: "HRIS integration created successfully",
      data: integration,
    });
  };

  updateIntegration = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = request.body as any;

    const integration = await this.service.updateIntegration(user.organizationId, params.id, body);

    return reply.status(200).send({
      success: true,
      message: "HRIS integration updated successfully",
      data: integration,
    });
  };

  deleteIntegration = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    await this.service.deleteIntegration(user.organizationId, params.id);

    return reply.status(200).send({
      success: true,
      message: "HRIS integration deleted successfully",
    });
  };

  testConnection = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    const result = await this.service.testConnection(user.organizationId, params.id);

    return reply.status(200).send({
      success: true,
      message: "HRIS connection test successful",
      data: result,
    });
  };

  triggerSync = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = request.body as any;

    const result = await this.service.triggerSync(user.organizationId, params.id, body?.records);

    return reply.status(200).send({
      success: true,
      message: "HRIS employee lifecycle sync triggered successfully",
      data: result,
    });
  };

  getSyncLogs = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    const logs = await this.service.getSyncLogs(user.organizationId, params.id);

    return reply.status(200).send({
      success: true,
      message: "Sync logs & DLQ events retrieved successfully",
      data: logs,
    });
  };

  handleWebhook = async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const signature = (request.headers["x-signature"] || request.headers["x-hub-signature"]) as string;
    const body = request.body as any;

    const result = await this.service.processWebhookPayload(params.provider, signature || "", body);

    return reply.status(200).send({
      success: true,
      message: "Webhook event processed successfully",
      data: result,
    });
  };
}
