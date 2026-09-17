import { FastifyInstance } from "fastify";
import OrganizationIntegrationController from "../controllers/organization-integration.controller.js";
import { authenticate, requireRole } from "../../../middleware/auth.middleware.js";

export async function organizationIntegrationRoutes(app: FastifyInstance) {
  const controller = new OrganizationIntegrationController();

  // All endpoints require authentication
  app.addHook("preHandler", authenticate);

  // GET /api/v1/organizations/integrations/capabilities
  // Public to all tenant members so frontend can gate features appropriately
  app.get("/capabilities", controller.getCapabilities as any);

  // Administrative endpoints restricted to organization owners & administrators
  const adminHook = { preHandler: [requireRole(["owner", "admin", "hr_admin", "super_admin"])] };

  // GET /api/v1/organizations/integrations/:type (ai | email)
  app.get("/:type", adminHook, controller.getIntegration as any);

  // PUT /api/v1/organizations/integrations/:type (ai | email)
  app.put("/:type", adminHook, controller.saveIntegration as any);

  // POST /api/v1/organizations/integrations/:type/test (ai | email)
  app.post("/:type/test", adminHook, controller.testIntegration as any);

  // DELETE /api/v1/organizations/integrations/:type (ai | email)
  app.delete("/:type", adminHook, controller.deleteIntegration as any);
}

export default organizationIntegrationRoutes;
