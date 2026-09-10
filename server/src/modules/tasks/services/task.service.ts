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
    },
    userRole?: string
  ) {
    // Authorization check: Regular employees cannot assign tasks to others (only personal tasks)
    if (userRole === "employee") {
      const assignedId = data.assignedToUserId?.toString();
      const creatorId = createdBy?.toString();
      if (assignedId && creatorId && assignedId !== creatorId) {
        throw new AppError(
          403,
          "FORBIDDEN",
          "Employees cannot create tasks assigned to others"
        );
      }
    }

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
    const cleanEmployeeId = data.employeeId && data.employeeId.trim() ? data.employeeId.trim() : undefined;
    if (cleanEmployeeId) {
      targetEmployee = await User.findOne({
        _id: cleanEmployeeId,
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
      employeeId: cleanEmployeeId ? new mongoose.Types.ObjectId(cleanEmployeeId) : undefined,
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
    newStatus: "pending" | "in_progress" | "completed" | "verified" | "overdue" | "cancelled",
    note?: string,
    userRole?: string
  ) {
    const task = await this.repository.findById(id, orgId);
    if (!task) {
      throw new AppError(404, "NOT_FOUND", "Task not found");
    }

    // Role-based task verification authorization:
    // Only target employee's manager or admin/owner can verify tasks.
    if (newStatus === "verified") {
      if (userRole === "employee") {
        throw new AppError(
          403,
          "FORBIDDEN",
          "Unauthorized. Regular employees cannot verify tasks requiring manager sign-off."
        );
      }

      if (userRole === "manager") {
        const targetEmpId = (task.employeeId as any)?._id || task.employeeId || (task.assignedToUserId as any)?._id || task.assignedToUserId;
        const targetEmp = await User.findById(targetEmpId);
        const targetManagerId = targetEmp?.employment?.managerId || (targetEmp?.employment as any)?.managerUserId;
        if (!targetManagerId || targetManagerId.toString() !== userId.toString()) {
          throw new AppError(
            403,
            "FORBIDDEN",
            "Unauthorized. Managers may only verify tasks belonging to their direct reports."
          );
        }
      }
    }

    // Role-based task ownership enforcement:
    // Regular employees may only update tasks explicitly assigned to them (assignedToUserId === userId)
    if (userRole === "employee") {
      const assignedId = (task.assignedToUserId as any)?._id?.toString() || task.assignedToUserId?.toString();
      const isAssigned = assignedId && assignedId === userId.toString();
      if (!isAssigned) {
        throw new AppError(
          403,
          "FORBIDDEN_TASK_MUTATION",
          "Unauthorized. Employees may only update tasks assigned to them."
        );
      }
    }

    // Check prerequisite tasks if completing or verifying
    if ((newStatus === "completed" || newStatus === "verified") && task.prerequisiteTaskIds && task.prerequisiteTaskIds.length > 0) {
      const prereqs = await this.repository.find(
        {
          organizationId: orgId,
          status: { $nin: ["completed", "verified"] },
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
    } else if (newStatus === "verified") {
      updateData.verifiedAt = new Date();
      updateData.verifiedBy = new mongoose.Types.ObjectId(userId);
      updateData.completedAt = task.completedAt || new Date();
      updateData.completedBy = task.completedBy || new mongoose.Types.ObjectId(userId);
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
      note: note || (newStatus === "verified" ? "Task verified by manager" : `Status changed to ${newStatus}`),
    });
    await updatedTask.save();

    // Publish TASK_COMPLETED or TASK_VERIFIED event
    if (newStatus === "completed" || newStatus === "verified") {
      try {
        await eventBus.publish({
          eventName: newStatus === "verified" ? ("TASK_VERIFIED" as any) : "TASK_COMPLETED",
          organizationId: orgId,
          actorId: userId,
          entityId: updatedTask._id as any,
          payload: {
            taskId: updatedTask._id.toString(),
            title: updatedTask.title,
            status: newStatus,
            assignedToUserId: (updatedTask.assignedToUserId as any)?._id?.toString() || updatedTask.assignedToUserId?.toString(),
            employeeId: (updatedTask.employeeId as any)?._id?.toString() || updatedTask.employeeId?.toString(),
            verifiedBy: userId.toString(),
          },
        });
      } catch (e) {
        console.error("Failed to publish task status event:", e);
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
