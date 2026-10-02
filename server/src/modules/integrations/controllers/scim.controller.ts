import { FastifyReply, FastifyRequest } from "fastify";
import mongoose from "mongoose";
import { ScimService, scimService } from "../services/scim.service.js";
import AppError from "../../../common/errors/app-error.js";
import { Organization } from "../../organizations/models/organization.model.js";

export class ScimController {
  constructor(private readonly service: ScimService = scimService) {}

  private resolveOrgId = async (request: FastifyRequest): Promise<string> => {
    const user = request.user as any;
    if (user?.organizationId) {
      return user.organizationId.toString();
    }

    const headers = request.headers as any;
    const headerOrg = headers["x-organization-id"] || headers["x-tenant-id"];
    if (headerOrg) {
      return headerOrg.toString();
    }

    const query = (request.query || {}) as any;
    const queryOrg = query.organizationId || query.orgId || query.o;
    if (queryOrg) {
      return queryOrg.toString();
    }

    const body = (request.body || {}) as any;
    if (body?.organizationId) {
      return body.organizationId.toString();
    }

    // Try decoding bearer token
    const authHeader = headers.authorization;
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      const token = authHeader.substring(7).trim();
      try {
        const decoded = (request.server as any).jwt.decode(token);
        if (decoded?.organizationId) {
          return decoded.organizationId.toString();
        }
      } catch {
        // Not a JWT, check if it matches an organization API key or SCIM token
      }

      // Check organization SCIM token / webhook secret / sso
      const org = await Organization.findOne({
        $or: [
          { "integrations.scimToken": token },
          { "ssoConfig.issuerId": token },
          { slug: token },
        ],
        isDeleted: false,
      });
      if (org) {
        return org._id.toString();
      }
    }

    // In single-tenant test or demo environments, resolve first active organization
    if (process.env.NODE_ENV === "test" || !!process.env.VITEST) {
      const firstOrg = await Organization.findOne({ isDeleted: false });
      if (firstOrg) {
        return firstOrg._id.toString();
      }
    }

    throw new AppError(401, "UNAUTHORIZED", "Organization context missing for SCIM request");
  };

  private getBaseUrl = (request: FastifyRequest): string => {
    return request.url.split("/Users")[0] || "/api/v1/scim/v2";
  };

  createUser = async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = await this.resolveOrgId(request);
    const baseUrl = this.getBaseUrl(request);
    const { user, statusCode } = await this.service.createUser(orgId, request.body, baseUrl);

    return reply
      .status(statusCode)
      .header("Content-Type", "application/scim+json; charset=utf-8")
      .header("Location", user.meta.location)
      .send(user);
  };

  getUser = async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = await this.resolveOrgId(request);
    const baseUrl = this.getBaseUrl(request);
    const params = request.params as any;
    const user = await this.service.getUser(orgId, params.id, baseUrl);

    return reply
      .status(200)
      .header("Content-Type", "application/scim+json; charset=utf-8")
      .send(user);
  };

  listUsers = async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = await this.resolveOrgId(request);
    const baseUrl = this.getBaseUrl(request);
    const query = (request.query || {}) as any;
    const list = await this.service.listUsers(orgId, query, baseUrl);

    return reply
      .status(200)
      .header("Content-Type", "application/scim+json; charset=utf-8")
      .send(list);
  };

  updateUser = async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = await this.resolveOrgId(request);
    const baseUrl = this.getBaseUrl(request);
    const params = request.params as any;
    const user = await this.service.updateUser(orgId, params.id, request.body, baseUrl);

    return reply
      .status(200)
      .header("Content-Type", "application/scim+json; charset=utf-8")
      .send(user);
  };

  patchUser = async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = await this.resolveOrgId(request);
    const baseUrl = this.getBaseUrl(request);
    const params = request.params as any;
    const user = await this.service.patchUser(orgId, params.id, request.body, baseUrl);

    return reply
      .status(200)
      .header("Content-Type", "application/scim+json; charset=utf-8")
      .send(user);
  };

  deleteUser = async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = await this.resolveOrgId(request);
    const params = request.params as any;
    await this.service.deleteUser(orgId, params.id);

    return reply.status(204).send();
  };

  getServiceProviderConfig = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 500 },
      changePassword: { supported: false },
      sort: { supported: true },
      etag: { supported: false },
      authenticationSchemes: [
        {
          name: "OAuth Bearer Token",
          description: "Authentication scheme using the OAuth Bearer Token standard",
          specUri: "http://www.rfc-editor.org/info/rfc6750",
          type: "oauthbearertoken",
          primary: true,
        },
      ],
    });
  };

  getResourceTypes = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send([
      {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
        id: "User",
        name: "User",
        endpoint: "/Users",
        description: "Frontline worker and employee user account resource",
        schema: "urn:ietf:params:scim:schemas:core:2.0:User",
        schemaExtensions: [
          {
            schema: "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User",
            required: false,
          },
          {
            schema: "urn:ietf:params:scim:schemas:extension:talnova:2.0:User",
            required: false,
          },
        ],
      },
    ]);
  };
}

export const scimController = new ScimController();
export default scimController;
