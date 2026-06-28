import { FastifyInstance } from "fastify";
import { OrganizationController } from "../controllers/organization.controller.js";
import { OrganizationService } from "../services/organization.service.js";
import { OrganizationRepository } from "../repositories/organization.repository.js";
import { authenticate, requireRole } from "../../../middleware/auth.middleware.js";
import {
  updateOrganizationSchema,
  updateBrandingSchema,
  updateSecuritySchema,
  departmentSchema,
  teamSchema,
} from "../schemas/organization.schema.js";

export async function organizationRoutes(app: FastifyInstance) {
  const orgRepository = new OrganizationRepository();
  const orgService = new OrganizationService(orgRepository);
  const controller = new OrganizationController(orgService);

  // Apply authentication to all organization routes
  app.addHook("preHandler", authenticate);

  // GET /api/v1/organizations/current
  app.get("/current", controller.getCurrent as any);

  // PATCH /api/v1/organizations/current
  app.patch(
    "/current",
    {
      preHandler: [requireRole(["owner"])],
      schema: { body: updateOrganizationSchema },
    },
    controller.updateCurrent as any
  );

  // PATCH /api/v1/organizations/branding
  app.patch(
    "/branding",
    {
      preHandler: [requireRole(["owner", "admin"])],
      schema: { body: updateBrandingSchema },
    },
    controller.updateBranding as any
  );

  // PATCH /api/v1/organizations/security
  app.patch(
    "/security",
    {
      preHandler: [requireRole(["owner"])],
      schema: { body: updateSecuritySchema },
    },
    controller.updateSecurity as any
  );

  // Departments
  app.get("/departments", { preHandler: [requireRole(["owner", "admin", "manager"])] }, controller.listDepartments as any);
  
  app.post(
    "/departments",
    {
      preHandler: [requireRole(["owner", "admin"])],
      schema: { body: departmentSchema },
    },
    controller.createDepartment as any
  );

  app.patch(
    "/departments/:id",
    {
      preHandler: [requireRole(["owner", "admin"])],
      schema: { body: departmentSchema.partial() },
    },
    controller.updateDepartment as any
  );

  app.delete(
    "/departments/:id",
    { preHandler: [requireRole(["owner", "admin"])] },
    controller.deleteDepartment as any
  );

  // Teams
  app.get("/teams", { preHandler: [requireRole(["owner", "admin", "manager"])] }, controller.listTeams as any);

  app.post(
    "/teams",
    {
      preHandler: [requireRole(["owner", "admin"])],
      schema: { body: teamSchema },
    },
    controller.createTeam as any
  );

  app.patch(
    "/teams/:id",
    {
      preHandler: [requireRole(["owner", "admin"])],
      schema: { body: teamSchema.partial() },
    },
    controller.updateTeam as any
  );

  app.delete(
    "/teams/:id",
    { preHandler: [requireRole(["owner", "admin"])] },
    controller.deleteTeam as any
  );
}

export default organizationRoutes;
