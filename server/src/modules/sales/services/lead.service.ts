import mongoose from "mongoose";
import Lead, { ILead } from "../models/lead.model.js";
import AuditLog from "../../audit-logs/models/audit-log.model.js";
import AppError from "../../../common/errors/app-error.js";
import { normalizeEmail, normalizePhone } from "../utils/normalize.js";
import {
  CreateLeadInput,
  UpdateLeadInput,
  UpdateLeadStatusInput,
  LeadQueryParams,
} from "../schemas/lead.schemas.js";
import { PaginatedResponse } from "../types/sales.types.js";
import { validateLifecycleTransition } from "./lead-scoring.service.js";

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

export class LeadService {
  /**
   * Retrieve paginated, filtered, and searchable leads
   */
  public async getLeads(params: LeadQueryParams): Promise<PaginatedResponse<ILead>> {
    const filter: Record<string, any> = {};

    // 1. Text search across name, email, normalizedEmail, companyName, and phone
    if (params.search && params.search.trim()) {
      const searchRegex = new RegExp(escapeRegex(params.search.trim()), "i");
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { normalizedEmail: searchRegex },
        { companyName: searchRegex },
        { phone: searchRegex },
        { normalizedPhone: searchRegex },
      ];
    }

    // 2. Status filter (supports single or comma-separated list)
    if (params.status) {
      const statuses = params.status.split(",").map((s) => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        filter.status = statuses[0];
      } else if (statuses.length > 1) {
        filter.status = { $in: statuses };
      }
    }

    // 3. Source filter (supports single or comma-separated list)
    if (params.source) {
      const sources = params.source.split(",").map((s) => s.trim()).filter(Boolean);
      if (sources.length === 1) {
        filter.source = sources[0];
      } else if (sources.length > 1) {
        filter.source = { $in: sources };
      }
    }

    // 4. Assigned owner filter
    if (params.ownerId) {
      if (mongoose.Types.ObjectId.isValid(params.ownerId)) {
        filter.assignedOwnerId = new mongoose.Types.ObjectId(params.ownerId);
      }
    }

    // 5. Priority filter
    if (params.priority) {
      const priorities = params.priority.split(",").map((p) => p.trim()).filter(Boolean);
      if (priorities.length === 1) {
        filter.priority = priorities[0];
      } else if (priorities.length > 1) {
        filter.priority = { $in: priorities };
      }
    }

    // 6. Score range filter
    if (params.minScore !== undefined || params.maxScore !== undefined) {
      filter.score = {};
      if (params.minScore !== undefined) filter.score.$gte = params.minScore;
      if (params.maxScore !== undefined) filter.score.$lte = params.maxScore;
    }

    // 7. Date range filter (based on createdAt)
    if (params.startDate || params.endDate) {
      filter.createdAt = {};
      if (params.startDate) filter.createdAt.$gte = new Date(params.startDate);
      if (params.endDate) filter.createdAt.$lte = new Date(params.endDate);
    }

