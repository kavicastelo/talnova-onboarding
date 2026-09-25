import { FastifyRequest, FastifyReply } from "fastify";
import { SuperAdminService } from "../services/super-admin.service.js";
import { featureTelemetryService } from "../services/feature-telemetry.service.js";

export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  // ---------------------------------------------------------------------------
  // 1. Search & Telemetry
  // ---------------------------------------------------------------------------

  searchGlobal = async (request: FastifyRequest, reply: FastifyReply) => {
    const { q, limit = "10" } = request.query as any;
    const data = await this.superAdminService.searchGlobal(q, limit);
    return reply.status(200).send({
      success: true,
      message: "Search results retrieved",
      data,
    });
  };

  getTelemetry = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.superAdminService.getTelemetry(request.query);
    return reply.status(200).send({
      success: true,
      message: "Telemetry retrieved successfully",
      data,
    });
  };

  getFeatureAdoption = async (request: FastifyRequest, reply: FastifyReply) => {
    const { timeWindowDays = "30", featureKey } = request.query as any;
    const days = parseInt(timeWindowDays, 10) || 30;
    const data = await featureTelemetryService.getAdoptionSummary(days, featureKey);
    return reply.status(200).send({
      success: true,
      message: "Feature adoption telemetry retrieved successfully",
      data,
    });
  };

  getActivityLogs = async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.superAdminService.getActivityLogs();
    return reply.status(200).send({
      success: true,
      message: "Activity logs retrieved successfully",
      data,
    });
  };

  getStats = async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.superAdminService.getStats();
    return reply.status(200).send({
      success: true,
      data,
    });
  };

  // ---------------------------------------------------------------------------
  // 2. Organizations
  // ---------------------------------------------------------------------------

  getOrganizations = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.superAdminService.getOrganizations(request.query);
    return reply.status(200).send({
      success: true,
      message: "Organizations retrieved successfully",
      data,
    });
  };

  createOrganization = async (request: FastifyRequest, reply: FastifyReply) => {
    const actorUserId = (request.user as any)?.userId;
    const data = await this.superAdminService.createOrganization(
      request.body,
      actorUserId
    );
    return reply.status(201).send({
      success: true,
      message: "Organization provisioned successfully",
      data,
    });
  };

  updateOrganizationStatus = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const { id } = request.params as any;
    const { status } = request.body as any;
    const actorUserId = (request.user as any)?.userId;
    const data = await this.superAdminService.updateOrganizationStatus(
      id,
      status,
      actorUserId
    );
    return reply.status(200).send({
      success: true,
      message: "Organization status updated successfully",
      data,
    });
  };

  updateOrganization = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const actorUserId = (request.user as any)?.userId;
    const data = await this.superAdminService.updateOrganization(
      id,
      request.body,
      actorUserId
    );
    return reply.status(200).send({
      success: true,
      message: "Organization updated successfully",
      data,
    });
  };

  getOrganization360 = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const data = await this.superAdminService.getOrganization360(id);
    return reply.status(200).send({
      success: true,
      message: "Organization 360 profile retrieved successfully",
      data,
    });
  };

  quarantineOrganization = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const { id } = request.params as any;
    const { reason } = (request.body as any) || {};
    const actorUserId = (request.user as any)?.userId;
    const data = await this.superAdminService.quarantineOrganization(
      id,
      reason,
      actorUserId
    );
    return reply.status(200).send({
      success: true,
      message: "Tenant has been placed in quarantine",
      data,
    });
  };

  activateOrganization = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const { id } = request.params as any;
    const actorUserId = (request.user as any)?.userId;
    const data = await this.superAdminService.updateOrganizationStatus(
      id,
      "Active",
      actorUserId
    );
    return reply.status(200).send({
      success: true,
      message: "Tenant has been activated",
      data,
    });
  };

  // ---------------------------------------------------------------------------
  // 3. Users & Sessions
  // ---------------------------------------------------------------------------

  getUsers = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.superAdminService.getUsers(request.query);
    return reply.status(200).send({
      success: true,
      message: "Users retrieved successfully",
      data,
    });
  };

  getUser360 = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const data = await this.superAdminService.getUser360(id);
    return reply.status(200).send({
      success: true,
      message: "User 360 profile retrieved successfully",
      data,
    });
  };

  updateUser = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const actorUserId = (request.user as any)?.userId;
    const data = await this.superAdminService.updateUser(
      id,
      request.body,
      actorUserId
    );
    return reply.status(200).send({
      success: true,
      message: "User updated successfully",
      data,
    });
  };

  forceLogoutUser = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const actorUserId = (request.user as any)?.userId;
    const email = await this.superAdminService.forceLogoutUser(
      id,
      actorUserId
    );
    return reply.status(200).send({
      success: true,
      message: `All active sessions revoked for ${email}`,
    });
  };

  getSessions = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.superAdminService.getSessions(request.query);
    return reply.status(200).send({
      success: true,
      message: "Active sessions retrieved successfully",
      data,
    });
  };

  revokeSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const { sessionId } = request.params as any;
    const actorUserId = (request.user as any)?.userId;
    await this.superAdminService.revokeSession(sessionId, actorUserId);
    return reply.status(200).send({
      success: true,
      message: "Session revoked successfully",
    });
  };

  // ---------------------------------------------------------------------------
  // 4. Invoices & Finance
  // ---------------------------------------------------------------------------

  getInvoices = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.superAdminService.getInvoices(request.query);
    return reply.status(200).send({
      success: true,
      message: "Invoices retrieved successfully",
      data,
    });
  };

  getInvoiceById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const data = await this.superAdminService.getInvoiceById(id);
    return reply.status(200).send({
      success: true,
      message: "Invoice retrieved successfully",
      data,
    });
  };

  createInvoice = async (request: FastifyRequest, reply: FastifyReply) => {
    const actorUserId = (request.user as any)?.userId;
    const data = await this.superAdminService.createInvoice(
      request.body,
      actorUserId
    );
    return reply.status(201).send({
      success: true,
      message: "Invoice created successfully",
      data,
    });
  };

  exportInvoices = async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.header("Content-Type", "text/csv");
    reply.header(
      "Content-Disposition",
      'attachment; filename="billing-export.csv"'
    );
    const csv = await this.superAdminService.exportInvoicesCsv();
    return reply.status(200).send(csv);
  };

  getFinance = async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.superAdminService.getFinanceOverview();
    return reply.status(200).send({
      success: true,
      message: "Financial metrics retrieved successfully",
      data,
    });
  };

  exportFinance = async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.header("Content-Type", "text/csv");
    reply.header(
      "Content-Disposition",
      'attachment; filename="finance-summary.csv"'
    );
    const csv = await this.superAdminService.exportFinanceCsv();
    return reply.status(200).send(csv);
  };

  getPayments = async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.superAdminService.getPayments();
    return reply.status(200).send({
      success: true,
      message: "Payment receipts retrieved",
      data,
    });
  };

  recordPayment = async (request: FastifyRequest, reply: FastifyReply) => {
    const actorUserId = (request.user as any)?.userId;
    const actorUserEmail = (request.user as any)?.email;
    const data = await this.superAdminService.recordPayment(
      request.body,
      actorUserId,
      actorUserEmail
    );
    return reply.status(201).send({
      success: true,
      message: "Payment recorded successfully",
      data,
    });
  };

  getExpenses = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.superAdminService.getExpenses(request.query);
    return reply.status(200).send({
      success: true,
      message: "Expenses retrieved",
      data,
    });
  };

  recordExpense = async (request: FastifyRequest, reply: FastifyReply) => {
    const actorUserId = (request.user as any)?.userId;
    const actorUserEmail = (request.user as any)?.email;
    const data = await this.superAdminService.recordExpense(
      request.body,
      actorUserId,
      actorUserEmail
    );
    return reply.status(201).send({
      success: true,
      message: "Expense recorded successfully",
      data,
    });
  };

  getCustomerAccounts = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const { results, total } = await this.superAdminService.getCustomerAccounts(
      request.query
    );
    return reply.status(200).send({
      success: true,
      message: "Customer accounts retrieved successfully",
      data: results,
      total,
    });
  };

  updateCustomerAccount = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const { id } = request.params as any;
    const actorUserId = (request.user as any)?.userId;
    const actorUserEmail = (request.user as any)?.email;
    const data = await this.superAdminService.updateCustomerAccount(
      id,
      request.body,
      actorUserId,
      actorUserEmail
    );
    return reply.status(200).send({
      success: true,
      message: "Customer account updated successfully",
      data,
    });
  };

  // ---------------------------------------------------------------------------
  // 5. Operations & Observability
  // ---------------------------------------------------------------------------

  getOnboardingCases = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const data = await this.superAdminService.getOnboardingCases(
      request.query
    );
    return reply.status(200).send({
      success: true,
      message: "Onboarding cases retrieved successfully",
      data,
    });
  };

  getTasksOps = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.superAdminService.getTasksOps(request.query);
    return reply.status(200).send({
      success: true,
      message: "Operations tasks retrieved successfully",
      data,
    });
  };

  getActivity = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.superAdminService.getActivity(request.query);
    return reply.status(200).send({
      success: true,
      message: "Activity events retrieved successfully",
      data,
    });
  };

  getApiObservability = async (
    _request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const data = this.superAdminService.getApiObservability();
    return reply.status(200).send({
      success: true,
      message: "API telemetry metrics retrieved",
      data,
    });
  };

  getInfrastructureObservability = async (
    _request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const data = await this.superAdminService.getInfrastructureObservability();
    return reply.status(200).send({
      success: true,
      message: "Infrastructure telemetry retrieved",
      data,
    });
  };

  getAiObservability = async (
    _request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const data = await this.superAdminService.getAiObservability();
    return reply.status(200).send({
      success: true,
      message: "AI telemetry retrieved",
      data,
    });
  };

  getAiUsage = async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await this.superAdminService.getAiUsage(request.query);
    return reply.status(200).send({
      success: true,
      message: "AI invocation logs retrieved",
      data: {
        items: result.items,
        pagination: result.pagination,
      },
      items: result.items,
      pagination: result.pagination,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  };

  getStorageObservability = async (
    _request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const data = await this.superAdminService.getStorageObservability();
    return reply.status(200).send({
      success: true,
      message: "Storage telemetry retrieved",
      data,
    });
  };

  // ---------------------------------------------------------------------------
  // 6. Settings, Flags, Alerts & Reports
  // ---------------------------------------------------------------------------

  getFlags = async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.superAdminService.getFlags();
    return reply.status(200).send({
      success: true,
      message: "Feature flags retrieved",
      data,
    });
  };

  createFlag = async (request: FastifyRequest, reply: FastifyReply) => {
    const actorUserId = (request.user as any)?.userId;
    const data = await this.superAdminService.createFlag(
      request.body,
      actorUserId
    );
    const key = (request.body as any)?.key?.trim().toLowerCase();
    return reply.status(201).send({
      success: true,
      message: `Feature flag ${key} registered successfully`,
      data,
    });
  };

  updateFlag = async (request: FastifyRequest, reply: FastifyReply) => {
    const { key } = request.params as any;
    const actorUserId = (request.user as any)?.userId;
    const data = await this.superAdminService.updateFlag(
      key,
      request.body,
      actorUserId
    );
    const normalizedKey = (key || "").trim().toLowerCase();
    return reply.status(200).send({
      success: true,
      message: `Feature flag ${normalizedKey} updated successfully`,
      data,
    });
  };

  getOrganizationFlags = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const data = await this.superAdminService.getOrganizationFlags(id);
    return reply.status(200).send({
      success: true,
      message: "Organization feature flags retrieved successfully",
      data,
    });
  };

  updateOrganizationFlag = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, key } = request.params as { id: string; key: string };
    const { override, reason } = (request.body as any) || {};
    const actorUserId = (request.user as any)?.userId;
    const data = await this.superAdminService.updateOrganizationFlagOverride(
      id,
      key,
      override,
      actorUserId,
      reason
    );
    return reply.status(200).send({
      success: true,
      message: `Organization override for '${key}' set to '${override}'`,
      data,
    });
  };

  batchUpdateOrganizationFlags = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { updates, reason } = (request.body as any) || {};
    const actorUserId = (request.user as any)?.userId;
    const data = await this.superAdminService.batchUpdateOrganizationFlags(
      id,
      updates,
      actorUserId,
      reason
    );
    return reply.status(200).send({
      success: true,
      message: "Organization feature flags batch updated successfully",
      data,
    });
  };

  getAlerts = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.superAdminService.getAlerts(request.query);
    return reply.status(200).send({
      success: true,
      message: "System alerts retrieved",
      data,
    });
  };

  updateAlertStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { status } = (request.body || {}) as { status: string };
    const actorUserId = (request.user as any)?.userId;

    try {
      const data = await this.superAdminService.updateAlertStatus(
        id,
        request.body,
        actorUserId
      );
      return reply.status(200).send({
        success: true,
        message: `Alert status updated to '${status}' successfully`,
        data,
      });
    } catch (err: any) {
      if (
        err.statusCode === 400 ||
        err.message === "Alert is already resolved"
      ) {
        return reply.status(400).send({
          success: false,
          message: err.message,
        });
      }
      if (err.statusCode === 404) {
        return reply.status(404).send({
          success: false,
          message: err.message,
        });
      }
      throw err;
    }
  };

  exportReport = async (request: FastifyRequest, reply: FastifyReply) => {
    const { reportId } = request.params as { reportId: string };
    const { format } = (request.query || {}) as { format?: string };
    const actorUserId = (request.user as any)?.userId;

    try {
      const generated = await this.superAdminService.exportReport(
        reportId,
        format,
        actorUserId
      );
      reply.header("Content-Type", generated.contentType);
      reply.header(
        "Content-Disposition",
        `attachment; filename="${generated.filename}"`
      );
      return reply.status(200).send(generated.content);
    } catch (err: any) {
      if (err.statusCode === 404) {
        return reply.status(404).send({
          success: false,
          message: err.message,
        });
      }
      throw err;
    }
  };

  getPlatformSettings = async (
    _request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const data = await this.superAdminService.getPlatformSettings();
    return reply.status(200).send({
      success: true,
      data,
    });
  };

  updatePlatformSettings = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const actorUserId = (request.user as any)?.userId;
    const data = await this.superAdminService.updatePlatformSettings(
      request.body,
      actorUserId
    );
    return reply.status(200).send({
      success: true,
      message: "Platform settings updated successfully",
      data,
    });
  };
}

export default SuperAdminController;
