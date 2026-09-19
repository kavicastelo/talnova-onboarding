import mongoose from "mongoose";
import Organization from "../../organizations/models/organization.model.js";
import User from "../../auth/models/user.model.js";
import Invoice from "../models/invoice.model.js";
import PaymentRecord from "../models/payment-record.model.js";
import ExpenseRecord from "../models/expense-record.model.js";
import OnboardingCase from "../../onboarding/models/onboarding-case.model.js";
import Journey from "../../journeys/models/journey.model.js";
import Task from "../../tasks/models/task.model.js";
import FeatureFlag from "../models/feature-flag.model.js";
import AuditLog from "../../audit-logs/models/audit-log.model.js";
import Session from "../../auth/models/session.model.js";
import { Upload } from "../../uploads/models/upload.model.js";
import AIUsageRecord from "../models/ai-usage-record.model.js";
import TelemetryBuffer from "../../../infrastructure/telemetry/telemetry-buffer.js";

export interface GeneratedReport {
  content: string;
  contentType: string;
  rowCount: number;
  format: "csv" | "json";
  filename: string;
}

export function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '""';
  if (val instanceof Date) return `"${val.toISOString()}"`;
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

export class ReportGeneratorService {
  private static readonly CANONICAL_IDS = new Set([
    "rep-org-growth",
    "rep-user-licenses",
    "rep-arr-ledger",
    "rep-payment-reconciliation",
    "rep-operating-expenses",
    "rep-onboarding-funnel",
    "rep-journey-dropoff",
    "rep-hardware-sla",
    "rep-feature-adoption",
    "rep-security-audit",
    "rep-session-security",
    "rep-storage-quotas",
    "rep-ai-tokens",
    "rep-api-latency",
    "rep-gdpr-compliance",
  ]);

  public static isSupportedReport(reportId: string): boolean {
    return this.CANONICAL_IDS.has(reportId);
  }

