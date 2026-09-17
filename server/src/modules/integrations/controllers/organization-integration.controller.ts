import { FastifyReply, FastifyRequest } from "fastify";
import OrganizationIntegrationService from "../services/organization-integration.service.js";
import { IntegrationType } from "../models/organization-integration.model.js";

export class OrganizationIntegrationController {
  constructor(
    private readonly service = new OrganizationIntegrationService()
  ) {}

  getCapabilities = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const capabilities = await this.service.getCapabilities(user.organizationId);

    return reply.status(200).send({
      success: true,
      data: capabilities,
    });
  };

  getIntegration = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as { type: IntegrationType };

    if (params.type !== "ai" && params.type !== "email") {
      return reply.status(400).send({
        success: false,
        message: "Invalid integration type. Must be 'ai' or 'email'.",
      });
    }

    const data = await this.service.getIntegration(user.organizationId, params.type);

    return reply.status(200).send({
      success: true,
      data,
    });
  };

  saveIntegration = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as { type: IntegrationType };
    const body = request.body as any;

    if (params.type !== "ai" && params.type !== "email") {
      return reply.status(400).send({
        success: false,
        message: "Invalid integration type. Must be 'ai' or 'email'.",
      });
    }

    const data = await this.service.saveIntegration(
      user.organizationId,
      user.userId,
      params.type,
      body
    );

    return reply.status(200).send({
      success: true,
      message: `${params.type.toUpperCase()} integration saved successfully.`,
      data,
    });
  };

  testIntegration = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as { type: IntegrationType };
    const body = (request.body as any) || {};

    if (params.type !== "ai" && params.type !== "email") {
      return reply.status(400).send({
        success: false,
        message: "Invalid integration type. Must be 'ai' or 'email'.",
      });
    }

    const result = await this.service.testIntegration(
      user.organizationId,
      params.type,
      body
    );

    return reply.status(200).send({
      success: result.success,
      data: result,
    });
  };

  deleteIntegration = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as { type: IntegrationType };

    if (params.type !== "ai" && params.type !== "email") {
      return reply.status(400).send({
        success: false,
        message: "Invalid integration type. Must be 'ai' or 'email'.",
      });
    }

    const result = await this.service.deleteIntegration(user.organizationId, params.type);

    return reply.status(200).send({
      success: true,
      message: result.message,
    });
  };
}

export default OrganizationIntegrationController;
