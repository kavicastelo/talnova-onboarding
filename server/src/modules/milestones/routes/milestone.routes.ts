import { FastifyInstance } from "fastify";
import { MilestoneController } from "../controllers/milestone.controller.js";
import { MilestoneService } from "../services/milestone.service.js";
import { authenticate, requireRole } from "../../../middleware/auth.middleware.js";
import {
  createMilestoneTemplateSchema,
  assignMilestoneSchema,
  selfCheckinSchema,
  managerReviewSchema,
} from "../schemas/milestone.schema.js";

export async function milestoneRoutes(app: FastifyInstance) {
  const service = new MilestoneService();
  const controller = new MilestoneController(service);

  // Authenticate all routes
  app.addHook("preHandler", authenticate);

  // Template Management (Admin / Owner)
  app.post(
    "/templates",
    {
      preHandler: [requireRole(["owner", "admin"])],
      schema: { body: createMilestoneTemplateSchema },
    },
    controller.createTemplate as any
  );

  app.get("/templates", controller.listTemplates as any);

  // Assignment (Admin / Owner)
  app.post(
    "/assign",
    {
      preHandler: [requireRole(["owner", "admin"])],
      schema: { body: assignMilestoneSchema },
    },
    controller.assignMilestone as any
  );

  // Employee Milestones & Self Check-in
  app.get("/my-milestones", controller.getMyMilestones as any);
  app.post(
    "/:id/self-checkin",
    { schema: { body: selfCheckinSchema } },
    controller.submitEmployeeSelfCheck as any
  );

  // Manager Team Milestones & Review
  app.get(
    "/team-milestones",
    { preHandler: [requireRole(["owner", "admin", "manager"])] },
    controller.getTeamMilestones as any
  );

  app.post(
    "/:id/manager-review",
    {
      preHandler: [requireRole(["owner", "admin", "manager"])],
      schema: { body: managerReviewSchema },
    },
    controller.submitManagerReview as any
  );
}

export default milestoneRoutes;
