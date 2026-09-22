import mongoose from "mongoose";
import RoleChecklistTemplate, { IRoleChecklistTemplate } from "../models/role-checklist-template.model.js";
import Task from "../models/task.model.js";
import User from "../../auth/models/user.model.js";
import AppError from "../../../common/errors/app-error.js";
import eventBus from "../../../infrastructure/events/event-bus.js";
import NotificationService from "../../notifications/services/notification.service.js";
import NotificationRepository from "../../notifications/repositories/notification.repository.js";

const notificationService = new NotificationService(new NotificationRepository());

export class RoleChecklistService {
  /**
   * Helper to dynamically resolve responsible user ID based on checklist item role
   */
  public async resolveResponsibleUser(
    orgId: mongoose.Types.ObjectId,
    targetUser: any,
    role?: string,
    fallbackCreatorId?: mongoose.Types.ObjectId
  ): Promise<mongoose.Types.ObjectId> {
    const targetUserId = targetUser._id;
    if (!role || role === "employee") {
      return targetUserId;
    }

    if (role === "manager") {
      const managerId = targetUser.employment?.managerId || (targetUser.employment as any)?.managerUserId;
      if (managerId && mongoose.Types.ObjectId.isValid(managerId)) {
        return new mongoose.Types.ObjectId(managerId.toString());
      }
    }

    if (role === "it_admin" || role === "it") {
      const itAdmin = await User.findOne({
        organizationId: orgId,
        "permissions.role": { $in: ["it_admin", "admin", "super_admin"] },
        isDeleted: false,
      });
      if (itAdmin) {
        return itAdmin._id;
      }
    }

    if (role === "hr_admin" || role === "hr") {
      const hrAdmin = await User.findOne({
        organizationId: orgId,
        "permissions.role": { $in: ["hr_admin", "admin", "super_admin"] },
        isDeleted: false,
      });
      if (hrAdmin) {
        return hrAdmin._id;
      }
    }

    if (role === "buddy") {
      try {
        const BuddyAssignment = mongoose.model("BuddyAssignment");
        const activeAssignment = await BuddyAssignment.findOne({
          organizationId: orgId,
          employeeUserId: targetUserId,
          status: "active",
          isDeleted: false,
        });
        if (activeAssignment?.buddyUserId) {
          return new mongoose.Types.ObjectId(activeAssignment.buddyUserId.toString());
        }
      } catch (err) {
        // model not registered or not found
      }
    }

    // Default fallback: Manager -> Fallback Creator -> Target User
    const managerId = targetUser.employment?.managerId || (targetUser.employment as any)?.managerUserId;
    if (managerId && mongoose.Types.ObjectId.isValid(managerId)) {
      return new mongoose.Types.ObjectId(managerId.toString());
    }

    return fallbackCreatorId || targetUserId;
  }
  async listTemplates(
    orgId: string | mongoose.Types.ObjectId,
    filters?: {
      role?: string;
      department?: string;
      isActive?: boolean;
    }
  ) {
    const query: any = {
      organizationId: new mongoose.Types.ObjectId(orgId.toString()),
      isDeleted: false,
    };

    if (filters?.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    if (filters?.role) {
      query["audience.roles"] = filters.role;
    }

    if (filters?.department) {
      query["audience.departmentNames"] = { $regex: new RegExp(`^${filters.department}$`, "i") };
    }

    return RoleChecklistTemplate.find(query)
      .sort({ createdAt: -1 })
      .populate("createdBy", "profile.firstName profile.lastName profile.fullName auth.email");
  }

  async getTemplate(orgId: string | mongoose.Types.ObjectId, templateId: string | mongoose.Types.ObjectId) {
    const template = await RoleChecklistTemplate.findOne({
      _id: new mongoose.Types.ObjectId(templateId.toString()),
      organizationId: new mongoose.Types.ObjectId(orgId.toString()),
      isDeleted: false,
    }).populate("createdBy", "profile.firstName profile.lastName profile.fullName auth.email");

    if (!template) {
      throw new AppError(404, "NOT_FOUND", "Checklist template not found");
    }
    return template;
  }

  async createTemplate(
    orgId: string | mongoose.Types.ObjectId,
    creatorId: string | mongoose.Types.ObjectId,
    data: {
      title: string;
      description?: string;
      audience?: {
        roles?: Array<"owner" | "admin" | "manager" | "employee" | "hr_admin" | "it_admin">;
        departmentNames?: string[];
        jobTitleNames?: string[];
        employmentTypes?: Array<"full_time" | "part_time" | "contractor" | "intern">;
        locations?: string[];
        autoAssignNewHires?: boolean;
      };
      items?: any[];
      isActive?: boolean;
    }
  ) {
    if (!data.title || !data.title.trim()) {
      throw new AppError(400, "BAD_REQUEST", "Template title is required");
    }

    const audienceData = (data as any).audience || {};
    const itemsData = (data.items || []).map((it: any) => ({
      ...it,
      relativeOffsetDays: it.relativeOffsetDays ?? it.relativeDueDays ?? 0,
    }));

    const template = new RoleChecklistTemplate({
      organizationId: new mongoose.Types.ObjectId(orgId.toString()),
      title: data.title.trim(),
      description: data.description?.trim(),
      audience: {
        roles: audienceData.roles?.length ? audienceData.roles : ["employee"],
        departmentNames: audienceData.departmentNames || audienceData.departments || [],
        jobTitleNames: audienceData.jobTitleNames || audienceData.jobTitles || [],
        employmentTypes: audienceData.employmentTypes || [],
        locations: audienceData.locations || [],
        autoAssignNewHires: audienceData.autoAssignNewHires ?? (data as any).autoAssignOnCreate ?? true,
      },
      items: itemsData,
      isActive: data.isActive !== false,
      createdBy: new mongoose.Types.ObjectId(creatorId.toString()),
      isDeleted: false,
    });

    await template.save();
    return template;
  }

  async updateTemplate(
    orgId: string | mongoose.Types.ObjectId,
    templateId: string | mongoose.Types.ObjectId,
    updaterId: string | mongoose.Types.ObjectId,
    data: Partial<IRoleChecklistTemplate>
  ) {
    const template = await RoleChecklistTemplate.findOne({
      _id: new mongoose.Types.ObjectId(templateId.toString()),
      organizationId: new mongoose.Types.ObjectId(orgId.toString()),
      isDeleted: false,
    });

    if (!template) {
      throw new AppError(404, "NOT_FOUND", "Checklist template not found");
    }

    if (data.title) template.title = data.title.trim();
    if (data.description !== undefined) template.description = data.description?.trim();
    if (data.audience) {
      template.audience = {
        ...template.audience,
        ...data.audience,
      };
    }
    if (data.items) template.items = data.items;
    if (data.isActive !== undefined) template.isActive = data.isActive;
    template.updatedBy = new mongoose.Types.ObjectId(updaterId.toString());

    await template.save();
    return template;
  }

  async deleteTemplate(
    orgId: string | mongoose.Types.ObjectId,
    templateId: string | mongoose.Types.ObjectId
  ) {
    const template = await RoleChecklistTemplate.findOne({
      _id: new mongoose.Types.ObjectId(templateId.toString()),
      organizationId: new mongoose.Types.ObjectId(orgId.toString()),
      isDeleted: false,
    });

    if (!template) {
      throw new AppError(404, "NOT_FOUND", "Checklist template not found");
    }

    template.isDeleted = true;
    template.deletedAt = new Date();
    await template.save();
    return { success: true, message: "Template archived successfully" };
  }

  /**
   * Auto-assigns all matching role checklist templates to a new hire
   * Computing dynamic deadlines: now() + N days (or relative to hireDate)
   */
  async autoAssignRoleChecklistsToNewHire(
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    options?: {
      hireDate?: Date;
      creatorId?: string | mongoose.Types.ObjectId;
    }
  ) {
    const user = await User.findOne({
      _id: new mongoose.Types.ObjectId(userId.toString()),
      organizationId: new mongoose.Types.ObjectId(orgId.toString()),
      isDeleted: false,
    });

    if (!user) {
      return { assignedTemplatesCount: 0, assignedTasksCount: 0, taskIds: [] };
    }

    // 1. Fetch active templates with autoAssignNewHires enabled
    const activeTemplates = await RoleChecklistTemplate.find({
      organizationId: new mongoose.Types.ObjectId(orgId.toString()),
      isActive: true,
      isDeleted: false,
      "audience.autoAssignNewHires": { $ne: false },
    });

    const userRole = user.permissions?.role || "employee";
    const userDept = (user.employment?.department || "").toLowerCase().trim();
    const userJobTitle = (user.employment?.designation || user.employment?.jobTitle || "").toLowerCase().trim();
    const userEmpType = user.employment?.employmentType;
    const userLocation = (user.profile?.location || "").toLowerCase().trim();

    console.log(`[RoleChecklist] Auto-assign evaluation for user: ${user.auth.email}, role: ${userRole}, dept: ${userDept}, jobTitle: ${userJobTitle}, activeTemplates: ${activeTemplates.length}`);

    const matchedTemplates: IRoleChecklistTemplate[] = [];

    for (const tmpl of activeTemplates) {
      const aud = tmpl.audience;

      // Role check (if specified, user's role must match)
      if (aud.roles && aud.roles.length > 0) {
        if (!aud.roles.includes(userRole as any)) {
          continue;
        }
      }

      // Department check (if specified, user's department must match)
      if (aud.departmentNames && aud.departmentNames.length > 0) {
        const matchesDept = aud.departmentNames.some(
          (d) => d.toLowerCase().trim() === userDept
        );
        if (!matchesDept) {
          continue;
        }
      }

      // Job title check (if specified, user's job title must match)
      if (aud.jobTitleNames && aud.jobTitleNames.length > 0) {
        const matchesTitle = aud.jobTitleNames.some(
          (t) => t.toLowerCase().trim() === userJobTitle
        );
        if (!matchesTitle) {
          continue;
        }
      }

      // Employment type check
      if (aud.employmentTypes && aud.employmentTypes.length > 0) {
        if (userEmpType && !aud.employmentTypes.includes(userEmpType as any)) {
          continue;
        }
      }

      // Location check
      if (aud.locations && aud.locations.length > 0) {
        const matchesLoc = aud.locations.some(
          (loc) => loc.toLowerCase().trim() === userLocation
        );
        if (!matchesLoc) {
          continue;
        }
      }

      matchedTemplates.push(tmpl);
    }

    if (matchedTemplates.length === 0) {
      return { assignedTemplatesCount: 0, assignedTasksCount: 0, taskIds: [] };
    }

    let totalTasksCreated = 0;
    const allTaskIds: mongoose.Types.ObjectId[] = [];

    // Reference base date for due date calculations: now() or hireDate if future
    const now = new Date();
    const employeeHireDate = options?.hireDate || (user.employment?.hireDate ? new Date(user.employment.hireDate) : now);
    const baseDate = employeeHireDate.getTime() > now.getTime() ? employeeHireDate : now;

    for (const tmpl of matchedTemplates) {
      // Idempotency check: prevent duplicate assignment if template already applied to user
      const alreadyAssigned = await Task.findOne({
        organizationId: new mongoose.Types.ObjectId(orgId.toString()),
        assignedToUserId: new mongoose.Types.ObjectId(userId.toString()),
        "metadata.sourceTemplateId": tmpl._id,
        isDeleted: false,
      });
      if (alreadyAssigned) {
        continue;
      }

      const itemIndexToTaskId = new Map<number, mongoose.Types.ObjectId>();

      for (let i = 0; i < tmpl.items.length; i++) {
        const item = tmpl.items[i];
        const offsetDays = item.relativeOffsetDays ?? 0;

        // Dynamic due date: baseDate + (offsetDays * 86400 * 1000)
        const calculatedDueDate = new Date(baseDate.getTime() + offsetDays * 24 * 60 * 60 * 1000);

        // Resolve prerequisite dependency if specified
        const prerequisiteTaskIds: mongoose.Types.ObjectId[] = [];
        if (item.prerequisiteItemIndex !== undefined && itemIndexToTaskId.has(item.prerequisiteItemIndex)) {
          prerequisiteTaskIds.push(itemIndexToTaskId.get(item.prerequisiteItemIndex)!);
        }

        const assignedUserId = await this.resolveResponsibleUser(
          new mongoose.Types.ObjectId(orgId.toString()),
          user,
          item.responsibleRole,
          options?.creatorId ? new mongoose.Types.ObjectId(options.creatorId.toString()) : tmpl.createdBy
        );

        const newTask = new Task({
          organizationId: new mongoose.Types.ObjectId(orgId.toString()),
          assignedToUserId: assignedUserId,
          employeeId: new mongoose.Types.ObjectId(userId.toString()),
          createdBy: options?.creatorId ? new mongoose.Types.ObjectId(options.creatorId.toString()) : tmpl.createdBy,
          title: item.title,
          description: item.description,
          category: item.category || "general",
          stage: item.stage || "day_1",
          priority: item.priority || "normal",
          status: "pending",
          dueDate: calculatedDueDate,
          relativeOffsetDays: offsetDays,
          prerequisiteTaskIds,
          requiresVerification: item.requiresVerification || false,
          autoVerification: item.autoVerification,
          metadata: {
            sourceTemplateId: tmpl._id,
            sourceTemplateTitle: tmpl.title,
            autoAssigned: true,
          },
        });

        await newTask.save();
        itemIndexToTaskId.set(i, newTask._id);
        allTaskIds.push(newTask._id);
        totalTasksCreated++;

        // Notify responsible user if not the target new hire
        if (assignedUserId.toString() !== userId.toString()) {
          const employeeName = `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() || "New Hire";
          notificationService.createNotification({
            organizationId: orgId,
            recipientUserId: assignedUserId,
            type: "manager_alert",
            title: `New Onboarding Task for ${employeeName}`,
            message: `Task "${item.title}" (${item.category || "general"}) assigned to you for new hire ${employeeName}. Due by ${calculatedDueDate.toLocaleDateString()}.`,
            priority: item.priority === "critical" || item.priority === "high" ? "high" : "medium",
            data: {
              taskId: newTask._id.toString(),
              employeeId: userId.toString(),
              deepLink: "/tasks",
            },
          }).catch((err) => console.warn("[RoleChecklistService] Notification dispatch error:", err));
        }

        // Publish event on EventBus
        eventBus.publish({
          eventName: "TASK_CREATED",
          organizationId: new mongoose.Types.ObjectId(orgId.toString()),
          actorId: new mongoose.Types.ObjectId(userId.toString()),
          entityId: newTask._id,
          payload: {
            taskId: newTask._id.toString(),
            title: newTask.title,
            assignedToUserId: assignedUserId.toString(),
            employeeId: userId.toString(),
            dueDate: calculatedDueDate,
            sourceTemplateTitle: tmpl.title,
          },
        }).catch((err) => console.warn("[RoleChecklistService] Event publish error:", err));
      }
    }

    return {
      assignedTemplatesCount: matchedTemplates.length,
      assignedTasksCount: totalTasksCreated,
      taskIds: allTaskIds,
    };
  }

  /**
   * Manually apply a template to an existing employee
   */
  async applyTemplateToUser(
    orgId: string | mongoose.Types.ObjectId,
    templateId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    assignedBy: string | mongoose.Types.ObjectId,
    referenceDate?: Date | string
  ) {
    const template = await this.getTemplate(orgId, templateId);
    const user = await User.findOne({
      _id: new mongoose.Types.ObjectId(userId.toString()),
      organizationId: new mongoose.Types.ObjectId(orgId.toString()),
      isDeleted: false,
    });

    if (!user) {
      throw new AppError(404, "NOT_FOUND", "Employee not found");
    }

    const baseDate = referenceDate ? new Date(referenceDate) : new Date();
    const itemIndexToTaskId = new Map<number, mongoose.Types.ObjectId>();
    const createdTasks: any[] = [];

    for (let i = 0; i < template.items.length; i++) {
      const item = template.items[i];
      const offsetDays = item.relativeOffsetDays ?? 0;
      const calculatedDueDate = new Date(baseDate.getTime() + offsetDays * 24 * 60 * 60 * 1000);

      const prerequisiteTaskIds: mongoose.Types.ObjectId[] = [];
      if (item.prerequisiteItemIndex !== undefined && itemIndexToTaskId.has(item.prerequisiteItemIndex)) {
        prerequisiteTaskIds.push(itemIndexToTaskId.get(item.prerequisiteItemIndex)!);
      }

      const assignedUserId = await this.resolveResponsibleUser(
        new mongoose.Types.ObjectId(orgId.toString()),
        user,
        item.responsibleRole,
        new mongoose.Types.ObjectId(assignedBy.toString())
      );

      const newTask = new Task({
        organizationId: new mongoose.Types.ObjectId(orgId.toString()),
        assignedToUserId: assignedUserId,
        employeeId: new mongoose.Types.ObjectId(userId.toString()),
        createdBy: new mongoose.Types.ObjectId(assignedBy.toString()),
        title: item.title,
        description: item.description,
        category: item.category || "general",
        stage: item.stage || "day_1",
        priority: item.priority || "normal",
        status: "pending",
        dueDate: calculatedDueDate,
        relativeOffsetDays: offsetDays,
        prerequisiteTaskIds,
        requiresVerification: item.requiresVerification || false,
        autoVerification: item.autoVerification,
        metadata: {
          sourceTemplateId: template._id,
          sourceTemplateTitle: template.title,
          manuallyApplied: true,
        },
      });

      await newTask.save();
      itemIndexToTaskId.set(i, newTask._id);
      createdTasks.push(newTask);

      // Notify responsible user if not the target employee
      if (assignedUserId.toString() !== userId.toString()) {
        const employeeName = `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() || "Employee";
        notificationService.createNotification({
          organizationId: orgId,
          recipientUserId: assignedUserId,
          type: "manager_alert",
          title: `New Onboarding Task for ${employeeName}`,
          message: `Task "${item.title}" (${item.category || "general"}) assigned to you for ${employeeName}. Due by ${calculatedDueDate.toLocaleDateString()}.`,
          priority: item.priority === "critical" || item.priority === "high" ? "high" : "medium",
          data: {
            taskId: newTask._id.toString(),
            employeeId: userId.toString(),
            deepLink: "/tasks",
          },
        }).catch((err) => console.warn("[RoleChecklistService] Notification dispatch error:", err));
      }
    }

    return {
      success: true,
      message: `Assigned ${createdTasks.length} tasks from "${template.title}" to ${user.profile?.fullName || user.auth?.email}`,
      tasksCount: createdTasks.length,
    };
  }
}

export const roleChecklistService = new RoleChecklistService();
export default roleChecklistService;
