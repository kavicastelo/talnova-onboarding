import mongoose from "mongoose";
import AppError from "../../../common/errors/app-error.js";
import Organization from "../../organizations/models/organization.model.js";
import User from "../../auth/models/user.model.js";
import AuditLog from "../../audit-logs/models/audit-log.model.js";
import Invoice from "../models/invoice.model.js";
import PaymentRecord from "../models/payment-record.model.js";
import ExpenseRecord from "../models/expense-record.model.js";
import CustomerAccount from "../models/customer-account.model.js";
import AIUsageRecord from "../models/ai-usage-record.model.js";
import FeatureFlag from "../models/feature-flag.model.js";
import FeatureFlagService from "./feature-flag.service.js";
import Journey from "../../journeys/models/journey.model.js";
import OnboardingCase from "../../onboarding/models/onboarding-case.model.js";
import { Upload } from "../../uploads/models/upload.model.js";
import Session from "../../auth/models/session.model.js";
import Task from "../../tasks/models/task.model.js";
import Alert from "../models/alert.model.js";
import AlertService from "./alert.service.js";
import ReportGeneratorService from "./report-generator.service.js";
import PlatformSetting from "../models/platform-setting.model.js";
import { hashPassword } from "../../../utils/crypto.js";
import TelemetryBuffer from "../../../infrastructure/telemetry/telemetry-buffer.js";
import TenantStatusCache from "../../../infrastructure/cache/tenant-status.cache.js";
import { DEFAULT_PLATFORM_FLAGS, type IFeatureFlagSeed } from "../config/default-feature-flags.js";
export { DEFAULT_PLATFORM_FLAGS, type IFeatureFlagSeed };

export class SuperAdminService {
  // ---------------------------------------------------------------------------
  // 1. Search & Telemetry
  // ---------------------------------------------------------------------------

  async searchGlobal(q?: string, limit: string = "10") {
    if (!q || typeof q !== "string" || q.trim().length < 2) {
      return { organizations: [], users: [], journeys: [], invoices: [] };
    }

    const queryStr = q.trim();
    const limitNum = Math.min(25, parseInt(limit) || 10);
    const regex = new RegExp(queryStr, "i");

    const [orgs, users, journeys, invoices] = await Promise.all([
      Organization.find({
        isDeleted: false,
        $or: [
          { name: regex },
          { domain: regex },
          { slug: regex },
          { supportEmail: regex },
        ],
      })
        .limit(limitNum)
        .select("_id name slug domain plan status"),

      User.find({
        isDeleted: false,
        $or: [
          { "profile.fullName": regex },
          { "profile.firstName": regex },
          { "profile.lastName": regex },
          { "auth.email": regex },
          { "employment.employeeId": regex },
          { "employment.department": regex },
        ],
      })
        .limit(limitNum)
        .select(
          "_id profile.fullName auth.email permissions.role employment.status employment.department organizationId"
        ),

      Journey.find({
        isDeleted: false,
        $or: [{ title: regex }, { description: regex }],
      })
        .limit(limitNum)
        .select("_id title status version organizationId"),

      Invoice.find({
        isDeleted: false,
        $or: [
          { invoiceNo: regex },
          { customerName: regex },
          { organization: regex },
          { description: regex },
        ],
      })
        .limit(limitNum)
        .select(
          "_id invoiceNo customerName organization amount totalAmount balanceDue status dueDate organizationId"
        ),
    ]);

    return {
      organizations: orgs.map((o) => ({
        id: o._id.toString(),
        name: o.name,
        slug: o.slug,
        domain: o.domain,
        plan: o.plan,
        status: o.status,
        type: "organization",
      })),
      users: users.map((u) => ({
        id: u._id.toString(),
        name: u.profile?.fullName || "Unnamed User",
        email: u.auth?.email,
        role: u.permissions?.role,
        department: u.employment?.department,
        status: u.employment?.status,
        organizationId: u.organizationId?.toString(),
        type: "user",
      })),
      journeys: journeys.map((j) => ({
        id: j._id.toString(),
        title: j.title,
        status: (j as any).status || "published",
        organizationId: j.organizationId?.toString(),
        type: "journey",
      })),
      invoices: invoices.map((i) => ({
        id: i._id.toString(),
        invoiceNo: i.invoiceNo,
        customerName: (i as any).customerName || i.organization,
        amount: (i as any).totalAmount ?? i.amount,
        balanceDue:
          (i as any).balanceDue ??
          ((i as any).status === "Paid" || (i as any).status === "paid"
            ? 0
            : (i as any).totalAmount ?? i.amount),
        status: i.status,
        dueDate: i.dueDate,
        organizationId: i.organizationId?.toString(),
        type: "invoice",
      })),
    };
  }

