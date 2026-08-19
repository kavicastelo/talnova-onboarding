import { FastifyInstance } from "fastify";
import { BuddyController } from "../controllers/buddy.controller.js";
import { BuddyService } from "../services/buddy.service.js";
import { authenticate, requireRole } from "../../../middleware/auth.middleware.js";
import {
  registerBuddySchema,
  assignBuddySchema,
  updateChecklistSchema,
  logCheckinSchema,
} from "../schemas/buddy.schema.js";

export async function buddyRoutes(app: FastifyInstance) {
  const service = new BuddyService();
  const controller = new BuddyController(service);

  // Authenticate all routes
  app.addHook("preHandler", authenticate);

  // Profile Registration & Discovery
  app.post(
    "/profiles",
    { schema: { body: registerBuddySchema } },
    controller.registerProfile as any
  );

  app.get("/available", controller.listAvailableBuddies as any);

  // Assignment (Admin / Owner / Manager)
  app.post(
    "/assign",
    {
      preHandler: [requireRole(["owner", "admin", "manager"])],
      schema: { body: assignBuddySchema },
    },
    controller.assignBuddy as any
  );

  // User Views
  app.get("/my-buddy", controller.getEmployeeBuddy as any);
  app.get("/my-mentees", controller.getBuddyMentees as any);

  // Checklist & Check-ins
  app.put(
    "/assignment/:id/checklist",
    { schema: { body: updateChecklistSchema } },
    controller.updateChecklistTask as any
  );

  app.post(
    "/assignment/:id/checkin",
    { schema: { body: logCheckinSchema } },
    controller.logBuddyCheckin as any
  );
}

export default buddyRoutes;