    // Sorting
    const sortField = params.sortBy || "createdAt";
    const sortOrder = params.sortOrder === "asc" ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortOrder };

    // Pagination bounds
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 25));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Lead.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("assignedOwnerId", "name email role")
        .lean(),
      Lead.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: items as unknown as ILead[],
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Find single lead by ID
   */
  public async getLeadById(id: string): Promise<ILead> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "INVALID_ID", `Invalid lead ID: ${id}`);
    }

    const lead = await Lead.findById(id).populate("assignedOwnerId", "name email role");
    if (!lead) {
      throw new AppError(404, "LEAD_NOT_FOUND", `Lead with ID ${id} not found`);
    }

    return lead;
  }

  /**
   * Create a new sales lead with audit logging
   */
  public async createLead(input: CreateLeadInput, actorUserId?: string): Promise<ILead> {
    const normalizedEmail = normalizeEmail(input.email);
    const normalizedPhone = normalizePhone(input.phone);

    const leadData: Record<string, any> = {
      ...input,
      normalizedEmail,
      normalizedPhone,
    };

    if (input.assignedOwnerId && mongoose.Types.ObjectId.isValid(input.assignedOwnerId)) {
      leadData.assignedOwnerId = new mongoose.Types.ObjectId(input.assignedOwnerId);
    }

    const lead = await Lead.create(leadData);

    // Audit Log record
    try {
      await AuditLog.create({
        actorUserId: actorUserId && mongoose.Types.ObjectId.isValid(actorUserId)
          ? new mongoose.Types.ObjectId(actorUserId)
          : undefined,
        actorType: actorUserId ? "user" : "system",
        eventCategory: "admin",
        eventType: "LEAD_CREATED",
        resourceType: "sales_lead",
        resourceId: lead._id,
        action: "create",
        description: `Created lead ${lead.name} (${lead.companyName})`,
        metadata: {
          leadId: lead._id,
          email: lead.email,
          companyName: lead.companyName,
          source: lead.source,
        },
        severity: "info",
      });
    } catch {}

    return lead;
  }

  /**
   * Update lead fields with audit logging
   */
  public async updateLead(
    id: string,
    updates: UpdateLeadInput,
    actorUserId?: string
  ): Promise<ILead> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "INVALID_ID", `Invalid lead ID: ${id}`);
    }

    const lead = await Lead.findById(id);
    if (!lead) {
      throw new AppError(404, "LEAD_NOT_FOUND", `Lead with ID ${id} not found`);
    }

    if (updates.status && updates.status !== lead.status) {
      validateLifecycleTransition(lead.status, updates.status);
    }

    const updateData: Record<string, any> = { ...updates };
    if (updates.email) {
      updateData.normalizedEmail = normalizeEmail(updates.email);
    }
    if (updates.phone !== undefined) {
      updateData.normalizedPhone = normalizePhone(updates.phone);
    }
    if (updates.assignedOwnerId) {
      if (mongoose.Types.ObjectId.isValid(updates.assignedOwnerId)) {
        updateData.assignedOwnerId = new mongoose.Types.ObjectId(updates.assignedOwnerId);
      }
    }

    const updated = await Lead.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    try {
      await AuditLog.create({
        actorUserId: actorUserId && mongoose.Types.ObjectId.isValid(actorUserId)
          ? new mongoose.Types.ObjectId(actorUserId)
          : undefined,
        actorType: actorUserId ? "user" : "system",
        eventCategory: "admin",
        eventType: "LEAD_UPDATED",
        resourceType: "sales_lead",
        resourceId: lead._id,
        action: "update",
        description: `Updated lead ${lead.name}`,
        metadata: {
          leadId: lead._id,
          changes: updates,
        },
        severity: "info",
      });
    } catch {}

    return updated!;
  }

  /**
   * Update lead lifecycle status with audit logging
   */
  public async updateLeadStatus(
    id: string,
    statusInput: UpdateLeadStatusInput,
    actorUserId?: string
  ): Promise<ILead> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "INVALID_ID", `Invalid lead ID: ${id}`);
    }

    const lead = await Lead.findById(id);
    if (!lead) {
      throw new AppError(404, "LEAD_NOT_FOUND", `Lead with ID ${id} not found`);
    }

    const previousStatus = lead.status;
    validateLifecycleTransition(previousStatus, statusInput.status);
    lead.status = statusInput.status;

    if (statusInput.disqualificationReason !== undefined) {
      lead.disqualificationReason = statusInput.disqualificationReason;
    }

    if (statusInput.note) {
      lead.notes.push({
        content: statusInput.note,
        createdBy: actorUserId && mongoose.Types.ObjectId.isValid(actorUserId)
          ? new mongoose.Types.ObjectId(actorUserId)
          : undefined,
        createdAt: new Date(),
      });
    }

    await lead.save();

    try {
      await AuditLog.create({
        actorUserId: actorUserId && mongoose.Types.ObjectId.isValid(actorUserId)
          ? new mongoose.Types.ObjectId(actorUserId)
          : undefined,
        actorType: actorUserId ? "user" : "system",
        eventCategory: "admin",
        eventType: "LEAD_STATUS_CHANGED",
        resourceType: "sales_lead",
        resourceId: lead._id,
        action: "status_change",
        description: `Lead status changed from ${previousStatus} to ${statusInput.status}`,
        metadata: {
          leadId: lead._id,
          previousValue: previousStatus,
          newValue: statusInput.status,
          reason: statusInput.disqualificationReason,
        },
        severity: "info",
      });
    } catch {}

    return lead;
  }

  /**
   * Delete lead by ID
   */
  public async deleteLead(id: string, actorUserId?: string): Promise<{ success: boolean; id: string }> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "INVALID_ID", `Invalid lead ID: ${id}`);
    }

    const lead = await Lead.findById(id);
    if (!lead) {
      throw new AppError(404, "LEAD_NOT_FOUND", `Lead with ID ${id} not found`);
    }

    await Lead.findByIdAndDelete(id);

    try {
      await AuditLog.create({
        actorUserId: actorUserId && mongoose.Types.ObjectId.isValid(actorUserId)
          ? new mongoose.Types.ObjectId(actorUserId)
          : undefined,
        actorType: actorUserId ? "user" : "system",
        eventCategory: "admin",
        eventType: "LEAD_DELETED",
        resourceType: "sales_lead",
        resourceId: lead._id,
        action: "delete",
        description: `Deleted lead ${lead.name} (${lead.email})`,
        metadata: {
          leadId: lead._id,
          email: lead.email,
          companyName: lead.companyName,
        },
        severity: "warning",
      });
    } catch {}

    return { success: true, id };
  }

  /**
   * Add a note to a lead
   */
  public async addNote(id: string, content: string, actorUserId?: string): Promise<ILead> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "INVALID_ID", `Invalid lead ID: ${id}`);
    }

    const lead = await Lead.findById(id);
    if (!lead) {
      throw new AppError(404, "LEAD_NOT_FOUND", `Lead with ID ${id} not found`);
    }

    lead.notes.push({
      content,
      createdBy: actorUserId && mongoose.Types.ObjectId.isValid(actorUserId)
        ? new mongoose.Types.ObjectId(actorUserId)
        : undefined,
      createdAt: new Date(),
    });

    await lead.save();
    return lead;
  }
}

export default LeadService;
