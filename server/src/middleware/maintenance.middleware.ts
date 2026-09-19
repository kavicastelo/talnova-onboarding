import { FastifyReply, FastifyRequest } from "fastify";
import PlatformSetting from "../modules/super-admin/models/platform-setting.model.js";

/**
 * Fastify pre-handler hook enforcing Platform Maintenance Mode.
 * When enabled, all non-super-admin incoming traffic is rejected with HTTP 503.
 * Super Admins, root admin routes, and infrastructure health probes retain uninhibited access.
 */
export async function maintenanceModeGuard(request: FastifyRequest, reply: FastifyReply) {
  const url = request.url;

  // 1. Whitelist infrastructure health checks, super-admin command center, and public docs
  if (
    url.startsWith("/api/v1/super-admin") ||
    url === "/live" ||
    url === "/health" ||
    url === "/ready" ||
    url.startsWith("/documentation") ||
    url.startsWith("/docs")
  ) {
    return;
  }

  // 2. Fetch platform setting singleton
  try {
    const setting = await PlatformSetting.findOne({ singleton: true });
    if (!setting || !setting.maintenanceMode) {
      return;
    }

    // 3. Maintenance mode is ACTIVE. Check if the requester is authenticated as a Super Admin.
    let userRole = (request.user as any)?.role || (request.user as any)?.permissions?.role;

    if (!userRole && request.headers.authorization) {
      try {
        await request.jwtVerify();
        userRole = (request.user as any)?.role || (request.user as any)?.permissions?.role;
      } catch {
        // Invalid or expired token; will be treated as non-super-admin
      }
    }

    if (userRole === "super_admin") {
      return; // Super admins pass through without interruption
    }

    // 4. Reject non-super-admin requests with 503 Service Unavailable
    return reply.status(503).send({
      success: false,
      code: "MAINTENANCE_MODE",
      message: setting.maintenanceMessage || "Talnova Onboarding is undergoing planned infrastructure maintenance.",
    });
  } catch (err: any) {
    request.log.error({ err }, "[MaintenanceModeGuard] Error checking maintenance setting");
  }
}

export default maintenanceModeGuard;
