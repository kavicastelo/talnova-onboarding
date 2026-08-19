import { FastifyInstance } from "fastify";
import { ManagerController } from "../controllers/manager.controller.js";
import { ManagerService } from "../services/manager.service.js";
import { authenticate, requireRole } from "../../../middleware/auth.middleware.js";
import { nudgeDirectReportSchema, signOffDirectReportSchema } from "../schemas/manager.schema.js";

export async function managerRoutes(app: FastifyInstance) {
  const service = new ManagerService();
  const controller = new ManagerController(service);

  // Authenticate all routes & enforce Manager / Admin / Owner role
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole(["owner", "admin", "manager"]));

  // GET /api/v1/manager/dashboard
  app.get("/dashboard", controller.getManagerDashboard as any);

  // GET /api/v1/manager/team
  app.get("/team", controller.getTeamDirectReports as any);

  // GET /api/v1/manager/team/:employeeId
  app.get("/team/:employeeId", controller.getDirectReportDetails as any);

  // POST /api/v1/manager/team/:employeeId/nudge
  app.post(
    "/team/:employeeId/nudge",
    { schema: { body: nudgeDirectReportSchema } },
    controller.nudgeDirectReport as any
  );

  // POST /api/v1/manager/team/:employeeId/sign-off
  app.post(
    "/team/:employeeId/sign-off",
    { schema: { body: signOffDirectReportSchema } },
    controller.signOffDirectReport as any
  );
}

export default managerRoutes;
