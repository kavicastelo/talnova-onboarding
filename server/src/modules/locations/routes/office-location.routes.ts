import { FastifyInstance } from "fastify";
import { OfficeLocationController } from "../controllers/office-location.controller.js";
import { OfficeLocationService } from "../services/office-location.service.js";
import { authenticate, requireRole } from "../../../middleware/auth.middleware.js";

export async function officeLocationRoutes(app: FastifyInstance) {
  const service = new OfficeLocationService();
  const controller = new OfficeLocationController(service);

  app.addHook("preHandler", authenticate);

  // Employee Location Guidance (LOC-004)
  app.get("/my-location", controller.getEmployeeGuidance as any);

  // Location Management (LOC-001, LOC-002, LOC-003)
  app.get("/", controller.getLocations as any);
  app.get("/:id", controller.getLocationById as any);
  app.post(
    "/",
    { preHandler: [requireRole(["owner", "admin"])] },
    controller.createLocation as any
  );
  app.put(
    "/:id",
    { preHandler: [requireRole(["owner", "admin"])] },
    controller.updateLocation as any
  );
  app.delete(
    "/:id",
    { preHandler: [requireRole(["owner", "admin"])] },
    controller.deleteLocation as any
  );
  app.post(
    "/:id/assign-desk",
    { preHandler: [requireRole(["owner", "admin", "manager"])] },
    controller.assignDesk as any
  );
}

export default officeLocationRoutes;
