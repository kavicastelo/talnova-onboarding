import mongoose from "mongoose";
import Alert, { AlertCategory, AlertSeverity, AlertStatus, IAlert } from "../models/alert.model.js";
import Organization from "../../organizations/models/organization.model.js";
import AuditLog from "../../audit-logs/models/audit-log.model.js";
import OnboardingCase from "../../onboarding/models/onboarding-case.model.js";
import Task from "../../tasks/models/task.model.js";

export class AlertService {
  /**
   * Synchronize platform condition states into the persistent Alert collection.
   * Auto-detects suspended tenants, failed onboarding cases, critical audit logs, and overdue tasks.
   * Auto-resolves alerts when underlying conditions clear.
   */
  public static async syncSystemAlerts(): Promise<void> {
    try {
      // 1. Scan for suspended organizations
      const suspendedOrgs = await Organization.find({ status: "Suspended", isDeleted: false })
        .select("_id name updatedAt createdAt")
        .lean();

      for (const org of suspendedOrgs) {
        const sourceId = org._id.toString();
        const existing = await Alert.findOne({ sourceId, status: { $ne: "resolved" } });
        if (!existing) {
          await Alert.create({
            category: "tenant",
            severity: "critical",
            title: `Tenant Suspended: ${org.name}`,
            description: "Organization is suspended / quarantined. Access is blocked.",
            sourceService: "organization-service",
            organizationId: org._id,
            sourceId,
            status: "open",
            createdAt: org.updatedAt || org.createdAt || new Date(),
          }).catch(() => {});
        }
      }

      // Auto-resolve tenant alerts if organization is reactivated
      const activeTenantAlerts = await Alert.find({
        category: "tenant",
        status: { $in: ["open", "acknowledged", "investigating"] },
      }).lean();

      for (const alert of activeTenantAlerts) {
        if (alert.organizationId) {
          const org = await Organization.findById(alert.organizationId).select("status isDeleted").lean();
          if (!org || org.status !== "Suspended" || org.isDeleted) {
            await Alert.findByIdAndUpdate(alert._id, {
              status: "resolved",
              resolvedAt: new Date(),
              resolutionNotes: "Auto-resolved: Organization status restored or reactivated.",
            }).catch(() => {});
          }
        }
      }

      // 2. Scan for critical security audit logs
      const criticalLogs = await AuditLog.find({ severity: "critical" })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

      for (const log of criticalLogs) {
        const sourceId = log._id.toString();
        const existing = await Alert.findOne({ sourceId });
        if (!existing) {
          await Alert.create({
            category: "security",
            severity: "critical",
            title: `Security Incident: ${log.eventType || log.action || "Critical Log"}`,
            description: log.description || "Critical security audit event captured.",
            sourceService: "audit-service",
            organizationId: log.organizationId,
            sourceId,
            status: "open",
            createdAt: log.createdAt || new Date(),
          }).catch(() => {});
        }
      }

      // 3. Scan for failed onboarding cases
      const failedCases = await OnboardingCase.find({ state: "provisioning_failed", isDeleted: false })
        .limit(20)
        .lean();

      for (const c of failedCases) {
        const sourceId = c._id.toString();
        const existing = await Alert.findOne({ sourceId, status: { $ne: "resolved" } });
        if (!existing) {
          await Alert.create({
            category: "onboarding",
            severity: "high",
            title: "Onboarding Provisioning Failed",
            description: (c as any).failure?.message || "Provisioning pipeline encountered an unhandled exception.",
            sourceService: "onboarding-service",
            organizationId: (c as any).organizationId,
            sourceId,
            status: "open",
            createdAt: (c as any).updatedAt || (c as any).createdAt || new Date(),
          }).catch(() => {});
        }
      }

      // 4. Scan for overdue tasks
      const overdueTasks = await Task.find({
        dueDate: { $lt: new Date() },
        status: { $nin: ["completed", "cancelled"] },
        isDeleted: false,
      })
        .limit(20)
        .lean();

      for (const t of overdueTasks) {
        const sourceId = t._id.toString();
        const existing = await Alert.findOne({ sourceId, status: { $ne: "resolved" } });
        if (!existing) {
          const dueStr = t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "Overdue";
          await Alert.create({
            category: "operations",
            severity: "warning",
            title: `SLA Breach: ${t.title}`,
            description: `Task has breached its due date: ${dueStr}.`,
            sourceService: "task-service",
            organizationId: (t as any).organizationId,
            sourceId,
            status: "open",
            createdAt: t.dueDate || (t as any).createdAt || new Date(),
          }).catch(() => {});
        }
      }
    } catch (err: any) {
      console.warn("[AlertService] syncSystemAlerts warning:", err.message);
    }
  }

