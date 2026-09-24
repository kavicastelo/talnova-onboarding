import { FastifyRequest, FastifyReply } from "fastify";
import AppError from "../../../common/errors/app-error.js";
import { getDemoTenantModel, getDemoActivityLogModel } from "../models/index.js";

/**
 * Ensures strict demo tenant isolation.
 * Demo User A can NEVER access resources belonging to Demo Tenant B.
 */
export async function verifyDemoTenant(request: FastifyRequest, _reply: FastifyReply) {
  if (!request.demoUser) {
    throw new AppError(401, "UNAUTHORIZED", "Demo authentication required.");
  }

  const params = request.params as Record<string, any>;
  const query = request.query as Record<string, any>;
  const body = (request.body as Record<string, any>) || {};

  const targetTenantId = params?.tenantId || query?.tenantId || body?.tenantId;

  if (targetTenantId && targetTenantId !== request.demoUser.tenantId) {
    const DemoActivityLog = getDemoActivityLogModel();
    await DemoActivityLog.create({
      demoTenantId: request.demoUser.tenantId,
      demoUserId: request.demoUser.id,
      action: "CROSS_TENANT_VIOLATION_ATTEMPT",
      category: "SECURITY",
      description: `Cross-tenant violation: Demo user tried accessing tenant ${targetTenantId}`,
      severity: "critical",
      metadata: { targetTenantId, userTenantId: request.demoUser.tenantId },
    });

    throw new AppError(403, "DEMO_TENANT_ISOLATION_VIOLATION", "Access denied. Cross-tenant access is strictly prohibited.");
  }
}

/**
 * Enforces feature entitlement for the tenant.
 */
export function requireDemoFeature(featureKey: string) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.demoUser) {
      throw new AppError(401, "UNAUTHORIZED", "Demo authentication required.");
    }

    const DemoTenant = getDemoTenantModel();
    const tenant = await DemoTenant.findById(request.demoUser.tenantId).lean();

    if (!tenant) {
      throw new AppError(403, "TENANT_NOT_FOUND", "Demo tenant record not found.");
    }

    const isEntitled = tenant.allowedFeatures.includes(featureKey);
    if (!isEntitled) {
      const DemoActivityLog = getDemoActivityLogModel();
      await DemoActivityLog.create({
        demoTenantId: tenant._id,
        demoUserId: request.demoUser.id,
        action: "RESTRICTED_FEATURE_ACCESSED",
        category: "NAVIGATION",
        description: `Demo user attempted access to unentitled feature: ${featureKey}`,
        severity: "info",
        metadata: { featureKey, entitlementPackage: tenant.entitlementPackage },
      });

      throw new AppError(
        403,
        "DEMO_FEATURE_RESTRICTED",
        `This feature ('${featureKey}') is available in a full guided demonstration. Contact your sales representative for an executive walkthrough.`,
        {
          featureKey,
          entitlementPackage: tenant.entitlementPackage,
          guidedDemoAvailable: true,
        }
      );
    }
  };
}

/**
 * Blocks dangerous / high-risk operations (e.g. bulk export, integration tampering) in demo mode.
 */
export async function guardDemoHighRisk(request: FastifyRequest, _reply: FastifyReply) {
  const DemoActivityLog = getDemoActivityLogModel();
  if (request.demoUser) {
    await DemoActivityLog.create({
      demoTenantId: request.demoUser.tenantId,
      demoUserId: request.demoUser.id,
      action: "HIGH_RISK_ENDPOINT_BLOCKED",
      category: "SECURITY",
      description: `High-risk action blocked in demo mode: ${request.method} ${request.url}`,
      severity: "warning",
    });
  }

  throw new AppError(
    403,
    "DEMO_ACTION_RESTRICTED",
    "This administrative or high-risk action is restricted in the demo environment."
  );
}