  async getTelemetry(query: any) {
    const { organizationId } = query || {};
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const isOrgScoped =
      organizationId &&
      organizationId !== "all" &&
      mongoose.Types.ObjectId.isValid(organizationId);
    const orgFilter = isOrgScoped
      ? { organizationId: new mongoose.Types.ObjectId(organizationId) }
      : {};

    // 1. Organizations count & delta
    const totalOrganizations = isOrgScoped
      ? 1
      : await Organization.countDocuments({ isDeleted: false });
    const activeOrganizations = isOrgScoped
      ? await Organization.countDocuments({
          _id: organizationId,
          isDeleted: false,
          status: "Active",
        })
      : await Organization.countDocuments({ isDeleted: false, status: "Active" });
    const suspendedOrganizations = totalOrganizations - activeOrganizations;
    const orgsBefore30d = isOrgScoped
      ? 1
      : await Organization.countDocuments({
          createdAt: { $lt: thirtyDaysAgo },
          isDeleted: false,
        });
    const orgsInLast30d = totalOrganizations - orgsBefore30d;
    const orgsDeltaPct =
      orgsBefore30d > 0
        ? Math.round((orgsInLast30d / orgsBefore30d) * 100)
        : 0;
    const orgsDeltaStr =
      orgsDeltaPct >= 0 ? `+${orgsDeltaPct}%` : `${orgsDeltaPct}%`;

    // 2. Platform Users count & delta
    const userFilter: any = { isDeleted: false, ...orgFilter };
    const platformUsers = await User.countDocuments(userFilter);
    const activeUsers = await User.countDocuments({
      ...userFilter,
      "employment.status": "Active",
    });
    const usersBefore30d = await User.countDocuments({
      ...userFilter,
      createdAt: { $lt: thirtyDaysAgo },
    });
    const usersInLast30d = platformUsers - usersBefore30d;
    const usersDeltaPct =
      usersBefore30d > 0
        ? Math.round((usersInLast30d / usersBefore30d) * 100)
        : 0;
    const usersDeltaStr =
      usersDeltaPct >= 0 ? `+${usersDeltaPct}%` : `${usersDeltaPct}%`;

    // 3. Active Onboardings in flight
    const caseFilter: any = {
      isDeleted: false,
      state: {
        $in: [
          "active",
          "ready",
          "provisioning",
          "ready_for_handover",
          "handover_pending",
        ],
      },
      ...orgFilter,
    };
    const activeOnboardings = await OnboardingCase.countDocuments(caseFilter);
    const onboardingsBefore30d = await OnboardingCase.countDocuments({
      ...caseFilter,
      createdAt: { $lt: thirtyDaysAgo },
    });
    const onboardingsDelta = activeOnboardings - onboardingsBefore30d;
    const onboardingsDeltaStr =
      onboardingsDelta >= 0 ? `+${onboardingsDelta}` : `${onboardingsDelta}`;

    // 4. Cash Collected (Paid invoices)
    const invoiceFilter: any = {
      status: { $in: ["Paid", "paid"] },
      isDeleted: false,
      ...orgFilter,
    };
    const currRevenueInvoices = await Invoice.find({
      ...invoiceFilter,
      createdAt: { $gte: thirtyDaysAgo },
    });
    const currRevenue = currRevenueInvoices.reduce(
      (sum, inv) => sum + (inv.totalAmount ?? inv.amount ?? 0),
      0
    );

    const prevRevenueInvoices = await Invoice.find({
      ...invoiceFilter,
      createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
    });
    const prevRevenue = prevRevenueInvoices.reduce(
      (sum, inv) => sum + (inv.totalAmount ?? inv.amount ?? 0),
      0
    );

    const revenueDeltaPct =
      prevRevenue > 0
        ? Math.round(((currRevenue - prevRevenue) / prevRevenue) * 100)
        : currRevenue > 0
        ? 100
        : 0;
    const revenueDeltaStr =
      revenueDeltaPct >= 0 ? `+${revenueDeltaPct}%` : `${revenueDeltaPct}%`;

    const allPaidInvoices = await Invoice.find(invoiceFilter);
    const totalPaidRevenue = allPaidInvoices.reduce(
      (sum, inv) => sum + (inv.totalAmount ?? inv.amount ?? 0),
      0
    );
    const cashCollected = totalPaidRevenue;

    // 5. Operating Expenses & Net Operating Result
    const expenseFilter: any = { isDeleted: { $ne: true } };
    if (orgFilter.organizationId) {
      expenseFilter.organizationId = orgFilter.organizationId;
    }

    const [currExpenseAgg, prevExpenseAgg, allExpenseAgg] = await Promise.all([
      ExpenseRecord.aggregate([
        { $match: { ...expenseFilter, expenseDate: { $gte: thirtyDaysAgo } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      ExpenseRecord.aggregate([
        {
          $match: {
            ...expenseFilter,
            expenseDate: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      ExpenseRecord.aggregate([
        { $match: expenseFilter },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    const currExpenses =
      Math.round(((currExpenseAgg[0]?.total || 0) + Number.EPSILON) * 100) / 100;
    const prevExpenses =
      Math.round(((prevExpenseAgg[0]?.total || 0) + Number.EPSILON) * 100) / 100;
    const operatingExpenses =
      Math.round(((allExpenseAgg[0]?.total || 0) + Number.EPSILON) * 100) / 100;

    const expenseDeltaPct =
      prevExpenses > 0
        ? Math.round(((currExpenses - prevExpenses) / prevExpenses) * 100)
        : currExpenses > 0
        ? 100
        : 0;
    const expenseDeltaStr =
      expenseDeltaPct >= 0 ? `+${expenseDeltaPct}%` : `${expenseDeltaPct}%`;

    const netOperatingResult =
      Math.round(
        (cashCollected - operatingExpenses + Number.EPSILON) * 100
      ) / 100;

    // 6. Open Platform Alerts
    const auditFilter: any = orgFilter.organizationId
      ? { organizationId: orgFilter.organizationId }
      : {};
    const [criticalLogs24h, highLogs24h] = await Promise.all([
      AuditLog.countDocuments({
        ...auditFilter,
        severity: "critical",
        createdAt: { $gte: twentyFourHoursAgo },
      }),
      AuditLog.countDocuments({
        ...auditFilter,
        severity: "high",
        createdAt: { $gte: twentyFourHoursAgo },
      }),
    ]);
    const openAlerts = criticalLogs24h + highLogs24h;

    // 7. System Health Score
    const systemHealthVal = Math.max(
      90.0,
      Number(
        (100.0 - (criticalLogs24h * 1.5 + highLogs24h * 0.5)).toFixed(1)
      )
    );
    const systemHealthStatus =
      systemHealthVal >= 98.0
        ? "HEALTHY"
        : systemHealthVal >= 94.0
        ? "DEGRADED"
        : "CRITICAL";

    // 8. 6-Month dynamic Growth Analytics data
    const growthData: any[] = [];
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() - i,
        1,
        0,
        0,
        0,
        0
      );
      const endOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() - i + 1,
        0,
        23,
        59,
        59,
        999
      );
      const monthLabel = monthNames[targetDate.getMonth()];

      const orgsCount = isOrgScoped
        ? 1
        : await Organization.countDocuments({
            createdAt: { $lte: endOfMonth },
            isDeleted: false,
          });

      const usersCount = await User.countDocuments({
        ...userFilter,
        createdAt: { $lte: endOfMonth },
      });

      const monthlyPaidInvoices = await Invoice.find({
        ...invoiceFilter,
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      });
      const monthlyRevenue = monthlyPaidInvoices.reduce(
        (sum, inv) => sum + (inv.totalAmount ?? inv.amount ?? 0),
        0
      );

      const monthlyOnboardings = await OnboardingCase.countDocuments({
        ...caseFilter,
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      });

      growthData.push({
        month: monthLabel,
        organizations: orgsCount,
        revenue: monthlyRevenue,
        users: usersCount,
        onboardings: monthlyOnboardings,
      });
    }

    return {
      stats: {
        totalOrganizations: {
          value: totalOrganizations,
          active: activeOrganizations,
          suspended: suspendedOrganizations,
          delta: orgsDeltaStr,
        },
        platformUsers: {
          value: platformUsers,
          active: activeUsers,
          delta: usersDeltaStr,
        },
        activeOnboardings: {
          value: activeOnboardings,
          delta: onboardingsDeltaStr,
        },
        cashCollected: {
          value: cashCollected,
          delta: revenueDeltaStr,
        },
        operatingExpenses: {
          value: operatingExpenses,
          delta: expenseDeltaStr,
        },
        netOperatingResult: {
          value: netOperatingResult,
          delta: revenueDeltaStr,
        },
        openAlerts: {
          value: openAlerts,
          critical: criticalLogs24h,
          high: highLogs24h,
        },
        systemHealth: {
          value: systemHealthVal,
          status: systemHealthStatus,
          avgLatencyMs: 42,
        },
        monthlyRevenue: {
          value: currRevenue > 0 ? currRevenue : cashCollected,
          delta: revenueDeltaStr,
        },
      },
      growthData,
    };
  }

  async getActivityLogs() {
    const orgs = await Organization.find({ isDeleted: false });
    const orgMap = new Map(orgs.map((o) => [o._id.toString(), o.name]));

    const dbLogs = await AuditLog.find().sort({ createdAt: -1 }).limit(20);
    return dbLogs.map((log) => ({
      id: log._id.toString(),
      org:
        (log.organizationId
          ? orgMap.get(log.organizationId.toString())
          : null) || "System Platform",
      event: log.description,
      time:
        log.createdAt.toLocaleTimeString() +
        " (" +
        log.createdAt.toLocaleDateString() +
        ")",
      type:
        log.eventCategory === "user"
          ? "user"
          : log.eventCategory === "journey"
          ? "journey"
          : "system",
    }));
  }

  async getStats() {
    const totalTenants = await Organization.countDocuments({ isDeleted: false });
    const activeTenants = await Organization.countDocuments({
      isDeleted: false,
      status: "Active",
    });
    const platformUsers = await User.countDocuments({ isDeleted: false });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const currRevenueInvoices = await Invoice.find({
      status: "Paid",
      createdAt: { $gte: thirtyDaysAgo },
      isDeleted: false,
    });
    const currRevenue = currRevenueInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const allPaidInvoices = await Invoice.find({ status: "Paid", isDeleted: false });
    const totalPaidRevenue = allPaidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const mrr = currRevenue > 0 ? currRevenue : totalPaidRevenue;

    const criticalLogs = await AuditLog.countDocuments({
      severity: "critical",
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    const systemHealth = Math.max(95.0, 100.0 - criticalLogs * 0.5);
    const systemHealthStatus = systemHealth > 98.0 ? "UP" : "DEGRADED";

    return {
      totalTenants,
      totalOrganizations: totalTenants,
      activeTenants,
      platformUsers,
      mrr,
      monthlyRevenue: mrr,
      systemHealth,
      systemHealthStatus,
    };
  }

  // ---------------------------------------------------------------------------
  // 2. Organizations
  // ---------------------------------------------------------------------------

  async getOrganizations(query: any) {
    const { search, page = "1", limit = "10" } = query || {};
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const filter: any = { isDeleted: false };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { domain: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
        { supportEmail: { $regex: search, $options: "i" } },
      ];
    }

    const orgs = await Organization.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);
    const total = await Organization.countDocuments(filter);

    const mappedOrgs = await Promise.all(
      orgs.map(async (org) => {
        const usersCount = await User.countDocuments({
          organizationId: org._id,
          isDeleted: false,
        });
        return {
          id: org._id.toString(),
          name: org.name,
          domain: org.domain || "",
          slug: org.slug,
          plan: org.plan || "Starter",
          status: org.status || "Active",
          subscription: org.subscription,
          limits: org.limits,
          seatLimit: org.limits?.maxUsers || org.subscription?.seatLimit || 50,
          usersCount,
          createdAt: org.createdAt
            ? org.createdAt.toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
          supportEmail: org.supportEmail || "support@talnova.com",
        };
      })
    );

    return {
      data: mappedOrgs,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    };
  }

  async createOrganization(body: any, actorUserId: string) {
    const {
      name,
      domain,
      adminEmail,
      ownerEmail,
      email,
      slug,
      plan,
      tier,
      supportEmail,
    } = body || {};

    if (!name || !name.trim()) {
      throw new AppError(400, "BAD_REQUEST", "Organization name is required");
    }

    const domainLower = domain ? domain.toLowerCase().trim() : undefined;
    if (domainLower) {
      const existingDomain = await Organization.findOne({
        domain: domainLower,
        isDeleted: false,
      });
      if (existingDomain) {
        throw new AppError(
          409,
          "DOMAIN_ALREADY_EXISTS",
          `Domain '${domainLower}' is already registered`
        );
      }
    }

    const baseSlug =
      slug ||
      (domainLower
        ? domainLower.replace(/\./g, "-")
        : name.toLowerCase().replace(/[^a-z0-9]/g, "-"));
    const slugLower = baseSlug.toLowerCase().trim();

    const existingSlug = await Organization.findOne({
      slug: slugLower,
      isDeleted: false,
    });
    if (existingSlug) {
      throw new AppError(
        409,
        "DOMAIN_ALREADY_EXISTS",
        `Organization slug '${slugLower}' already in use`
      );
    }

    const targetAdminEmail = (
      adminEmail ||
      ownerEmail ||
      email ||
      supportEmail ||
      `admin@${domainLower || "talnova.test"}`
    )
      .toLowerCase()
      .trim();
    const existingUser = await User.findOne({
      "auth.email": targetAdminEmail,
      isDeleted: false,
    });
    if (existingUser) {
      throw new AppError(
        409,
        "EMAIL_ALREADY_EXISTS",
        `User with email '${targetAdminEmail}' already exists`
      );
    }

    const orgId = new mongoose.Types.ObjectId();
    const selectedPlan = tier || plan || "Enterprise";

    const newOrg = new Organization({
      _id: orgId,
      name: name.trim(),
      domain: domainLower,
      slug: slugLower,
      plan: selectedPlan,
      status: "Active",
      supportEmail: targetAdminEmail,
      createdBy: actorUserId,
      branding: {
        primaryColor: "#4F46E5",
        secondaryColor: "#10B981",
        accentColor: "#F59E0B",
      },
      workspace: {
        timezone: "UTC",
        locale: "en-US",
        dateFormat: "YYYY-MM-DD",
        firstDayOfWeek: 0,
      },
    });

    await newOrg.save();

    // Create Initial Owner User
    const defaultPassword = "Password123!";
    const passwordHash = await hashPassword(defaultPassword);
    const ownerUserId = new mongoose.Types.ObjectId();
    const ownerUser = new User({
      _id: ownerUserId,
      organizationId: orgId,
      auth: {
        email: targetAdminEmail,
        passwordHash,
        emailVerified: true,
      },
      profile: {
        firstName: "Admin",
        lastName: name.trim(),
        fullName: `Admin ${name.trim()}`,
      },
      employment: {
        employmentType: "full_time",
        status: "active",
      },
      permissions: {
        role: "owner",
        customRoles: [],
      },
      preferences: {
        language: "en",
        theme: "dark",
        emailNotifications: true,
      },
      statistics: {
        assignedJourneys: 0,
        completedJourneys: 0,
        certificates: 0,
        completionRate: 0,
      },
      security: {
        mfaEnabled: false,
        failedLoginAttempts: 0,
      },
    });

    await ownerUser.save();

    // Automatically create initial CustomerAccount in good_standing
    await CustomerAccount.create({
      organizationId: orgId,
      accountStatus: "good_standing",
      billingCycle: "monthly",
      preferredCurrency: "USD",
      creditLimit: 0,
      billingContact: {
        name: ownerUser.profile?.fullName || `Admin ${name.trim()}`,
        email: targetAdminEmail,
        phone: "",
        address: "",
      },
    });

    // Log the organization provisioning event
    await AuditLog.create({
      organizationId: orgId,
      actorUserId,
      actorType: "user",
      eventCategory: "organization",
      eventType: "TENANT_PROVISIONED",
      resourceType: "Organization",
      resourceId: orgId,
      action: "create",
      description: `Organization ${newOrg.name} (${
        domainLower || slugLower
      }) was provisioned with owner ${targetAdminEmail}`,
      severity: "info",
    });

    return {
      id: newOrg._id.toString(),
      name: newOrg.name,
      domain: newOrg.domain,
      slug: newOrg.slug,
      plan: newOrg.plan,
      status: newOrg.status,
      owner: {
        id: ownerUser._id.toString(),
        email: ownerUser.auth.email,
        role: ownerUser.permissions.role,
      },
      usersCount: 1,
      createdAt: newOrg.createdAt
        ? newOrg.createdAt.toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      supportEmail: newOrg.supportEmail,
    };
  }

  async updateOrganizationStatus(id: string, status: string, actorUserId: string) {
    if (!["Active", "Suspended"].includes(status)) {
      throw new AppError(400, "BAD_REQUEST", "Invalid status value");
    }

    const isObjId = mongoose.Types.ObjectId.isValid(id);
    const filter = isObjId
      ? { _id: id, isDeleted: false }
      : { slug: id.toLowerCase().trim(), isDeleted: false };

    const updated = await Organization.findOneAndUpdate(
      filter,
      { $set: { status } },
      { new: true }
    );

    if (!updated) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }

    if (status === "Suspended") {
      await Session.updateMany(
        { organizationId: updated._id, isValid: true },
        { $set: { isValid: false, revokedReason: "ORGANIZATION_QUARANTINED" } }
      );
      TenantStatusCache.addSuspended(updated._id.toString());
    } else if (status === "Active") {
      TenantStatusCache.removeSuspended(updated._id.toString());
    }

    // Log status toggle event
    await AuditLog.create({
      organizationId: updated._id,
      actorUserId,
      actorType: "user",
      eventCategory: "organization",
      eventType: "update",
      resourceType: "Organization",
      resourceId: updated._id,
      action: "update",
      description: `Organization ${updated.name} status updated to ${status}`,
      severity: "warning",
    });

    return {
      id: updated._id.toString(),
      name: updated.name,
      slug: updated.slug,
      plan: updated.plan,
      status: updated.status,
      usersCount: await User.countDocuments({
        organizationId: updated._id,
        isDeleted: false,
      }),
      createdAt: updated.createdAt
        ? updated.createdAt.toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      supportEmail: updated.supportEmail,
    };
  }

  async updateOrganization(id: string, body: any, actorUserId: string) {
    const {
      name,
      plan,
      status,
      seatLimit,
      seatQuota,
      maxUsers,
      subscription,
    } = body || {};

    const requestedSeats =
      seatLimit !== undefined
        ? seatLimit
        : seatQuota !== undefined
        ? seatQuota
        : maxUsers !== undefined
        ? maxUsers
        : subscription?.seatLimit;
    if (requestedSeats !== undefined) {
      const seatsNum = Number(requestedSeats);
      if (isNaN(seatsNum) || seatsNum < 0) {
        throw new AppError(
          400,
          "INVALID_SEAT_QUOTA",
          "Seat quota must be a non-negative number"
        );
      }
    }

    const isObjId = mongoose.Types.ObjectId.isValid(id);
    let org = isObjId
      ? await Organization.findOne({ _id: id, isDeleted: false })
      : null;
    if (!org) {
      org = await Organization.findOne({
        slug: id.toLowerCase().trim(),
        isDeleted: false,
      });
    }

    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }

    const updates: any = {};
    if (name) updates.name = name.trim();
    if (status) {
      if (!["Active", "Suspended"].includes(status)) {
        throw new AppError(400, "BAD_REQUEST", "Invalid status value");
      }
      updates.status = status;
    }

    const targetPlan = plan || subscription?.plan;
    if (targetPlan) {
      updates.plan = targetPlan;
      updates["subscription.plan"] = targetPlan;
    }

    if (requestedSeats !== undefined) {
      const seatsNum = Number(requestedSeats);
      updates["limits.maxUsers"] = seatsNum;
      updates["subscription.seatLimit"] = seatsNum;
    }

    const updated = await Organization.findByIdAndUpdate(
      org._id,
      { $set: updates },
      { new: true }
    );

    if (!updated) {
      throw new AppError(404, "NOT_FOUND", "Failed to update organization");
    }

    await AuditLog.create({
      organizationId: updated._id,
      actorUserId,
      actorType: "user",
      eventCategory: "organization",
      eventType: "update",
      resourceType: "Organization",
      resourceId: updated._id,
      action: "update",
      description: `Organization ${updated.name} updated: plan=${updated.plan}, maxUsers=${updated.limits?.maxUsers}`,
      severity: "info",
    });

    const usersCount = await User.countDocuments({
      organizationId: updated._id,
      isDeleted: false,
    });

    return {
      id: updated._id.toString(),
      name: updated.name,
      domain: updated.domain || "",
      slug: updated.slug,
      plan: updated.plan,
      status: updated.status,
      subscription: updated.subscription,
      limits: updated.limits,
      seatLimit: updated.limits?.maxUsers || 50,
      usersCount,
      createdAt: updated.createdAt
        ? updated.createdAt.toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      supportEmail: updated.supportEmail,
    };
  }

  async getOrganization360(id: string) {
    const isObjId = mongoose.Types.ObjectId.isValid(id);
    let org = isObjId
      ? await Organization.findOne({ _id: id, isDeleted: false })
      : null;
    if (!org) {
      org = await Organization.findOne({
        slug: id.toLowerCase().trim(),
        isDeleted: false,
      });
    }

    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }

    const orgId = org._id;

    const [
      usersCount,
      activeUsersCount,
      topUsers,
      journeys,
      invoices,
      activityLogs,
      activeOnboardings,
      completedOnboardings,
      storageAgg,
    ] = await Promise.all([
      User.countDocuments({ organizationId: orgId, isDeleted: false }),
      User.countDocuments({
        organizationId: orgId,
        isDeleted: false,
        "employment.status": "Active",
      }),
      User.find({ organizationId: orgId, isDeleted: false })
        .sort({ createdAt: -1 })
        .limit(25)
        .select("_id profile auth permissions employment createdAt"),
      Journey.find({ organizationId: orgId, isDeleted: false })
        .sort({ createdAt: -1 })
        .limit(20)
        .select("_id title description status version createdAt"),
      Invoice.find({ organizationId: orgId, isDeleted: false })
        .sort({ createdAt: -1 })
        .limit(20)
        .select(
          "_id invoiceNo amount status dueDate createdAt description paymentMethod"
        ),
      AuditLog.find({ organizationId: orgId })
        .sort({ createdAt: -1 })
        .limit(30)
        .select(
          "_id description eventCategory eventType action severity createdAt actorType"
        ),
      OnboardingCase.countDocuments({
        organizationId: orgId,
        isDeleted: false,
        state: {
          $in: [
            "active",
            "ready",
            "provisioning",
            "ready_for_handover",
            "handover_pending",
          ],
        },
      }),
      OnboardingCase.countDocuments({
        organizationId: orgId,
        isDeleted: false,
        state: "completed",
      }),
      Upload.aggregate([
        {
          $match: {
            organizationId: orgId,
            "lifecycle.status": { $ne: "deleted" },
          },
        },
        {
          $group: {
            _id: null,
            totalBytes: { $sum: "$fileSizeBytes" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const totalStorageBytes = storageAgg[0]?.totalBytes || 0;
    const totalFilesCount = storageAgg[0]?.count || 0;
    const maxUsers = org.limits?.maxUsers || org.subscription?.seatLimit || 50;
    const maxStorageBytes =
      (org.limits?.maxStorageGb || 50) * 1024 * 1024 * 1024;

    return {
      organization: {
        id: org._id.toString(),
        name: org.name,
        slug: org.slug,
        domain: org.domain,
        plan: org.plan,
        status: org.status,
        supportEmail: org.supportEmail,
        branding: org.branding,
        workspace: org.workspace,
        limits: org.limits,
        subscription: org.subscription,
        createdAt: org.createdAt,
      },
      quotas: {
        users: {
          current: usersCount,
          active: activeUsersCount,
          limit: maxUsers,
          utilizationPct:
            maxUsers > 0 ? Math.round((usersCount / maxUsers) * 100) : 0,
        },
        storage: {
          currentBytes: totalStorageBytes,
          limitBytes: maxStorageBytes,
          filesCount: totalFilesCount,
          utilizationPct:
            maxStorageBytes > 0
              ? Math.round((totalStorageBytes / maxStorageBytes) * 100)
              : 0,
        },
        aiTokens: {
          monthlyUsed: 0,
          monthlyBudget: 1000000,
          utilizationPct: 0,
        },
      },
      users: topUsers.map((u) => ({
        id: u._id.toString(),
        name:
          u.profile?.fullName ||
          `${u.profile?.firstName || ""} ${u.profile?.lastName || ""}`.trim() ||
          "User",
        email: u.auth?.email,
        role: u.permissions?.role,
        department: u.employment?.department,
        status: u.employment?.status || "Active",
        createdAt: u.createdAt,
      })),
      journeys: journeys.map((j) => ({
        id: j._id.toString(),
        title: j.title,
        description: j.description,
        status: (j as any).status || "published",
        version: (j as any).version || 1,
        createdAt: j.createdAt,
      })),
      invoices: invoices.map((i) => ({
        id: i._id.toString(),
        invoiceNo: i.invoiceNo,
        amount: i.amount,
        status: i.status,
        dueDate: i.dueDate,
        createdAt: i.createdAt,
        description: i.description,
      })),
      activity: activityLogs.map((l) => ({
        id: l._id.toString(),
        description: l.description,
        category: l.eventCategory,
        action: l.action,
        severity: l.severity,
        createdAt: l.createdAt,
      })),
      onboardingStats: {
        activeCount: activeOnboardings,
        completedCount: completedOnboardings,
        totalCases: activeOnboardings + completedOnboardings,
      },
    };
  }

  async quarantineOrganization(id: string, reason: string | undefined, actorUserId: string) {
    const isObjId = mongoose.Types.ObjectId.isValid(id);
    const filter = isObjId
      ? { _id: id, isDeleted: false }
      : { slug: id.toLowerCase().trim(), isDeleted: false };

    const org = await Organization.findOneAndUpdate(
      filter,
      { $set: { status: "Suspended" } },
      { new: true }
    );

    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }

    // Invalidate all active sessions for this quarantined tenant immediately
    await Session.updateMany(
      { organizationId: org._id, isValid: true },
      { $set: { isValid: false, revokedReason: "ORGANIZATION_QUARANTINED" } }
    );

    // Update in-memory TenantStatusCache for O(1) <5ms enforcement
    TenantStatusCache.addSuspended(org._id.toString());

    await AuditLog.create({
      organizationId: org._id,
      actorUserId,
      actorType: "user",
      eventCategory: "admin",
      eventType: "TENANT_QUARANTINED",
      resourceType: "Organization",
      resourceId: org._id,
      action: "status_change",
      description: `Tenant ${org.name} was placed in quarantine/suspension. Reason: ${
        reason || "Super Admin administrative action"
      }`,
      severity: "critical",
    });

    return { id: org._id.toString(), status: org.status };
  }

  // ---------------------------------------------------------------------------
  // 3. Users & Sessions
  // ---------------------------------------------------------------------------

  async getUsers(query: any) {
    const {
      search,
      organizationId,
      role,
      status,
      page = "1",
      limit = "15",
    } = query || {};
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 15));
    const skip = (pageNum - 1) * limitNum;

    const filter: any = { isDeleted: false };

    if (
      organizationId &&
      organizationId !== "all" &&
      mongoose.Types.ObjectId.isValid(organizationId)
    ) {
      filter.organizationId = new mongoose.Types.ObjectId(organizationId);
    }
    if (role && role !== "all") {
      filter["permissions.role"] = role;
    }
    if (status && status !== "all") {
      filter["employment.status"] = { $regex: new RegExp(`^${status}$`, "i") };
    }
    if (search && search.trim()) {
      const q = search.trim();
      const regex = new RegExp(q, "i");
      filter.$or = [
        { "profile.fullName": regex },
        { "profile.firstName": regex },
        { "profile.lastName": regex },
        { "auth.email": regex },
        { "employment.employeeId": regex },
        { "employment.department": regex },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("organizationId", "name slug domain plan"),
      User.countDocuments(filter),
    ]);

    return {
      users: users.map((u) => ({
        id: u._id.toString(),
        name:
          u.profile?.fullName ||
          `${u.profile?.firstName || ""} ${u.profile?.lastName || ""}`.trim() ||
          "Unnamed User",
        email: u.auth?.email,
        role: u.permissions?.role,
        department: u.employment?.department || "General",
        jobTitle: u.employment?.jobTitle,
        status: u.employment?.status || "Active",
        organization: u.organizationId
          ? {
              id: (u.organizationId as any)._id?.toString(),
              name: (u.organizationId as any).name,
              slug: (u.organizationId as any).slug,
            }
          : null,
        createdAt: u.createdAt,
        lastLoginAt: u.auth?.lastLoginAt,
      })),
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      limit: limitNum,
    };
  }

  async getUser360(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "BAD_REQUEST", "Invalid User ID format");
    }

    const user = await User.findOne({ _id: id, isDeleted: false }).populate(
      "organizationId",
      "name slug domain plan status"
    );

    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    const userId = user._id;

    const [activeSessions, tasks, auditLogs, onboardingCase] = await Promise.all([
      Session.find({ userId, isValid: true }).sort({ lastActivityAt: -1 }),
      Task.find({
        $or: [{ assignedToUserId: userId }, { employeeId: userId }],
        isDeleted: false,
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .select("_id title status priority dueDate type createdAt"),
      AuditLog.find({ actorUserId: userId })
        .sort({ createdAt: -1 })
        .limit(25)
        .select("_id description eventCategory action severity createdAt"),
      OnboardingCase.findOne({ employeeId: userId, isDeleted: false }),
    ]);

    return {
      user: {
        id: user._id.toString(),
        name:
          user.profile?.fullName ||
          `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() ||
          "User",
        email: user.auth?.email,
        emailVerified: user.auth?.emailVerified,
        role: user.permissions?.role,
        authProvider: user.auth?.authProvider || "local",
        lastLoginAt: user.auth?.lastLoginAt,
        failedLoginAttempts: user.security?.failedLoginAttempts || 0,
        mfaEnabled: user.security?.mfaEnabled || false,
        employment: user.employment,
        profile: user.profile,
        statistics: user.statistics,
        organization: user.organizationId,
        createdAt: user.createdAt,
      },
      activeSessions: activeSessions.map((s) => ({
        id: s._id.toString(),
        deviceInfo: s.deviceInfo || "Unknown Browser / OS",
        ipAddress: s.ipAddress || "Internal / N/A",
        lastActivityAt: s.lastActivityAt,
        expiresAt: s.expiresAt,
        isValid: s.isValid,
      })),
      tasks: tasks.map((t) => ({
        id: t._id.toString(),
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        createdAt: t.createdAt,
      })),
      auditLogs: auditLogs.map((a) => ({
        id: a._id.toString(),
        description: a.description,
        category: a.eventCategory,
        action: a.action,
        severity: a.severity,
        createdAt: a.createdAt,
      })),
      onboardingCase: onboardingCase
        ? {
            id: onboardingCase._id.toString(),
            state: onboardingCase.state,
            source: onboardingCase.source,
            createdAt: onboardingCase.createdAt,
          }
        : null,
    };
  }

  async updateUser(id: string, body: any, actorUserId: string) {
    const { role, status, unlock } = body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "BAD_REQUEST", "Invalid User ID");
    }

    const user = await User.findOne({ _id: id, isDeleted: false });
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    const updates: any = {};
    if (role) {
      if (
        ![
          "owner",
          "admin",
          "manager",
          "employee",
          "super_admin",
          "it_admin",
        ].includes(role)
      ) {
        throw new AppError(400, "BAD_REQUEST", "Invalid role specified");
      }
      updates["permissions.role"] = role;
    }
    if (status) {
      updates["employment.status"] = status;
    }
    if (unlock) {
      updates["security.failedLoginAttempts"] = 0;
      updates["security.lockedUntil"] = null;
    }

    const updated = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );

    await AuditLog.create({
      organizationId: user.organizationId,
      actorUserId,
      actorType: "user",
      eventCategory: "user",
      eventType: "USER_MODIFIED_BY_ADMIN",
      resourceType: "User",
      resourceId: user._id,
      action: "update",
      description: `Super Admin modified user ${user.auth.email}: ${JSON.stringify(
        updates
      )}`,
      severity: "warning",
    });

    return {
      id: updated!._id.toString(),
      role: updated!.permissions?.role,
      status: updated!.employment?.status,
    };
  }

  async forceLogoutUser(id: string, actorUserId: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "BAD_REQUEST", "Invalid User ID");
    }

    const user = await User.findOne({ _id: id, isDeleted: false });
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    await Session.updateMany(
      { userId: user._id, isValid: true },
      { $set: { isValid: false } }
    );

    await AuditLog.create({
      organizationId: user.organizationId,
      actorUserId,
      actorType: "user",
      eventCategory: "security",
      eventType: "USER_FORCE_LOGOUT",
      resourceType: "User",
      resourceId: user._id,
      action: "status_change",
      description: `Super Admin invalidated all active sessions for user ${user.auth.email}`,
      severity: "warning",
    });

    return user.auth.email;
  }

  async getSessions(query: any) {
    const { organizationId, page = "1", limit = "20" } = query || {};
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter: any = { isValid: true };
    if (
      organizationId &&
      organizationId !== "all" &&
      mongoose.Types.ObjectId.isValid(organizationId)
    ) {
      filter.organizationId = new mongoose.Types.ObjectId(organizationId);
    }

    const [sessions, total] = await Promise.all([
      Session.find(filter)
        .sort({ lastActivityAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("userId", "profile.fullName auth.email permissions.role")
        .populate("organizationId", "name slug"),
      Session.countDocuments(filter),
    ]);

    return {
      sessions: sessions.map((s) => ({
        id: s._id.toString(),
        user: s.userId
          ? {
              id: (s.userId as any)._id?.toString(),
              name: (s.userId as any).profile?.fullName || "User",
              email: (s.userId as any).auth?.email,
              role: (s.userId as any).permissions?.role,
            }
          : null,
        organization: s.organizationId
          ? {
              id: (s.organizationId as any)._id?.toString(),
              name: (s.organizationId as any).name,
              slug: (s.organizationId as any).slug,
            }
          : null,
        deviceInfo: s.deviceInfo || "Unknown Device",
        ipAddress: s.ipAddress || "N/A",
        lastActivityAt: s.lastActivityAt,
        expiresAt: s.expiresAt,
      })),
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    };
  }

  async revokeSession(sessionId: string, actorUserId: string) {
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      throw new AppError(400, "BAD_REQUEST", "Invalid session ID");
    }

    const session = await Session.findOneAndUpdate(
      { _id: sessionId, isValid: true },
      { $set: { isValid: false } },
      { new: true }
    );

    if (!session) {
      throw new AppError(404, "NOT_FOUND", "Active session not found");
    }

    await AuditLog.create({
      organizationId: session.organizationId,
      actorUserId,
      actorType: "user",
      eventCategory: "security",
      eventType: "SESSION_REVOKED",
      resourceType: "Session",
      resourceId: session._id,
      action: "delete",
      description: `Super Admin revoked session ${sessionId} for user ID ${session.userId}`,
      severity: "warning",
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Invoices & Finance
  // ---------------------------------------------------------------------------

  async getInvoices(query: any) {
    const {
      search,
      status,
      organizationId,
      page = "1",
      limit = "10",
    } = query || {};
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    const filter: any = { isDeleted: false };
    if (organizationId && mongoose.Types.ObjectId.isValid(organizationId)) {
      filter.organizationId = new mongoose.Types.ObjectId(organizationId);
    }
    if (status && status !== "all") {
      if (status === "Paid" || status === "paid") {
        filter.status = { $in: ["Paid", "paid"] };
      } else if (status === "Pending" || status === "pending") {
        filter.status = {
          $in: ["Pending", "issued", "sent", "partially_paid"],
        };
      } else if (status === "Overdue" || status === "overdue") {
        filter.status = { $in: ["Overdue", "overdue"] };
      } else {
        filter.status = status;
      }
    }
    if (search) {
      filter.$or = [
        { invoiceNo: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
        { organization: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
      ];
    }

    const invoices = await Invoice.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);
    const total = await Invoice.countDocuments(filter);

    const allPaid = await Invoice.find({
      status: { $in: ["Paid", "paid"] },
      isDeleted: false,
    });
    const allPending = await Invoice.find({
      status: { $in: ["Pending", "issued", "sent", "partially_paid"] },
      isDeleted: false,
    });
    const allOverdue = await Invoice.find({
      status: { $in: ["Overdue", "overdue"] },
      isDeleted: false,
    });

    const totalRevenue =
      Math.round(
        allPaid.reduce(
          (sum, inv) => sum + (inv.totalAmount ?? inv.amount ?? 0),
          0
        ) * 100
      ) / 100;
    const pendingRevenue =
      Math.round(
        allPending.reduce(
          (sum, inv) =>
            sum + (inv.balanceDue ?? inv.totalAmount ?? inv.amount ?? 0),
          0
        ) * 100
      ) / 100;
    const overdueRevenue =
      Math.round(
        allOverdue.reduce(
          (sum, inv) =>
            sum + (inv.balanceDue ?? inv.totalAmount ?? inv.amount ?? 0),
          0
        ) * 100
      ) / 100;

    const mappedInvoices = invoices.map((inv) => ({
      id: inv._id.toString(),
      _id: inv._id.toString(),
      invoiceNo: inv.invoiceNo,
      organizationId: inv.organizationId ? inv.organizationId.toString() : null,
      customerName: inv.customerName || inv.organization,
      organization: inv.customerName || inv.organization,
      currency: inv.currency || "USD",
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      lineItems: inv.lineItems || [],
      subtotal: inv.subtotal ?? inv.amount ?? 0,
      discountAmount: inv.discountAmount || 0,
      taxAmount: inv.taxAmount || 0,
      totalAmount: inv.totalAmount ?? inv.amount ?? 0,
      amount: inv.totalAmount ?? inv.amount ?? 0,
      amountPaid: inv.amountPaid || 0,
      balanceDue:
        inv.balanceDue ??
        (inv.status === "Paid" || inv.status === "paid"
          ? 0
          : inv.totalAmount ?? inv.amount ?? 0),
      type: inv.type,
      status: inv.status,
      notes: inv.notes,
      description: inv.description,
      createdAt: inv.createdAt,
      updatedAt: inv.updatedAt,
    }));

    return {
      invoices: {
        data: mappedInvoices,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
      summary: {
        totalRevenue,
        pendingRevenue,
        overdueRevenue,
      },
    };
  }

  async getInvoiceById(id: string) {
    let invoice = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      invoice = await Invoice.findOne({ _id: id, isDeleted: false });
    }
    if (!invoice) {
      invoice = await Invoice.findOne({
        invoiceNo: id.toUpperCase().trim(),
        isDeleted: false,
      });
    }

    if (!invoice) {
      throw new AppError(404, "NOT_FOUND", `Invoice '${id}' not found`);
    }

    const payments = await PaymentRecord.find({
      $or: [{ invoiceId: invoice._id }, { invoiceNo: invoice.invoiceNo }],
      isDeleted: { $ne: true },
    }).sort({ paymentDate: -1, createdAt: -1 });

    return {
      invoice: {
        id: invoice._id.toString(),
        _id: invoice._id.toString(),
        invoiceNo: invoice.invoiceNo,
        organizationId: invoice.organizationId
          ? invoice.organizationId.toString()
          : null,
        customerName: invoice.customerName || invoice.organization,
        organization: invoice.customerName || invoice.organization,
        currency: invoice.currency || "USD",
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        lineItems: invoice.lineItems || [],
        subtotal: invoice.subtotal ?? invoice.amount ?? 0,
        discountAmount: invoice.discountAmount || 0,
        taxAmount: invoice.taxAmount || 0,
        totalAmount: invoice.totalAmount ?? invoice.amount ?? 0,
        amount: invoice.totalAmount ?? invoice.amount ?? 0,
        amountPaid: invoice.amountPaid || 0,
        balanceDue:
          invoice.balanceDue ??
          (invoice.status === "Paid" || invoice.status === "paid"
            ? 0
            : invoice.totalAmount ?? invoice.amount ?? 0),
        type: invoice.type,
        status: invoice.status,
        notes: invoice.notes,
        description: invoice.description,
        createdBy: invoice.createdBy ? invoice.createdBy.toString() : null,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt,
      },
      payments: payments.map((p) => ({
        id: p._id.toString(),
        receiptNo:
          p.paymentNo ||
          (p as any).receiptNo ||
          (p as any)._doc?.receiptNo,
        paymentNo: p.paymentNo,
        amount: p.amount,
        method:
          p.paymentMethod ||
          (p as any).method ||
          (p as any)._doc?.method,
        paymentMethod:
          p.paymentMethod ||
          (p as any).method ||
          (p as any)._doc?.method,
        reference:
          p.referenceNumber ||
          (p as any).reference ||
          (p as any)._doc?.reference,
        referenceNumber:
          p.referenceNumber ||
          (p as any).reference ||
          (p as any)._doc?.reference,
        notes: p.notes,
        recordedAt:
          p.paymentDate ||
          (p as any).recordedAt ||
          (p as any)._doc?.recordedAt,
        paymentDate: p.paymentDate,
        recordedBy: p.recordedByEmail || (p as any).recordedBy,
      })),
    };
  }

  async createInvoice(body: any, actorUserId: string) {
    const {
      organizationId,
      organization,
      customerName,
      currency = "USD",
      issueDate,
      dueDate,
      lineItems,
      discountAmount = 0,
      taxAmount = 0,
      amount,
      type = "Invoice",
      status = "issued",
      notes,
      description,
    } = body || {};

    let custName = (customerName || organization || "").trim();
    let targetOrgId = organizationId;

    if (targetOrgId && mongoose.Types.ObjectId.isValid(targetOrgId)) {
      targetOrgId = new mongoose.Types.ObjectId(targetOrgId);
      if (!custName) {
        const foundOrg = await Organization.findById(targetOrgId);
        if (foundOrg) custName = foundOrg.name;
      }
    } else if (custName) {
      const foundOrg = await Organization.findOne({
        name: { $regex: new RegExp(`^${custName}$`, "i") },
        isDeleted: false,
      });
      if (foundOrg) {
        targetOrgId = foundOrg._id;
        custName = foundOrg.name;
      } else {
        const anyOrg = await Organization.findOne({ isDeleted: false });
        if (anyOrg) {
          targetOrgId = anyOrg._id;
        } else {
          throw new AppError(
            400,
            "BAD_REQUEST",
            "No active organization exists to associate with invoice"
          );
        }
      }
    } else {
      throw new AppError(
        400,
        "BAD_REQUEST",
        "Customer organization name or organizationId is required"
      );
    }

    if (Array.isArray(lineItems) && lineItems.length === 0) {
      throw new AppError(
        400,
        "INVALID_LINE_ITEMS",
        "Invoice must contain at least one line item"
      );
    }

    let preparedLineItems: any[] = [];
    if (Array.isArray(lineItems) && lineItems.length > 0) {
      preparedLineItems = lineItems.map((item: any) => {
        const desc = (item.description || "").trim();
        if (!desc) {
          throw new AppError(
            400,
            "INVALID_LINE_ITEMS",
            "Each line item must have a non-empty description"
          );
        }
        const qty = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
        const unit = Number(item.unitPrice) >= 0 ? Number(item.unitPrice) : 0;
        return {
          description: desc,
          quantity: qty,
          unitPrice: Math.round((unit + Number.EPSILON) * 100) / 100,
          amount: Math.round((qty * unit + Number.EPSILON) * 100) / 100,
        };
      });
    } else if (amount !== undefined && amount !== null && Number(amount) >= 0) {
      const parsedAmount =
        Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
      preparedLineItems = [
        {
          description: (
            description || "Professional Services & Platform Subscription"
          ).trim(),
          quantity: 1,
          unitPrice: parsedAmount,
          amount: parsedAmount,
        },
      ];
    } else {
      throw new AppError(
        400,
        "INVALID_LINE_ITEMS",
        "Invoice must contain line items or a valid amount"
      );
    }

    const parsedIssueDate = issueDate ? new Date(issueDate) : new Date();
    const parsedDueDate = dueDate
      ? new Date(dueDate)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    if (isNaN(parsedIssueDate.getTime())) {
      throw new AppError(400, "INVALID_DATE", "Issue date is not a valid date");
    }
    if (isNaN(parsedDueDate.getTime())) {
      throw new AppError(400, "INVALID_DATE", "Due date is not a valid date");
    }

    if (parsedDueDate.getTime() < parsedIssueDate.getTime()) {
      throw new AppError(
        400,
        "INVALID_DUE_DATE",
        "Due date cannot be earlier than issue date"
      );
    }

    const count = await Invoice.countDocuments();
    const invoiceNo = `INV-${8890 + count}`;

    const newInvoice = new Invoice({
      invoiceNo,
      organizationId: targetOrgId,
      customerName: custName,
      currency: (currency || "USD").toUpperCase().trim(),
      issueDate: parsedIssueDate,
      dueDate: parsedDueDate,
      lineItems: preparedLineItems,
      discountAmount: Number(discountAmount) || 0,
      taxAmount: Number(taxAmount) || 0,
      type: type || "Invoice",
      status: status || "issued",
      notes: notes?.trim() || "",
      description:
        description?.trim() || preparedLineItems[0]?.description || "",
      createdBy: actorUserId
        ? new mongoose.Types.ObjectId(actorUserId)
        : undefined,
    });

    await newInvoice.save();

    await AuditLog.create({
      organizationId: targetOrgId,
      actorUserId,
      actorType: "user",
      eventCategory: "finance",
      eventType: "INVOICE_CREATED",
      resourceType: "Invoice",
      resourceId: newInvoice._id,
      action: "create",
      description: `Created invoice ${newInvoice.invoiceNo} for ${custName} (${newInvoice.currency} ${newInvoice.totalAmount}) with ${newInvoice.lineItems.length} line items`,
      severity: "info",
    });

    return {
      id: newInvoice._id.toString(),
      _id: newInvoice._id.toString(),
      invoiceNo: newInvoice.invoiceNo,
      organizationId: newInvoice.organizationId.toString(),
      customerName: newInvoice.customerName,
      organization: newInvoice.customerName,
      currency: newInvoice.currency,
      issueDate: newInvoice.issueDate,
      dueDate: newInvoice.dueDate,
      lineItems: newInvoice.lineItems,
      subtotal: newInvoice.subtotal,
      discountAmount: newInvoice.discountAmount,
      taxAmount: newInvoice.taxAmount,
      totalAmount: newInvoice.totalAmount,
      amount: newInvoice.totalAmount,
      amountPaid: newInvoice.amountPaid,
      balanceDue: newInvoice.balanceDue,
      type: newInvoice.type,
      status: newInvoice.status,
      notes: newInvoice.notes,
      description: newInvoice.description,
    };
  }

  async exportInvoicesCsv() {
    const invoices = await Invoice.find({ isDeleted: false }).sort({
      createdAt: -1,
    });
    let csv =
      "Invoice No,Customer,Issue Date,Due Date,Currency,Subtotal,Discount,Tax,Total Amount,Amount Paid,Balance Due,Status,Type,Items Count,Notes\n";
    for (const inv of invoices) {
      const cust = (inv.customerName || inv.organization || "").replace(
        /"/g,
        '""'
      );
      const notes = (inv.notes || inv.description || "").replace(/"/g, '""');
      const issue = inv.issueDate
        ? inv.issueDate instanceof Date
          ? inv.issueDate.toISOString().split("T")[0]
          : String(inv.issueDate)
        : "";
      const due = inv.dueDate
        ? inv.dueDate instanceof Date
          ? inv.dueDate.toISOString().split("T")[0]
          : String(inv.dueDate)
        : "";
      const itemsCount = Array.isArray(inv.lineItems)
        ? inv.lineItems.length
        : 1;
      const subtotal = inv.subtotal ?? inv.amount ?? 0;
      const discount = inv.discountAmount || 0;
      const tax = inv.taxAmount || 0;
      const total = inv.totalAmount ?? inv.amount ?? 0;
      const paid = inv.amountPaid || 0;
      const bal =
        inv.balanceDue ??
        (inv.status === "Paid" || inv.status === "paid" ? 0 : total);
      const curr = inv.currency || "USD";

      csv += `"${inv.invoiceNo}","${cust}","${issue}","${due}","${curr}",${subtotal},${discount},${tax},${total},${paid},${bal},"${inv.status}","${inv.type}",${itemsCount},"${notes}"\n`;
    }
    return csv;
  }

  async getFinanceOverview() {
    const PLAN_PRICES: Record<string, number> = {
      Starter: 99,
      Growth: 199,
      Pro: 299,
      Professional: 299,
      Enterprise: 999,
    };

    const orgs = await Organization.find({ isDeleted: false });
    const activeOrgs = orgs.filter(
      (o) => (o.status || "Active").toLowerCase() === "active"
    );
    const platformUsers = await User.countDocuments({ isDeleted: false });

    let totalMrr = 0;
    const tierCounts: Record<string, { count: number; mrr: number }> = {
      Starter: { count: 0, mrr: 0 },
      Pro: { count: 0, mrr: 0 },
      Enterprise: { count: 0, mrr: 0 },
    };

    for (const org of activeOrgs) {
      const rawPlan = (org.plan ||
        org.subscription?.plan ||
        "Starter") as string;
      const normalizedPlan =
        rawPlan === "Professional" ||
        rawPlan === "Growth" ||
        rawPlan === "Pro"
          ? "Pro"
          : rawPlan === "Enterprise"
          ? "Enterprise"
          : "Starter";

      const monthlyPrice =
        (org.subscription as any)?.price ??
        (PLAN_PRICES[rawPlan] || PLAN_PRICES[normalizedPlan] || 99);
      totalMrr += monthlyPrice;

      if (!tierCounts[normalizedPlan]) {
        tierCounts[normalizedPlan] = { count: 0, mrr: 0 };
      }
      tierCounts[normalizedPlan].count += 1;
      tierCounts[normalizedPlan].mrr += monthlyPrice;
    }

    const activeSubscriptions = activeOrgs.length;
    const totalArr = totalMrr * 12;
    const arpu =
      platformUsers > 0 ? Number((totalMrr / platformUsers).toFixed(2)) : 0;

    const allPaid = await Invoice.find({
      status: { $in: ["Paid", "paid"] },
      isDeleted: false,
    });
    const allPending = await Invoice.find({
      status: { $in: ["Pending", "issued", "sent", "partially_paid"] },
      isDeleted: false,
    });
    const allOverdue = await Invoice.find({
      status: { $in: ["Overdue", "overdue"] },
      isDeleted: false,
    });

    const totalRevenue =
      Math.round(
        allPaid.reduce(
          (sum, inv) => sum + (inv.totalAmount ?? inv.amount ?? 0),
          0
        ) * 100
      ) / 100;
    const pendingRevenue =
      Math.round(
        allPending.reduce(
          (sum, inv) =>
            sum + (inv.balanceDue ?? inv.totalAmount ?? inv.amount ?? 0),
          0
        ) * 100
      ) / 100;
    const overdueRevenue =
      Math.round(
        allOverdue.reduce(
          (sum, inv) =>
            sum + (inv.balanceDue ?? inv.totalAmount ?? inv.amount ?? 0),
          0
        ) * 100
      ) / 100;

    const TIER_COLORS: Record<string, string> = {
      Starter: "#3B82F6",
      Pro: "#8B5CF6",
      Enterprise: "#10B981",
    };

    const tierDistribution = ["Starter", "Pro", "Enterprise"].map((tier) => {
      const data = tierCounts[tier] || { count: 0, mrr: 0 };
      const percentage =
        activeSubscriptions > 0
          ? Number(((data.count / activeSubscriptions) * 100).toFixed(1))
          : 0;
      return {
        tier,
        name: tier === "Pro" ? "Pro / Growth" : tier,
        count: data.count,
        mrr: data.mrr,
        arr: data.mrr * 12,
        percentage,
        color: TIER_COLORS[tier] || "#6366F1",
      };
    });

    // 6-Month historical MRR trajectory
    const now = new Date();
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const monthlyGrowth: any[] = [];

    for (let i = 5; i >= 0; i--) {
      const startOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() - i,
        1,
        0,
        0,
        0,
        0
      );
      const endOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() - i + 1,
        0,
        23,
        59,
        59,
        999
      );
      const monthLabel = monthNames[startOfMonth.getMonth()];

      const orgsAtMonth = await Organization.countDocuments({
        createdAt: { $lte: endOfMonth },
        isDeleted: false,
      });

      const monthInvoices = await Invoice.find({
        status: { $in: ["Paid", "paid"] },
        isDeleted: false,
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      }).lean();

      const monthPayments = await PaymentRecord.find({
        verificationStatus: "verified",
        isDeleted: false,
        invoiceId: { $in: [null, undefined] },
        paymentDate: { $gte: startOfMonth, $lte: endOfMonth },
      }).lean();

      const invoiceRevenue = monthInvoices.reduce(
        (sum, inv) => sum + (inv.totalAmount ?? inv.amount ?? 0),
        0
      );
      const paymentRevenue = monthPayments.reduce(
        (sum, pay) => sum + (pay.amount || 0),
        0
      );
      const realMrr =
        Math.round((invoiceRevenue + paymentRevenue) * 100) / 100;

      monthlyGrowth.push({
        month: monthLabel,
        mrr: realMrr,
        arr: Math.round(realMrr * 12 * 100) / 100,
        subscriptions: orgsAtMonth,
      });
    }

    return {
      summary: {
        totalArr,
        totalMrr,
        activeSubscriptions,
        arpu,
        platformUsers,
        totalRevenue,
        pendingRevenue,
        overdueRevenue,
      },
      tierDistribution,
      monthlyGrowth,
      invoicesSummary: {
        totalRevenue,
        pendingRevenue,
        overdueRevenue,
        paidCount: allPaid.length,
        pendingCount: allPending.length,
        overdueCount: allOverdue.length,
      },
    };
  }

  async exportFinanceCsv() {
    const PLAN_PRICES: Record<string, number> = {
      Starter: 99,
      Growth: 199,
      Pro: 299,
      Professional: 299,
      Enterprise: 999,
    };

    const orgs = await Organization.find({ isDeleted: false }).sort({ name: 1 });
    let csv =
      "Organization,Domain,Plan,Status,Seats,MRR ($),ARR ($),Created At\n";

    for (const org of orgs) {
      const plan = org.plan || org.subscription?.plan || "Starter";
      const price =
        (org.subscription as any)?.price ?? (PLAN_PRICES[plan] || 99);
      const mrr =
        (org.status || "Active").toLowerCase() === "active" ? price : 0;
      const arr = mrr * 12;
      const seats =
        org.limits?.maxUsers || org.subscription?.seatLimit || 50;
      const created = org.createdAt
        ? org.createdAt.toISOString().split("T")[0]
        : "";

      csv += `"${org.name}","${org.domain || ""}","${plan}","${
        org.status || "Active"
      }",${seats},${mrr},${arr},"${created}"\n`;
    }

    return csv;
  }

  async getPayments() {
    const payments = await PaymentRecord.find({ isDeleted: { $ne: true } })
      .sort({ paymentDate: -1, createdAt: -1 })
      .limit(100);

    const totalCollected =
      Math.round(
        payments.reduce((sum, p) => sum + (p.amount || 0), 0) * 100
      ) / 100;

    return {
      payments: payments.map((p) => ({
        id: p._id.toString(),
        _id: p._id.toString(),
        paymentNo: p.paymentNo,
        receiptNo:
          p.paymentNo ||
          (p as any).receiptNo ||
          (p as any)._doc?.receiptNo,
        invoiceId: p.invoiceId ? p.invoiceId.toString() : null,
        invoiceNo: p.invoiceNo,
        organizationId: p.organizationId ? p.organizationId.toString() : null,
        organizationName: p.organizationName,
        amount: p.amount,
        currency: p.currency || "USD",
        method:
          p.paymentMethod ||
          (p as any).method ||
          (p as any)._doc?.method ||
          "wire",
        paymentMethod:
          p.paymentMethod ||
          (p as any).method ||
          (p as any)._doc?.method ||
          "wire",
        reference:
          p.referenceNumber ||
          (p as any).reference ||
          (p as any)._doc?.reference ||
          "REF",
        referenceNumber:
          p.referenceNumber ||
          (p as any).reference ||
          (p as any)._doc?.reference ||
          "REF",
        verificationStatus: p.verificationStatus || "verified",
        notes: p.notes,
        paymentDate: p.paymentDate,
        recordedAt:
          p.paymentDate ||
          (p as any).recordedAt ||
          (p as any)._doc?.recordedAt,
        recordedBy:
          p.recordedByEmail || (p as any).recordedBy || "Super Admin",
      })),
      totalCollected,
    };
  }

  async recordPayment(body: any, actorUserId: string, actorUserEmail?: string) {
    const {
      invoiceId,
      invoiceNo,
      organizationName,
      organizationId,
      amount,
      method,
      paymentMethod,
      reference,
      referenceNumber,
      notes,
    } = body || {};

    let invoice = null;
    if (invoiceId && mongoose.Types.ObjectId.isValid(invoiceId)) {
      invoice = await Invoice.findOne({ _id: invoiceId, isDeleted: false });
    }
    if (!invoice && invoiceNo && invoiceNo !== "N/A") {
      invoice = await Invoice.findOne({
        invoiceNo: invoiceNo.toUpperCase().trim(),
        isDeleted: false,
      });
    }

    if (!invoice && !invoiceId && (!invoiceNo || invoiceNo === "N/A")) {
      const orgFilter: any = {
        status: {
          $in: ["issued", "sent", "partially_paid", "pending", "Pending"],
        },
        isDeleted: false,
      };
      if (organizationId && mongoose.Types.ObjectId.isValid(organizationId)) {
        orgFilter.organizationId = new mongoose.Types.ObjectId(organizationId);
      }
      if (orgFilter.organizationId) {
        invoice = await Invoice.findOne(orgFilter).sort({
          dueDate: 1,
          createdAt: 1,
        });
      }
    }

    if (!invoice) {
      if (invoiceId || (invoiceNo && invoiceNo !== "N/A")) {
        throw new AppError(
          404,
          "NOT_FOUND",
          `Invoice '${invoiceId || invoiceNo}' not found`
        );
      }
      if (!organizationId && !organizationName) {
        throw new AppError(
          400,
          "BAD_REQUEST",
          "Target organization or active invoice must be specified for payment recording"
        );
      }
    }

    if (
      invoice &&
      (invoice.status === "cancelled" || invoice.status === "written_off")
    ) {
      throw new AppError(
        400,
        "INVALID_INVOICE_STATUS",
        `Cannot record payment against ${invoice.status} invoice`
      );
    }

    const currentBalance = invoice
      ? invoice.balanceDue !== undefined
        ? invoice.balanceDue
        : invoice.status === "Paid" || invoice.status === "paid"
        ? 0
        : invoice.totalAmount ?? invoice.amount ?? 0
      : 0;

    if (
      invoice &&
      (currentBalance <= 0 ||
        invoice.status === "Paid" ||
        invoice.status === "paid")
    ) {
      throw new AppError(
        400,
        "INVOICE_ALREADY_PAID",
        "Invoice is already fully paid"
      );
    }

    const paymentAmount =
      Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      throw new AppError(
        400,
        "BAD_REQUEST",
        "Payment amount must be a positive number"
      );
    }

    if (invoice && paymentAmount > currentBalance) {
      throw new AppError(
        400,
        "OVERPAYMENT_NOT_ALLOWED",
        `Payment amount ($${paymentAmount.toFixed(
          2
        )}) exceeds invoice balance due ($${currentBalance.toFixed(2)})`
      );
    }

    const refNo = (referenceNumber || reference || "").trim();
    if (!refNo) {
      throw new AppError(
        400,
        "BAD_REQUEST",
        "Transaction reference or wire reference number is required"
      );
    }

    const rawMethod = (paymentMethod || method || "bank_transfer").toLowerCase();
    let normalizedMethod:
      | "bank_transfer"
      | "wire"
      | "check"
      | "manual_card"
      | "other" = "bank_transfer";
    if (rawMethod.includes("wire")) normalizedMethod = "wire";
    else if (rawMethod.includes("check")) normalizedMethod = "check";
    else if (rawMethod.includes("card")) normalizedMethod = "manual_card";
    else if (
      rawMethod.includes("ach") ||
      rawMethod.includes("transfer") ||
      rawMethod.includes("bank")
    )
      normalizedMethod = "bank_transfer";
    else if (rawMethod === "other") normalizedMethod = "other";

    let targetOrgId =
      invoice?.organizationId ||
      (organizationId && mongoose.Types.ObjectId.isValid(organizationId)
        ? new mongoose.Types.ObjectId(organizationId)
        : null);
    let orgName =
      invoice?.customerName || invoice?.organization || organizationName || "";

    if (!orgName && targetOrgId) {
      const foundOrg = await Organization.findById(targetOrgId);
      if (foundOrg) orgName = foundOrg.name;
    }

    const previousBalance = currentBalance;
    let newBalance = 0;

    const paymentCount = await PaymentRecord.countDocuments();
    const paymentNo = `REC-${new Date().getFullYear()}-${String(paymentCount + 1).padStart(4, "0")}`;

    const newPayment = new PaymentRecord({
      paymentNo,
      invoiceId: invoice?._id,
      invoiceNo: invoice?.invoiceNo || "N/A",
      organizationId: targetOrgId,
      organizationName: orgName || "Enterprise Customer",
      amount: paymentAmount,
      currency: invoice?.currency || "USD",
      paymentDate: new Date(),
      paymentMethod: normalizedMethod,
      referenceNumber: refNo,
      verificationStatus: "verified",
      notes: notes?.trim() || "",
      recordedBy: actorUserId && mongoose.Types.ObjectId.isValid(actorUserId)
        ? new mongoose.Types.ObjectId(actorUserId)
        : undefined,
      recordedByEmail: actorUserEmail || "Super Admin",
    });

    await newPayment.save();

    if (invoice) {
      const newPaid =
        Math.round(
          ((invoice.amountPaid || 0) + paymentAmount + Number.EPSILON) * 100
        ) / 100;
      const totalAmt = invoice.totalAmount ?? invoice.amount ?? 0;
      newBalance = Math.max(
        0,
        Math.round((totalAmt - newPaid + Number.EPSILON) * 100) / 100
      );

      invoice.amountPaid = newPaid;
      invoice.balanceDue = newBalance;
      invoice.status = newBalance <= 0 ? "paid" : "partially_paid";
      await invoice.save();
    }

    await AuditLog.create({
      organizationId: targetOrgId,
      actorUserId: actorUserId && mongoose.Types.ObjectId.isValid(actorUserId)
        ? new mongoose.Types.ObjectId(actorUserId)
        : undefined,
      actorType: "user",
      eventCategory: "finance",
      eventType: "PAYMENT_RECORDED",
      resourceType: "PaymentRecord",
      resourceId: newPayment._id,
      action: "create",
      description: invoice
        ? `Manual payment receipt ${paymentNo} recorded: $${paymentAmount.toFixed(
            2
          )} from ${orgName} against invoice ${
            invoice.invoiceNo
          } (Prev balance: $${previousBalance.toFixed(
            2
          )}, New balance: $${newBalance.toFixed(2)})`
        : `Manual prepayment receipt ${paymentNo} recorded: $${paymentAmount.toFixed(
            2
          )} from ${orgName} (${refNo})`,
      severity: "info",
      metadata: {
        invoiceNo: invoice?.invoiceNo || "N/A",
        amount: paymentAmount,
        previousBalance,
        newBalance,
        referenceNumber: refNo,
      },
    });

    return {
      id: newPayment._id.toString(),
      _id: newPayment._id.toString(),
      paymentNo: newPayment.paymentNo,
      receiptNo: newPayment.paymentNo,
      invoiceId: newPayment.invoiceId ? newPayment.invoiceId.toString() : null,
      invoiceNo: newPayment.invoiceNo,
      organizationId: newPayment.organizationId
        ? newPayment.organizationId.toString()
        : null,
      organizationName: newPayment.organizationName,
      amount: newPayment.amount,
      currency: newPayment.currency,
      paymentDate: newPayment.paymentDate,
      recordedAt: newPayment.paymentDate,
      paymentMethod: newPayment.paymentMethod,
      method: newPayment.paymentMethod,
      referenceNumber: newPayment.referenceNumber,
      reference: newPayment.referenceNumber,
      verificationStatus: newPayment.verificationStatus,
      notes: newPayment.notes,
      recordedBy: newPayment.recordedByEmail,
    };
  }

  async getExpenses(query: any) {
    const { category, organizationId } = query || {};
    const filter: any = { isDeleted: { $ne: true } };

    if (category && category !== "all") {
      filter.category = category;
    }
    if (
      organizationId &&
      organizationId !== "all" &&
      mongoose.Types.ObjectId.isValid(organizationId)
    ) {
      filter.organizationId = new mongoose.Types.ObjectId(organizationId);
    }

    const expenses = await ExpenseRecord.find(filter)
      .sort({ expenseDate: -1, createdAt: -1 })
      .limit(100);

    const totalOperatingExpenses =
      Math.round(
        expenses.reduce((sum, e) => sum + (e.amount || 0), 0) * 100
      ) / 100;

    return {
      expenses: expenses.map((e) => ({
        id: e._id.toString(),
        _id: e._id.toString(),
        expenseNo: e.expenseNo,
        category: e.category,
        vendor: e.vendor,
        amount: e.amount,
        currency: e.currency || "USD",
        expenseDate: e.expenseDate,
        incurredAt: e.expenseDate,
        date: e.expenseDate,
        description: e.description,
        title: e.description,
        notes: e.description,
        isRecurring: e.isRecurring,
        recordedBy: e.createdByEmail || (e as any).recordedBy || "Super Admin",
        organizationId: e.organizationId ? e.organizationId.toString() : null,
        createdAt: e.createdAt,
      })),
      totalExpenses: totalOperatingExpenses,
      totalOperatingExpenses,
    };
  }

  async recordExpense(body: any, actorUserId: string, actorUserEmail?: string) {
    const {
      title,
      description,
      amount,
      currency = "USD",
      category,
      vendor,
      expenseDate,
      incurredAt,
      isRecurring = false,
      receiptUrl,
      organizationId,
      notes,
    } = body || {};

    const desc = (description || title || notes || "").trim();
    if (!desc) {
      throw new AppError(
        400,
        "BAD_REQUEST",
        "Expense description or title is required"
      );
    }

    if (!vendor || typeof vendor !== "string" || !vendor.trim()) {
      throw new AppError(400, "BAD_REQUEST", "Expense vendor is required");
    }

    let normalizedCategory = (category || "other").toString().trim().toLowerCase();
    if (
      normalizedCategory === "hosting" ||
      normalizedCategory === "cloud" ||
      normalizedCategory === "cloud_infrastructure"
    ) {
      normalizedCategory = "infrastructure";
    } else if (
      normalizedCategory === "ai" ||
      normalizedCategory === "tokens" ||
      normalizedCategory === "ai_inference"
    ) {
      normalizedCategory = "ai_compute";
    } else if (
      normalizedCategory === "tools" ||
      normalizedCategory === "saas" ||
      normalizedCategory === "software_license"
    ) {
      normalizedCategory = "software_licenses";
    } else if (normalizedCategory === "hardware") {
      normalizedCategory = "office";
    } else if (normalizedCategory === "support_payroll") {
      normalizedCategory = "salaries";
    } else if (normalizedCategory === "security_compliance") {
      normalizedCategory = "legal";
    } else if (normalizedCategory === "payment_gateway_fees") {
      normalizedCategory = "other";
    }

    const validCategories = [
      "infrastructure",
      "ai_compute",
      "software_licenses",
      "salaries",
      "marketing",
      "office",
      "legal",
      "other",
    ];

    if (!validCategories.includes(normalizedCategory)) {
      throw new AppError(
        400,
        "INVALID_CATEGORY",
        `Invalid expense category: '${category}'. Must be one of: ${validCategories.join(", ")}`
      );
    }

    const expenseAmount =
      Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
    if (isNaN(expenseAmount) || expenseAmount <= 0) {
      throw new AppError(
        400,
        "BAD_REQUEST",
        "Expense amount must be a positive number"
      );
    }

    let parsedOrgId: mongoose.Types.ObjectId | undefined = undefined;
    if (organizationId && mongoose.Types.ObjectId.isValid(organizationId)) {
      parsedOrgId = new mongoose.Types.ObjectId(organizationId);
    }

    const count = await ExpenseRecord.countDocuments();
    const expenseNo = `EXP-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
    const dateVal = expenseDate
      ? new Date(expenseDate)
      : incurredAt
      ? new Date(incurredAt)
      : new Date();

    const newExpense = new ExpenseRecord({
      expenseNo,
      category: normalizedCategory as any,
      vendor: vendor.trim(),
      amount: expenseAmount,
      currency: (currency || "USD").toUpperCase().trim(),
      expenseDate: dateVal,
      description: desc,
      organizationId: parsedOrgId,
      isRecurring: Boolean(isRecurring),
      receiptUrl: receiptUrl?.toString().trim() || undefined,
      createdBy: actorUserId && mongoose.Types.ObjectId.isValid(actorUserId)
        ? new mongoose.Types.ObjectId(actorUserId)
        : undefined,
      createdByEmail: actorUserEmail || "Super Admin",
    });

    await newExpense.save();

    await AuditLog.create({
      organizationId: parsedOrgId,
      actorUserId: actorUserId && mongoose.Types.ObjectId.isValid(actorUserId)
        ? new mongoose.Types.ObjectId(actorUserId)
        : undefined,
      actorType: "user",
      eventCategory: "finance",
      eventType: "EXPENSE_RECORDED",
      resourceType: "ExpenseRecord",
      resourceId: newExpense._id,
      action: "create",
      description: `Operating expense ${newExpense.expenseNo} recorded: $${expenseAmount.toFixed(2)} for ${vendor.trim()} (${normalizedCategory})`,
      severity: "info",
      metadata: {
        expenseNo: newExpense.expenseNo,
        category: normalizedCategory,
        vendor: newExpense.vendor,
        amount: expenseAmount,
        description: desc,
      },
    });

    return {
      id: newExpense._id.toString(),
      _id: newExpense._id.toString(),
      expenseNo: newExpense.expenseNo,
      category: newExpense.category,
      vendor: newExpense.vendor,
      amount: newExpense.amount,
      currency: newExpense.currency,
      expenseDate: newExpense.expenseDate,
      incurredAt: newExpense.expenseDate,
      date: newExpense.expenseDate,
      description: newExpense.description,
      title: newExpense.description,
      notes: newExpense.description,
      isRecurring: newExpense.isRecurring,
      receiptUrl: newExpense.receiptUrl,
      recordedBy: newExpense.createdByEmail || "Super Admin",
      organizationId: newExpense.organizationId
        ? newExpense.organizationId.toString()
        : null,
      createdAt: newExpense.createdAt,
    };
  }

  async getCustomerAccounts(query: any) {
    const { status, search } = query || {};

    const orgs = await Organization.find({ isDeleted: { $ne: true } })
      .select("_id name slug domain plan status supportEmail")
      .lean();

    const orgIds = orgs.map((o) => o._id);
    const existingAccounts = await CustomerAccount.find({
      organizationId: { $in: orgIds },
      isDeleted: { $ne: true },
    });

    const accountMap = new Map<string, any>();
    existingAccounts.forEach((acc) => {
      accountMap.set(acc.organizationId.toString(), acc);
    });

    for (const org of orgs) {
      const orgIdStr = org._id.toString();
      if (!accountMap.has(orgIdStr)) {
        const newAcc = await CustomerAccount.create({
          organizationId: org._id,
          accountStatus: "good_standing",
          billingCycle: "monthly",
          preferredCurrency: "USD",
          creditLimit: 0,
          billingContact: {
            name: org.name,
            email: org.supportEmail || "",
            phone: "",
            address: "",
          },
        });
        accountMap.set(orgIdStr, newAcc);
      }
    }

    const invoiceAggregates = await Invoice.aggregate([
      {
        $match: {
          isDeleted: { $ne: true },
          status: { $ne: "Void" },
        },
      },
      {
        $group: {
          _id: "$organizationId",
          totalInvoiced: {
            $sum: {
              $ifNull: ["$totalAmount", { $ifNull: ["$subtotal", 0] }],
            },
          },
          totalPaid: {
            $sum: { $ifNull: ["$amountPaid", 0] },
          },
          totalBalanceDue: {
            $sum: {
              $ifNull: [
                "$balanceDue",
                {
                  $subtract: [
                    {
                      $ifNull: [
                        "$totalAmount",
                        { $ifNull: ["$subtotal", 0] },
                      ],
                    },
                    { $ifNull: ["$amountPaid", 0] },
                  ],
                },
              ],
            },
          },
        },
      },
    ]);

    const invoiceStatsMap = new Map<
      string,
      { totalInvoiced: number; totalPaid: number; totalBalanceDue: number }
    >();
    invoiceAggregates.forEach((inv) => {
      if (inv._id) {
        invoiceStatsMap.set(inv._id.toString(), {
          totalInvoiced:
            Math.round(
              (Number(inv.totalInvoiced || 0) + Number.EPSILON) * 100
            ) / 100,
          totalPaid:
            Math.round(
              (Number(inv.totalPaid || 0) + Number.EPSILON) * 100
            ) / 100,
          totalBalanceDue:
            Math.round(
              (Number(inv.totalBalanceDue || 0) + Number.EPSILON) * 100
            ) / 100,
        });
      }
    });

    let results = orgs.map((org) => {
      const orgIdStr = org._id.toString();
      const acc = accountMap.get(orgIdStr);
      const invStats = invoiceStatsMap.get(orgIdStr) || {
        totalInvoiced: 0,
        totalPaid: 0,
        totalBalanceDue: 0,
      };

      return {
        id: acc._id.toString(),
        _id: acc._id.toString(),
        organizationId: {
          id: org._id.toString(),
          _id: org._id.toString(),
          name: org.name,
          slug: org.slug,
          domain: org.domain,
          plan: org.plan || "Enterprise",
          status: org.status || "Active",
          supportEmail: org.supportEmail,
        },
        organization: {
          id: org._id.toString(),
          _id: org._id.toString(),
          name: org.name,
          slug: org.slug,
          domain: org.domain,
          plan: org.plan || "Enterprise",
          status: org.status || "Active",
          supportEmail: org.supportEmail,
        },
        accountStatus: acc.accountStatus || "good_standing",
        billingCycle: acc.billingCycle || "monthly",
        preferredCurrency: acc.preferredCurrency || "USD",
        creditLimit: acc.creditLimit || 0,
        billingContact: acc.billingContact || {
          name: org.name,
          email: org.supportEmail || "",
          phone: "",
          address: "",
        },
        commercialNotes: acc.commercialNotes || "",
        totalInvoiced: invStats.totalInvoiced,
        totalPaid: invStats.totalPaid,
        totalBalanceDue: invStats.totalBalanceDue,
        currentBalance: invStats.totalBalanceDue,
        totalLifetimeSpend: invStats.totalPaid,
        createdAt: acc.createdAt,
        updatedAt: acc.updatedAt,
      };
    });

    if (status && status !== "all") {
      results = results.filter((r) => r.accountStatus === status);
    }

    if (search && typeof search === "string" && search.trim()) {
      const q = search.trim().toLowerCase();
      results = results.filter(
        (r) =>
          r.organization.name.toLowerCase().includes(q) ||
          r.organization.slug.toLowerCase().includes(q) ||
          (r.billingContact?.name &&
            r.billingContact.name.toLowerCase().includes(q)) ||
          (r.billingContact?.email &&
            r.billingContact.email.toLowerCase().includes(q))
      );
    }

    const summary = {
      totalAccounts: results.length,
      goodStandingCount: results.filter(
        (r) => r.accountStatus === "good_standing"
      ).length,
      delinquentCount: results.filter((r) => r.accountStatus === "delinquent")
        .length,
      creditHoldCount: results.filter((r) => r.accountStatus === "credit_hold")
        .length,
      vipCount: results.filter((r) => r.accountStatus === "vip").length,
      totalOutstandingBalance:
        Math.round(
          results.reduce((sum, r) => sum + r.currentBalance, 0) * 100
        ) / 100,
    };

    return {
      results,
      accounts: results,
      total: results.length,
      summary,
    };
  }

  async updateCustomerAccount(
    id: string,
    body: any,
    actorUserId: string,
    actorUserEmail?: string
  ) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(
        400,
        "BAD_REQUEST",
        "Invalid customer account or organization ID format"
      );
    }

    const objectId = new mongoose.Types.ObjectId(id);

    let account = await CustomerAccount.findOne({
      $or: [{ _id: objectId }, { organizationId: objectId }],
      isDeleted: { $ne: true },
    });

    if (!account) {
      const org = await Organization.findById(objectId);
      if (org) {
        account = await CustomerAccount.create({
          organizationId: org._id,
          accountStatus: "good_standing",
          billingCycle: "monthly",
          preferredCurrency: "USD",
          creditLimit: 0,
          billingContact: {
            name: org.name,
            email: org.supportEmail || "",
            phone: "",
            address: "",
          },
        });
      } else {
        throw new AppError(404, "NOT_FOUND", "Customer account not found");
      }
    }

    const previousStatus = account.accountStatus;
    const previousCreditLimit = account.creditLimit;

    const {
      accountStatus,
      billingCycle,
      creditLimit,
      preferredCurrency,
      billingContact,
      commercialNotes,
    } = body || {};

    if (accountStatus !== undefined) {
      const VALID_STATUSES = [
        "good_standing",
        "delinquent",
        "credit_hold",
        "vip",
      ];
      if (!VALID_STATUSES.includes(accountStatus)) {
        throw new AppError(
          400,
          "INVALID_STATUS",
          `Invalid account status '${accountStatus}'. Must be one of: ${VALID_STATUSES.join(
            ", "
          )}`
        );
      }
      account.accountStatus = accountStatus;
    }

    if (billingCycle !== undefined) {
      const VALID_CYCLES = ["monthly", "quarterly", "annual"];
      if (!VALID_CYCLES.includes(billingCycle)) {
        throw new AppError(
          400,
          "INVALID_BILLING_CYCLE",
          `Invalid billing cycle '${billingCycle}'. Must be one of: ${VALID_CYCLES.join(
            ", "
          )}`
        );
      }
      account.billingCycle = billingCycle;
    }

    if (creditLimit !== undefined) {
      const numLimit = Number(creditLimit);
      if (isNaN(numLimit) || numLimit < 0) {
        throw new AppError(
          400,
          "INVALID_CREDIT_LIMIT",
          "Credit limit must be a non-negative number"
        );
      }
      account.creditLimit = Math.round(numLimit * 100) / 100;
    }

    if (
      preferredCurrency !== undefined &&
      typeof preferredCurrency === "string"
    ) {
      account.preferredCurrency = preferredCurrency
        .trim()
        .toUpperCase()
        .slice(0, 3);
    }

    if (billingContact && typeof billingContact === "object") {
      account.billingContact = {
        name:
          billingContact.name !== undefined
            ? String(billingContact.name).trim()
            : account.billingContact?.name || "",
        email:
          billingContact.email !== undefined
            ? String(billingContact.email).trim().toLowerCase()
            : account.billingContact?.email || "",
        phone:
          billingContact.phone !== undefined
            ? String(billingContact.phone).trim()
            : account.billingContact?.phone || "",
        address:
          billingContact.address !== undefined
            ? String(billingContact.address).trim()
            : account.billingContact?.address || "",
      };
    }

    if (commercialNotes !== undefined) {
      account.commercialNotes = String(commercialNotes).trim();
    }

    await account.save();

    await AuditLog.create({
      organizationId: account.organizationId,
      actorUserId: actorUserId && mongoose.Types.ObjectId.isValid(actorUserId)
        ? new mongoose.Types.ObjectId(actorUserId)
        : undefined,
      actorType: "user",
      eventCategory: "finance",
      eventType: "CUSTOMER_ACCOUNT_UPDATED",
      resourceType: "CustomerAccount",
      resourceId: account._id,
      action: "update",
      description: `Customer account updated for organization ${account.organizationId}: status=${account.accountStatus}, creditLimit=$${account.creditLimit}`,
      severity: "info",
      metadata: {
        previousStatus,
        newStatus: account.accountStatus,
        previousCreditLimit,
        newCreditLimit: account.creditLimit,
        billingCycle: account.billingCycle,
      },
    });

    return {
      id: account._id.toString(),
      _id: account._id.toString(),
      organizationId: account.organizationId.toString(),
      accountStatus: account.accountStatus,
      billingCycle: account.billingCycle,
      preferredCurrency: account.preferredCurrency,
      creditLimit: account.creditLimit,
      billingContact: account.billingContact,
      commercialNotes: account.commercialNotes,
      updatedAt: account.updatedAt,
    };
  }

  // ---------------------------------------------------------------------------
  // 5. Operations & Observability
  // ---------------------------------------------------------------------------

  async getOnboardingCases(query: any) {
    const {
      organizationId,
      state,
      page = "1",
      limit = "15",
    } = query || {};
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 15));
    const skip = (pageNum - 1) * limitNum;

    const filter: any = { isDeleted: false };
    if (
      organizationId &&
      organizationId !== "all" &&
      mongoose.Types.ObjectId.isValid(organizationId)
    ) {
      filter.organizationId = new mongoose.Types.ObjectId(organizationId);
    }
    if (state && state !== "all") {
      filter.state = state;
    }

    const [cases, total, stateAgg] = await Promise.all([
      OnboardingCase.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate(
          "employeeId",
          "profile.fullName auth.email employment.department"
        )
        .populate("organizationId", "name slug"),
      OnboardingCase.countDocuments(filter),
      OnboardingCase.aggregate([
        {
          $match: {
            isDeleted: false,
            ...(filter.organizationId
              ? { organizationId: filter.organizationId }
              : {}),
          },
        },
        { $group: { _id: "$state", count: { $sum: 1 } } },
      ]),
    ]);

    const stateMap = Object.fromEntries(stateAgg.map((s) => [s._id, s.count]));

    return {
      cases: cases.map((c) => ({
        id: c._id.toString(),
        employee: c.employeeId
          ? {
              id: (c.employeeId as any)._id?.toString(),
              name: (c.employeeId as any).profile?.fullName || "Employee",
              email: (c.employeeId as any).auth?.email,
              department:
                (c.employeeId as any).employment?.department || "General",
            }
          : null,
        organization: c.organizationId
          ? {
              id: (c.organizationId as any)._id?.toString(),
              name: (c.organizationId as any).name,
              slug: (c.organizationId as any).slug,
            }
          : null,
        source: c.source,
        state: c.state,
        stateReason: c.stateReason,
        failure: c.failure,
        transitionsCount: c.transitions?.length || 0,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      summary: {
        totalCases: Object.values(stateMap).reduce(
          (a: number, b: any) => a + Number(b),
          0
        ),
        activeCases:
          Number(stateMap["active"] || 0) +
          Number(stateMap["ready"] || 0) +
          Number(stateMap["provisioning"] || 0),
        readyForHandover:
          Number(stateMap["ready_for_handover"] || 0) +
          Number(stateMap["handover_pending"] || 0),
        completedCases: Number(stateMap["completed"] || 0),
        failedCases: Number(stateMap["provisioning_failed"] || 0),
        stateDistribution: stateMap,
      },
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    };
  }

  async getTasksOps(query: any) {
    const {
      organizationId,
      status,
      type,
      page = "1",
      limit = "15",
    } = query || {};
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 15));
    const skip = (pageNum - 1) * limitNum;

    const filter: any = { isDeleted: false };
    if (
      organizationId &&
      organizationId !== "all" &&
      mongoose.Types.ObjectId.isValid(organizationId)
    ) {
      filter.organizationId = new mongoose.Types.ObjectId(organizationId);
    }
    if (status && status !== "all") {
      filter.status = status;
    }
    if (type && type !== "all") {
      filter.type = type;
    }

    const now = new Date();
    const [tasks, total, overdueCount, itCount] = await Promise.all([
      Task.find(filter)
        .sort({ dueDate: 1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("assignedToUserId", "profile.fullName auth.email")
        .populate("organizationId", "name slug"),
      Task.countDocuments(filter),
      Task.countDocuments({
        ...filter,
        dueDate: { $lt: now },
        status: { $nin: ["completed", "cancelled"] },
      }),
      Task.countDocuments({
        ...filter,
        type: { $in: ["it_provisioning", "hardware", "system_access"] },
      }),
    ]);

    return {
      tasks: tasks.map((t) => ({
        id: t._id.toString(),
        title: t.title,
        description: t.description,
        type: (t as any).type || (t as any).taskType || "task",
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        isOverdue:
          t.dueDate &&
          new Date(t.dueDate) < now &&
          t.status !== "completed",
        assignee: t.assignedToUserId
          ? {
              id: (t.assignedToUserId as any)._id?.toString(),
              name: (t.assignedToUserId as any).profile?.fullName || "User",
              email: (t.assignedToUserId as any).auth?.email,
            }
          : null,
        organization: t.organizationId
          ? {
              id: (t.organizationId as any)._id?.toString(),
              name: (t.organizationId as any).name,
              slug: (t.organizationId as any).slug,
            }
          : null,
        createdAt: t.createdAt,
      })),
      summary: {
        total,
        overdueCount,
        itHardwareCount: itCount,
      },
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    };
  }

  async getActivity(query: any) {
    const {
      organizationId,
      category,
      severity,
      search,
      page = "1",
      limit = "25",
    } = query || {};
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 25));
    const skip = (pageNum - 1) * limitNum;

    const filter: any = {};
    if (
      organizationId &&
      organizationId !== "all" &&
      mongoose.Types.ObjectId.isValid(organizationId)
    ) {
      filter.organizationId = new mongoose.Types.ObjectId(organizationId);
    }
    if (category && category !== "all") {
      filter.eventCategory = category;
    }
    if (severity && severity !== "all") {
      filter.severity = severity;
    }
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [
        { description: regex },
        { action: regex },
        { eventType: regex },
        { resourceType: regex },
      ];
    }

    const [logs, total, severityAgg] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("organizationId", "name slug")
        .populate("actorUserId", "profile.fullName auth.email"),
      AuditLog.countDocuments(filter),
      AuditLog.aggregate([
        {
          $match: filter.organizationId
            ? { organizationId: filter.organizationId }
            : {},
        },
        { $group: { _id: "$severity", count: { $sum: 1 } } },
      ]),
    ]);

    const severityMap = Object.fromEntries(
      severityAgg.map((s) => [s._id, s.count])
    );

    return {
      events: logs.map((l) => ({
        id: l._id.toString(),
        description: l.description,
        category: l.eventCategory,
        action: l.action,
        severity: l.severity,
        eventType: l.eventType,
        resourceType: l.resourceType,
        resourceId: l.resourceId?.toString(),
        actor: l.actorUserId
          ? {
              id: (l.actorUserId as any)._id?.toString(),
              name: (l.actorUserId as any).profile?.fullName || "User",
              email: (l.actorUserId as any).auth?.email,
            }
          : { name: "System Operator", email: "system@talnova.app" },
        organization: l.organizationId
          ? {
              id: (l.organizationId as any)._id?.toString(),
              name: (l.organizationId as any).name,
              slug: (l.organizationId as any).slug,
            }
          : { name: "Platform Infrastructure", slug: "talnova" },
        createdAt: l.createdAt,
      })),
      summary: {
        total,
        criticalCount: severityMap["critical"] || 0,
        highCount: severityMap["high"] || 0,
        warningCount: severityMap["warning"] || 0,
        infoCount: severityMap["info"] || 0,
      },
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    };
  }

  getApiObservability() {
    return TelemetryBuffer.getMetrics();
  }

  async getInfrastructureObservability() {
    const mem = process.memoryUsage();
    const uptimeSeconds = Math.floor(process.uptime());

    const [orgs, users, journeys, tasks, uploads, auditLogs] = await Promise.all([
      Organization.countDocuments(),
      User.countDocuments(),
      Journey.countDocuments(),
      Task.countDocuments(),
      Upload.countDocuments(),
      AuditLog.countDocuments(),
    ]);

    return {
      runtime: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        uptimeSeconds,
        uptimeFormatted: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor(
          (uptimeSeconds % 3600) / 60
        )}m`,
      },
      memory: {
        rssMB: Math.round(mem.rss / (1024 * 1024)),
        heapTotalMB: Math.round(mem.heapTotal / (1024 * 1024)),
        heapUsedMB: Math.round(mem.heapUsed / (1024 * 1024)),
        externalMB: Math.round(mem.external / (1024 * 1024)),
      },
      database: {
        state: mongoose.connection.readyState === 1 ? "CONNECTED" : "DEGRADED",
        name: mongoose.connection.name || "talnova",
        host: mongoose.connection.host || "localhost",
        collections: [
          { name: "organizations", documents: orgs },
          { name: "users", documents: users },
          { name: "journeys", documents: journeys },
          { name: "tasks", documents: tasks },
          { name: "uploads", documents: uploads },
          { name: "audit_logs", documents: auditLogs },
        ],
      },
    };
  }

  async getAiObservability() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const featureAggregates = await AIUsageRecord.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: "$feature",
          requests: { $sum: 1 },
          tokens: { $sum: "$totalTokens" },
          cost: { $sum: "$estimatedCostUsd" },
        },
      },
    ]);

    const featureLabelMap: Record<string, string> = {
      ai_course_builder: "AI Course Builder",
      ai_assistant: "Onboarding Assistant",
      kb_rag: "Knowledge Base RAG",
      document_summary: "Document Summarizer",
    };

    const breakdownMap = new Map<
      string,
      { requests: number; tokens: number; cost: number }
    >();
    featureAggregates.forEach((item) => {
      if (item._id) {
        breakdownMap.set(item._id, {
          requests: item.requests || 0,
          tokens: item.tokens || 0,
          cost: Math.round((item.cost || 0) * 100) / 100,
        });
      }
    });

    const canonicalFeatures = [
      "ai_course_builder",
      "ai_assistant",
      "kb_rag",
      "document_summary",
    ];
    const featureBreakdown = canonicalFeatures.map((fKey) => {
      const stats = breakdownMap.get(fKey) || {
        requests: 0,
        tokens: 0,
        cost: 0,
      };
      return {
        feature: featureLabelMap[fKey] || fKey,
        requests: stats.requests,
        tokens: stats.tokens,
        cost: stats.cost,
      };
    });

    for (const [key, stats] of breakdownMap.entries()) {
      if (!canonicalFeatures.includes(key)) {
        featureBreakdown.push({
          feature: featureLabelMap[key] || key,
          requests: stats.requests,
          tokens: stats.tokens,
          cost: stats.cost,
        });
      }
    }

    const totalRequests = featureAggregates.reduce(
      (sum, f) => sum + (f.requests || 0),
      0
    );
    const tokensConsumed = featureAggregates.reduce(
      (sum, f) => sum + (f.tokens || 0),
      0
    );
    const costEstimateUSD =
      Math.round(
        featureAggregates.reduce((sum, f) => sum + (f.cost || 0), 0) * 100
      ) / 100;
    const monthlyBudget = 2500000;
    const utilizationPct =
      Math.round(((tokensConsumed / monthlyBudget) * 100) * 100) / 100;

    const dominantModelAgg = await AIUsageRecord.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: "$model", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]);
    const dominantModel =
      dominantModelAgg.length > 0
        ? dominantModelAgg[0]._id
        : "gemini-1.5-flash / pro";

    return {
      model: dominantModel,
      totalRequests,
      tokensConsumed,
      monthlyBudget,
      utilizationPct,
      costEstimateUSD,
      featureBreakdown,
    };
  }

