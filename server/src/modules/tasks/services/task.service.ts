import TaskRepository, { TaskFilter, PaginationOptions } from "../repositories/task.repository.js";
import AppError from "../../../common/errors/app-error.js";
import mongoose from "mongoose";
import eventBus from "../../../infrastructure/events/event-bus.js";
import User from "../../auth/models/user.model.js";
import { TaskStatus, ITaskAutoVerification, ITask } from "../models/task.model.js";

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
      requiresVerification?: boolean;
      autoVerification?: {
        enabled?: boolean;
        ruleType?: "document_signed" | "quiz_passed" | "course_completed" | "form_submitted";
        linkedEntityId?: string | mongoose.Types.ObjectId;
        entityModel?: "DocumentTemplate" | "Course" | "Quiz";
        minScorePercent?: number;
      };
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

    const newTaskData: any = {
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
      requiresVerification: data.requiresVerification ?? false,
      autoVerification: data.autoVerification
        ? {
            enabled: data.autoVerification.enabled ?? false,
            ruleType: data.autoVerification.ruleType,
            linkedEntityId: data.autoVerification.linkedEntityId
              ? new mongoose.Types.ObjectId(data.autoVerification.linkedEntityId)
              : undefined,
            entityModel: data.autoVerification.entityModel,
            minScorePercent: data.autoVerification.minScorePercent,
          }
        : undefined,
      statusHistory: [
        {
          status: "pending" as const,
          changedBy: new mongoose.Types.ObjectId(createdBy),
          actingRole: userRole || "creator",
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
    userIdOrOptions:
      | string
      | mongoose.Types.ObjectId
      | {
          newStatus: TaskStatus;
          note?: string;
          actingUser?: string;
          userRole?: string;
          verifiedHash?: string;
        },
    newStatusOrNote?: TaskStatus | string,
    noteOrRole?: string,
    userRoleArg?: string
  ) {
    let userId: string;
    let newStatus: TaskStatus;
    let note: string | undefined;
    let userRole: string | undefined;
    let verifiedHash: string | undefined;

    if (typeof userIdOrOptions === "object" && !(userIdOrOptions instanceof mongoose.Types.ObjectId)) {
      userId = userIdOrOptions.actingUser || "system.autonomous.sentinel";
      newStatus = userIdOrOptions.newStatus;
      note = userIdOrOptions.note;
      userRole = userIdOrOptions.userRole || (userId.includes("sentinel") ? "system" : "admin");
      verifiedHash = userIdOrOptions.verifiedHash;
    } else {
      userId = userIdOrOptions.toString();
      newStatus = newStatusOrNote as TaskStatus;
      note = noteOrRole;
      userRole = userRoleArg;
    }

    const task = await this.repository.findById(id, orgId);
    if (!task) {
      throw new AppError(404, "NOT_FOUND", "Task not found");
    }

    const isSentinel = userId === "system.autonomous.sentinel" || userRole === "system";

    // Role-based task verification authorization:
    // Only target employee's manager, admin/owner, or the system sentinel can verify tasks.
    if (newStatus === "verified" && !isSentinel) {
      if (userRole === "employee") {
        throw new AppError(
          403,
          "FORBIDDEN",
          "Unauthorized. Regular employees cannot verify tasks requiring manager sign-off."
        );
      }

      if (userRole === "manager") {
        const targetEmpId =
          (task.employeeId as any)?._id ||
          task.employeeId ||
          (task.assignedToUserId as any)?._id ||
          task.assignedToUserId;
        const targetEmp = await User.findById(targetEmpId);
        const targetManagerId =
          targetEmp?.employment?.managerId || (targetEmp?.employment as any)?.managerUserId;
        if (!targetManagerId || targetManagerId.toString() !== userId.toString()) {
          throw new AppError(
            403,
            "FORBIDDEN",
            "Unauthorized. Managers may only verify tasks belonging to their direct reports."
          );
        }
      }
    }

    // Role-based revocation authorization:
    // Managers and Admins retain the right to revoke verification (verified -> revision_requested)
    if (newStatus === "revision_requested") {
      if (userRole === "employee") {
        throw new AppError(
          403,
          "FORBIDDEN",
          "Unauthorized. Regular employees cannot revoke task verification."
        );
      }
      if (userRole === "manager") {
        const targetEmpId =
          (task.employeeId as any)?._id ||
          task.employeeId ||
          (task.assignedToUserId as any)?._id ||
          task.assignedToUserId;
        const targetEmp = await User.findById(targetEmpId);
        const targetManagerId =
          targetEmp?.employment?.managerId || (targetEmp?.employment as any)?.managerUserId;
        if (!targetManagerId || targetManagerId.toString() !== userId.toString()) {
          throw new AppError(
            403,
            "FORBIDDEN",
            "Unauthorized. Managers may only request revisions for their direct reports."
          );
        }
      }
    }

    // Role-based task ownership enforcement:
    // Regular employees may only update tasks explicitly assigned to them (assignedToUserId === userId)
    if (userRole === "employee" && !isSentinel) {
      const assignedId =
        (task.assignedToUserId as any)?._id?.toString() || task.assignedToUserId?.toString();
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
    if (
      (newStatus === "completed" || newStatus === "verified") &&
      task.prerequisiteTaskIds &&
      task.prerequisiteTaskIds.length > 0
    ) {
      const prereqs = await this.repository.find(
        {
          organizationId: orgId,
          status: { $nin: ["completed", "verified"] },
        },
        { page: 1, limit: 100 }
      );

      const uncompletedPrereqIds = prereqs.tasks
        .filter((t) =>
          task.prerequisiteTaskIds.some(
            (pId: any) => pId.equals?.(t._id) || pId.toString() === t._id.toString()
          )
        )
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
      updateData.completedBy = mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : undefined;
    } else if (newStatus === "verified") {
      updateData.verifiedAt = new Date();
      updateData.verifiedBy = !isSentinel && mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : undefined;
      updateData.completedAt = task.completedAt || new Date();
      updateData.completedBy =
        task.completedBy ||
        (!isSentinel && mongoose.Types.ObjectId.isValid(userId)
          ? new mongoose.Types.ObjectId(userId)
          : undefined);
      if (verifiedHash) {
        updateData["autoVerification.verifiedHash"] = verifiedHash;
        updateData["autoVerification.verificationAuditNote"] = note;
      }
    } else if (newStatus === "revision_requested") {
      updateData.verifiedAt = null;
      updateData.verifiedBy = null;
    } else if (newStatus === "needs_review") {
      if (note) {
        updateData.quarantineReason = note;
        updateData["autoVerification.quarantineReason"] = note;
      }
    }

    const updatedTask = await this.repository.update(id, orgId, updateData as any);
    if (!updatedTask) {
      throw new AppError(404, "NOT_FOUND", "Task update failed");
    }

    // Push status history
    updatedTask.statusHistory.push({
      status: newStatus,
      changedBy: isSentinel
        ? "system.autonomous.sentinel"
        : mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : userId,
      actingRole: isSentinel ? "system.autonomous.sentinel" : userRole || "user",
      changedAt: new Date(),
      note:
        note ||
        (newStatus === "verified"
          ? isSentinel
            ? "Autonomous Verification: Task verified by sentinel"
            : "Task verified by manager"
          : `Status changed to ${newStatus}`),
    });
    await updatedTask.save();

    // Publish TASK_COMPLETED or TASK_VERIFIED event
    if (newStatus === "completed" || newStatus === "verified") {
      try {
        await eventBus.publish({
          eventName: newStatus === "verified" ? ("TASK_VERIFIED" as any) : "TASK_COMPLETED",
          organizationId: orgId,
          actorId: isSentinel
            ? undefined
            : mongoose.Types.ObjectId.isValid(userId)
            ? new mongoose.Types.ObjectId(userId)
            : undefined,
          entityId: updatedTask._id as any,
          payload: {
            taskId: updatedTask._id.toString(),
            title: updatedTask.title,
            status: newStatus,
            assignedToUserId:
              (updatedTask.assignedToUserId as any)?._id?.toString() ||
              updatedTask.assignedToUserId?.toString(),
            employeeId:
              (updatedTask.employeeId as any)?._id?.toString() ||
              updatedTask.employeeId?.toString(),
            verifiedBy: userId,
            actingRole: isSentinel ? "system.autonomous.sentinel" : userRole,
            verifiedHash: updatedTask.autoVerification?.verifiedHash,
          },
        });

        if (newStatus === "verified" && isSentinel) {
          await eventBus.publish({
            eventName: "task.auto_verified" as any,
            organizationId: orgId,
            actorId: undefined,
            entityId: updatedTask._id as any,
            payload: {
              taskId: updatedTask._id.toString(),
              title: updatedTask.title,
              employeeId:
                (updatedTask.employeeId as any)?._id?.toString() ||
                updatedTask.employeeId?.toString(),
              ruleType: updatedTask.autoVerification?.ruleType,
              verifiedHash: updatedTask.autoVerification?.verifiedHash,
              verifiedAt: updatedTask.verifiedAt,
              note,
            },
          });
        }
      } catch (e) {
        console.error("Failed to publish task status event:", e);
      }
    }

    return updatedTask;
  }

  /**
   * Autonomous Verification Sentinel execution method
   */
  async autoVerifyTask(
    taskId: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    options: {
      note: string;
      signatureHash?: string;
      score?: number;
    }
  ): Promise<ITask> {
    return this.updateTaskStatus(taskId, orgId, {
      newStatus: "verified",
      note: options.note,
      actingUser: "system.autonomous.sentinel",
      userRole: "system",
      verifiedHash: options.signatureHash,
    });
  }

  /**
   * Flag a task for manager review due to evidence anomalies
   */
  async flagTaskForReview(
    taskId: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    diagnosticReason: string
  ): Promise<ITask> {
    return this.updateTaskStatus(taskId, orgId, {
      newStatus: "needs_review",
      note: diagnosticReason,
      actingUser: "system.autonomous.sentinel",
      userRole: "system",
    });
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

  async cancelTasksForTerminatedEmployee(
    orgId: string | mongoose.Types.ObjectId,
    employeeId: string | mongoose.Types.ObjectId,
    note = "Cancelled due to HRIS termination event"
  ): Promise<{ cancelledCount: number }> {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    const empObjectId = new mongoose.Types.ObjectId(employeeId.toString());

    const result = await this.repository.find(
      {
        organizationId: orgObjectId,
        $or: [{ employeeId: empObjectId }, { assignedToUserId: empObjectId }],
        status: { $in: ["pending", "in_progress", "needs_review", "overdue"] },
      },
      { page: 1, limit: 500 }
    );

    let count = 0;
    for (const task of result.tasks) {
      await this.updateTaskStatus(task._id, orgId, {
        newStatus: "cancelled",
        note,
        actingUser: "system.hris.termination",
        userRole: "system",
      });
      count++;
    }

    return { cancelledCount: count };
  }
}

export default TaskService;
