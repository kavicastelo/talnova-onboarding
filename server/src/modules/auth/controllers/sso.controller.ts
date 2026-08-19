import { FastifyReply, FastifyRequest } from "fastify";
import { SSOService } from "../services/sso.service.js";

export class SSOController {
  constructor(private readonly ssoService: SSOService) {}

  getSSOConfig = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const config = await this.ssoService.getSSOConfig(user.organizationId);

    return reply.status(200).send({
      success: true,
      message: "SSO configuration retrieved successfully",
      data: config,
    });
  };

  saveSSOConfig = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;

    const config = await this.ssoService.saveSSOConfig(user.organizationId, user.userId, body);

    return reply.status(200).send({
      success: true,
      message: "SSO configuration saved successfully",
      data: config,
    });
  };

  discoverDomain = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;

    if (!body.email || typeof body.email !== "string") {
      return reply.status(400).send({
        success: false,
        message: "Email address is required for domain discovery",
      });
    }

    const discovery = await this.ssoService.discoverDomainSSO(body.email);

    return reply.status(200).send({
      success: true,
      message: "SSO domain discovery processed successfully",
      data: discovery,
    });
  };

  initiateSSO = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;

    if (!body.email || typeof body.email !== "string") {
      return reply.status(400).send({
        success: false,
        message: "Email address is required to initiate SSO",
      });
    }

    const result = await this.ssoService.initiateSSOLogin(body.email);

    return reply.status(200).send({
      success: true,
      message: "SSO login initiated successfully",
      data: result,
    });
  };

  handleCallback = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;

    if (!body.organizationId || !body.email) {
      return reply.status(400).send({
        success: false,
        message: "Organization ID and Email are required for SSO callback",
      });
    }

    const service = new SSOService(undefined, undefined, request.server.jwt as any);

    const result = await service.handleSSOCallback(
      body.organizationId,
      {
        email: body.email,
        firstName: body.firstName || "SSO",
        lastName: body.lastName || "User",
        ssoId: body.ssoId || `sso_${Date.now()}`,
        idpGroups: body.idpGroups || [],
      },
      request.ip,
      request.headers["user-agent"]
    );

    return reply.status(200).send({
      success: true,
      message: "SSO authentication successful",
      data: result,
    });
  };
}
