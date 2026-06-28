import { FastifyReply, FastifyRequest } from "fastify";
import { AuditLogService } from "../services/audit-log.service.js";

export class AuditLogController {
  constructor(private readonly service: AuditLogService) {}

  private getPagination(query: any) {
    return {
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 50,
    };
  }

  private parseDate(val?: string): Date | undefined {
    return val ? new Date(val) : undefined;
  }

  listLogs = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const query = request.query as any;

    const filter = {
      organizationId: user.organizationId,
      actorUserId: query.actorUserId,
      eventCategory: query.eventCategory,
      eventType: query.eventType,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      severity: query.severity,
      startDate: this.parseDate(query.startDate),
      endDate: this.parseDate(query.endDate),
    };

    const pagination = this.getPagination(query);
    const result = await this.service.getLogs(filter, pagination);

    return reply.status(200).send({
      success: true,
      message: "Audit logs retrieved successfully",
      data: result.logs,
      meta: {
        total: result.total,
        page: pagination.page,
        limit: pagination.limit,
      },
    });
  };

  getLogDetails = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    const log = await this.service.getLogDetails(params.id, user.organizationId);
    if (!log) {
      return reply.status(404).send({
        success: false,
        message: "Audit log not found",
      });
    }

    return reply.status(200).send({
      success: true,
      message: "Audit log details retrieved successfully",
      data: log,
    });
  };

  exportLogs = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const query = request.query as any;

    const filter = {
      organizationId: user.organizationId,
      actorUserId: query.actorUserId,
      eventCategory: query.eventCategory,
      severity: query.severity,
      startDate: this.parseDate(query.startDate),
      endDate: this.parseDate(query.endDate),
    };

    const exported = await this.service.exportLogs(filter);

    // Return JSON array or CSV text. Let's return CSV text if query format is csv, else JSON.
    if (query.format === "csv") {
      const headers = ["Timestamp", "Category", "Type", "Actor", "Action", "Resource", "Description", "Severity", "IP", "User Agent"];
      const rows = exported.map(log => [
        log.timestamp.toISOString(),
        log.category,
        log.type,
        log.actor,
        log.action,
        log.resource,
        `"${log.description.replace(/"/g, '""')}"`,
        log.severity,
        log.ip,
        `"${log.userAgent.replace(/"/g, '""')}"`
      ]);
      
      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      
      return reply
        .type("text/csv")
        .header("Content-Disposition", 'attachment; filename="audit_logs.csv"')
        .status(200)
        .send(csvContent);
    }

    return reply.status(200).send({
      success: true,
      message: "Logs exported successfully",
      data: exported,
    });
  };

  getSecurityLogs = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const query = request.query as any;

    const filter = {
      organizationId: user.organizationId,
      eventCategory: "security",
      severity: query.severity,
    };

    const pagination = this.getPagination(query);
    const result = await this.service.getLogs(filter, pagination);

    return reply.status(200).send({
      success: true,
      message: "Security logs retrieved successfully",
      data: result.logs,
      meta: {
        total: result.total,
        page: pagination.page,
        limit: pagination.limit,
      },
    });
  };

  getUserLogs = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const query = request.query as any;

    const filter = {
      organizationId: user.organizationId,
      actorUserId: params.userId,
    };

    const pagination = this.getPagination(query);
    const result = await this.service.getLogs(filter, pagination);

    return reply.status(200).send({
      success: true,
      message: "User logs retrieved successfully",
      data: result.logs,
      meta: {
        total: result.total,
        page: pagination.page,
        limit: pagination.limit,
      },
    });
  };

  getResourceLogs = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const query = request.query as any;

    const filter = {
      organizationId: user.organizationId,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
    };

    const pagination = this.getPagination(query);
    const result = await this.service.getLogs(filter, pagination);

    return reply.status(200).send({
      success: true,
      message: "Resource history retrieved successfully",
      data: result.logs,
      meta: {
        total: result.total,
        page: pagination.page,
        limit: pagination.limit,
      },
    });
  };
}

export default AuditLogController;
