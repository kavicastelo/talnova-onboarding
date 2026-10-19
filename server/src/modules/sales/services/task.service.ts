import mongoose, { FilterQuery } from "mongoose";
import SalesTask, { ISalesTask } from "../models/task.model.js";
import Lead from "../models/lead.model.js";
import Contact from "../models/contact.model.js";
import Company from "../models/company.model.js";
import Deal from "../models/deal.model.js";
import User from "../../auth/models/user.model.js";
import AuditLog from "../../audit-logs/models/audit-log.model.js";
import AppError from "../../../common/errors/app-error.js";
import {
  CreateTaskInput,
  UpdateTaskInput,
  CompleteTaskInput,
  TaskQueryParams,
  CalendarQueryParams,
} from "../schemas/task.schemas.js";

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

export class TaskService {
  private async logAudit(params: {
    actorId?: string;
    action: "create" | "update" | "delete" | "complete";
    eventType: string;
    resourceId?: mongoose.Types.ObjectId;
    description: string;
    metadata?: Record<string, any>;
    severity?: "info" | "warning" | "critical";
  }): Promise<void> {
    try {
      await AuditLog.create({
        actorUserId:
          params.actorId && mongoose.Types.ObjectId.isValid(params.actorId)
            ? new mongoose.Types.ObjectId(params.actorId)
            : undefined,
        actorType: params.actorId ? ("user" as const) : ("system" as const),
        eventCategory: "admin" as const,
        eventType: params.eventType,
        resourceType: "sales_task",
        resourceId: params.resourceId,
        action: params.action,
        description: params.description,
        metadata: params.metadata,
        severity: params.severity || ("info" as const),
      });
    } catch {
      // Do not fail operation if audit log recording fails
    }
  }

  /**
   * Validate polymorphic linkages (lead, contact, company, deal, assignedTo)
   */
  private async validateLinkages(input: {
    leadId?: string | null;
    contactId?: string | null;
    companyId?: string | null;
    dealId?: string | null;
    assignedTo?: string | null;
  }): Promise<void> {
    if (input.leadId) {
      if (!mongoose.Types.ObjectId.isValid(input.leadId)) {
        throw new AppError(400, "INVALID_LEAD_ID", "Provided lead ID is invalid");
      }
      const lead = await Lead.findById(input.leadId);
      if (!lead) {
        throw new AppError(404, "LEAD_NOT_FOUND", "Associated lead not found");
      }
    }

    if (input.contactId) {
      if (!mongoose.Types.ObjectId.isValid(input.contactId)) {
        throw new AppError(400, "INVALID_CONTACT_ID", "Provided contact ID is invalid");
      }
      const contact = await Contact.findById(input.contactId);
      if (!contact) {
        throw new AppError(404, "CONTACT_NOT_FOUND", "Associated contact not found");
      }
    }

    if (input.companyId) {
      if (!mongoose.Types.ObjectId.isValid(input.companyId)) {
        throw new AppError(400, "INVALID_COMPANY_ID", "Provided company ID is invalid");
      }
      const company = await Company.findById(input.companyId);
      if (!company) {
        throw new AppError(404, "COMPANY_NOT_FOUND", "Associated company not found");
      }
    }

    if (input.dealId) {
      if (!mongoose.Types.ObjectId.isValid(input.dealId)) {
        throw new AppError(400, "INVALID_DEAL_ID", "Provided deal ID is invalid");
      }
      const deal = await Deal.findById(input.dealId);
      if (!deal) {
        throw new AppError(404, "DEAL_NOT_FOUND", "Associated deal not found");
      }
    }

    if (input.assignedTo) {
      if (!mongoose.Types.ObjectId.isValid(input.assignedTo)) {
        throw new AppError(400, "INVALID_USER_ID", "Assigned user ID is invalid");
      }
      const user = await User.findById(input.assignedTo);
      if (!user) {
        throw new AppError(404, "USER_NOT_FOUND", "Assigned user not found");
      }
    }
  }

