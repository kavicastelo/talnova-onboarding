import { FastifyInstance } from "fastify";
import { authenticate, requireRole } from "../../../middleware/auth.middleware.js";
import { SuperAdminService } from "../services/super-admin.service.js";
import { SuperAdminController } from "../controllers/super-admin.controller.js";

export async function superAdminRoutes(app: FastifyInstance) {
  // Enforce auth & super_admin role for all routes in this prefix
  app.addHook("onRequest", authenticate);
  app.addHook("onRequest", requireRole(["super_admin"]));

  const superAdminService = new SuperAdminService();
  const controller = new SuperAdminController(superAdminService);

  // 1. Search & Telemetry
  app.get("/search", controller.searchGlobal);
  app.get("/telemetry", controller.getTelemetry);
  app.get("/activity-logs", controller.getActivityLogs);
  app.get("/stats", controller.getStats);

  // 2. Organizations
  app.get("/organizations", controller.getOrganizations);
  app.post("/organizations", controller.createOrganization);
  app.patch("/organizations/:id/status", controller.updateOrganizationStatus);
  app.patch("/organizations/:id", controller.updateOrganization);
  app.get("/organizations/:id/360", controller.getOrganization360);
  app.post("/organizations/:id/quarantine", controller.quarantineOrganization);

  // 3. Users & Sessions
  app.get("/users", controller.getUsers);
  app.get("/users/:id/360", controller.getUser360);
  app.patch("/users/:id", controller.updateUser);
  app.post("/users/:id/force-logout", controller.forceLogoutUser);
  app.get("/sessions", controller.getSessions);
  app.post("/sessions/:sessionId/revoke", controller.revokeSession);

  // 4. Invoices & Finance
  app.get("/invoices", controller.getInvoices);
  app.get("/invoices/:id", controller.getInvoiceById);
  app.post("/invoices", controller.createInvoice);
  app.get("/invoices/export", controller.exportInvoices);
  app.get("/finance", controller.getFinance);
  app.get("/finance/export", controller.exportFinance);
  app.get("/finance/payments", controller.getPayments);
  app.post("/finance/payments", controller.recordPayment);
  app.get("/finance/expenses", controller.getExpenses);
  app.post("/finance/expenses", controller.recordExpense);
  app.get("/finance/accounts", controller.getCustomerAccounts);
  app.patch("/finance/accounts/:id", controller.updateCustomerAccount);

  // 5. Operations & Observability
  app.get("/onboarding/cases", controller.getOnboardingCases);
  app.get("/tasks-ops", controller.getTasksOps);
  app.get("/activity", controller.getActivity);
  app.get("/observability/api", controller.getApiObservability);
  app.get("/observability/infrastructure", controller.getInfrastructureObservability);
  app.get("/observability/ai", controller.getAiObservability);
  app.get("/ai/usage", controller.getAiUsage);
  app.get("/observability/storage", controller.getStorageObservability);

  // 6. Settings, Flags, Alerts & Reports
  app.get("/settings/flags", controller.getFlags);
  app.post("/settings/flags", controller.createFlag);
  app.patch("/settings/flags/:key", controller.updateFlag);
  app.get("/alerts", controller.getAlerts);
  app.patch("/alerts/:id/status", controller.updateAlertStatus);
  app.get("/reports/:reportId/export", controller.exportReport);
  app.get("/settings/platform", controller.getPlatformSettings);
  app.patch("/settings/platform", controller.updatePlatformSettings);
}

export default superAdminRoutes;
