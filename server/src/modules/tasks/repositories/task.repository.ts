import Task, { ITask } from "../models/task.model.js";
import mongoose from "mongoose";

export interface TaskFilter {
  organizationId: string | mongoose.Types.ObjectId;
  assignedToUserId?: string | mongoose.Types.ObjectId | (string | mongoose.Types.ObjectId)[];
  employeeId?: string | mongoose.Types.ObjectId | Record<string, any>;
  createdBy?: string | mongoose.Types.ObjectId;
  status?: string | Record<string, any>;
  stage?: string;
  category?: string;
  priority?: string;
  isOverdue?: boolean;
  $or?: any[];
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export class TaskRepository {
  private buildQuery(id: string | mongoose.Types.ObjectId, orgId: string | mongoose.Types.ObjectId) {
    const isObjectId = typeof id === "string" ? mongoose.Types.ObjectId.isValid(id) && id.length === 24 : id instanceof mongoose.Types.ObjectId;
    return isObjectId
      ? { _id: id, organizationId: orgId, isDeleted: false }
      : { taskCode: id, organizationId: orgId, isDeleted: false };
  }

  async findById(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId
  ): Promise<ITask | null> {
    return Task.findOne(this.buildQuery(id, orgId))
      .populate("assignedToUserId", "profile auth.email permissions.role")
      .populate("employeeId", "profile auth.email employment")
      .populate("createdBy", "profile auth.email")
      .populate("prerequisiteTaskIds", "title status dueDate");
  }

  async find(
    filter: TaskFilter,
    pagination: PaginationOptions
  ): Promise<{ tasks: ITask[]; total: number }> {
    const query: Record<string, any> = {
      organizationId: new mongoose.Types.ObjectId(filter.organizationId),
      isDeleted: false,
    };

    if (filter.$or) {
      query.$or = filter.$or.map((clause: any) => {
        const transformed: Record<string, any> = {};
        for (const [k, v] of Object.entries(clause)) {
          if (v && typeof v === "object" && "$in" in (v as any) && Array.isArray((v as any).$in)) {
            transformed[k] = {
              $in: (v as any).$in.map((val: any) =>
                mongoose.Types.ObjectId.isValid(val) ? new mongoose.Types.ObjectId(val) : val
              ),
            };
          } else if (v && mongoose.Types.ObjectId.isValid(v as any) && typeof v === "string") {
            transformed[k] = new mongoose.Types.ObjectId(v as any);
          } else {
            transformed[k] = v;
          }
        }
        return transformed;
      });
    }

    if (filter.assignedToUserId) {
      if (Array.isArray(filter.assignedToUserId)) {
        query.assignedToUserId = { $in: filter.assignedToUserId.map((id) => new mongoose.Types.ObjectId(id)) };
      } else {
        query.assignedToUserId = new mongoose.Types.ObjectId(filter.assignedToUserId);
      }
    }
    if (filter.employeeId) {
      if (typeof filter.employeeId === "object" && "$in" in filter.employeeId) {
        query.employeeId = filter.employeeId;
      } else {
        query.employeeId = new mongoose.Types.ObjectId(filter.employeeId as any);
      }
    }
    if (filter.createdBy) {
      query.createdBy = new mongoose.Types.ObjectId(filter.createdBy);
    }
    if (filter.status) {
      query.status = filter.status;
    }
    if (filter.stage) {
      query.stage = filter.stage;
    }
    if (filter.category) {
      query.category = filter.category;
    }
    if (filter.priority) {
      query.priority = filter.priority;
    }
    if (filter.isOverdue) {
      query.status = { $in: ["pending", "in_progress", "overdue"] };
      query.dueDate = { $lt: new Date() };
    }

    console.log('[TaskRepository.find] query:', JSON.stringify(query));
    const total = await Task.countDocuments(query);
    const page = Math.max(1, pagination.page);
    const limit = Math.max(1, pagination.limit);
    const skip = (page - 1) * limit;

    const sortField = pagination.sortBy || "createdAt";
    const sortOrder = pagination.sortOrder === "asc" ? 1 : -1;

    const tasks = await Task.find(query)
      .populate("assignedToUserId", "profile auth.email permissions.role")
      .populate("employeeId", "profile auth.email employment")
      .populate("createdBy", "profile auth.email")
      .populate("prerequisiteTaskIds", "title status dueDate")
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit);

    return { tasks, total };
  }

  async create(data: Partial<ITask>): Promise<ITask> {
    const task = new Task(data);
    return task.save();
  }

  async update(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    data: Partial<ITask>
  ): Promise<ITask | null> {
    return Task.findOneAndUpdate(
      this.buildQuery(id, orgId),
      { $set: data },
      { new: true }
    )
      .populate("assignedToUserId", "profile auth.email permissions.role")
      .populate("employeeId", "profile auth.email employment")
      .populate("createdBy", "profile auth.email")
      .populate("prerequisiteTaskIds", "title status dueDate");
  }

  async softDelete(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId
  ): Promise<ITask | null> {
    return Task.findOneAndUpdate(
      this.buildQuery(id, orgId),
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true }
    );
  }

  async addComment(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    comment: { userId: mongoose.Types.ObjectId; comment: string }
  ): Promise<ITask | null> {
    return Task.findOneAndUpdate(
      this.buildQuery(id, orgId),
      { $push: { comments: comment } },
      { new: true }
    )
      .populate("assignedToUserId", "profile auth.email permissions.role")
      .populate("employeeId", "profile auth.email employment")
      .populate("comments.userId", "profile auth.email");
  }

  async countPendingOverdue(orgId: string | mongoose.Types.ObjectId): Promise<number> {
    return Task.countDocuments({
      organizationId: orgId,
      status: { $in: ["pending", "in_progress", "overdue"] },
      dueDate: { $lt: new Date() },
      isDeleted: false,
    });
  }
}

export default TaskRepository;
