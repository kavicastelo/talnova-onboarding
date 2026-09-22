import { FastifyReply, FastifyRequest } from "fastify";
import AppError from "../common/errors/app-error.js";
import Organization from "../modules/organizations/models/organization.model.js";
import TenantStatusCache from "../infrastructure/cache/tenant-status.cache.js";
import FeatureFlagService from "../modules/super-admin/services/feature-flag.service.js";

/**
 * Global authentication hook that verifies the JWT access token.
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  if (request.url.includes("/public/verify")) {
    return;
  }
  try {
    await request.jwtVerify();

    // Check if organization is suspended via in-memory cache (<5ms)
    const user = request.user as any;
    if (user && user.organizationId && user.role !== "super_admin") {
      const orgIdStr = user.organizationId.toString();
      let isSuspended = TenantStatusCache.isSuspended(orgIdStr);
      if (!isSuspended) {
        const org = await Organization.findById(user.organizationId, { status: 1 }).lean();
        if (org && org.status === "Suspended") {
          TenantStatusCache.addSuspended(orgIdStr);
          isSuspended = true;
        }
      }
      if (isSuspended) {
        throw new AppError(
          403,
          "ORGANIZATION_SUSPENDED",
          "Your organization has been suspended. Please contact support."
        );
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
      if (user && user.organizationId && user.role !== "super_admin") {
        const orgIdStr = user.organizationId.toString();
        let isSuspended = TenantStatusCache.isSuspended(orgIdStr);
        if (!isSuspended) {
          const org = await Organization.findById(user.organizationId, { status: 1 }).lean();
          if (org && org.status === "Suspended") {
            TenantStatusCache.addSuspended(orgIdStr);
            isSuspended = true;
          }
        }
        if (isSuspended) {
          throw new AppError(
            403,
            "ORGANIZATION_SUSPENDED",
            "Your organization has been suspended. Please contact support."
          );
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

    const { role, roles, customRoles } = request.user as any;
    if (role === "super_admin" || (Array.isArray(roles) && roles.includes("super_admin"))) {
      return;
    }

    const userRoles = Array.from(
      new Set([
        role,
        ...(Array.isArray(roles) ? roles : []),
        ...(Array.isArray(customRoles) ? customRoles : []),
      ].filter(Boolean))
    );

    const hasPermission = allowedRoles.some((r) => userRoles.includes(r));
    if (!hasPermission) {
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

/**
 * Feature flag enforcement hook that checks whether a platform feature is enabled
 * for the authenticated tenant organization and user role.
 */
export function requireFeatureFlag(flagKey: string) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const user = request.user as any;
    const orgId = user?.organizationId;
    const role = user?.role;

    if (role === "super_admin") {
      return;
    }

    const enabled = await FeatureFlagService.isEnabled(flagKey, orgId, role);
    if (!enabled) {
      throw new AppError(
        403,
        "FEATURE_DISABLED",
        `This feature is currently disabled by platform administration: The feature '${flagKey}' is currently disabled for your organization.`,
        {
          code: "FEATURE_DISABLED",
          error: {
            code: "FEATURE_DISABLED",
            message: `The feature '${flagKey}' is currently disabled for your organization.`,
          },
        }
      );
    }
  };
}