  /**
   * Create a new sales task
   */
  public async createTask(input: CreateTaskInput, actorId?: string): Promise<ISalesTask> {
    await this.validateLinkages({
      leadId: input.leadId,
      contactId: input.contactId,
      companyId: input.companyId,
      dealId: input.dealId,
      assignedTo: input.assignedTo,
    });

    const task = new SalesTask({
      title: input.title,
      description: input.description,
      type: input.type || "follow_up",
      priority: input.priority || "normal",
      status: "pending",
      dueDate: new Date(input.dueDate),
      assignedTo: input.assignedTo ? new mongoose.Types.ObjectId(input.assignedTo) : undefined,
      leadId: input.leadId ? new mongoose.Types.ObjectId(input.leadId) : undefined,
      contactId: input.contactId ? new mongoose.Types.ObjectId(input.contactId) : undefined,
      companyId: input.companyId ? new mongoose.Types.ObjectId(input.companyId) : undefined,
      dealId: input.dealId ? new mongoose.Types.ObjectId(input.dealId) : undefined,
    });

    await task.save();

    await this.logAudit({
      actorId,
      action: "create",
      eventType: "TASK_CREATED",
      resourceId: task._id,
      description: `Created sales task: ${task.title} (${task.type})`,
      metadata: {
        taskId: task._id,
        title: task.title,
        type: task.type,
        priority: task.priority,
        dueDate: task.dueDate,
        assignedTo: task.assignedTo,
      },
    });

    return task;
  }

  /**
   * List tasks with comprehensive filtering, status/due date partitioning, and pagination
   */
  public async getTasks(params: TaskQueryParams) {
    const filter: FilterQuery<ISalesTask> = {};

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (params.search && params.search.trim()) {
      const escaped = escapeRegex(params.search.trim());
      filter.$or = [
        { title: { $regex: escaped, $options: "i" } },
        { description: { $regex: escaped, $options: "i" } },
        { outcomeNotes: { $regex: escaped, $options: "i" } },
      ];
    }

    if (params.type) filter.type = params.type;
    if (params.status) filter.status = params.status;
    if (params.priority) filter.priority = params.priority;

    if (params.assignedTo && mongoose.Types.ObjectId.isValid(params.assignedTo)) {
      filter.assignedTo = new mongoose.Types.ObjectId(params.assignedTo);
    }
    if (params.leadId && mongoose.Types.ObjectId.isValid(params.leadId)) {
      filter.leadId = new mongoose.Types.ObjectId(params.leadId);
    }
    if (params.contactId && mongoose.Types.ObjectId.isValid(params.contactId)) {
      filter.contactId = new mongoose.Types.ObjectId(params.contactId);
    }
    if (params.companyId && mongoose.Types.ObjectId.isValid(params.companyId)) {
      filter.companyId = new mongoose.Types.ObjectId(params.companyId);
    }
    if (params.dealId && mongoose.Types.ObjectId.isValid(params.dealId)) {
      filter.dealId = new mongoose.Types.ObjectId(params.dealId);
    }

    // Due Date filtering
    if (params.dueFilter) {
      if (params.dueFilter === "overdue") {
        filter.dueDate = { $lt: startOfToday };
        if (!params.status) {
          filter.status = { $nin: ["completed", "cancelled"] };
        }
      } else if (params.dueFilter === "today") {
        filter.dueDate = { $gte: startOfToday, $lte: endOfToday };
      } else if (params.dueFilter === "upcoming") {
        filter.dueDate = { $gt: endOfToday };
      }
    } else if (params.startDate || params.endDate) {
      filter.dueDate = {};
      if (params.startDate) filter.dueDate.$gte = new Date(params.startDate);
      if (params.endDate) filter.dueDate.$lte = new Date(params.endDate);
    }

    const page = params.page || 1;
    const limit = params.limit || 25;
    const skip = (page - 1) * limit;

    const sort: Record<string, any> = {};
    sort[params.sortBy] = params.sortOrder === "asc" ? 1 : -1;

    const [items, total, overdueCount, todayCount, upcomingCount, completedCount] = await Promise.all([
      SalesTask.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("assignedTo", "name email")
        .populate("completedBy", "name email")
        .populate("leadId", "name companyName status")
        .populate("contactId", "firstName lastName email phone jobTitle")
        .populate("companyId", "name domain industry")
        .populate("dealId", "name stage value currency")
        .lean(),
      SalesTask.countDocuments(filter),
      // Aggregate summary metrics
      SalesTask.countDocuments({
        dueDate: { $lt: startOfToday },
        status: { $nin: ["completed", "cancelled"] },
      }),
      SalesTask.countDocuments({
        dueDate: { $gte: startOfToday, $lte: endOfToday },
      }),
      SalesTask.countDocuments({
        dueDate: { $gt: endOfToday },
      }),
      SalesTask.countDocuments({
        status: "completed",
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      counters: {
        overdue: overdueCount,
        today: todayCount,
        upcoming: upcomingCount,
        completed: completedCount,
      },
    };
  }

  /**
   * Get single task by ID
   */
  public async getTaskById(id: string): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "INVALID_TASK_ID", "Provided task ID is invalid");
    }

    const task = await SalesTask.findById(id)
      .populate("assignedTo", "name email")
      .populate("completedBy", "name email")
      .populate("leadId", "name companyName email status score priority")
      .populate("contactId", "firstName lastName email phone jobTitle isPrimaryDecisionMaker")
      .populate("companyId", "name domain industry tier status")
      .populate("dealId", "name stage value currency probability");

    if (!task) {
      throw new AppError(404, "TASK_NOT_FOUND", "Sales task not found");
    }

    return task;
  }

