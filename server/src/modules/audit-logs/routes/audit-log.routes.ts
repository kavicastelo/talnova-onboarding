import { FastifyInstance } from "fastify";
import { AuditLogController } from "../controllers/audit-log.controller.js";
import { AuditLogService } from "../services/audit-log.service.js";
import { AuditLogRepository } from "../repositories/audit-log.repository.js";
import { authenticate, requireRole } from "../../../middleware/auth.middleware.js";

export async function auditLogRoutes(app: FastifyInstance) {
  const repository = new AuditLogRepository();
  const service = new AuditLogService(repository);
  const controller = new AuditLogController(service);

  // Authenticate and restrict all audit log endpoints to owners and admins only
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole(["owner", "admin"]));

  // GET /api/v1/audit-logs/export
  app.get("/export", controller.exportLogs as any);

  // GET /api/v1/audit-logs/security
  app.get("/security", controller.getSecurityLogs as any);

  // GET /api/v1/audit-logs/user/:userId
  app.get("/user/:userId", controller.getUserLogs as any);

  // GET /api/v1/audit-logs/resource/:resourceType/:resourceId
  app.get("/resource/:resourceType/:resourceId", controller.getResourceLogs as any);

  // GET /api/v1/audit-logs/:id
  app.get("/:id", controller.getLogDetails as any);

  // GET /api/v1/audit-logs
  app.get("/", controller.listLogs as any);
}

export default auditLogRoutes;
