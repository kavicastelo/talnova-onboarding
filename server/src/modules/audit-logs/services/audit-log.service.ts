import AuditLogRepository, {
  AuditLogFilter,
  PaginationOptions,
} from "../repositories/audit-log.repository.js";
import mongoose from "mongoose";

export class AuditLogService {
  constructor(private readonly repository: AuditLogRepository) {}

  async logEvent(data: {
    organizationId: string | mongoose.Types.ObjectId;
    actorUserId?: string | mongoose.Types.ObjectId;
    actorType?: "user" | "system" | "api" | "scheduler";
    eventCategory:
      | "authentication"
      | "user"
      | "journey"
      | "assignment"
      | "content"
      | "organization"
      | "security"
      | "system";
    eventType: string;
    resourceType: string;
    resourceId?: string | mongoose.Types.ObjectId;
    action:
      | "create"
      | "update"
      | "delete"
      | "assign"
      | "complete"
      | "archive"
      | "restore"
      | "login"
      | "logout";
    description: string;
    metadata?: {
      previousValue?: any;
      newValue?: any;
      changes?: Record<string, any>;
    };
    request?: {
      ipAddress?: string;
      userAgent?: string;
      method?: string;
      endpoint?: string;
    };
    severity?: "info" | "warning" | "critical";
  }) {
    const auditLogData = {
      organizationId: new mongoose.Types.ObjectId(data.organizationId),
      actorUserId: data.actorUserId ? new mongoose.Types.ObjectId(data.actorUserId) : undefined,
      actorType: data.actorType || "user",
      eventCategory: data.eventCategory,
      eventType: data.eventType,
      resourceType: data.resourceType,
      resourceId: data.resourceId ? new mongoose.Types.ObjectId(data.resourceId) : undefined,
      action: data.action,
      description: data.description,
      metadata: data.metadata,
      request: data.request,
      severity: data.severity || "info",
    };

    return this.repository.create(auditLogData as any);
  }

  async getLogs(filter: AuditLogFilter, pagination: PaginationOptions) {
    return this.repository.find(filter, pagination);
  }

  async getLogDetails(id: string | mongoose.Types.ObjectId, orgId: string | mongoose.Types.ObjectId) {
    return this.repository.findById(id, orgId);
  }

  async exportLogs(filter: AuditLogFilter) {
    // Export fetches all matching documents (limit to 10000 logs max for safety)
    const result = await this.repository.find(filter, { page: 1, limit: 10000 });
    
    // Return formatted JSON or parse to CSV string helper
    return result.logs.map(log => ({
      timestamp: log.createdAt,
      category: log.eventCategory,
      type: log.eventType,
      actor: log.actorUserId ? log.actorUserId.toString() : "system",
      action: log.action,
      resource: `${log.resourceType}:${log.resourceId ? log.resourceId.toString() : ""}`,
      description: log.description,
      severity: log.severity,
      ip: log.request?.ipAddress || "",
      userAgent: log.request?.userAgent || "",
    }));
  }
}

export default AuditLogService;
