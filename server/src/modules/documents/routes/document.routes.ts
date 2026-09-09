import { FastifyInstance } from "fastify";
import { DocumentController } from "../controllers/document.controller.js";
import { DocumentService } from "../services/document.service.js";
import { authenticate, requireRole } from "../../../middleware/auth.middleware.js";
import {
  createTemplateSchema,
  updateTemplateSchema,
  assignDocumentSchema,
  signDocumentSchema,
} from "../schemas/document.schema.js";

export async function documentRoutes(app: FastifyInstance) {
  const service = new DocumentService();
  const controller = new DocumentController(service);

  // Authenticate all routes
  app.addHook("preHandler", authenticate);

  // Template Routes (Admin / Owner)
  app.post(
    "/templates",
    {
      preHandler: [requireRole(["owner", "admin"])],
      schema: { body: createTemplateSchema },
    },
    controller.createTemplate as any
  );

  // Alias POST /api/v1/documents -> createTemplate
  app.post(
    "/",
    {
      preHandler: [requireRole(["owner", "admin"])],
      schema: { body: createTemplateSchema },
    },
    controller.createTemplate as any
  );

  app.get(
    "/templates",
    { preHandler: [requireRole(["owner", "admin", "manager"])] },
    controller.listTemplates as any
  );

  // Alias GET /api/v1/documents -> listTemplates
  app.get(
    "/",
    { preHandler: [requireRole(["owner", "admin", "manager"])] },
    controller.listTemplates as any
  );

  app.put(
    "/templates/:id",
    {
      preHandler: [requireRole(["owner", "admin"])],
      schema: { body: updateTemplateSchema },
    },
    controller.updateTemplate as any
  );

  // Alias PATCH /api/v1/documents/:id -> updateTemplate
  app.patch(
    "/:id",
    {
      preHandler: [requireRole(["owner", "admin"])],
      schema: { body: updateTemplateSchema },
    },
    controller.updateTemplate as any
  );

  app.delete(
    "/templates/:id",
    { preHandler: [requireRole(["owner", "admin"])] },
    controller.deleteTemplate as any
  );

  // Template Audit Trail Signatures (Admin / Owner / Manager)
  app.get(
    "/templates/:id/signatures",
    { preHandler: [requireRole(["owner", "admin", "manager"])] },
    controller.getTemplateSignatures as any
  );

  app.get(
    "/:id/signatures",
    { preHandler: [requireRole(["owner", "admin", "manager"])] },
    controller.getTemplateSignatures as any
  );

  // Assignment Routes (Admin / Owner)
  app.post(
    "/assign",
    {
      preHandler: [requireRole(["owner", "admin"])],
      schema: { body: assignDocumentSchema },
    },
    controller.assignDocument as any
  );

  // Employee Inbox & Signing Routes (Any Authenticated User)
  app.get("/inbox", controller.getEmployeeInbox as any);
  app.get("/:id", controller.getDocumentAssignment as any);
  app.post(
    "/:id/sign",
    { schema: { body: signDocumentSchema } },
    controller.signDocument as any
  );
}

export default documentRoutes;
