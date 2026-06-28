import { FastifyInstance } from "fastify";
import { EmployeeController } from "../controllers/employee.controller.js";
import { EmployeeService } from "../services/employee.service.js";
import { EmployeeRepository } from "../repositories/employee.repository.js";
import { authenticate, requireRole } from "../../../middleware/auth.middleware.js";
import {
  updateProfileSchema,
  updatePreferencesSchema,
  changePasswordSchema,
  inviteEmployeeSchema,
  updateEmployeeSchema,
} from "../schemas/employee.schema.js";

export async function employeeRoutes(app: FastifyInstance) {
  const repository = new EmployeeRepository();
  const service = new EmployeeService(repository);
  const controller = new EmployeeController(service);

  // Authenticate all routes
  app.addHook("preHandler", authenticate);

  // User Self Profile Routes
  app.get("/me", controller.getMe as any);
  app.patch("/me", { schema: { body: updateProfileSchema } }, controller.updateMe as any);
  app.patch("/preferences", { schema: { body: updatePreferencesSchema } }, controller.updatePreferences as any);
  app.patch("/me/preferences", { schema: { body: updatePreferencesSchema } }, controller.updatePreferences as any);
  app.patch("/me/password", { schema: { body: changePasswordSchema } }, controller.changePassword as any);

  // Directory & Administration Routes
  app.get(
    "/",
    { preHandler: [requireRole(["owner", "admin", "manager"])] },
    controller.listEmployees as any
  );

  app.post(
    "/invite",
    {
      preHandler: [requireRole(["owner", "admin"])],
      schema: { body: inviteEmployeeSchema },
    },
    controller.inviteEmployee as any
  );

  app.get(
    "/:id",
    { preHandler: [requireRole(["owner", "admin", "manager"])] },
    controller.getEmployee as any
  );

  app.patch(
    "/:id",
    {
      preHandler: [requireRole(["owner", "admin"])],
      schema: { body: updateEmployeeSchema },
    },
    controller.updateEmployee as any
  );

  app.delete(
    "/:id",
    { preHandler: [requireRole(["owner", "admin"])] },
    controller.deleteEmployee as any
  );
}

export default employeeRoutes;