  /**
   * Update task attributes
   */
  public async updateTask(id: string, input: UpdateTaskInput, actorId?: string): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "INVALID_TASK_ID", "Provided task ID is invalid");
    }

    const task = await SalesTask.findById(id);
    if (!task) {
      throw new AppError(404, "TASK_NOT_FOUND", "Sales task not found");
    }

    await this.validateLinkages({
      leadId: input.leadId,
      contactId: input.contactId,
      companyId: input.companyId,
      dealId: input.dealId,
      assignedTo: input.assignedTo,
    });

    if (input.title !== undefined) task.title = input.title;
    if (input.description !== undefined) task.description = input.description ?? undefined;
    if (input.type !== undefined) task.type = input.type;
    if (input.priority !== undefined) task.priority = input.priority;
    if (input.dueDate !== undefined) task.dueDate = new Date(input.dueDate);
    if (input.outcomeNotes !== undefined) task.outcomeNotes = input.outcomeNotes ?? undefined;

    if (input.assignedTo !== undefined) {
      task.assignedTo = input.assignedTo && mongoose.Types.ObjectId.isValid(input.assignedTo)
        ? new mongoose.Types.ObjectId(input.assignedTo)
        : undefined;
    }
    if (input.leadId !== undefined) {
      task.leadId = input.leadId && mongoose.Types.ObjectId.isValid(input.leadId)
        ? new mongoose.Types.ObjectId(input.leadId)
        : undefined;
    }
    if (input.contactId !== undefined) {
      task.contactId = input.contactId && mongoose.Types.ObjectId.isValid(input.contactId)
        ? new mongoose.Types.ObjectId(input.contactId)
        : undefined;
    }
    if (input.companyId !== undefined) {
      task.companyId = input.companyId && mongoose.Types.ObjectId.isValid(input.companyId)
        ? new mongoose.Types.ObjectId(input.companyId)
        : undefined;
    }
    if (input.dealId !== undefined) {
      task.dealId = input.dealId && mongoose.Types.ObjectId.isValid(input.dealId)
        ? new mongoose.Types.ObjectId(input.dealId)
        : undefined;
    }

    if (input.status !== undefined) {
      task.status = input.status;
      if (input.status === "completed" && !task.completedAt) {
        task.completedAt = new Date();
        task.completedBy = actorId && mongoose.Types.ObjectId.isValid(actorId)
          ? new mongoose.Types.ObjectId(actorId)
          : undefined;
      }
    }

    await task.save();

    await this.logAudit({
      actorId,
      action: "update",
      eventType: "TASK_UPDATED",
      resourceId: task._id,
      description: `Updated sales task: ${task.title}`,
      metadata: { updates: input },
    });

    return this.getTaskById(task._id.toString());
  }

  /**
   * Mark a task as completed with outcome notes
   */
  public async completeTask(id: string, input: CompleteTaskInput, actorId?: string): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "INVALID_TASK_ID", "Provided task ID is invalid");
    }

    const task = await SalesTask.findById(id);
    if (!task) {
      throw new AppError(404, "TASK_NOT_FOUND", "Sales task not found");
    }

    task.status = "completed";
    task.completedAt = input.completedAt ? new Date(input.completedAt) : new Date();
    task.completedBy = actorId && mongoose.Types.ObjectId.isValid(actorId)
      ? new mongoose.Types.ObjectId(actorId)
      : undefined;

    if (input.outcomeNotes !== undefined) {
      task.outcomeNotes = input.outcomeNotes;
    }

    await task.save();

    await this.logAudit({
      actorId,
      action: "complete",
      eventType: "TASK_COMPLETED",
      resourceId: task._id,
      description: `Completed sales task: ${task.title}`,
      metadata: {
        taskId: task._id,
        completedAt: task.completedAt,
        outcomeNotes: task.outcomeNotes,
      },
    });

    return this.getTaskById(task._id.toString());
  }

  /**
   * Delete a task
   */
  public async deleteTask(id: string, actorId?: string): Promise<{ success: boolean; id: string }> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "INVALID_TASK_ID", "Provided task ID is invalid");
    }

    const task = await SalesTask.findById(id);
    if (!task) {
      throw new AppError(404, "TASK_NOT_FOUND", "Sales task not found");
    }

    await SalesTask.findByIdAndDelete(task._id);

    await this.logAudit({
      actorId,
      action: "delete",
      eventType: "TASK_DELETED",
      resourceId: task._id,
      description: `Deleted sales task: ${task.title}`,
      metadata: { title: task.title, type: task.type },
      severity: "warning",
    });

    return { success: true, id: task._id.toString() };
  }

  /**
   * Calendar view aggregator grouping tasks by day within date window
   */
  public async getCalendarTasks(params: CalendarQueryParams) {
    const filter: FilterQuery<ISalesTask> = {
      dueDate: {
        $gte: new Date(params.startDate),
        $lte: new Date(params.endDate),
      },
    };

    if (params.assignedTo && mongoose.Types.ObjectId.isValid(params.assignedTo)) {
      filter.assignedTo = new mongoose.Types.ObjectId(params.assignedTo);
    }
    if (params.type) filter.type = params.type;
    if (params.status) filter.status = params.status;

    const tasks = await SalesTask.find(filter)
      .sort({ dueDate: 1 })
      .populate("assignedTo", "name email")
      .populate("leadId", "name companyName")
      .populate("contactId", "firstName lastName email")
      .populate("companyId", "name")
      .populate("dealId", "name stage value currency")
      .lean();

    // Group by YYYY-MM-DD
    const dateMap: Record<string, any[]> = {};
    for (const t of tasks) {
      const dateKey = new Date(t.dueDate).toISOString().split("T")[0];
      if (!dateMap[dateKey]) {
        dateMap[dateKey] = [];
      }
      dateMap[dateKey].push(t);
    }

    const days = Object.entries(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayTasks]) => ({
        date,
        count: dayTasks.length,
        tasks: dayTasks,
      }));

    return {
      startDate: params.startDate,
      endDate: params.endDate,
      totalTasks: tasks.length,
      days,
    };
  }
}

export default TaskService;