  async getAiUsage(query: any) {
    const {
      organizationId,
      feature,
      provider,
      model,
      status,
      page = 1,
      limit = 50,
    } = query || {};

    const filter: any = {};
    if (organizationId && mongoose.Types.ObjectId.isValid(organizationId)) {
      filter.organizationId = new mongoose.Types.ObjectId(organizationId);
    }
    if (feature) filter.feature = feature;
    if (provider) filter.provider = provider;
    if (model) filter.model = model;
    if (status) filter.status = status;

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(
      100,
      Math.max(1, parseInt(String(limit), 10) || 50)
    );
    const skip = (pageNum - 1) * limitNum;

    const [records, total] = await Promise.all([
      AIUsageRecord.find(filter)
        .populate("organizationId", "name slug plan")
        .populate("userId", "profile.fullName auth.email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AIUsageRecord.countDocuments(filter),
    ]);

    const items = records.map((r) => ({
      id: r._id.toString(),
      _id: r._id.toString(),
      organization: r.organizationId,
      organizationId: r.organizationId,
      user: r.userId,
      userId: r.userId,
      feature: r.feature,
      provider: r.provider,
      model: r.model,
      inputTokens: r.inputTokens,
      promptTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      completionTokens: r.outputTokens,
      totalTokens: r.totalTokens,
      estimatedCostUsd: r.estimatedCostUsd,
      costEstimateUSD: r.estimatedCostUsd,
      latencyMs: r.latencyMs,
      durationMs: r.latencyMs,
      status: r.status,
      errorMessage: r.errorMessage,
      createdAt: r.createdAt,
    }));

    const pagination = {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    };

    return {
      items,
      pagination,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: pagination.totalPages,
    };
  }

  async getStorageObservability() {
    const storageByType = await Upload.aggregate([
      { $match: { "lifecycle.status": { $ne: "deleted" } } },
      {
        $group: {
          _id: "$type",
          totalBytes: { $sum: "$fileSizeBytes" },
          count: { $sum: 1 },
        },
      },
    ]);

    const totalBytes = storageByType.reduce(
      (sum, item) => sum + (item.totalBytes || 0),
      0
    );
    const totalFiles = storageByType.reduce(
      (sum, item) => sum + (item.count || 0),
      0
    );

    return {
      provider: "Cloudflare R2 / S3",
      totalBytes,
      totalFiles,
      totalMB: Math.round(totalBytes / (1024 * 1024)),
      totalGB: Number((totalBytes / (1024 * 1024 * 1024)).toFixed(2)),
      byType: storageByType.map((s) => ({
        type: s._id || "other",
        count: s.count,
        sizeMB: Math.round((s.totalBytes || 0) / (1024 * 1024)),
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // 6. Settings, Flags, Alerts & Reports
  // ---------------------------------------------------------------------------

  async syncDefaultFeatureFlags() {
    const db = mongoose.connection.db;
    if (db) {
      try {
        const rawCol = db.collection("platform_feature_flags");
        const rawDocs = await rawCol.find().toArray();
        if (rawDocs && rawDocs.length > 0) {
          for (const raw of rawDocs) {
            const rawKey = raw.key?.toLowerCase()?.trim();
            if (rawKey) {
              await FeatureFlag.updateOne(
                { key: rawKey },
                {
                  $setOnInsert: {
                    name: raw.name || rawKey,
                    description: raw.description || `Platform flag ${rawKey}`,
                    isEnabled: raw.enabled ?? false,
                    rolloutPercentage: raw.rolloutPct ?? 100,
                    targetAudience: "global",
                    environment: "all",
                    targetOrganizationIds: [],
                    excludedOrganizationIds: [],
                    targetRoles: [],
                    isDeleted: false,
                  },
                },
                { upsert: true }
              );
            }
          }
        }
      } catch {
        // Raw collection migration silent catch
      }
    }

    // Ensure baseline default platform flags exist
    const bulkOps = DEFAULT_PLATFORM_FLAGS.map((flag) => ({
      updateOne: {
        filter: { key: flag.key },
        update: {
          $setOnInsert: {
            ...flag,
            targetOrganizationIds: [],
            excludedOrganizationIds: [],
            targetRoles: [],
            isDeleted: false,
          },
        },
        upsert: true,
      },
    }));
    await FeatureFlag.bulkWrite(bulkOps, { ordered: false });
  }

  async getFlags() {
    await this.syncDefaultFeatureFlags();

    const flags = await FeatureFlag.find({ isDeleted: false })
      .populate("targetOrganizationIds", "name slug")
      .populate("excludedOrganizationIds", "name slug")
      .sort({ key: 1 });

    return flags.map((f) => f.toJSON());
  }

  async createFlag(body: any, actorUserId: string) {
    const {
      key,
      name,
      description,
      isEnabled,
      enabled,
      environment = "all",
      targetAudience = "global",
      targetOrganizationIds = [],
      excludedOrganizationIds = [],
      targetRoles = [],
      rolloutPercentage,
      rolloutPct,
    } = body || {};

    if (!key || typeof key !== "string" || !key.trim()) {
      throw new AppError(400, "VALIDATION_ERROR", "Feature flag 'key' is required");
    }
    if (!name || typeof name !== "string" || !name.trim()) {
      throw new AppError(400, "VALIDATION_ERROR", "Feature flag 'name' is required");
    }
    if (!description || typeof description !== "string" || !description.trim()) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Feature flag 'description' is required"
      );
    }

    const normalizedKey = key.trim().toLowerCase();

    const allOrgIds = [...targetOrganizationIds, ...excludedOrganizationIds];
    for (const id of allOrgIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          `Invalid organization ObjectId format: ${id}`
        );
      }
    }

    const existing = await FeatureFlag.findOne({
      key: normalizedKey,
      isDeleted: false,
    });
    if (existing) {
      throw new AppError(
        409,
        "DUPLICATE_KEY",
        `Feature flag with key '${normalizedKey}' already exists`
      );
    }

    const effectiveRollout = rolloutPercentage ?? rolloutPct ?? 100;
    const effectiveEnabled = isEnabled ?? enabled ?? false;

    const newFlag = await FeatureFlag.create({
      key: normalizedKey,
      name: name.trim(),
      description: description.trim(),
      isEnabled: Boolean(effectiveEnabled),
      environment,
      targetAudience,
      targetOrganizationIds: targetOrganizationIds.map(
        (id: string) => new mongoose.Types.ObjectId(id)
      ),
      excludedOrganizationIds: excludedOrganizationIds.map(
        (id: string) => new mongoose.Types.ObjectId(id)
      ),
      targetRoles,
      rolloutPercentage: Math.max(0, Math.min(100, Number(effectiveRollout))),
      isDeleted: false,
    });

    await AuditLog.create({
      actorUserId,
      actorType: "user",
      eventCategory: "feature_flag",
      eventType: "FLAG_UPDATED",
      resourceType: "FeatureFlag",
      resourceId: newFlag._id,
      action: "create",
      description: `Feature flag '${normalizedKey}' registered`,
      severity: "warning",
      metadata: {
        previousState: null,
        newState: newFlag.toJSON(),
        reason: body.reason || "Custom feature flag registered",
      },
    });

    FeatureFlagService.invalidateCache(normalizedKey);

    return newFlag.toJSON();
  }

  async updateFlag(key: string, body: any, actorUserId: string) {
    const normalizedKey = (key || "").trim().toLowerCase();
    let flag = await FeatureFlag.findOne({
      key: normalizedKey,
      isDeleted: false,
    });

    if (!flag) {
      const defaultFlag = DEFAULT_PLATFORM_FLAGS.find(
        (f) => f.key === normalizedKey
      );
      if (defaultFlag) {
        flag = await FeatureFlag.create({
          ...defaultFlag,
          targetOrganizationIds: [],
          excludedOrganizationIds: [],
          targetRoles: [],
          isDeleted: false,
        });
      } else {
        throw new AppError(
          404,
          "FLAG_NOT_FOUND",
          `Feature flag '${key}' not found`
        );
      }
    }

    const previousState = flag.toJSON();

    if (body.targetOrganizationIds !== undefined) {
      if (!Array.isArray(body.targetOrganizationIds)) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "targetOrganizationIds must be an array"
        );
      }
      for (const id of body.targetOrganizationIds) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            `Invalid targetOrganizationId format: ${id}`
          );
        }
      }
      flag.targetOrganizationIds = body.targetOrganizationIds.map(
        (id: string) => new mongoose.Types.ObjectId(id)
      );
    }

    if (body.excludedOrganizationIds !== undefined) {
      if (!Array.isArray(body.excludedOrganizationIds)) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "excludedOrganizationIds must be an array"
        );
      }
      for (const id of body.excludedOrganizationIds) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            `Invalid excludedOrganizationId format: ${id}`
          );
        }
      }
      flag.excludedOrganizationIds = body.excludedOrganizationIds.map(
        (id: string) => new mongoose.Types.ObjectId(id)
      );
    }

    if (body.targetRoles !== undefined) {
      if (!Array.isArray(body.targetRoles)) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "targetRoles must be an array"
        );
      }
      flag.targetRoles = body.targetRoles;
    }

    if (body.rolloutPercentage !== undefined || body.rolloutPct !== undefined) {
      const pct = Number(body.rolloutPercentage ?? body.rolloutPct);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "rolloutPercentage must be between 0 and 100"
        );
      }
      flag.rolloutPercentage = pct;
    }

    if (body.isEnabled !== undefined || body.enabled !== undefined) {
      flag.isEnabled = Boolean(body.isEnabled ?? body.enabled);
    }
    if (body.environment !== undefined) flag.environment = body.environment;
    if (body.targetAudience !== undefined)
      flag.targetAudience = body.targetAudience;
    if (body.name !== undefined) flag.name = String(body.name).trim();
    if (body.description !== undefined)
      flag.description = String(body.description).trim();

    await flag.save();

    await flag.populate("targetOrganizationIds", "name slug");
    await flag.populate("excludedOrganizationIds", "name slug");

    const newState = flag.toJSON();

    await AuditLog.create({
      actorUserId,
      actorType: "user",
      eventCategory: "feature_flag",
      eventType: "FLAG_UPDATED",
      resourceType: "FeatureFlag",
      resourceId: flag._id,
      action: "update",
      description: `Feature flag '${flag.key}' updated`,
      severity: "warning",
      metadata: {
        previousState: {
          isEnabled: previousState.isEnabled,
          rolloutPercentage: previousState.rolloutPercentage,
          targetAudience: previousState.targetAudience,
          targetOrganizationIds: previousState.targetOrganizationIds,
          excludedOrganizationIds: previousState.excludedOrganizationIds,
        },
        newState: {
          isEnabled: newState.isEnabled,
          rolloutPercentage: newState.rolloutPercentage,
          targetAudience: newState.targetAudience,
          targetOrganizationIds: newState.targetOrganizationIds,
          excludedOrganizationIds: newState.excludedOrganizationIds,
        },
        reason: body.reason || "Administrative feature flag update",
      },
    });

    FeatureFlagService.invalidateCache(normalizedKey);

    return flag.toJSON();
  }

  async getAlerts(query: any) {
    const {
      status,
      severity,
      category,
      search,
      page = 1,
      limit = 50,
    } = query || {};

    await AlertService.syncSystemAlerts();

    const filter: any = {};

    if (status && status !== "all") {
      if (status === "active") {
        filter.status = { $ne: "resolved" };
      } else {
        filter.status = status;
      }
    } else if (!status) {
      filter.status = { $ne: "resolved" };
    }

    if (severity && severity !== "all") {
      filter.severity = severity;
    }

    if (category && category !== "all") {
      filter.category = category;
    }

    if (search && typeof search === "string" && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { alertNo: { $regex: q, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(
      100,
      Math.max(1, parseInt(String(limit), 10) || 50)
    );
    const skip = (pageNum - 1) * limitNum;

    const [alertDocs, totalFiltered, activeStatsAgg] = await Promise.all([
      Alert.find(filter)
        .populate("organizationId", "name slug")
        .populate("acknowledgedBy", "profile.fullName auth.email")
        .populate("resolvedBy", "profile.fullName auth.email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Alert.countDocuments(filter),
      Alert.aggregate([
        { $match: { status: { $ne: "resolved" } } },
        {
          $group: {
            _id: null,
            critical: {
              $sum: { $cond: [{ $eq: ["$severity", "critical"] }, 1, 0] },
            },
            high: {
              $sum: { $cond: [{ $eq: ["$severity", "high"] }, 1, 0] },
            },
            warning: {
              $sum: { $cond: [{ $eq: ["$severity", "warning"] }, 1, 0] },
            },
            info: {
              $sum: { $cond: [{ $eq: ["$severity", "info"] }, 1, 0] },
            },
            open: {
              $sum: { $cond: [{ $eq: ["$status", "open"] }, 1, 0] },
            },
            acknowledged: {
              $sum: { $cond: [{ $eq: ["$status", "acknowledged"] }, 1, 0] },
            },
            investigating: {
              $sum: { $cond: [{ $eq: ["$status", "investigating"] }, 1, 0] },
            },
            total: { $sum: 1 },
          },
        },
      ]),
    ]);

    const activeStats = activeStatsAgg[0] || {
      critical: 0,
      high: 0,
      warning: 0,
      info: 0,
      open: 0,
      acknowledged: 0,
      investigating: 0,
      total: 0,
    };

    const resolvedCount = await Alert.countDocuments({ status: "resolved" });

    const alerts = alertDocs.map((a: any) => ({
      id: a._id.toString(),
      _id: a._id.toString(),
      alertNo: a.alertNo,
      title: a.title,
      description: a.description,
      severity: a.severity,
      category: a.category,
      sourceService: a.sourceService,
      sourceId: a.sourceId,
      organizationId: a.organizationId?._id
        ? a.organizationId._id.toString()
        : a.organizationId?.toString(),
      organization:
        a.organizationId && a.organizationId.name
          ? {
              id: a.organizationId._id?.toString(),
              name: a.organizationId.name,
              slug: a.organizationId.slug,
            }
          : null,
      status: a.status,
      acknowledgedBy: a.acknowledgedBy
        ? {
            id: a.acknowledgedBy._id?.toString(),
            name: a.acknowledgedBy.profile?.fullName,
            email: a.acknowledgedBy.auth?.email,
          }
        : null,
      acknowledgedAt: a.acknowledgedAt,
      resolvedBy: a.resolvedBy
        ? {
            id: a.resolvedBy._id?.toString(),
            name: a.resolvedBy.profile?.fullName,
            email: a.resolvedBy.auth?.email,
          }
        : null,
      resolvedAt: a.resolvedAt,
      resolutionNotes: a.resolutionNotes,
      createdAt: a.createdAt,
    }));

    const summary = {
      total: activeStats.total,
      critical: activeStats.critical,
      high: activeStats.high,
      warning: activeStats.warning,
      info: activeStats.info,
      open: activeStats.open,
      acknowledged: activeStats.acknowledged,
      investigating: activeStats.investigating,
      resolved: resolvedCount,
    };

    return {
      alerts,
      summary,
      total: totalFiltered,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalFiltered / limitNum) || 1,
    };
  }

  async updateAlertStatus(id: string, body: any, actorUserId?: string) {
    const { status, resolutionNotes } = body || {};

    if (
      !status ||
      !["open", "acknowledged", "investigating", "resolved", "ignored"].includes(
        status
      )
    ) {
      throw new AppError(
        400,
        "BAD_REQUEST",
        "Invalid alert status. Must be one of: open, acknowledged, investigating, resolved, ignored"
      );
    }

    const updated = await AlertService.updateAlertStatus({
      alertId: id,
      status: status as any,
      operatorUserId: actorUserId,
      resolutionNotes,
    });

    return {
      id: updated._id.toString(),
      _id: updated._id.toString(),
      alertNo: updated.alertNo,
      status: updated.status,
      acknowledgedBy: updated.acknowledgedBy,
      acknowledgedAt: updated.acknowledgedAt,
      resolvedBy: updated.resolvedBy,
      resolvedAt: updated.resolvedAt,
      resolutionNotes: updated.resolutionNotes,
      updatedAt: updated.updatedAt,
    };
  }

  async exportReport(reportId: string, format?: string, actorUserId?: string) {
    if (!ReportGeneratorService.isSupportedReport(reportId)) {
      throw new AppError(
        404,
        "NOT_FOUND",
        `Report '${reportId}' not found in canonical reports catalog.`
      );
    }

    const generated = await ReportGeneratorService.generateReport(reportId, format);

    if (actorUserId && mongoose.Types.ObjectId.isValid(actorUserId)) {
      await AuditLog.create({
        actorUserId: new mongoose.Types.ObjectId(actorUserId),
        actorType: "user",
        eventCategory: "admin",
        eventType: "DATA_EXPORTED",
        resourceType: "Report",
        action: "export",
        description: `Canonical report '${reportId}' exported (${generated.rowCount} records, ${generated.format.toUpperCase()})`,
        severity: "info",
        metadata: {
          reportId,
          rowCount: generated.rowCount,
          format: generated.format,
        },
      }).catch((err) => {
        console.warn("[SuperAdminService] Failed to log DATA_EXPORTED audit:", err.message);
      });
    }

    return generated;
  }

  async getPlatformSettings() {
    const setting = await PlatformSetting.getOrCreate();
    return {
      maintenanceMode: setting.maintenanceMode,
      maintenanceMessage: setting.maintenanceMessage,
      sessionTimeoutMinutes: setting.sessionTimeoutMinutes,
      enforceMfaAdmins: setting.enforceMfaAdmins,
      updatedAt: setting.updatedAt,
      updatedBy: setting.updatedBy,
    };
  }

  async updatePlatformSettings(body: any, actorUserId?: string) {
    const {
      maintenanceMode,
      maintenanceMessage,
      sessionTimeoutMinutes,
      enforceMfaAdmins,
    } = body || {};

    if (sessionTimeoutMinutes !== undefined) {
      const timeout = Number(sessionTimeoutMinutes);
      if (isNaN(timeout) || timeout < 5 || timeout > 1440) {
        throw new AppError(
          400,
          "BAD_REQUEST",
          "Session timeout must be between 5 and 1440 minutes"
        );
      }
    }

    const currentSetting = await PlatformSetting.getOrCreate();
    const previousState = {
      maintenanceMode: currentSetting.maintenanceMode,
      maintenanceMessage: currentSetting.maintenanceMessage,
      sessionTimeoutMinutes: currentSetting.sessionTimeoutMinutes,
      enforceMfaAdmins: currentSetting.enforceMfaAdmins,
    };

    if (maintenanceMode !== undefined)
      currentSetting.maintenanceMode = Boolean(maintenanceMode);
    if (
      maintenanceMessage !== undefined &&
      typeof maintenanceMessage === "string"
    ) {
      currentSetting.maintenanceMessage = maintenanceMessage.trim();
    }
    if (sessionTimeoutMinutes !== undefined) {
      currentSetting.sessionTimeoutMinutes = Number(sessionTimeoutMinutes);
    }
    if (enforceMfaAdmins !== undefined) {
      currentSetting.enforceMfaAdmins = Boolean(enforceMfaAdmins);
    }

    if (actorUserId && mongoose.Types.ObjectId.isValid(actorUserId)) {
      currentSetting.updatedBy = new mongoose.Types.ObjectId(actorUserId);
    }
    currentSetting.updatedAt = new Date();

    await currentSetting.save();

    const newState = {
      maintenanceMode: currentSetting.maintenanceMode,
      maintenanceMessage: currentSetting.maintenanceMessage,
      sessionTimeoutMinutes: currentSetting.sessionTimeoutMinutes,
      enforceMfaAdmins: currentSetting.enforceMfaAdmins,
    };

    if (actorUserId && mongoose.Types.ObjectId.isValid(actorUserId)) {
      await AuditLog.create({
        actorUserId: new mongoose.Types.ObjectId(actorUserId),
        actorType: "user",
        eventCategory: "security",
        eventType: "PLATFORM_SETTINGS_UPDATED",
        resourceType: "PlatformSetting",
        action: "update",
        description: `Platform governance settings updated: maintenanceMode=${newState.maintenanceMode}, sessionTimeout=${newState.sessionTimeoutMinutes}m`,
        severity: "critical",
        metadata: {
          previousState,
          newState,
        },
      }).catch((err) => {
        console.warn("[SuperAdminService] Failed to log PLATFORM_SETTINGS_UPDATED audit:", err.message);
      });
    }

    return {
      maintenanceMode: currentSetting.maintenanceMode,
      maintenanceMessage: currentSetting.maintenanceMessage,
      sessionTimeoutMinutes: currentSetting.sessionTimeoutMinutes,
      enforceMfaAdmins: currentSetting.enforceMfaAdmins,
      updatedAt: currentSetting.updatedAt,
      updatedBy: currentSetting.updatedBy,
    };
  }
}

export default SuperAdminService;
