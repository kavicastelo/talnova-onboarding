import { FastifyInstance } from "fastify";
import { SSOController } from "../controllers/sso.controller.js";
import { SSOService } from "../services/sso.service.js";
import { authenticate, requireRole } from "../../../middleware/auth.middleware.js";

export async function ssoRoutes(app: FastifyInstance) {
  const service = new SSOService();
  const controller = new SSOController(service);

  // Public Endpoints (Domain Discovery, Initiate & Callback)
  app.post("/discover", controller.discoverDomain as any);
  app.post("/initiate", controller.initiateSSO as any);
  app.post("/callback", controller.handleCallback as any);

  // Admin Configuration Endpoints (Protected)
  app.get(
    "/config",
    { preHandler: [authenticate, requireRole(["owner", "admin"])] },
    controller.getSSOConfig as any
  );
  app.put(
    "/config",
    { preHandler: [authenticate, requireRole(["owner", "admin"])] },
    controller.saveSSOConfig as any
  );
}

export default ssoRoutes;
