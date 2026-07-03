import { FastifyInstance } from "fastify";
import { JourneyController } from "../controllers/journey.controller.js";
import { JourneyService } from "../services/journey.service.js";
import { JourneyRepository } from "../repositories/journey.repository.js";
import { authenticate, requireRole } from "../../../middleware/auth.middleware.js";
import { extractLocale } from "../../../middleware/locale.middleware.js";
import {
  createJourneySchema,
  updateJourneySchema,
  duplicateJourneySchema,
} from "../schemas/journey.schema.js";

export async function journeyRoutes(app: FastifyInstance) {
  const repository = new JourneyRepository();
  const service = new JourneyService(repository);
  const controller = new JourneyController(service);

  // Authenticate all routes
  app.addHook("preHandler", authenticate);

  // GET /api/v1/journeys
  app.get("/", { preHandler: [extractLocale] }, controller.listJourneys as any);

  // GET /api/v1/journeys/:id
  app.get("/:id", { preHandler: [extractLocale] }, controller.getJourney as any);

  // POST /api/v1/journeys
  app.post(
    "/",
    {
      preHandler: [requireRole(["owner", "admin"])],
      schema: { body: createJourneySchema },
    },
    controller.createJourney as any
  );

  // PATCH /api/v1/journeys/:id
  app.patch(
    "/:id",
    {
      preHandler: [requireRole(["owner", "admin"])],
      schema: { body: updateJourneySchema },
    },
    controller.updateJourney as any
  );

  // DELETE /api/v1/journeys/:id
  app.delete(
    "/:id",
    { preHandler: [requireRole(["owner", "admin"])] },
    controller.deleteJourney as any
  );

  // POST /api/v1/journeys/:id/publish
  app.post(
    "/:id/publish",
    { preHandler: [requireRole(["owner", "admin"])] },
    controller.publishJourney as any
  );

  // POST /api/v1/journeys/:id/archive
  app.post(
    "/:id/archive",
    { preHandler: [requireRole(["owner", "admin"])] },
    controller.archiveJourney as any
  );

  // POST /api/v1/journeys/:id/duplicate
  app.post(
    "/:id/duplicate",
    {
      preHandler: [requireRole(["owner", "admin"])],
      schema: { body: duplicateJourneySchema },
    },
    controller.duplicateJourney as any
  );

  // GET /api/v1/journeys/:id/analytics
  app.get(
    "/:id/analytics",
    { preHandler: [requireRole(["owner", "admin", "manager"])] },
    controller.getJourneyAnalytics as any
  );
}

export default journeyRoutes;