  public static async generateReport(
    reportId: string,
    requestedFormat?: string
  ): Promise<GeneratedReport> {
    if (!this.isSupportedReport(reportId)) {
      const err: any = new Error(`Unsupported report identifier: ${reportId}`);
      err.statusCode = 404;
      throw err;
    }

    const defaultFormat = reportId === "rep-session-security" || reportId === "rep-api-latency" ? "json" : "csv";
    const format = (requestedFormat?.toLowerCase() === "json" ? "json" : requestedFormat?.toLowerCase() === "csv" ? "csv" : defaultFormat) as "csv" | "json";

    let rows: any[] = [];
    let headers: string[] = [];

    switch (reportId) {
      case "rep-org-growth": {
        const orgs = await Organization.find({ isDeleted: false }).sort({ createdAt: -1 }).lean();
        headers = ["Organization ID", "Name", "Slug", "Plan Tier", "Status", "Seat Quota", "Created At"];
        rows = orgs.map((o) => [
          o._id.toString(),
          o.name,
          o.slug,
          o.plan,
          o.status,
          (o as any).userLimit || 50,
          o.createdAt,
        ]);
        break;
      }

      case "rep-user-licenses": {
        const orgs = await Organization.find({ isDeleted: false }).lean();
        const userCounts = await User.aggregate([
          { $group: { _id: "$organizationId", total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ["$employment.status", "active"] }, 1, 0] } } } },
        ]);
        const userCountMap = new Map(userCounts.map((u) => [u._id?.toString(), u]));

        headers = ["Organization ID", "Organization Name", "Plan Tier", "Active Employees", "Total Users", "Seat Limit", "Overage"];
        rows = orgs.map((o) => {
          const stats = userCountMap.get(o._id.toString()) || { total: 0, active: 0 };
          const limit = (o as any).userLimit || 50;
          const overage = Math.max(0, stats.active - limit);
          return [o._id.toString(), o.name, o.plan, stats.active, stats.total, limit, overage];
        });

        if (format === "json") {
          const content = JSON.stringify(
            {
              report: "Cross-Tenant User License & Seat Consumption",
              generatedAt: new Date().toISOString(),
              totalOrganizations: orgs.length,
              tenants: rows.map((r) => ({
                id: r[0],
                name: r[1],
                plan: r[2],
                activeEmployees: r[3],
                totalUsers: r[4],
                seatLimit: r[5],
                overage: r[6],
              })),
            },
            null,
            2
          );
          return {
            content,
            contentType: "application/json; charset=utf-8",
            rowCount: orgs.length,
            format: "json",
            filename: `${reportId}-${Date.now()}.json`,
          };
        }
        break;
      }

      case "rep-arr-ledger": {
        const invoices = await Invoice.find({ isDeleted: false }).lean();
        const expenses = await ExpenseRecord.find({}).lean();
        const payments = await PaymentRecord.find({ verificationStatus: "verified" }).lean();

        const totalInvoiced = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
        const cashCollected = payments.reduce((s, p) => s + (p.amount || 0), 0);
        const operatingExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
        const netOperatingResult = cashCollected - operatingExpenses;
        const netMarginPct = cashCollected > 0 ? Math.round((netOperatingResult / cashCollected) * 10000) / 100 : 0;

        headers = ["Metric", "Value USD", "Notes"];
        rows = [
          ["Total Invoiced Gross", totalInvoiced, "All active generated invoices"],
          ["Total Cash Collected", cashCollected, "Verified manual & gateway payments"],
          ["Total Operating Expenses", operatingExpenses, "Recorded cloud & AI compute expenses"],
          ["Net Operating Result", netOperatingResult, "Cash collected minus operational expenses"],
          ["Operating Margin %", `${netMarginPct}%`, "Deterministic P&L result"],
        ];
        break;
      }

      case "rep-payment-reconciliation": {
        const payments = await PaymentRecord.find({}).sort({ paymentDate: -1 }).lean();

        const userIds = payments
          .map((p) => p.recordedBy)
          .filter((id) => id && mongoose.Types.ObjectId.isValid(id.toString()));
        const orgIds = payments
          .map((p) => p.organizationId)
          .filter((id) => id && mongoose.Types.ObjectId.isValid(id.toString()));

        const [users, orgs] = await Promise.all([
          User.find({ _id: { $in: userIds } }, "profile.fullName auth.email").lean(),
          Organization.find({ _id: { $in: orgIds } }, "name slug").lean(),
        ]);

        const userMap = new Map(users.map((u) => [u._id.toString(), u]));
        const orgMap = new Map(orgs.map((o) => [o._id.toString(), o]));

        headers = ["Payment No", "Invoice No", "Organization", "Amount", "Currency", "Payment Method", "Reference", "Verification Status", "Payment Date", "Recorded By"];
        rows = payments.map((p) => {
          const org = orgMap.get(p.organizationId?.toString() || "");
          const user = userMap.get(p.recordedBy?.toString() || "");
          const recordedByName = user?.profile?.fullName || user?.auth?.email || (typeof p.recordedBy === "string" ? p.recordedBy : "System");
          return [
            p.paymentNo,
            p.invoiceNo,
            org?.name || p.organizationName || "N/A",
            p.amount,
            p.currency || "USD",
            p.paymentMethod,
            p.referenceNumber || (p as any).reference || "N/A",
            p.verificationStatus,
            p.paymentDate,
            recordedByName,
          ];
        });
        break;
      }

      case "rep-operating-expenses": {
        const expenses = await ExpenseRecord.find({}).sort({ expenseDate: -1 }).lean();
        headers = ["Expense No", "Category", "Vendor", "Amount USD", "Expense Date", "Recurring", "Receipt URL", "Description"];
        rows = expenses.map((e) => [
          e.expenseNo || e._id.toString(),
          e.category,
          e.vendor,
          e.amount,
          e.expenseDate || (e as any).incurredAt,
          e.isRecurring ? "RECURRING" : "ONE_TIME",
          e.receiptUrl || "N/A",
          e.description,
        ]);
        break;
      }

      case "rep-onboarding-funnel": {
        const cases = await OnboardingCase.find({ isDeleted: false })
          .populate("organizationId", "name")
          .populate("employeeId", "profile.fullName auth.email")
          .sort({ createdAt: -1 })
          .lean();

        headers = ["Case ID", "Employee Name", "Employee Email", "Organization", "State", "State Reason", "Source", "Transitions Count", "Created At"];
        rows = cases.map((c) => [
          c._id.toString(),
          (c.employeeId as any)?.profile?.fullName || "N/A",
          (c.employeeId as any)?.auth?.email || "N/A",
          (c.organizationId as any)?.name || "N/A",
          c.state,
          c.stateReason || "N/A",
          c.source,
          c.transitions?.length || 0,
          c.createdAt,
        ]);
        break;
      }

      case "rep-journey-dropoff": {
        const journeys = await Journey.find({ isDeleted: false })
          .populate("organizationId", "name")
          .sort({ createdAt: -1 })
          .lean();

        headers = ["Journey ID", "Title", "Organization", "Category", "Status", "Total Modules", "Start Offset Days", "Created At"];
        rows = journeys.map((j) => [
          j._id.toString(),
          j.title,
          (j.organizationId as any)?.name || "Default",
          j.category || "General",
          j.publishing?.status || "draft",
          j.modules?.length || 0,
          j.audience?.startDateOffsetDays || 30,
          j.createdAt,
        ]);
        break;
      }

      case "rep-hardware-sla": {
        const tasks = await Task.find({ isDeleted: false })
          .populate("organizationId", "name")
          .populate("assignedToUserId", "profile.fullName")
          .sort({ dueDate: 1 })
          .lean();

        headers = ["Task ID", "Title", "Organization", "Assigned User", "Priority", "Status", "Due Date", "Is Overdue", "Created At"];
        rows = tasks.map((t) => {
          const isOverdue = t.dueDate ? new Date(t.dueDate) < new Date() && !["completed", "cancelled"].includes(t.status) : false;
          return [
            t._id.toString(),
            t.title,
            (t.organizationId as any)?.name || "N/A",
            (t.assignedToUserId as any)?.profile?.fullName || "Unassigned",
            t.priority,
            t.status,
            t.dueDate || "None",
            isOverdue ? "OVERDUE" : "ON_SCHEDULE",
            t.createdAt,
          ];
        });
        break;
      }

      case "rep-feature-adoption": {
        const flags = await FeatureFlag.find({}).sort({ key: 1 }).lean();
        headers = ["Flag Key", "Name", "Global State", "Rollout %", "Target Audience", "Targeted Orgs Count", "Updated At"];
        rows = flags.map((f) => [
          f.key,
          f.name,
          f.isEnabled ? "ENABLED" : "DISABLED",
          f.rolloutPercentage,
          f.targetAudience,
          f.targetOrganizationIds?.length || 0,
          f.updatedAt,
        ]);
        break;
      }

      case "rep-security-audit": {
        const logs = await AuditLog.find({})
          .populate("actorUserId", "profile.fullName auth.email")
          .populate("organizationId", "name")
          .sort({ createdAt: -1 })
          .limit(1000)
          .lean();

        headers = ["Timestamp", "Category", "Event Type", "Action", "Resource Type", "Actor", "Organization", "Severity", "Description"];
        rows = logs.map((l) => [
          l.createdAt,
          l.eventCategory,
          l.eventType,
          l.action,
          l.resourceType,
          (l.actorUserId as any)?.profile?.fullName || (l.actorUserId as any)?.auth?.email || "System",
          (l.organizationId as any)?.name || "Platform",
          l.severity,
          l.description,
        ]);
        break;
      }

      case "rep-session-security": {
        const sessions = await Session.find({})
          .populate("userId", "profile.fullName auth.email")
          .populate("organizationId", "name")
          .sort({ lastActivityAt: -1 })
          .limit(500)
          .lean();

        if (format === "json") {
          const content = JSON.stringify(
            {
              report: "Active User Sessions & Security",
              generatedAt: new Date().toISOString(),
              totalSessions: sessions.length,
              sessions: sessions.map((s) => ({
                id: s._id.toString(),
                user: (s.userId as any)?.profile?.fullName || "Unknown",
                email: (s.userId as any)?.auth?.email || "Unknown",
                organization: (s.organizationId as any)?.name || "Platform",
                ipAddress: s.ipAddress || "N/A",
                deviceInfo: s.deviceInfo || "Unknown",
                isActive: s.isValid && new Date(s.expiresAt) > new Date(),
                expiresAt: s.expiresAt,
                lastActivityAt: s.lastActivityAt,
              })),
            },
            null,
            2
          );
          return {
            content,
            contentType: "application/json; charset=utf-8",
            rowCount: sessions.length,
            format: "json",
            filename: `${reportId}-${Date.now()}.json`,
          };
        }

        headers = ["Session ID", "User", "Email", "Organization", "IP Address", "Device Info", "Is Active", "Expires At", "Last Activity"];
        rows = sessions.map((s) => [
          s._id.toString(),
          (s.userId as any)?.profile?.fullName || "Unknown",
          (s.userId as any)?.auth?.email || "Unknown",
          (s.organizationId as any)?.name || "Platform",
          s.ipAddress || "N/A",
          s.deviceInfo || "N/A",
          s.isValid && new Date(s.expiresAt) > new Date() ? "ACTIVE" : "EXPIRED",
          s.expiresAt,
          s.lastActivityAt,
        ]);
        break;
      }

      case "rep-storage-quotas": {
        const storageStats = await Upload.aggregate([
          { $match: { "lifecycle.status": { $ne: "deleted" } } },
          { $group: { _id: "$type", totalBytes: { $sum: "$fileSizeBytes" }, count: { $sum: 1 } } },
        ]);

        headers = ["Media Purpose / MIME Group", "Total MB", "Total GB", "Object Count"];
        rows = storageStats.map((st) => {
          const mb = Math.round(((st.totalBytes || 0) / (1024 * 1024)) * 100) / 100;
          const gb = Math.round((mb / 1024) * 100) / 100;
          return [st._id || "general", mb, gb, st.count];
        });
        break;
      }

      case "rep-ai-tokens": {
        const aiRecords = await AIUsageRecord.find({})
          .populate("organizationId", "name")
          .populate("userId", "profile.fullName")
          .sort({ createdAt: -1 })
          .limit(1000)
          .lean();

        headers = ["Record ID", "Feature", "Provider", "Model", "Prompt Tokens", "Completion Tokens", "Total Tokens", "Estimated Cost USD", "Latency ms", "Status", "Created At"];
        rows = aiRecords.map((r) => [
          r._id.toString(),
          r.feature,
          r.provider,
          r.model,
          r.inputTokens,
          r.outputTokens,
          r.totalTokens,
          r.estimatedCostUsd,
          r.latencyMs,
          r.status,
          r.createdAt,
        ]);
        break;
      }

      case "rep-api-latency": {
        const metrics = TelemetryBuffer.getMetrics(60000);
        if (format === "json") {
          const content = JSON.stringify(
            {
              report: "API Latency & Route Reliability",
              generatedAt: new Date().toISOString(),
              windowMs: 60000,
              latency: metrics.latency,
              throughput: metrics.throughput,
              endpoints: metrics.endpoints,
            },
            null,
            2
          );
          return {
            content,
            contentType: "application/json; charset=utf-8",
            rowCount: metrics.endpoints.length,
            format: "json",
            filename: `${reportId}-${Date.now()}.json`,
          };
        }

        headers = ["Endpoint Route", "P95 Latency ms", "Call Count", "Health Status"];
        rows = metrics.endpoints.map((e) => [e.route, e.p95, e.count24h, e.status]);
        break;
      }

      case "rep-gdpr-compliance": {
        const logs = await AuditLog.find({
          $or: [
            { action: { $in: ["delete", "archive", "restore"] } },
            { eventCategory: { $in: ["user", "security"] } },
          ],
        })
          .sort({ createdAt: -1 })
          .limit(500)
          .lean();

        headers = ["Log ID", "Category", "Event Type", "Action", "Resource Type", "Resource ID", "Severity", "Description", "Timestamp"];
        rows = logs.map((l) => [
          l._id.toString(),
          l.eventCategory,
          l.eventType,
          l.action,
          l.resourceType,
          l.resourceId?.toString() || "N/A",
          l.severity,
          l.description,
          l.createdAt,
        ]);
        break;
      }

      default: {
        const err: any = new Error(`Unsupported report identifier: ${reportId}`);
        err.statusCode = 404;
        throw err;
      }
    }

    if (format === "json") {
      const dataObjects = rows.map((row) => {
        const obj: Record<string, any> = {};
        headers.forEach((header, idx) => {
          obj[header] = row[idx];
        });
        return obj;
      });

      const content = JSON.stringify(
        {
          reportId,
          generatedAt: new Date().toISOString(),
          rowCount: dataObjects.length,
          data: dataObjects,
        },
        null,
        2
      );

      return {
        content,
        contentType: "application/json; charset=utf-8",
        rowCount: dataObjects.length,
        format: "json",
        filename: `${reportId}-${Date.now()}.json`,
      };
    }

    // Build CSV
    const csvHeaderLine = headers.map(escapeCsv).join(",");
    const csvDataLines = rows.map((row) => row.map(escapeCsv).join(","));
    const content = [csvHeaderLine, ...csvDataLines].join("\n");

    return {
      content,
      contentType: "text/csv; charset=utf-8",
      rowCount: rows.length,
      format: "csv",
      filename: `${reportId}-${Date.now()}.csv`,
    };
  }
}

export default ReportGeneratorService;