  /**
   * Helper to create an incident alert manually or via event subscriber
   */
  public static async createAlert(params: {
    category: AlertCategory;
    severity: AlertSeverity;
    title: string;
    description: string;
    sourceService: string;
    sourceId: string;
    organizationId?: any;
    status?: AlertStatus;
  }): Promise<IAlert> {
    return await Alert.create({
      ...params,
      status: params.status || "open",
    });
  }

  /**
   * Update the lifecycle status of an alert and log the audit entry
   */
  public static async updateAlertStatus(params: {
    alertId: string;
    status: AlertStatus;
    operatorUserId?: string;
    resolutionNotes?: string;
  }): Promise<IAlert> {
    const { alertId, status, operatorUserId, resolutionNotes } = params;

    const query: any = mongoose.Types.ObjectId.isValid(alertId)
      ? { $or: [{ _id: alertId }, { alertNo: alertId }, { sourceId: alertId }] }
      : { $or: [{ alertNo: alertId }, { sourceId: alertId }] };

    const alert = await Alert.findOne(query);
    if (!alert) {
      const err: any = new Error(`Alert '${alertId}' not found`);
      err.statusCode = 404;
      throw err;
    }

    if (alert.status === "resolved" && status === "resolved") {
      const err: any = new Error("Alert is already resolved");
      err.statusCode = 400;
      throw err;
    }

    const previousStatus = alert.status;
    alert.status = status;

    if (status === "acknowledged") {
      alert.acknowledgedBy = operatorUserId ? new mongoose.Types.ObjectId(operatorUserId) : undefined;
      alert.acknowledgedAt = new Date();
    } else if (status === "investigating") {
      if (!alert.acknowledgedAt) {
        alert.acknowledgedAt = new Date();
        alert.acknowledgedBy = operatorUserId ? new mongoose.Types.ObjectId(operatorUserId) : undefined;
      }
    } else if (status === "resolved") {
      alert.resolvedBy = operatorUserId ? new mongoose.Types.ObjectId(operatorUserId) : undefined;
      alert.resolvedAt = new Date();
      alert.resolutionNotes = resolutionNotes || "Resolved by Super Admin";
    } else if (status === "open") {
      alert.resolvedBy = undefined;
      alert.resolvedAt = undefined;
      alert.resolutionNotes = undefined;
    }

    await alert.save();

    // Write to AuditLog
    if (operatorUserId && mongoose.Types.ObjectId.isValid(operatorUserId)) {
      await AuditLog.create({
        actorUserId: new mongoose.Types.ObjectId(operatorUserId),
        actorType: "user",
        eventCategory: "security",
        eventType: status === "resolved" ? "ALERT_RESOLVED" : "ALERT_STATUS_CHANGED",
        resourceType: "Alert",
        resourceId: alert._id,
        organizationId: alert.organizationId,
        action: "status_change",
        description: `Alert ${alert.alertNo} status changed from ${previousStatus} to ${status}${
          resolutionNotes ? `: ${resolutionNotes}` : ""
        }`,
        severity: status === "resolved" ? "info" : "warning",
        metadata: {
          alertId: alert._id.toString(),
          alertNo: alert.alertNo,
          previousStatus,
          newStatus: status,
          resolutionNotes,
        },
      }).catch((err) => {
        console.warn("[AlertService] Failed to write AuditLog:", err.message);
      });
    }

    return alert;
  }
}

export default AlertService;
