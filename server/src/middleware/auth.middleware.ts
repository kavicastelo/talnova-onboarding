import { FastifyReply, FastifyRequest } from "fastify";
import AppError from "../common/errors/app-error.js";
import { Organization } from "../modules/organizations/models/organization.model.js";

/**
 * Global authentication hook that verifies the JWT access token.
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();

    // Check if organization is suspended
    const user = request.user as any;
    if (user && user.organizationId) {
      if (user.role !== "super_admin") {
        const org = await Organization.findById(user.organizationId);
        if (org && org.status === "Suspended") {
          throw new AppError(
            403,
            "FORBIDDEN",
            "Your organization has been suspended. Access denied."
          );
        }
      }
    }
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    const isExpired = error.code === "FST_JWT_AUTHORIZATION_TOKEN_EXPIRED";
    throw new AppError(
      401,
      isExpired ? "TOKEN_EXPIRED" : "UNAUTHORIZED",
      isExpired ? "Authentication token has expired" : "Authentication required"
    );
  }
}

/**
 * Optional authentication hook that parses the JWT token if available, but doesn't block guests.
 */
export async function optionalAuthenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    if (authHeader) {
      await request.jwtVerify();
      const user = request.user as any;
      if (user && user.organizationId) {
        if (user.role !== "super_admin") {
          const org = await Organization.findById(user.organizationId);
          if (org && org.status === "Suspended") {
            throw new AppError(
              403,
              "FORBIDDEN",
              "Your organization has been suspended. Access denied."
            );
          }
        }
      }
    }
  } catch (error: any) {
    // If it's a tenant suspension error, propagate it
    if (error instanceof AppError) {
      throw error;
    }
    // Otherwise, ignore invalid/expired tokens for optional authentication
  }
}

/**
 * Authorization hook creator to restrict route access to specific roles.
 */
export function requireRole(allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      throw new AppError(401, "UNAUTHORIZED", "Please authenticate first");
    }

    const { role } = request.user as any;
    if (!allowedRoles.includes(role)) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "Access denied. You do not have the required role to perform this action."
      );
    }
  };
}

/**
 * Tenant boundaries validator that ensures the user belongs to the target organization.
 */
export async function verifyTenant(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    throw new AppError(401, "UNAUTHORIZED", "Please authenticate first");
  }

  // If a request provides an organizationId in route parameters, enforce check
  const params = request.params as Record<string, any>;
  const query = request.query as Record<string, any>;

  const targetOrgId = params?.organizationId || query?.organizationId;

  if (targetOrgId && targetOrgId !== (request.user as any).organizationId) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Access denied. Tenant boundary violation."
    );
  }
}
