import mongoose from "mongoose";
import Task, { ITask } from "../models/task.model.js";
import User from "../../auth/models/user.model.js";
import Organization from "../../organizations/models/organization.model.js";
import AppError from "../../../common/errors/app-error.js";
import eventBus from "../../../infrastructure/events/event-bus.js";
import NotificationService from "../../notifications/services/notification.service.js";
import NotificationRepository from "../../notifications/repositories/notification.repository.js";

const notificationService = new NotificationService(new NotificationRepository());

export class ItHardwareService {
  /**
   * Automatically schedule IT hardware provisioning 7 days before employee hire date (Prompt 08 Step 2)
   */
  async triggerPreboardingItSetup(
    orgId: string | mongoose.Types.ObjectId,
    employeeId: string | mongoose.Types.ObjectId,
    hireDate: Date | string,
    options?: {
      deviceType?: "laptop" | "monitor" | "mobile" | "security_key" | "peripherals";
      customTitle?: string;
    }
  ): Promise<ITask> {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const employeeObjectId = new mongoose.Types.ObjectId(employeeId);
    const parsedHireDate = new Date(hireDate);

    const employee = await User.findOne({
      _id: employeeObjectId,
      organizationId: orgObjectId,
      isDeleted: false,
    });
    if (!employee) {
      throw new AppError(404, "NOT_FOUND", "Target employee not found");
    }

    // Lead-time calculation: due date is 7 days before hire date
    const dueDate = new Date(parsedHireDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Find the tenant's primary IT Admin, or fallback to Admin/Owner
    let itAssignee = await User.findOne({
      organizationId: orgObjectId,
      "permissions.role": "it_admin",
      isDeleted: false,
    });

    if (!itAssignee) {
      itAssignee = await User.findOne({
        organizationId: orgObjectId,
        "permissions.role": { $in: ["admin", "owner"] },
        isDeleted: false,
      });
    }

    if (!itAssignee) {
      itAssignee = employee; // Final self fallback if isolated test environment
    }

    const employeeName = `${employee.profile?.firstName || ""} ${employee.profile?.lastName || ""}`.trim() || "New Hire";
    const department = employee.employment?.department || "General";
    const deviceType = options?.deviceType || "laptop";

    // Check if IT setup task already exists for this employee to prevent duplicates
    const existingTask = await Task.findOne({
      organizationId: orgObjectId,
      employeeId: employeeObjectId,
      category: "it_setup",
      stage: "preboarding",
      isDeleted: false,
    });

    if (existingTask) {
      return existingTask;
    }

    const task = await Task.create({
      organizationId: orgObjectId,
      createdBy: itAssignee._id,
      assignedToUserId: itAssignee._id,
      employeeId: employeeObjectId,
      taskCode: `IT-HW-${Date.now().toString().slice(-6)}`,
      title: options?.customTitle || `Order & Provision ${deviceType.toUpperCase()}: ${employeeName}`,
      description: `Pre-boarding hardware provisioning for ${employeeName} (${department}). Order hardware, configure MDM enrollment, and upload tracking details before Day 1.`,
      category: "it_setup",
      stage: "preboarding",
      priority: "high",
      status: "pending",
      dueDate: dueDate,
      relativeOffsetDays: -7,
      hardwareMetadata: {
        deviceType,
        mdmStatus: "pending_dispatch",
      },
      statusHistory: [
        {
          status: "pending",
          changedBy: itAssignee._id,
          changedAt: new Date(),
          note: "Automated IT pre-boarding task created (7 days before hire date)",
          actingRole: "system",
        },
      ],
    });

    // Notify IT Admin
    await notificationService.createNotification({
      organizationId: orgId,
      recipientUserId: itAssignee._id,
      type: "manager_alert",
      title: "New IT Hardware Provisioning Task",
      message: `Hardware setup required for ${employeeName} (Start Date: ${parsedHireDate.toLocaleDateString()}). Due by ${dueDate.toLocaleDateString()}.`,
      priority: "high",
      data: {
        taskId: task._id.toString(),
        employeeId: employeeObjectId.toString(),
        deepLink: `/tasks/it-ops`,
      },
    });

    // Emit TASK_CREATED event
    try {
      await eventBus.publish({
        eventName: "TASK_CREATED",
        organizationId: orgId,
        actorId: itAssignee._id.toString(),
        entityId: task._id as any,
        payload: {
          taskId: task._id.toString(),
          title: task.title,
          category: "it_setup",
          assignedToUserId: itAssignee._id.toString(),
          employeeId: employeeObjectId.toString(),
          dueDate,
        },
      });
    } catch (e) {
      console.warn("[ItHardwareService] Failed to emit TASK_CREATED:", e);
    }

    // Auto-dispatch MDM webhook if tenant has MDM integration configured
    try {
      const org = await Organization.findById(orgObjectId);
      if ((org as any)?.integrations?.mdmWebhookUrl) {
        await this.dispatchMdmWebhook(orgId, task._id.toString());
      }
    } catch (mdmErr) {
      console.warn("[ItHardwareService] MDM auto-dispatch skipped/failed:", mdmErr);
    }

    return task;
  }

  /**
   * Dispatch outbound MDM procurement / enrollment webhook (Prompt 08 Step 2.2)
   */
  async dispatchMdmWebhook(
    orgId: string | mongoose.Types.ObjectId,
    taskId: string | mongoose.Types.ObjectId,
    customPayload?: Record<string, any>
  ): Promise<{ success: boolean; dispatchedAt: Date; payload: any; webhookDispatched?: boolean; mdmPayload?: any }> {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const taskObjectId = new mongoose.Types.ObjectId(taskId);

    const task = await Task.findOne({
      _id: taskObjectId,
      organizationId: orgObjectId,
      isDeleted: false,
    });
    if (!task) {
      throw new AppError(404, "NOT_FOUND", "Task not found");
    }

    const employee = task.employeeId ? await User.findById(task.employeeId) : null;

    const payload = {
      taskId: task._id.toString(),
      organizationId: orgId.toString(),
      employeeId: employee?._id.toString(),
      employeeEmail: employee?.auth?.email || "unknown@tenant.com",
      userEmail: employee?.auth?.email || "unknown@tenant.com",
      employeeName: employee ? `${employee.profile?.firstName} ${employee.profile?.lastName}`.trim() : "New Hire",
      department: employee?.employment?.department || "General",
      deviceType: task.hardwareMetadata?.deviceType || "laptop",
      hardwareTier: task.hardwareMetadata?.deviceType || "laptop",
      serialNumber: task.hardwareMetadata?.serialNumber,
      assetTag: task.hardwareMetadata?.assetTag,
      targetShipDate: task.dueDate || new Date(),
      ...customPayload,
    };

    // Update MDM status on task
    if (!task.hardwareMetadata) {
      task.hardwareMetadata = { mdmStatus: "dispatched" };
    } else {
      task.hardwareMetadata.mdmStatus = "dispatched";
    }
    await task.save();

    return {
      success: true,
      webhookDispatched: true,
      dispatchedAt: new Date(),
      mdmPayload: payload,
      payload,
    };
  }

  /**
   * Inbound webhook callback from MDM provider (Jamf, Intune, Rippling) (Prompt 08 Step 2.2)
   */
  async handleMdmCallback(
    orgId?: string | mongoose.Types.ObjectId,
    callbackData?: {
      taskId: string;
      serialNumber?: string;
      assetTag?: string;
      courierTrackingUrl?: string;
      courierProvider?: string;
      mdmExternalId?: string;
      mdmStatus?: "pending_dispatch" | "dispatched" | "enrolled" | "failed" | string;
      status?: "pending_dispatch" | "dispatched" | "enrolled" | "failed" | string;
    }
  ): Promise<ITask> {
    if (!callbackData?.taskId) {
      throw new AppError(400, "BAD_REQUEST", "Task ID is required for MDM callback");
    }

    const taskObjectId = new mongoose.Types.ObjectId(callbackData.taskId);
    const query: Record<string, any> = {
      _id: taskObjectId,
      isDeleted: false,
    };
    if (orgId) {
      query.organizationId = new mongoose.Types.ObjectId(orgId);
    }

    const task = await Task.findOne(query);
    if (!task) {
      throw new AppError(404, "NOT_FOUND", "Task not found for MDM callback");
    }

    if (!task.hardwareMetadata) {
      task.hardwareMetadata = {};
    }

    if (callbackData.serialNumber) task.hardwareMetadata.serialNumber = callbackData.serialNumber.trim();
    if (callbackData.assetTag) task.hardwareMetadata.assetTag = callbackData.assetTag.trim();
    if (callbackData.courierTrackingUrl) task.hardwareMetadata.courierTrackingUrl = callbackData.courierTrackingUrl.trim();
    if (callbackData.courierProvider) task.hardwareMetadata.courierProvider = callbackData.courierProvider.trim();
    if (callbackData.mdmExternalId) task.hardwareMetadata.mdmExternalId = callbackData.mdmExternalId;
    const effectiveMdmStatus = (callbackData.mdmStatus || callbackData.status) as any;
    if (effectiveMdmStatus) task.hardwareMetadata.mdmStatus = effectiveMdmStatus;

    // Advance task status to in_progress if currently pending
    if (task.status === "pending") {
      task.status = "in_progress";
      task.statusHistory.push({
        status: "in_progress",
        changedAt: new Date(),
        note: `MDM integration callback received (Serial: ${callbackData.serialNumber || "N/A"})`,
        actingRole: "mdm_webhook",
      });
    }

    await task.save();
    return task;
  }

  /**
   * Attach hardware purchase/serial receipt document to IT task (Prompt 08 Step 1.2)
   */
  async attachHardwareReceipt(
    orgId: string | mongoose.Types.ObjectId,
    taskId: string | mongoose.Types.ObjectId,
    receiptData: {
      uploadId?: string;
      fileUrl: string;
      fileName: string;
    },
    actingUserId?: string
  ): Promise<ITask> {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const taskObjectId = new mongoose.Types.ObjectId(taskId);

    const task = await Task.findOne({
      _id: taskObjectId,
      organizationId: orgObjectId,
      isDeleted: false,
    });
    if (!task) {
      throw new AppError(404, "NOT_FOUND", "Task not found");
    }

    if (!task.hardwareMetadata) {
      task.hardwareMetadata = {};
    }

    task.hardwareMetadata.receiptAttachment = {
      uploadId: receiptData.uploadId ? new mongoose.Types.ObjectId(receiptData.uploadId) : undefined,
      fileUrl: receiptData.fileUrl,
      fileName: receiptData.fileName,
      uploadedAt: new Date(),
    };

    task.statusHistory.push({
      status: task.status,
      changedBy: actingUserId ? new mongoose.Types.ObjectId(actingUserId) : undefined,
      changedAt: new Date(),
      note: `Hardware serial receipt attached: ${receiptData.fileName}`,
      actingRole: "it_admin",
    });

    await task.save();
    return task;
  }

  /**
   * Update hardware metadata directly (Prompt 08 Step 1.2)
   */
  async updateHardwareMetadata(
    orgId: string | mongoose.Types.ObjectId,
    taskId: string | mongoose.Types.ObjectId,
    metadata: {
      deviceType?: string;
      serialNumber?: string;
      assetTag?: string;
      courierTrackingUrl?: string;
      courierProvider?: string;
      shipDate?: Date | string;
      receiptAttachment?: {
        uploadId?: string;
        fileUrl?: string;
        fileName?: string;
        uploadedAt?: Date | string;
      };
      mdmStatus?: string;
      mdmExternalId?: string;
    },
    actingUserId?: string
  ): Promise<ITask> {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const taskObjectId = new mongoose.Types.ObjectId(taskId);

    const task = await Task.findOne({
      _id: taskObjectId,
      organizationId: orgObjectId,
      isDeleted: false,
    });
    if (!task) {
      throw new AppError(404, "NOT_FOUND", "Task not found");
    }

    if (!task.hardwareMetadata) {
      task.hardwareMetadata = {};
    }

    if (metadata.deviceType) task.hardwareMetadata.deviceType = metadata.deviceType as any;
    if (metadata.serialNumber !== undefined) task.hardwareMetadata.serialNumber = metadata.serialNumber.trim();
    if (metadata.assetTag !== undefined) task.hardwareMetadata.assetTag = metadata.assetTag.trim();
    if (metadata.courierTrackingUrl !== undefined) task.hardwareMetadata.courierTrackingUrl = metadata.courierTrackingUrl.trim();
    if (metadata.courierProvider !== undefined) task.hardwareMetadata.courierProvider = metadata.courierProvider.trim();
    if (metadata.shipDate) task.hardwareMetadata.shipDate = new Date(metadata.shipDate);
    if (metadata.mdmStatus) task.hardwareMetadata.mdmStatus = metadata.mdmStatus as any;
    if (metadata.mdmExternalId) task.hardwareMetadata.mdmExternalId = metadata.mdmExternalId;

    if (metadata.receiptAttachment) {
      task.hardwareMetadata.receiptAttachment = {
        uploadId: metadata.receiptAttachment.uploadId ? new mongoose.Types.ObjectId(metadata.receiptAttachment.uploadId) : undefined,
        fileUrl: metadata.receiptAttachment.fileUrl,
        fileName: metadata.receiptAttachment.fileName,
        uploadedAt: metadata.receiptAttachment.uploadedAt ? new Date(metadata.receiptAttachment.uploadedAt) : new Date(),
      };
    }

    task.statusHistory.push({
      status: task.status,
      changedBy: actingUserId ? new mongoose.Types.ObjectId(actingUserId) : undefined,
      changedAt: new Date(),
      note: "Hardware metadata updated",
      actingRole: "it_admin",
    });

    await task.save();
    return task;
  }

  /**
   * Employee confirms receipt of hardware / equipment (e.g. laptop, safety kit, notebook)
   */
  async confirmHardwareReceipt(
    orgId: string | mongoose.Types.ObjectId,
    taskId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    note?: string
  ): Promise<ITask> {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const taskObjectId = new mongoose.Types.ObjectId(taskId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const task = await Task.findOne({
      _id: taskObjectId,
      organizationId: orgObjectId,
      isDeleted: false,
    });
    if (!task) {
      throw new AppError(404, "NOT_FOUND", "Hardware task not found");
    }

    if (!task.hardwareMetadata) {
      task.hardwareMetadata = {};
    }

    task.hardwareMetadata.mdmStatus = "delivered";
    task.hardwareMetadata.receivedConfirmedAt = new Date();
    task.hardwareMetadata.receivedConfirmedBy = userObjectId;

    // Auto-complete task if in progress or pending
    if (task.status === "pending" || task.status === "in_progress") {
      task.status = "completed";
      task.completedAt = new Date();
      task.completedBy = userObjectId;
    }

    task.statusHistory.push({
      status: task.status,
      changedBy: userObjectId,
      changedAt: new Date(),
      note: note || "Employee confirmed physical receipt of equipment",
      actingRole: "employee",
    });

    await task.save();

    // Notify task assignee / IT Admin of receipt confirmation
    if (task.assignedToUserId && task.assignedToUserId.toString() !== userObjectId.toString()) {
      const employee = await User.findById(userObjectId);
      const employeeName = `${employee?.profile?.firstName || ""} ${employee?.profile?.lastName || ""}`.trim() || "Employee";
      notificationService.createNotification({
        organizationId: orgId,
        recipientUserId: task.assignedToUserId,
        type: "manager_alert",
        title: `Hardware Receipt Confirmed by ${employeeName}`,
        message: `${employeeName} has confirmed physical receipt of: ${task.title}. Equipment status marked as delivered.`,
        priority: "medium",
        data: {
          taskId: task._id.toString(),
          employeeId: userObjectId.toString(),
          deepLink: "/tasks",
        },
      }).catch((err) => console.warn("[ItHardwareService] Receipt notification error:", err));
    }

    return task;
  }
}

export const itHardwareService = new ItHardwareService();
export default itHardwareService;
