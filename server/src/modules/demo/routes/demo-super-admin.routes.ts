import { FastifyInstance } from "fastify";
import { demoSuperAdminController } from "../controllers/demo-super-admin.controller.js";
import { authenticate, requireRole } from "../../../middleware/auth.middleware.js";

export async function demoSuperAdminRoutes(app: FastifyInstance) {
  // All demo management endpoints require super_admin authentication on the main platform
  app.addHook("onRequest", authenticate);
  app.addHook("onRequest", requireRole(["super_admin"]));

  // Telemetry & Overview
  app.get("/overview", demoSuperAdminController.getOverview);
  app.get("/telemetry/analytics", demoSuperAdminController.getTelemetryAnalytics);

  // Demo Companies / Tenants
  app.get("/companies", demoSuperAdminController.getCompanies);
  app.post("/companies", demoSuperAdminController.createCompany);
  app.patch("/companies/:id", demoSuperAdminController.updateCompany);

  // Attributable Demo Users
  app.get("/users", demoSuperAdminController.getUsers);
  app.post("/users", demoSuperAdminController.createUser);
  app.patch("/users/:id", demoSuperAdminController.updateUser);

  // Live Sessions & Termination
  app.get("/sessions", demoSuperAdminController.getSessions);
  app.post("/sessions/:sessionId/terminate", demoSuperAdminController.terminateSession);

  // Activity Explorer & Suspicious Signals
  app.get("/activity", demoSuperAdminController.getActivityLogs);
  app.get("/risk-alerts", demoSuperAdminController.getRiskAlerts);
  app.patch("/risk-alerts/:id/resolve", demoSuperAdminController.resolveRiskAlert);

  // Entitlements
  app.get("/entitlements", demoSuperAdminController.getEntitlements);

  // Reset Engine & History
  app.post("/reset", demoSuperAdminController.resetDemo);
  app.get("/reset/history", demoSuperAdminController.getResetHistory);
}

export default demoSuperAdminRoutes;
