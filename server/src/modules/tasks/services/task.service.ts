import TaskRepository, { TaskFilter, PaginationOptions } from "../repositories/task.repository.js";
import AppError from "../../../common/errors/app-error.js";
import mongoose from "mongoose";
import eventBus from "../../../infrastructure/events/event-bus.js";
import User from "../../auth/models/user.model.js";

export class TaskService {
  constructor(private readonly repository: TaskRepository) {}

  async listTasks(filter: TaskFilter, pagination: PaginationOptions) {
    return this.repository.find(filter, pagination);
  }

  async getTask(id: string | mongoose.Types.ObjectId, orgId: string | mongoose.Types.ObjectId) {
    const task = await this.repository.findById(id, orgId);
    if (!task) {
      throw new AppError(404, "NOT_FOUND", "Task not found");
    }
    return task;
  }

  async createTask(
    orgId: string | mongoose.Types.ObjectId,
    createdBy: string | mongoose.Types.ObjectId,
    data: {
      employeeId?: string;
      assignedToUserId: string;
      title: string;
      description?: string;
      category?: "it_setup" | "hr_paperwork" | "equipment" | "training" | "general";
      stage?: "preboarding" | "day_1" | "week_1" | "month_1" | "custom";
      priority?: "low" | "normal" | "high" | "critical";
      dueDate?: Date | string;
      relativeOffsetDays?: number;
      prerequisiteTaskIds?: string[];
    }
  ) {
    // Verify assigned user exists & belongs to same org
    const assignee = await User.findOne({
      _id: data.assignedToUserId,
      organizationId: orgId,
      isDeleted: false,
    });
    if (!assignee) {
      throw new AppError(400, "BAD_REQUEST", "Assigned user not found in organization");
    }

    // Verify target employee if specified
    let targetEmployee: any = null;
    if (data.employeeId) {
      targetEmployee = await User.findOne({
        _id: data.employeeId,
        organizationId: orgId,
        isDeleted: false,
      });
      if (!targetEmployee) {
        throw new AppError(400, "BAD_REQUEST", "Target employee not found in organization");
      }
    }

    // Calculate due date if relativeOffsetDays specified and employee hireDate exists
    let calculatedDueDate: Date | undefined = data.dueDate ? new Date(data.dueDate) : undefined;
    if (!calculatedDueDate && data.relativeOffsetDays !== undefined && targetEmployee?.employment?.hireDate) {
      const hireDate = new Date(targetEmployee.employment.hireDate);
      calculatedDueDate = new Date(hireDate.getTime() + data.relativeOffsetDays * 24 * 60 * 60 * 1000);
    }

    const newTaskData = {
      organizationId: new mongoose.Types.ObjectId(orgId),
      createdBy: new mongoose.Types.ObjectId(createdBy),
      assignedToUserId: new mongoose.Types.ObjectId(data.assignedToUserId),
      employeeId: data.employeeId ? new mongoose.Types.ObjectId(data.employeeId) : undefined,
      title: data.title,
      description: data.description,
      category: data.category || "general",
      stage: data.stage || "day_1",
      priority: data.priority || "normal",
      status: "pending" as const,
      dueDate: calculatedDueDate,
      relativeOffsetDays: data.relativeOffsetDays,
      prerequisiteTaskIds: (data.prerequisiteTaskIds || []).map((id) => new mongoose.Types.ObjectId(id)),
      statusHistory: [
        {
          status: "pending" as const,
          changedBy: new mongoose.Types.ObjectId(createdBy),
          changedAt: new Date(),
          note: "Task created",
        },
      ],
    };

    const task = await this.repository.create(newTaskData as any);

    // Publish TASK_CREATED event
    try {
      await eventBus.publish({
        eventName: "TASK_CREATED",
        organizationId: orgId,
        actorId: createdBy,
        entityId: task._id as any,
        payload: {
          taskId: (task._id as any).toString(),
          title: task.title,
          assignedToUserId: data.assignedToUserId,
          employeeId: data.employeeId,
          dueDate: task.dueDate,
        },
      });
    } catch (e) {
      console.error("Failed to publish TASK_CREATED event:", e);
    }

    return this.getTask(task._id as any, orgId);
  }

  async updateTaskStatus(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    newStatus: "pending" | "in_progress" | "completed" | "overdue" | "cancelled",
    note?: string
  ) {
    const task = await this.repository.findById(id, orgId);
    if (!task) {
      throw new AppError(404, "NOT_FOUND", "Task not found");
    }

    // Check prerequisite tasks if completing
    if (newStatus === "completed" && task.prerequisiteTaskIds && task.prerequisiteTaskIds.length > 0) {
      const prereqs = await this.repository.find(
        {
          organizationId: orgId,
          status: { $ne: "completed" },
        },
        { page: 1, limit: 100 }
      );

      const uncompletedPrereqIds = prereqs.tasks
        .filter((t) => task.prerequisiteTaskIds.some((pId: any) => pId.equals?.(t._id) || pId.toString() === t._id.toString()))
        .map((t) => t.title);

      if (uncompletedPrereqIds.length > 0) {
        throw new AppError(
          400,
          "PREREQUISITES_NOT_MET",
          `Cannot complete task. Pending prerequisite tasks: ${uncompletedPrereqIds.join(", ")}`
        );
      }
    }

    const updateData: Record<string, any> = {
      status: newStatus,
    };

    if (newStatus === "completed") {
      updateData.completedAt = new Date();
      updateData.completedBy = new mongoose.Types.ObjectId(userId);
    }

    const updatedTask = await this.repository.update(id, orgId, updateData as any);
    if (!updatedTask) {
      throw new AppError(404, "NOT_FOUND", "Task update failed");
    }

    // Push status history
    updatedTask.statusHistory.push({
      status: newStatus,
      changedBy: new mongoose.Types.ObjectId(userId),
      changedAt: new Date(),
      note: note || `Status changed to ${newStatus}`,
    });
    await updatedTask.save();

    // Publish TASK_COMPLETED or status event
    if (newStatus === "completed") {
      try {
        await eventBus.publish({
          eventName: "TASK_COMPLETED",
          organizationId: orgId,
          actorId: userId,
          entityId: updatedTask._id as any,
          payload: {
            taskId: updatedTask._id.toString(),
            title: updatedTask.title,
            assignedToUserId: updatedTask.assignedToUserId.toString(),
            employeeId: updatedTask.employeeId?.toString(),
          },
        });
      } catch (e) {
        console.error("Failed to publish TASK_COMPLETED event:", e);
      }
    }

    return updatedTask;
  }

  async addComment(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    commentText: string
  ) {
    const task = await this.repository.findById(id, orgId);
    if (!task) {
      throw new AppError(404, "NOT_FOUND", "Task not found");
    }

    const updatedTask = await this.repository.addComment(id, orgId, {
      userId: new mongoose.Types.ObjectId(userId),
      comment: commentText,
    });

    return updatedTask;
  }

  async deleteTask(id: string | mongoose.Types.ObjectId, orgId: string | mongoose.Types.ObjectId) {
    const task = await this.repository.softDelete(id, orgId);
    if (!task) {
      throw new AppError(404, "NOT_FOUND", "Task not found");
    }
    return task;
  }
}

export default TaskService;
