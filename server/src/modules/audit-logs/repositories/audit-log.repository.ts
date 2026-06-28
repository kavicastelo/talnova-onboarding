import { AuditLog, IAuditLog } from "../models/audit-log.model.js";
import mongoose from "mongoose";

export interface AuditLogFilter {
  organizationId: string | mongoose.Types.ObjectId;
  actorUserId?: string | mongoose.Types.ObjectId;
  eventCategory?: string;
  eventType?: string;
  resourceType?: string;
  resourceId?: string | mongoose.Types.ObjectId;
  severity?: "info" | "warning" | "critical";
  startDate?: Date;
  endDate?: Date;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export class AuditLogRepository {
  async create(auditLogData: Partial<IAuditLog>): Promise<IAuditLog> {
    const log = new AuditLog(auditLogData);
    return log.save();
  }

  async findById(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId
  ): Promise<IAuditLog | null> {
    return AuditLog.findOne({ _id: id, organizationId: orgId });
  }

  async find(
    filter: AuditLogFilter,
    pagination: PaginationOptions
  ): Promise<{ logs: IAuditLog[]; total: number }> {
    const query: Record<string, any> = {
      organizationId: new mongoose.Types.ObjectId(filter.organizationId),
    };

    if (filter.actorUserId) {
      query.actorUserId = new mongoose.Types.ObjectId(filter.actorUserId);
    }
    if (filter.eventCategory) {
      query.eventCategory = filter.eventCategory;
    }
    if (filter.eventType) {
      query.eventType = filter.eventType;
    }
    if (filter.resourceType) {
      query.resourceType = filter.resourceType;
    }
    if (filter.resourceId) {
      query.resourceId = new mongoose.Types.ObjectId(filter.resourceId);
    }
    if (filter.severity) {
      query.severity = filter.severity;
    }

    if (filter.startDate || filter.endDate) {
      query.createdAt = {};
      if (filter.startDate) {
        query.createdAt.$gte = filter.startDate;
      }
      if (filter.endDate) {
        query.createdAt.$lte = filter.endDate;
      }
    }

    const total = await AuditLog.countDocuments(query);

    const page = Math.max(1, pagination.page);
    const limit = Math.max(1, pagination.limit);
    const skip = (page - 1) * limit;

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return { logs, total };
  }
}

export default AuditLogRepository;
