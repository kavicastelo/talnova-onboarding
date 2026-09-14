import { FastifyInstance } from "fastify";
import roleChecklistController from "../controllers/role-checklist.controller.js";
import { authenticate, requireRole } from "../../../middleware/auth.middleware.js";

export async function taskTemplateRoutes(app: FastifyInstance) {
  // All template management requires authentication
  app.addHook("preHandler", authenticate);

  // List templates
  app.get("/", roleChecklistController.listTemplates as any);

  // Get template by ID
  app.get("/:id", roleChecklistController.getTemplate as any);

  // Create template (Admin, Owner, Manager, HR Admin)
  app.post(
    "/",
    { preHandler: [requireRole(["owner", "admin", "manager", "hr_admin"])] },
    roleChecklistController.createTemplate as any
  );

  // Update template
  app.patch(
    "/:id",
    { preHandler: [requireRole(["owner", "admin", "manager", "hr_admin"])] },
    roleChecklistController.updateTemplate as any
  );

  // Delete template
  app.delete(
    "/:id",
    { preHandler: [requireRole(["owner", "admin", "manager", "hr_admin"])] },
    roleChecklistController.deleteTemplate as any
  );

  // Manually apply template to an employee
  app.post(
    "/:id/apply",
    { preHandler: [requireRole(["owner", "admin", "manager", "hr_admin"])] },
    roleChecklistController.applyTemplate as any
  );
  app.post(
    "/:id/apply/:userId",
    { preHandler: [requireRole(["owner", "admin", "manager", "hr_admin"])] },
    roleChecklistController.applyTemplate as any
  );
}

export default taskTemplateRoutes;
