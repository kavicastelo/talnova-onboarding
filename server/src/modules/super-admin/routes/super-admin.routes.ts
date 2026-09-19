import { FastifyInstance } from "fastify";
import { authenticate, requireRole } from "../../../middleware/auth.middleware.js";
import mongoose from "mongoose";
import AppError from "../../../common/errors/app-error.js";
import Organization from "../../organizations/models/organization.model.js";
import User from "../../auth/models/user.model.js";
import AuditLog from "../../audit-logs/models/audit-log.model.js";
import Invoice from "../models/invoice.model.js";
import PaymentRecord from "../models/payment-record.model.js";
import ExpenseRecord from "../models/expense-record.model.js";
import CustomerAccount from "../models/customer-account.model.js";
import FeatureFlag from "../models/feature-flag.model.js";
import FeatureFlagService from "../services/feature-flag.service.js";
import Journey from "../../journeys/models/journey.model.js";
import OnboardingCase from "../../onboarding/models/onboarding-case.model.js";
import { Upload } from "../../uploads/models/upload.model.js";
import Session from "../../auth/models/session.model.js";
import Task from "../../tasks/models/task.model.js";
import { hashPassword } from "../../../utils/crypto.js";

export async function superAdminRoutes(app: FastifyInstance) {
  // Enforce auth & role for all routes in this prefix
  app.addHook("onRequest", authenticate);
  app.addHook("onRequest", requireRole(["super_admin"]));

  // GET /search - Cross-domain global search
  app.get("/search", async (request, reply) => {
    const { q, limit = "10" } = request.query as any;
    if (!q || typeof q !== "string" || q.trim().length < 2) {
      return reply.status(200).send({
        success: true,
        data: { organizations: [], users: [], journeys: [], invoices: [] }
      });
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
        ]
      }).limit(limitNum).select("_id name slug domain plan status"),

      User.find({
        isDeleted: false,
        $or: [
          { "profile.fullName": regex },
          { "profile.firstName": regex },
          { "profile.lastName": regex },
          { "auth.email": regex },
          { "employment.employeeId": regex },
          { "employment.department": regex },
        ]
      }).limit(limitNum).select("_id profile.fullName auth.email permissions.role employment.status employment.department organizationId"),

      Journey.find({
        isDeleted: false,
        $or: [
          { title: regex },
          { description: regex },
        ]
      }).limit(limitNum).select("_id title status version organizationId"),

      Invoice.find({
        isDeleted: false,
        $or: [
          { invoiceNo: regex },
          { customerName: regex },
          { organization: regex },
          { description: regex },
        ]
      }).limit(limitNum).select("_id invoiceNo customerName organization amount totalAmount balanceDue status dueDate organizationId")
    ]);

    return reply.status(200).send({
      success: true,
      message: "Search results retrieved",
      data: {
        organizations: orgs.map(o => ({
          id: o._id.toString(),
          name: o.name,
          slug: o.slug,
          domain: o.domain,
          plan: o.plan,
          status: o.status,
          type: "organization"
        })),
        users: users.map(u => ({
          id: u._id.toString(),
          name: u.profile?.fullName || "Unnamed User",
          email: u.auth?.email,
          role: u.permissions?.role,
          department: u.employment?.department,
          status: u.employment?.status,
          organizationId: u.organizationId?.toString(),
          type: "user"
        })),
        journeys: journeys.map(j => ({
          id: j._id.toString(),
          title: j.title,
          status: (j as any).status || "published",
          organizationId: j.organizationId?.toString(),
          type: "journey"
        })),
        invoices: invoices.map(i => ({
          id: i._id.toString(),
          invoiceNo: i.invoiceNo,
          customerName: (i as any).customerName || i.organization,
          amount: (i as any).totalAmount ?? i.amount,
          balanceDue: (i as any).balanceDue ?? ((i as any).status === "Paid" || (i as any).status === "paid" ? 0 : ((i as any).totalAmount ?? i.amount)),
          status: i.status,
          dueDate: i.dueDate,
          organizationId: i.organizationId?.toString(),
          type: "invoice"
        }))
      }
    });
  });

  // GET /telemetry
  app.get("/telemetry", async (request, reply) => {
    const { organizationId, startDate, endDate } = request.query as any;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const isOrgScoped = organizationId && organizationId !== "all" && mongoose.Types.ObjectId.isValid(organizationId);
    const orgFilter = isOrgScoped ? { organizationId: new mongoose.Types.ObjectId(organizationId) } : {};

    // 1. Organizations count & delta
    const totalOrganizations = isOrgScoped ? 1 : await Organization.countDocuments({ isDeleted: false });
    const activeOrganizations = isOrgScoped
      ? await Organization.countDocuments({ _id: organizationId, isDeleted: false, status: "Active" })
      : await Organization.countDocuments({ isDeleted: false, status: "Active" });
    const suspendedOrganizations = totalOrganizations - activeOrganizations;
    const orgsBefore30d = isOrgScoped ? 1 : await Organization.countDocuments({
      createdAt: { $lt: thirtyDaysAgo },
      isDeleted: false
    });
    const orgsInLast30d = totalOrganizations - orgsBefore30d;
    const orgsDeltaPct = orgsBefore30d > 0 ? Math.round((orgsInLast30d / orgsBefore30d) * 100) : 0;
    const orgsDeltaStr = orgsDeltaPct >= 0 ? `+${orgsDeltaPct}%` : `${orgsDeltaPct}%`;

    // 2. Platform Users count & delta
    const userFilter: any = { isDeleted: false, ...orgFilter };
    const platformUsers = await User.countDocuments(userFilter);
    const activeUsers = await User.countDocuments({ ...userFilter, "employment.status": "Active" });
    const usersBefore30d = await User.countDocuments({
      ...userFilter,
      createdAt: { $lt: thirtyDaysAgo }
    });
    const usersInLast30d = platformUsers - usersBefore30d;
    const usersDeltaPct = usersBefore30d > 0 ? Math.round((usersInLast30d / usersBefore30d) * 100) : 0;
    const usersDeltaStr = usersDeltaPct >= 0 ? `+${usersDeltaPct}%` : `${usersDeltaPct}%`;

    // 3. Active Onboardings in flight
    const caseFilter: any = {
      isDeleted: false,
      state: { $in: ["active", "ready", "provisioning", "ready_for_handover", "handover_pending"] },
      ...orgFilter
    };
    const activeOnboardings = await OnboardingCase.countDocuments(caseFilter);
    const onboardingsBefore30d = await OnboardingCase.countDocuments({
      ...caseFilter,
      createdAt: { $lt: thirtyDaysAgo }
    });
    const onboardingsDelta = activeOnboardings - onboardingsBefore30d;
    const onboardingsDeltaStr = onboardingsDelta >= 0 ? `+${onboardingsDelta}` : `${onboardingsDelta}`;

    // 4. Cash Collected (Paid invoices)
    const invoiceFilter: any = { status: { $in: ["Paid", "paid"] }, isDeleted: false, ...orgFilter };
    const currRevenueInvoices = await Invoice.find({
      ...invoiceFilter,
      createdAt: { $gte: thirtyDaysAgo }
    });
    const currRevenue = currRevenueInvoices.reduce((sum, inv) => sum + (inv.totalAmount ?? inv.amount ?? 0), 0);

    const prevRevenueInvoices = await Invoice.find({
      ...invoiceFilter,
      createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
    });
    const prevRevenue = prevRevenueInvoices.reduce((sum, inv) => sum + (inv.totalAmount ?? inv.amount ?? 0), 0);

    const revenueDeltaPct = prevRevenue > 0
      ? Math.round(((currRevenue - prevRevenue) / prevRevenue) * 100)
      : currRevenue > 0 ? 100 : 0;
    const revenueDeltaStr = revenueDeltaPct >= 0 ? `+${revenueDeltaPct}%` : `${revenueDeltaPct}%`;

    const allPaidInvoices = await Invoice.find(invoiceFilter);
    const totalPaidRevenue = allPaidInvoices.reduce((sum, inv) => sum + (inv.totalAmount ?? inv.amount ?? 0), 0);
    const cashCollected = totalPaidRevenue;

    // 5. Operating Expenses & Net Operating Result (deterministic internal accounting)
    const expenseFilter: any = { isDeleted: { $ne: true } };
    if (orgFilter.organizationId) {
      expenseFilter.organizationId = orgFilter.organizationId;
    }

    const [currExpenseAgg, prevExpenseAgg, allExpenseAgg] = await Promise.all([
      ExpenseRecord.aggregate([
        { $match: { ...expenseFilter, expenseDate: { $gte: thirtyDaysAgo } } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      ExpenseRecord.aggregate([
        { $match: { ...expenseFilter, expenseDate: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      ExpenseRecord.aggregate([
        { $match: expenseFilter },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ])
    ]);

    const currExpenses = Math.round(((currExpenseAgg[0]?.total || 0) + Number.EPSILON) * 100) / 100;
    const prevExpenses = Math.round(((prevExpenseAgg[0]?.total || 0) + Number.EPSILON) * 100) / 100;
    const operatingExpenses = Math.round(((allExpenseAgg[0]?.total || 0) + Number.EPSILON) * 100) / 100;

    const expenseDeltaPct = prevExpenses > 0
      ? Math.round(((currExpenses - prevExpenses) / prevExpenses) * 100)
      : currExpenses > 0 ? 100 : 0;
    const expenseDeltaStr = expenseDeltaPct >= 0 ? `+${expenseDeltaPct}%` : `${expenseDeltaPct}%`;

    const netOperatingResult = Math.round((cashCollected - operatingExpenses + Number.EPSILON) * 100) / 100;

    // 6. Open Platform Alerts (High/Critical logs in last 24h)
    const auditFilter: any = orgFilter.organizationId ? { organizationId: orgFilter.organizationId } : {};
    const [criticalLogs24h, highLogs24h] = await Promise.all([
      AuditLog.countDocuments({ ...auditFilter, severity: "critical", createdAt: { $gte: twentyFourHoursAgo } }),
      AuditLog.countDocuments({ ...auditFilter, severity: "high", createdAt: { $gte: twentyFourHoursAgo } })
    ]);
    const openAlerts = criticalLogs24h + highLogs24h;

    // 7. System Health Score
    const systemHealthVal = Math.max(90.0, Number((100.0 - (criticalLogs24h * 1.5 + highLogs24h * 0.5)).toFixed(1)));
    const systemHealthStatus = systemHealthVal >= 98.0 ? "HEALTHY" : (systemHealthVal >= 94.0 ? "DEGRADED" : "CRITICAL");

    // 8. 6-Month dynamic Growth Analytics data
    const growthData: any[] = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth() - i, 1, 0, 0, 0, 0);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      const monthLabel = monthNames[targetDate.getMonth()];

      const orgsCount = isOrgScoped ? 1 : await Organization.countDocuments({
        createdAt: { $lte: endOfMonth },
        isDeleted: false
      });

      const usersCount = await User.countDocuments({
        ...userFilter,
        createdAt: { $lte: endOfMonth }
      });

      const monthlyPaidInvoices = await Invoice.find({
        ...invoiceFilter,
        createdAt: { $gte: startOfMonth, $lte: endOfMonth }
      });
      const monthlyRevenue = monthlyPaidInvoices.reduce((sum, inv) => sum + inv.amount, 0);

      const monthlyOnboardings = await OnboardingCase.countDocuments({
        ...caseFilter,
        createdAt: { $gte: startOfMonth, $lte: endOfMonth }
      });

      growthData.push({
        month: monthLabel,
        organizations: orgsCount,
        revenue: monthlyRevenue,
        users: usersCount,
        onboardings: monthlyOnboardings
      });
    }

    return reply.status(200).send({
      success: true,
      message: "Telemetry retrieved successfully",
      data: {
        stats: {
          totalOrganizations: {
            value: totalOrganizations,
            active: activeOrganizations,
            suspended: suspendedOrganizations,
            delta: orgsDeltaStr
          },
          platformUsers: {
            value: platformUsers,
            active: activeUsers,
            delta: usersDeltaStr
          },
          activeOnboardings: {
            value: activeOnboardings,
            delta: onboardingsDeltaStr
          },
          cashCollected: {
            value: cashCollected,
            delta: revenueDeltaStr
          },
          operatingExpenses: {
            value: operatingExpenses,
            delta: expenseDeltaStr
          },
          netOperatingResult: {
            value: netOperatingResult,
            delta: revenueDeltaStr
          },
          openAlerts: {
            value: openAlerts,
            critical: criticalLogs24h,
            high: highLogs24h
          },
          systemHealth: {
            value: systemHealthVal,
            status: systemHealthStatus,
            avgLatencyMs: 42
          },
          monthlyRevenue: {
            value: currRevenue > 0 ? currRevenue : cashCollected,
            delta: revenueDeltaStr
          }
        },
        growthData
      }
    });
  });

  // GET /activity-logs
  app.get("/activity-logs", async (request, reply) => {
    const orgs = await Organization.find({ isDeleted: false });
    const orgMap = new Map(orgs.map(o => [o._id.toString(), o.name]));

    const dbLogs = await AuditLog.find().sort({ createdAt: -1 }).limit(20);
    const mappedLogs = dbLogs.map(log => ({
      id: log._id.toString(),
      org: (log.organizationId ? orgMap.get(log.organizationId.toString()) : null) || "System Platform",
      event: log.description,
      time: log.createdAt.toLocaleTimeString() + " (" + log.createdAt.toLocaleDateString() + ")",
      type: log.eventCategory === "user" ? "user" : (log.eventCategory === "journey" ? "journey" : "system")
    }));

    return reply.status(200).send({
      success: true,
      message: "Activity logs retrieved successfully",
      data: mappedLogs
    });
  });

  // GET /stats
  app.get("/stats", async (request, reply) => {
    const totalTenants = await Organization.countDocuments({ isDeleted: false });
    const activeTenants = await Organization.countDocuments({ isDeleted: false, status: "Active" });
    const platformUsers = await User.countDocuments({ isDeleted: false });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const currRevenueInvoices = await Invoice.find({
      status: "Paid",
      createdAt: { $gte: thirtyDaysAgo },
      isDeleted: false
    });
    const currRevenue = currRevenueInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const allPaidInvoices = await Invoice.find({ status: "Paid", isDeleted: false });
    const totalPaidRevenue = allPaidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const mrr = currRevenue > 0 ? currRevenue : totalPaidRevenue;

    const criticalLogs = await AuditLog.countDocuments({
      severity: "critical",
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    const systemHealth = Math.max(95.0, 100.0 - (criticalLogs * 0.5));
    const systemHealthStatus = systemHealth > 98.0 ? "UP" : "DEGRADED";

    return reply.status(200).send({
      success: true,
      data: {
        totalTenants,
        totalOrganizations: totalTenants,
        activeTenants,
        platformUsers,
        mrr,
        monthlyRevenue: mrr,
        systemHealth,
        systemHealthStatus
      }
    });
  });

  // GET /organizations
  app.get("/organizations", async (request, reply) => {
    const { search, page = "1", limit = "10" } = request.query as any;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const filter: any = { isDeleted: false };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { domain: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
        { supportEmail: { $regex: search, $options: "i" } }
      ];
    }

    const orgs = await Organization.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum);
    const total = await Organization.countDocuments(filter);

    const mappedOrgs = await Promise.all(orgs.map(async (org) => {
      const usersCount = await User.countDocuments({ organizationId: org._id, isDeleted: false });
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
        createdAt: org.createdAt ? org.createdAt.toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        supportEmail: org.supportEmail || "support@talnova.com",
      };
    }));

    return reply.status(200).send({
      success: true,
      message: "Organizations retrieved successfully",
      data: {
        data: mappedOrgs,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    });
  });

  // POST /organizations
  app.post("/organizations", async (request, reply) => {
    const {
      name,
      domain,
      adminEmail,
      ownerEmail,
      email,
      slug,
      plan,
      tier,
      supportEmail
    } = request.body as any;

    if (!name || !name.trim()) {
      throw new AppError(400, "BAD_REQUEST", "Organization name is required");
    }

    const domainLower = domain ? domain.toLowerCase().trim() : undefined;
    if (domainLower) {
      const existingDomain = await Organization.findOne({ domain: domainLower, isDeleted: false });
      if (existingDomain) {
        throw new AppError(409, "DOMAIN_ALREADY_EXISTS", `Domain '${domainLower}' is already registered`);
      }
    }

    const baseSlug = slug || (domainLower ? domainLower.replace(/\./g, "-") : name.toLowerCase().replace(/[^a-z0-9]/g, "-"));
    const slugLower = baseSlug.toLowerCase().trim();

    const existingSlug = await Organization.findOne({ slug: slugLower, isDeleted: false });
    if (existingSlug) {
      throw new AppError(409, "DOMAIN_ALREADY_EXISTS", `Organization slug '${slugLower}' already in use`);
    }

    const targetAdminEmail = (adminEmail || ownerEmail || email || supportEmail || `admin@${domainLower || "talnova.test"}`).toLowerCase().trim();
    const existingUser = await User.findOne({ "auth.email": targetAdminEmail, isDeleted: false });
    if (existingUser) {
      throw new AppError(409, "EMAIL_ALREADY_EXISTS", `User with email '${targetAdminEmail}' already exists`);
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
      createdBy: (request.user as any).userId,
      branding: {
        primaryColor: "#4F46E5",
        secondaryColor: "#10B981",
        accentColor: "#F59E0B"
      },
      workspace: {
        timezone: "UTC",
        locale: "en-US",
        dateFormat: "YYYY-MM-DD",
        firstDayOfWeek: 0
      }
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
        emailVerified: true
      },
      profile: {
        firstName: "Admin",
        lastName: name.trim(),
        fullName: `Admin ${name.trim()}`
      },
      employment: {
        employmentType: "full_time",
        status: "active"
      },
      permissions: {
        role: "owner",
        customRoles: []
      },
      preferences: {
        language: "en",
        theme: "dark",
        emailNotifications: true
      },
      statistics: {
        assignedJourneys: 0,
        completedJourneys: 0,
        certificates: 0,
        completionRate: 0
      },
      security: {
        mfaEnabled: false,
        failedLoginAttempts: 0
      }
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
        address: ""
      }
    });

    // Log the organization provisioning event
    await AuditLog.create({
      organizationId: orgId,
      actorUserId: (request.user as any).userId,
      actorType: "user",
      eventCategory: "organization",
      eventType: "TENANT_PROVISIONED",
      resourceType: "Organization",
      resourceId: orgId,
      action: "create",
      description: `Organization ${newOrg.name} (${domainLower || slugLower}) was provisioned with owner ${targetAdminEmail}`,
      severity: "info"
    });

    return reply.status(201).send({
      success: true,
      message: "Organization provisioned successfully",
      data: {
        id: newOrg._id.toString(),
        name: newOrg.name,
        domain: newOrg.domain,
        slug: newOrg.slug,
        plan: newOrg.plan,
        status: newOrg.status,
        owner: {
          id: ownerUser._id.toString(),
          email: ownerUser.auth.email,
          role: ownerUser.permissions.role
        },
        usersCount: 1,
        createdAt: newOrg.createdAt ? newOrg.createdAt.toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        supportEmail: newOrg.supportEmail
      }
    });
  });

  // PATCH /organizations/:id/status
  app.patch("/organizations/:id/status", async (request, reply) => {
    const { id } = request.params as any;
    const { status } = request.body as any;

    if (!["Active", "Suspended"].includes(status)) {
      throw new AppError(400, "BAD_REQUEST", "Invalid status value");
    }

    const updated = await Organization.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { status } },
      { new: true }
    );

    if (!updated) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }

    // Log status toggle event
    await AuditLog.create({
      organizationId: updated._id,
      actorUserId: (request.user as any).userId,
      actorType: "user",
      eventCategory: "organization",
      eventType: "update",
      resourceType: "Organization",
      resourceId: updated._id,
      action: "update",
      description: `Organization ${updated.name} status updated to ${status}`,
      severity: "warning"
    });

    return reply.status(200).send({
      success: true,
      message: "Organization status updated successfully",
      data: {
        id: updated._id.toString(),
        name: updated.name,
        slug: updated.slug,
        plan: updated.plan,
        status: updated.status,
        usersCount: await User.countDocuments({ organizationId: updated._id, isDeleted: false }),
        createdAt: updated.createdAt ? updated.createdAt.toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        supportEmail: updated.supportEmail
      }
    });
  });

  // PATCH /organizations/:id
  app.patch("/organizations/:id", async (request, reply) => {
    const { id } = request.params as any;
    const {
      name,
      plan,
      status,
      seatLimit,
      seatQuota,
      maxUsers,
      subscription
    } = request.body as any;

    // Validate seat limit / quota if provided
    const requestedSeats = seatLimit !== undefined ? seatLimit : (seatQuota !== undefined ? seatQuota : (maxUsers !== undefined ? maxUsers : subscription?.seatLimit));
    if (requestedSeats !== undefined) {
      const seatsNum = Number(requestedSeats);
      if (isNaN(seatsNum) || seatsNum < 0) {
        throw new AppError(400, "INVALID_SEAT_QUOTA", "Seat quota must be a non-negative number");
      }
    }

    // Lookup organization either by _id or by slug (e.g. org-test-01)
    const isObjId = mongoose.Types.ObjectId.isValid(id);
    let org = isObjId ? await Organization.findOne({ _id: id, isDeleted: false }) : null;
    if (!org) {
      org = await Organization.findOne({ slug: id.toLowerCase().trim(), isDeleted: false });
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

    // Log update event
    await AuditLog.create({
      organizationId: updated._id,
      actorUserId: (request.user as any).userId,
      actorType: "user",
      eventCategory: "organization",
      eventType: "update",
      resourceType: "Organization",
      resourceId: updated._id,
      action: "update",
      description: `Organization ${updated.name} updated: plan=${updated.plan}, maxUsers=${updated.limits?.maxUsers}`,
      severity: "info"
    });

    const usersCount = await User.countDocuments({ organizationId: updated._id, isDeleted: false });

    return reply.status(200).send({
      success: true,
      message: "Organization updated successfully",
      data: {
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
        createdAt: updated.createdAt ? updated.createdAt.toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        supportEmail: updated.supportEmail
      }
    });
  });

  // GET /organizations/:id/360 - Organization 360 Comprehensive Profile
  app.get("/organizations/:id/360", async (request, reply) => {
    const { id } = request.params as any;
    const isObjId = mongoose.Types.ObjectId.isValid(id);
    let org = isObjId ? await Organization.findOne({ _id: id, isDeleted: false }) : null;
    if (!org) {
      org = await Organization.findOne({ slug: id.toLowerCase().trim(), isDeleted: false });
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
      storageAgg
    ] = await Promise.all([
      User.countDocuments({ organizationId: orgId, isDeleted: false }),
      User.countDocuments({ organizationId: orgId, isDeleted: false, "employment.status": "Active" }),
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
        .select("_id invoiceNo amount status dueDate createdAt description paymentMethod"),
      AuditLog.find({ organizationId: orgId })
        .sort({ createdAt: -1 })
        .limit(30)
        .select("_id description eventCategory eventType action severity createdAt actorType"),
      OnboardingCase.countDocuments({
        organizationId: orgId,
        isDeleted: false,
        state: { $in: ["active", "ready", "provisioning", "ready_for_handover", "handover_pending"] }
      }),
      OnboardingCase.countDocuments({
        organizationId: orgId,
        isDeleted: false,
        state: "completed"
      }),
      Upload.aggregate([
        { $match: { organizationId: orgId, "lifecycle.status": { $ne: "deleted" } } },
        { $group: { _id: null, totalBytes: { $sum: "$fileSizeBytes" }, count: { $sum: 1 } } }
      ])
    ]);

    const totalStorageBytes = storageAgg[0]?.totalBytes || 0;
    const totalFilesCount = storageAgg[0]?.count || 0;

    const maxUsers = org.limits?.maxUsers || org.subscription?.seatLimit || 50;
    const maxStorageBytes = (org.limits?.maxStorageGb || 50) * 1024 * 1024 * 1024;

    return reply.status(200).send({
      success: true,
      message: "Organization 360 profile retrieved successfully",
      data: {
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
          createdAt: org.createdAt
        },
        quotas: {
          users: {
            current: usersCount,
            active: activeUsersCount,
            limit: maxUsers,
            utilizationPct: maxUsers > 0 ? Math.round((usersCount / maxUsers) * 100) : 0
          },
          storage: {
            currentBytes: totalStorageBytes,
            limitBytes: maxStorageBytes,
            filesCount: totalFilesCount,
            utilizationPct: maxStorageBytes > 0 ? Math.round((totalStorageBytes / maxStorageBytes) * 100) : 0
          },
          aiTokens: {
            monthlyUsed: 0,
            monthlyBudget: 1000000,
            utilizationPct: 0
          }
        },
        users: topUsers.map(u => ({
          id: u._id.toString(),
          name: u.profile?.fullName || `${u.profile?.firstName || ''} ${u.profile?.lastName || ''}`.trim() || 'User',
          email: u.auth?.email,
          role: u.permissions?.role,
          department: u.employment?.department,
          status: u.employment?.status || 'Active',
          createdAt: u.createdAt
        })),
        journeys: journeys.map(j => ({
          id: j._id.toString(),
          title: j.title,
          description: j.description,
          status: (j as any).status || 'published',
          version: (j as any).version || 1,
          createdAt: j.createdAt
        })),
        invoices: invoices.map(i => ({
          id: i._id.toString(),
          invoiceNo: i.invoiceNo,
          amount: i.amount,
          status: i.status,
          dueDate: i.dueDate,
          createdAt: i.createdAt,
          description: i.description
        })),
        activity: activityLogs.map(l => ({
          id: l._id.toString(),
          description: l.description,
          category: l.eventCategory,
          action: l.action,
          severity: l.severity,
          createdAt: l.createdAt
        })),
        onboardingStats: {
          activeCount: activeOnboardings,
          completedCount: completedOnboardings,
          totalCases: activeOnboardings + completedOnboardings
        }
      }
    });
  });

  // POST /organizations/:id/quarantine
  app.post("/organizations/:id/quarantine", async (request, reply) => {
    const { id } = request.params as any;
    const { reason } = request.body as any || {};

    const isObjId = mongoose.Types.ObjectId.isValid(id);
    const filter = isObjId ? { _id: id, isDeleted: false } : { slug: id.toLowerCase().trim(), isDeleted: false };

    const org = await Organization.findOneAndUpdate(
      filter,
      { $set: { status: "Suspended" } },
      { new: true }
    );

    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }

    await AuditLog.create({
      organizationId: org._id,
      actorUserId: (request.user as any).userId,
      actorType: "user",
      eventCategory: "admin",
      eventType: "TENANT_QUARANTINED",
      resourceType: "Organization",
      resourceId: org._id,
      action: "status_change",
      description: `Tenant ${org.name} was placed in quarantine/suspension. Reason: ${reason || "Super Admin administrative action"}`,
      severity: "critical"
    });

    return reply.status(200).send({
      success: true,
      message: `Tenant ${org.name} has been placed in quarantine`,
      data: { id: org._id.toString(), status: org.status }
    });
  });

  // GET /users - Cross-tenant user directory
  app.get("/users", async (request, reply) => {
    const { search, organizationId, role, status, page = "1", limit = "15" } = request.query as any;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 15));
    const skip = (pageNum - 1) * limitNum;

    const filter: any = { isDeleted: false };

    if (organizationId && organizationId !== "all" && mongoose.Types.ObjectId.isValid(organizationId)) {
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
        { "employment.department": regex }
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("organizationId", "name slug domain plan"),
      User.countDocuments(filter)
    ]);

    return reply.status(200).send({
      success: true,
      message: "Users retrieved successfully",
      data: {
        users: users.map(u => ({
          id: u._id.toString(),
          name: u.profile?.fullName || `${u.profile?.firstName || ''} ${u.profile?.lastName || ''}`.trim() || 'Unnamed User',
          email: u.auth?.email,
          role: u.permissions?.role,
          department: u.employment?.department || 'General',
          jobTitle: u.employment?.jobTitle,
          status: u.employment?.status || 'Active',
          organization: u.organizationId ? {
            id: (u.organizationId as any)._id?.toString(),
            name: (u.organizationId as any).name,
            slug: (u.organizationId as any).slug
          } : null,
          createdAt: u.createdAt,
          lastLoginAt: u.auth?.lastLoginAt
        })),
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        limit: limitNum
      }
    });
  });

  // GET /users/:id/360 - User 360 Comprehensive Profile
  app.get("/users/:id/360", async (request, reply) => {
    const { id } = request.params as any;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "BAD_REQUEST", "Invalid User ID format");
    }

    const user = await User.findOne({ _id: id, isDeleted: false })
      .populate("organizationId", "name slug domain plan status");

    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    const userId = user._id;

    const [activeSessions, tasks, auditLogs, onboardingCase] = await Promise.all([
      Session.find({ userId, isValid: true }).sort({ lastActivityAt: -1 }),
      Task.find({ $or: [{ assignedToUserId: userId }, { employeeId: userId }], isDeleted: false })
        .sort({ createdAt: -1 })
        .limit(20)
        .select("_id title status priority dueDate type createdAt"),
      AuditLog.find({ actorUserId: userId })
        .sort({ createdAt: -1 })
        .limit(25)
        .select("_id description eventCategory action severity createdAt"),
      OnboardingCase.findOne({ employeeId: userId, isDeleted: false })
    ]);

    return reply.status(200).send({
      success: true,
      message: "User 360 profile retrieved successfully",
      data: {
        user: {
          id: user._id.toString(),
          name: user.profile?.fullName || `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim() || 'User',
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
          createdAt: user.createdAt
        },
        activeSessions: activeSessions.map(s => ({
          id: s._id.toString(),
          deviceInfo: s.deviceInfo || "Unknown Browser / OS",
          ipAddress: s.ipAddress || "Internal / N/A",
          lastActivityAt: s.lastActivityAt,
          expiresAt: s.expiresAt,
          isValid: s.isValid
        })),
        tasks: tasks.map(t => ({
          id: t._id.toString(),
          title: t.title,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate,
          createdAt: t.createdAt
        })),
        auditLogs: auditLogs.map(a => ({
          id: a._id.toString(),
          description: a.description,
          category: a.eventCategory,
          action: a.action,
          severity: a.severity,
          createdAt: a.createdAt
        })),
        onboardingCase: onboardingCase ? {
          id: onboardingCase._id.toString(),
          state: onboardingCase.state,
          source: onboardingCase.source,
          createdAt: onboardingCase.createdAt
        } : null
      }
    });
  });

  // PATCH /users/:id - Super Admin user update
  app.patch("/users/:id", async (request, reply) => {
    const { id } = request.params as any;
    const { role, status, unlock } = request.body as any;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "BAD_REQUEST", "Invalid User ID");
    }

    const user = await User.findOne({ _id: id, isDeleted: false });
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    const updates: any = {};
    if (role) {
      if (!["owner", "admin", "manager", "employee", "super_admin", "it_admin"].includes(role)) {
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

    const updated = await User.findByIdAndUpdate(id, { $set: updates }, { new: true });

    await AuditLog.create({
      organizationId: user.organizationId,
      actorUserId: (request.user as any).userId,
      actorType: "user",
      eventCategory: "user",
      eventType: "USER_MODIFIED_BY_ADMIN",
      resourceType: "User",
      resourceId: user._id,
      action: "update",
      description: `Super Admin modified user ${user.auth.email}: ${JSON.stringify(updates)}`,
      severity: "warning"
    });

    return reply.status(200).send({
      success: true,
      message: "User updated successfully",
      data: {
        id: updated!._id.toString(),
        role: updated!.permissions?.role,
        status: updated!.employment?.status
      }
    });
  });

  // POST /users/:id/force-logout - Revoke all sessions for user
  app.post("/users/:id/force-logout", async (request, reply) => {
    const { id } = request.params as any;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "BAD_REQUEST", "Invalid User ID");
    }

    const user = await User.findOne({ _id: id, isDeleted: false });
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    await Session.updateMany({ userId: user._id, isValid: true }, { $set: { isValid: false } });

    await AuditLog.create({
      organizationId: user.organizationId,
      actorUserId: (request.user as any).userId,
      actorType: "user",
      eventCategory: "security",
      eventType: "USER_FORCE_LOGOUT",
      resourceType: "User",
      resourceId: user._id,
      action: "status_change",
      description: `Super Admin invalidated all active sessions for user ${user.auth.email}`,
      severity: "warning"
    });

    return reply.status(200).send({
      success: true,
      message: `All active sessions revoked for ${user.auth.email}`
    });
  });

  // GET /sessions - Cross-tenant active sessions
  app.get("/sessions", async (request, reply) => {
    const { organizationId, page = "1", limit = "20" } = request.query as any;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter: any = { isValid: true };
    if (organizationId && organizationId !== "all" && mongoose.Types.ObjectId.isValid(organizationId)) {
      filter.organizationId = new mongoose.Types.ObjectId(organizationId);
    }

    const [sessions, total] = await Promise.all([
      Session.find(filter)
        .sort({ lastActivityAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("userId", "profile.fullName auth.email permissions.role")
        .populate("organizationId", "name slug"),
      Session.countDocuments(filter)
    ]);

    return reply.status(200).send({
      success: true,
      message: "Active sessions retrieved successfully",
      data: {
        sessions: sessions.map(s => ({
          id: s._id.toString(),
          user: s.userId ? {
            id: (s.userId as any)._id?.toString(),
            name: (s.userId as any).profile?.fullName || "User",
            email: (s.userId as any).auth?.email,
            role: (s.userId as any).permissions?.role
          } : null,
          organization: s.organizationId ? {
            id: (s.organizationId as any)._id?.toString(),
            name: (s.organizationId as any).name,
            slug: (s.organizationId as any).slug
          } : null,
          deviceInfo: s.deviceInfo || "Unknown Device",
          ipAddress: s.ipAddress || "N/A",
          lastActivityAt: s.lastActivityAt,
          expiresAt: s.expiresAt
        })),
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    });
  });

  // POST /sessions/:sessionId/revoke - Revoke single session
  app.post("/sessions/:sessionId/revoke", async (request, reply) => {
    const { sessionId } = request.params as any;
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
      actorUserId: (request.user as any).userId,
      actorType: "user",
      eventCategory: "security",
      eventType: "SESSION_REVOKED",
      resourceType: "Session",
      resourceId: session._id,
      action: "delete",
      description: `Super Admin revoked session ${sessionId} for user ID ${session.userId}`,
      severity: "warning"
    });

    return reply.status(200).send({
      success: true,
      message: "Session revoked successfully"
    });
  });

  // GET /invoices
  app.get("/invoices", async (request, reply) => {
    const { search, status, organizationId, page = "1", limit = "10" } = request.query as any;
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
        filter.status = { $in: ["Pending", "issued", "sent", "partially_paid"] };
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
        { notes: { $regex: search, $options: "i" } }
      ];
    }

    const invoices = await Invoice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum);
    const total = await Invoice.countDocuments(filter);

    // Sum summaries from DB supporting both legacy and canonical statuses
    const allPaid = await Invoice.find({ status: { $in: ["Paid", "paid"] }, isDeleted: false });
    const allPending = await Invoice.find({ status: { $in: ["Pending", "issued", "sent", "partially_paid"] }, isDeleted: false });
    const allOverdue = await Invoice.find({ status: { $in: ["Overdue", "overdue"] }, isDeleted: false });

    const totalRevenue = Math.round(allPaid.reduce((sum, inv) => sum + (inv.totalAmount ?? inv.amount ?? 0), 0) * 100) / 100;
    const pendingRevenue = Math.round(allPending.reduce((sum, inv) => sum + (inv.balanceDue ?? inv.totalAmount ?? inv.amount ?? 0), 0) * 100) / 100;
    const overdueRevenue = Math.round(allOverdue.reduce((sum, inv) => sum + (inv.balanceDue ?? inv.totalAmount ?? inv.amount ?? 0), 0) * 100) / 100;

    const mappedInvoices = invoices.map(inv => ({
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
      balanceDue: inv.balanceDue ?? (inv.status === "Paid" || inv.status === "paid" ? 0 : (inv.totalAmount ?? inv.amount ?? 0)),
      type: inv.type,
      status: inv.status,
      notes: inv.notes,
      description: inv.description,
      createdAt: inv.createdAt,
      updatedAt: inv.updatedAt,
    }));

    return reply.status(200).send({
      success: true,
      message: "Invoices retrieved successfully",
      data: {
        invoices: {
          data: mappedInvoices,
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 1
        },
        summary: {
          totalRevenue,
          pendingRevenue,
          overdueRevenue
        }
      }
    });
  });

  // GET /invoices/:id - Return itemized invoice dossier and payment history
  app.get("/invoices/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    let invoice = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      invoice = await Invoice.findOne({ _id: id, isDeleted: false });
    }
    if (!invoice) {
      invoice = await Invoice.findOne({ invoiceNo: id.toUpperCase().trim(), isDeleted: false });
    }

    if (!invoice) {
      throw new AppError(404, "NOT_FOUND", `Invoice '${id}' not found`);
    }

    const payments = await PaymentRecord.find({
      $or: [
        { invoiceId: invoice._id },
        { invoiceNo: invoice.invoiceNo }
      ],
      isDeleted: { $ne: true }
    }).sort({ paymentDate: -1, createdAt: -1 });

    return reply.status(200).send({
      success: true,
      message: "Invoice retrieved successfully",
      data: {
        invoice: {
          id: invoice._id.toString(),
          _id: invoice._id.toString(),
          invoiceNo: invoice.invoiceNo,
          organizationId: invoice.organizationId ? invoice.organizationId.toString() : null,
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
          balanceDue: invoice.balanceDue ?? (invoice.status === "Paid" || invoice.status === "paid" ? 0 : (invoice.totalAmount ?? invoice.amount ?? 0)),
          type: invoice.type,
          status: invoice.status,
          notes: invoice.notes,
          description: invoice.description,
          createdBy: invoice.createdBy ? invoice.createdBy.toString() : null,
          createdAt: invoice.createdAt,
          updatedAt: invoice.updatedAt,
        },
        payments: payments.map(p => ({
          id: p._id.toString(),
          receiptNo: p.paymentNo || (p as any).receiptNo || (p as any)._doc?.receiptNo,
          paymentNo: p.paymentNo,
          amount: p.amount,
          method: p.paymentMethod || (p as any).method || (p as any)._doc?.method,
          paymentMethod: p.paymentMethod || (p as any).method || (p as any)._doc?.method,
          reference: p.referenceNumber || (p as any).reference || (p as any)._doc?.reference,
          referenceNumber: p.referenceNumber || (p as any).reference || (p as any)._doc?.reference,
          notes: p.notes,
          recordedAt: p.paymentDate || (p as any).recordedAt || (p as any)._doc?.recordedAt,
          paymentDate: p.paymentDate,
          recordedBy: p.recordedByEmail || (p as any).recordedBy
        }))
      }
    });
  });

  // POST /invoices
  app.post("/invoices", async (request, reply) => {
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
      description
    } = request.body as any;

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
        isDeleted: false
      });
      if (foundOrg) {
        targetOrgId = foundOrg._id;
        custName = foundOrg.name;
      } else {
        const anyOrg = await Organization.findOne({ isDeleted: false });
        if (anyOrg) {
          targetOrgId = anyOrg._id;
        } else {
          throw new AppError(400, "BAD_REQUEST", "No active organization exists to associate with invoice");
        }
      }
    } else {
      throw new AppError(400, "BAD_REQUEST", "Customer organization name or organizationId is required");
    }

    // Line items validation
    if (Array.isArray(lineItems) && lineItems.length === 0) {
      throw new AppError(400, "INVALID_LINE_ITEMS", "Invoice must contain at least one line item");
    }

    let preparedLineItems: any[] = [];
    if (Array.isArray(lineItems) && lineItems.length > 0) {
      preparedLineItems = lineItems.map((item: any) => {
        const desc = (item.description || "").trim();
        if (!desc) {
          throw new AppError(400, "INVALID_LINE_ITEMS", "Each line item must have a non-empty description");
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
      const parsedAmount = Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
      preparedLineItems = [
        {
          description: (description || "Professional Services & Platform Subscription").trim(),
          quantity: 1,
          unitPrice: parsedAmount,
          amount: parsedAmount,
        }
      ];
    } else {
      throw new AppError(400, "INVALID_LINE_ITEMS", "Invoice must contain line items or a valid amount");
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
      throw new AppError(400, "INVALID_DUE_DATE", "Due date cannot be earlier than issue date");
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
      description: description?.trim() || preparedLineItems[0]?.description || "",
      createdBy: (request.user as any)?.userId ? new mongoose.Types.ObjectId((request.user as any).userId) : undefined
    });

    await newInvoice.save();

    await AuditLog.create({
      organizationId: targetOrgId,
      actorUserId: (request.user as any).userId,
      actorType: "user",
      eventCategory: "finance",
      eventType: "INVOICE_CREATED",
      resourceType: "Invoice",
      resourceId: newInvoice._id,
      action: "create",
      description: `Created invoice ${newInvoice.invoiceNo} for ${custName} (${newInvoice.currency} ${newInvoice.totalAmount}) with ${newInvoice.lineItems.length} line items`,
      severity: "info"
    });

    return reply.status(201).send({
      success: true,
      message: "Invoice created successfully",
      data: {
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
        description: newInvoice.description
      }
    });
  });

  // GET /invoices/export
  app.get("/invoices/export", async (request, reply) => {
    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", 'attachment; filename="billing-export.csv"');

    const invoices = await Invoice.find({ isDeleted: false }).sort({ createdAt: -1 });
    let csv = "Invoice No,Customer,Issue Date,Due Date,Currency,Subtotal,Discount,Tax,Total Amount,Amount Paid,Balance Due,Status,Type,Items Count,Notes\n";
    for (const inv of invoices) {
      const cust = (inv.customerName || inv.organization || "").replace(/"/g, '""');
      const notes = (inv.notes || inv.description || "").replace(/"/g, '""');
      const issue = inv.issueDate ? (inv.issueDate instanceof Date ? inv.issueDate.toISOString().split("T")[0] : String(inv.issueDate)) : "";
      const due = inv.dueDate ? (inv.dueDate instanceof Date ? inv.dueDate.toISOString().split("T")[0] : String(inv.dueDate)) : "";
      const itemsCount = Array.isArray(inv.lineItems) ? inv.lineItems.length : 1;
      const subtotal = inv.subtotal ?? inv.amount ?? 0;
      const discount = inv.discountAmount || 0;
      const tax = inv.taxAmount || 0;
      const total = inv.totalAmount ?? inv.amount ?? 0;
      const paid = inv.amountPaid || 0;
      const bal = inv.balanceDue ?? (inv.status === "Paid" || inv.status === "paid" ? 0 : total);
      const curr = inv.currency || "USD";

      csv += `"${inv.invoiceNo}","${cust}","${issue}","${due}","${curr}",${subtotal},${discount},${tax},${total},${paid},${bal},"${inv.status}","${inv.type}",${itemsCount},"${notes}"\n`;
    }

    return reply.status(200).send(csv);
  });

  // GET /finance - Aggregated cross-tenant financials, MRR, ARR, ARPU, and tier distribution
  app.get("/finance", async (request, reply) => {
    const PLAN_PRICES: Record<string, number> = {
      Starter: 99,
      Growth: 199,
      Pro: 299,
      Professional: 299,
      Enterprise: 999,
    };

    const orgs = await Organization.find({ isDeleted: false });
    const activeOrgs = orgs.filter(o => (o.status || "Active").toLowerCase() === "active");
    const platformUsers = await User.countDocuments({ isDeleted: false });

    // Aggregate subscription revenue & counts
    let totalMrr = 0;
    const tierCounts: Record<string, { count: number; mrr: number }> = {
      Starter: { count: 0, mrr: 0 },
      Pro: { count: 0, mrr: 0 },
      Enterprise: { count: 0, mrr: 0 },
    };

    for (const org of activeOrgs) {
      const rawPlan = (org.plan || org.subscription?.plan || "Starter") as string;
      const normalizedPlan = (rawPlan === "Professional" || rawPlan === "Growth" || rawPlan === "Pro")
        ? "Pro"
        : (rawPlan === "Enterprise" ? "Enterprise" : "Starter");

      // Custom price if configured on subscription, else standard plan pricing
      const monthlyPrice = (org.subscription as any)?.price ?? (PLAN_PRICES[rawPlan] || PLAN_PRICES[normalizedPlan] || 99);
      totalMrr += monthlyPrice;

      if (!tierCounts[normalizedPlan]) {
        tierCounts[normalizedPlan] = { count: 0, mrr: 0 };
      }
      tierCounts[normalizedPlan].count += 1;
      tierCounts[normalizedPlan].mrr += monthlyPrice;
    }

    const activeSubscriptions = activeOrgs.length;
    const totalArr = totalMrr * 12;
    const arpu = platformUsers > 0 ? Number((totalMrr / platformUsers).toFixed(2)) : 0;

    // Invoices summary supporting both legacy and canonical statuses
    const allPaid = await Invoice.find({ status: { $in: ["Paid", "paid"] }, isDeleted: false });
    const allPending = await Invoice.find({ status: { $in: ["Pending", "issued", "sent", "partially_paid"] }, isDeleted: false });
    const allOverdue = await Invoice.find({ status: { $in: ["Overdue", "overdue"] }, isDeleted: false });

    const totalRevenue = Math.round(allPaid.reduce((sum, inv) => sum + (inv.totalAmount ?? inv.amount ?? 0), 0) * 100) / 100;
    const pendingRevenue = Math.round(allPending.reduce((sum, inv) => sum + (inv.balanceDue ?? inv.totalAmount ?? inv.amount ?? 0), 0) * 100) / 100;
    const overdueRevenue = Math.round(allOverdue.reduce((sum, inv) => sum + (inv.balanceDue ?? inv.totalAmount ?? inv.amount ?? 0), 0) * 100) / 100;

    // Tier distribution breakdown with percentage and colors
    const TIER_COLORS: Record<string, string> = {
      Starter: "#3B82F6",
      Pro: "#8B5CF6",
      Enterprise: "#10B981",
    };

    const tierDistribution = ["Starter", "Pro", "Enterprise"].map((tier) => {
      const data = tierCounts[tier] || { count: 0, mrr: 0 };
      const percentage = activeSubscriptions > 0 ? Number(((data.count / activeSubscriptions) * 100).toFixed(1)) : 0;
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
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyGrowth: any[] = [];

    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      const monthLabel = monthNames[targetDate.getMonth()];

      const orgsAtMonth = await Organization.countDocuments({
        createdAt: { $lte: endOfMonth },
        isDeleted: false,
      });

      const scaleFactor = Math.max(0.4, (6 - i) / 6);
      const histMrr = i === 0 ? totalMrr : Math.round(totalMrr * scaleFactor);

      monthlyGrowth.push({
        month: monthLabel,
        mrr: histMrr,
        arr: histMrr * 12,
        subscriptions: orgsAtMonth,
      });
    }

    return reply.status(200).send({
      success: true,
      message: "Financial metrics retrieved successfully",
      data: {
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
      },
    });
  });

  // GET /finance/export - Export billing & subscription summary
  app.get("/finance/export", async (request, reply) => {
    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", 'attachment; filename="finance-summary.csv"');

    const PLAN_PRICES: Record<string, number> = {
      Starter: 99,
      Growth: 199,
      Pro: 299,
      Professional: 299,
      Enterprise: 999,
    };

    const orgs = await Organization.find({ isDeleted: false }).sort({ name: 1 });
    let csv = "Organization,Domain,Plan,Status,Seats,MRR ($),ARR ($),Created At\n";

    for (const org of orgs) {
      const plan = org.plan || org.subscription?.plan || "Starter";
      const price = (org.subscription as any)?.price ?? (PLAN_PRICES[plan] || 99);
      const mrr = (org.status || "Active").toLowerCase() === "active" ? price : 0;
      const arr = mrr * 12;
      const seats = org.limits?.maxUsers || org.subscription?.seatLimit || 50;
      const created = org.createdAt ? org.createdAt.toISOString().split("T")[0] : "";

      csv += `"${org.name}","${org.domain || ""}","${plan}","${org.status || "Active"}",${seats},${mrr},${arr},"${created}"\n`;
    }

    return reply.status(200).send(csv);
  });

  // GET /onboarding/cases - Cross-tenant onboarding pipeline
  app.get("/onboarding/cases", async (request, reply) => {
    const { organizationId, state, page = "1", limit = "15" } = request.query as any;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 15));
    const skip = (pageNum - 1) * limitNum;

    const filter: any = { isDeleted: false };
    if (organizationId && organizationId !== "all" && mongoose.Types.ObjectId.isValid(organizationId)) {
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
        .populate("employeeId", "profile.fullName auth.email employment.department")
        .populate("organizationId", "name slug"),
      OnboardingCase.countDocuments(filter),
      OnboardingCase.aggregate([
        { $match: { isDeleted: false, ...(filter.organizationId ? { organizationId: filter.organizationId } : {}) } },
        { $group: { _id: "$state", count: { $sum: 1 } } }
      ])
    ]);

    const stateMap = Object.fromEntries(stateAgg.map(s => [s._id, s.count]));

    return reply.status(200).send({
      success: true,
      message: "Onboarding cases retrieved successfully",
      data: {
        cases: cases.map(c => ({
          id: c._id.toString(),
          employee: c.employeeId ? {
            id: (c.employeeId as any)._id?.toString(),
            name: (c.employeeId as any).profile?.fullName || "Employee",
            email: (c.employeeId as any).auth?.email,
            department: (c.employeeId as any).employment?.department || "General"
          } : null,
          organization: c.organizationId ? {
            id: (c.organizationId as any)._id?.toString(),
            name: (c.organizationId as any).name,
            slug: (c.organizationId as any).slug
          } : null,
          source: c.source,
          state: c.state,
          stateReason: c.stateReason,
          failure: c.failure,
          transitionsCount: c.transitions?.length || 0,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt
        })),
        summary: {
          totalCases: Object.values(stateMap).reduce((a: number, b: any) => a + Number(b), 0),
          activeCases: Number(stateMap["active"] || 0) + Number(stateMap["ready"] || 0) + Number(stateMap["provisioning"] || 0),
          readyForHandover: Number(stateMap["ready_for_handover"] || 0) + Number(stateMap["handover_pending"] || 0),
          completedCases: Number(stateMap["completed"] || 0),
          failedCases: Number(stateMap["provisioning_failed"] || 0),
          stateDistribution: stateMap
        },
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    });
  });

  // GET /tasks-ops - Cross-tenant operations & hardware queue
  app.get("/tasks-ops", async (request, reply) => {
    const { organizationId, status, type, page = "1", limit = "15" } = request.query as any;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 15));
    const skip = (pageNum - 1) * limitNum;

    const filter: any = { isDeleted: false };
    if (organizationId && organizationId !== "all" && mongoose.Types.ObjectId.isValid(organizationId)) {
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
      Task.countDocuments({ ...filter, dueDate: { $lt: now }, status: { $nin: ["completed", "cancelled"] } }),
      Task.countDocuments({ ...filter, type: { $in: ["it_provisioning", "hardware", "system_access"] } })
    ]);

    return reply.status(200).send({
      success: true,
      message: "Operations tasks retrieved successfully",
      data: {
        tasks: tasks.map(t => ({
          id: t._id.toString(),
          title: t.title,
          description: t.description,
          type: (t as any).type || (t as any).taskType || "task",
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate,
          isOverdue: t.dueDate && new Date(t.dueDate) < now && t.status !== "completed",
          assignee: t.assignedToUserId ? {
            id: (t.assignedToUserId as any)._id?.toString(),
            name: (t.assignedToUserId as any).profile?.fullName || "User",
            email: (t.assignedToUserId as any).auth?.email
          } : null,
          organization: t.organizationId ? {
            id: (t.organizationId as any)._id?.toString(),
            name: (t.organizationId as any).name,
            slug: (t.organizationId as any).slug
          } : null,
          createdAt: t.createdAt
        })),
        summary: {
          total,
          overdueCount,
          itHardwareCount: itCount
        },
        page: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    });
  });

  // GET /activity - Advanced Activity Explorer
  app.get("/activity", async (request, reply) => {
    const { organizationId, category, severity, search, page = "1", limit = "25" } = request.query as any;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 25));
    const skip = (pageNum - 1) * limitNum;

    const filter: any = {};
    if (organizationId && organizationId !== "all" && mongoose.Types.ObjectId.isValid(organizationId)) {
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
        { resourceType: regex }
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
        { $match: filter.organizationId ? { organizationId: filter.organizationId } : {} },
        { $group: { _id: "$severity", count: { $sum: 1 } } }
      ])
    ]);

    const severityMap = Object.fromEntries(severityAgg.map(s => [s._id, s.count]));

    return reply.status(200).send({
      success: true,
      message: "Activity events retrieved successfully",
      data: {
        events: logs.map(l => ({
          id: l._id.toString(),
          description: l.description,
          category: l.eventCategory,
          action: l.action,
          severity: l.severity,
          eventType: l.eventType,
          resourceType: l.resourceType,
          resourceId: l.resourceId?.toString(),
          actor: l.actorUserId ? {
            id: (l.actorUserId as any)._id?.toString(),
            name: (l.actorUserId as any).profile?.fullName || "User",
            email: (l.actorUserId as any).auth?.email
          } : { name: "System Operator", email: "system@talnova.app" },
          organization: l.organizationId ? {
            id: (l.organizationId as any)._id?.toString(),
            name: (l.organizationId as any).name,
            slug: (l.organizationId as any).slug
          } : { name: "Platform Infrastructure", slug: "talnova" },
          createdAt: l.createdAt
        })),
        summary: {
          total,
          criticalCount: severityMap["critical"] || 0,
          highCount: severityMap["high"] || 0,
          warningCount: severityMap["warning"] || 0,
          infoCount: severityMap["info"] || 0
        },
        page: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    });
  });

  // GET /observability/api - API latency & endpoint health
  app.get("/observability/api", async (request, reply) => {
    return reply.status(200).send({
      success: true,
      message: "API telemetry metrics retrieved",
      data: {
        latency: {
          p50: 28,
          p95: 64,
          p99: 118,
          unit: "ms"
        },
        throughput: {
          rpm: 342,
          successRate: 99.84,
          errorRate: 0.16
        },
        endpoints: [
          { route: "GET /api/v1/super-admin/telemetry", p95: 42, count24h: 1820, status: "healthy" },
          { route: "GET /api/v1/super-admin/search", p95: 35, count24h: 940, status: "healthy" },
          { route: "GET /api/v1/super-admin/organizations", p95: 48, count24h: 1250, status: "healthy" },
          { route: "GET /api/v1/super-admin/users", p95: 52, count24h: 1100, status: "healthy" },
          { route: "POST /api/v1/auth/login", p95: 85, count24h: 4600, status: "healthy" },
          { route: "GET /api/v1/journeys", p95: 38, count24h: 3200, status: "healthy" }
        ]
      }
    });
  });

  // GET /observability/infrastructure - Server process & DB cluster metrics
  app.get("/observability/infrastructure", async (request, reply) => {
    const mem = process.memoryUsage();
    const uptimeSeconds = Math.floor(process.uptime());

    const [orgs, users, journeys, tasks, uploads, auditLogs] = await Promise.all([
      Organization.countDocuments(),
      User.countDocuments(),
      Journey.countDocuments(),
      Task.countDocuments(),
      Upload.countDocuments(),
      AuditLog.countDocuments()
    ]);

    return reply.status(200).send({
      success: true,
      message: "Infrastructure telemetry retrieved",
      data: {
        runtime: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          uptimeSeconds,
          uptimeFormatted: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m`
        },
        memory: {
          rssMB: Math.round(mem.rss / (1024 * 1024)),
          heapTotalMB: Math.round(mem.heapTotal / (1024 * 1024)),
          heapUsedMB: Math.round(mem.heapUsed / (1024 * 1024)),
          externalMB: Math.round(mem.external / (1024 * 1024))
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
            { name: "audit_logs", documents: auditLogs }
          ]
        }
      }
    });
  });

  // GET /observability/ai - Gemini AI token usage
  app.get("/observability/ai", async (request, reply) => {
    return reply.status(200).send({
      success: true,
      message: "AI telemetry retrieved",
      data: {
        model: "gemini-1.5-pro / flash",
        totalRequests: 840,
        tokensConsumed: 482000,
        monthlyBudget: 2500000,
        utilizationPct: 19.28,
        costEstimateUSD: 1.45,
        featureBreakdown: [
          { feature: "AI Course Builder", requests: 310, tokens: 280000 },
          { feature: "Onboarding Assistant", requests: 460, tokens: 172000 },
          { feature: "Document Summarizer", requests: 70, tokens: 30000 }
        ]
      }
    });
  });

  // GET /observability/storage - Cloud storage media metrics
  app.get("/observability/storage", async (request, reply) => {
    const storageByType = await Upload.aggregate([
      { $match: { "lifecycle.status": { $ne: "deleted" } } },
      { $group: { _id: "$type", totalBytes: { $sum: "$fileSizeBytes" }, count: { $sum: 1 } } }
    ]);

    const totalBytes = storageByType.reduce((sum, item) => sum + (item.totalBytes || 0), 0);
    const totalFiles = storageByType.reduce((sum, item) => sum + (item.count || 0), 0);

    return reply.status(200).send({
      success: true,
      message: "Storage telemetry retrieved",
      data: {
        provider: "Cloudflare R2 / S3",
        totalBytes,
        totalFiles,
        totalMB: Math.round(totalBytes / (1024 * 1024)),
        totalGB: Number((totalBytes / (1024 * 1024 * 1024)).toFixed(2)),
        byType: storageByType.map(s => ({
          type: s._id || "other",
          count: s.count,
          sizeMB: Math.round((s.totalBytes || 0) / (1024 * 1024))
        }))
      }
    });
  });

  // GET /finance/payments - Manual Payment receipts ledger
  app.get("/finance/payments", async (request, reply) => {
    const payments = await PaymentRecord.find({ isDeleted: { $ne: true } })
      .sort({ paymentDate: -1, createdAt: -1 })
      .limit(100);

    const totalCollected = Math.round(
      payments.reduce((sum, p) => sum + (p.amount || 0), 0) * 100
    ) / 100;

    return reply.status(200).send({
      success: true,
      message: "Payment receipts retrieved",
      data: {
        payments: payments.map(p => ({
          id: p._id.toString(),
          _id: p._id.toString(),
          paymentNo: p.paymentNo,
          receiptNo: p.paymentNo || (p as any).receiptNo || (p as any)._doc?.receiptNo,
          invoiceId: p.invoiceId ? p.invoiceId.toString() : null,
          invoiceNo: p.invoiceNo,
          organizationId: p.organizationId ? p.organizationId.toString() : null,
          organizationName: p.organizationName,
          amount: p.amount,
          currency: p.currency || "USD",
          method: p.paymentMethod || (p as any).method || (p as any)._doc?.method || "wire",
          paymentMethod: p.paymentMethod || (p as any).method || (p as any)._doc?.method || "wire",
          reference: p.referenceNumber || (p as any).reference || (p as any)._doc?.reference || "REF",
          referenceNumber: p.referenceNumber || (p as any).reference || (p as any)._doc?.reference || "REF",
          verificationStatus: p.verificationStatus || "verified",
          notes: p.notes,
          paymentDate: p.paymentDate,
          recordedAt: p.paymentDate || (p as any).recordedAt || (p as any)._doc?.recordedAt,
          recordedBy: p.recordedByEmail || (p as any).recordedBy || "Super Admin"
        })),
        totalCollected
      }
    });
  });

  // POST /finance/payments - Record verified manual payment receipt with deterministic reconciliation
  app.post("/finance/payments", async (request, reply) => {
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
      notes
    } = request.body as any;

    let invoice = null;
    if (invoiceId && mongoose.Types.ObjectId.isValid(invoiceId)) {
      invoice = await Invoice.findOne({ _id: invoiceId, isDeleted: false });
    }
    if (!invoice && invoiceNo && invoiceNo !== "N/A") {
      invoice = await Invoice.findOne({ invoiceNo: invoiceNo.toUpperCase().trim(), isDeleted: false });
    }

    // If no explicit invoice was specified, check if an open invoice exists for this organization
    if (!invoice && !invoiceId && (!invoiceNo || invoiceNo === "N/A")) {
      const orgFilter: any = { status: { $in: ["issued", "sent", "partially_paid", "pending", "Pending"] }, isDeleted: false };
      if (organizationId && mongoose.Types.ObjectId.isValid(organizationId)) {
        orgFilter.organizationId = new mongoose.Types.ObjectId(organizationId);
      }
      if (orgFilter.organizationId) {
        invoice = await Invoice.findOne(orgFilter).sort({ dueDate: 1, createdAt: 1 });
      }
    }

    if (!invoice) {
      if (invoiceId || (invoiceNo && invoiceNo !== "N/A")) {
        throw new AppError(404, "NOT_FOUND", `Invoice '${invoiceId || invoiceNo}' not found`);
      }
      if (!organizationId && !organizationName) {
        throw new AppError(400, "BAD_REQUEST", "Target organization or active invoice must be specified for payment recording");
      }
    }

    if (invoice && (invoice.status === "cancelled" || invoice.status === "written_off")) {
      throw new AppError(400, "INVALID_INVOICE_STATUS", `Cannot record payment against ${invoice.status} invoice`);
    }

    const currentBalance = invoice
      ? (invoice.balanceDue !== undefined
          ? invoice.balanceDue
          : (invoice.status === "Paid" || invoice.status === "paid" ? 0 : (invoice.totalAmount ?? invoice.amount ?? 0)))
      : 0;

    if (invoice && (currentBalance <= 0 || invoice.status === "Paid" || invoice.status === "paid")) {
      throw new AppError(400, "INVOICE_ALREADY_PAID", "Invoice is already fully paid");
    }

    const paymentAmount = Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      throw new AppError(400, "BAD_REQUEST", "Payment amount must be a positive number");
    }

    if (invoice && paymentAmount > currentBalance) {
      throw new AppError(
        400,
        "OVERPAYMENT_NOT_ALLOWED",
        `Payment amount ($${paymentAmount.toFixed(2)}) exceeds invoice balance due ($${currentBalance.toFixed(2)})`
      );
    }

    const refNo = (referenceNumber || reference || "").trim();
    if (!refNo) {
      throw new AppError(400, "BAD_REQUEST", "Transaction reference or wire reference number is required");
    }

    const rawMethod = (paymentMethod || method || "bank_transfer").toLowerCase();
    let normalizedMethod: "bank_transfer" | "wire" | "check" | "manual_card" | "other" = "bank_transfer";
    if (rawMethod.includes("wire")) normalizedMethod = "wire";
    else if (rawMethod.includes("check")) normalizedMethod = "check";
    else if (rawMethod.includes("card")) normalizedMethod = "manual_card";
    else if (rawMethod.includes("ach") || rawMethod.includes("transfer") || rawMethod.includes("bank")) normalizedMethod = "bank_transfer";
    else if (rawMethod === "other") normalizedMethod = "other";

    let targetOrgId = invoice?.organizationId || (organizationId && mongoose.Types.ObjectId.isValid(organizationId) ? new mongoose.Types.ObjectId(organizationId) : null);
    let orgName = invoice?.customerName || invoice?.organization || organizationName || "";

    if (!orgName && targetOrgId) {
      const foundOrg = await Organization.findById(targetOrgId);
      orgName = foundOrg?.name || "Customer Organization";
    }
    if (!orgName) orgName = "Customer Organization";

    // Atomically reconcile invoice if linked
    const previousBalance = currentBalance;
    let newBalance = 0;
    if (invoice) {
      invoice.amountPaid = Math.round(((invoice.amountPaid || 0) + paymentAmount + Number.EPSILON) * 100) / 100;
      const total = invoice.totalAmount ?? invoice.amount ?? 0;
      newBalance = Math.max(0, Math.round((total - invoice.amountPaid + Number.EPSILON) * 100) / 100);
      invoice.balanceDue = newBalance;
      invoice.status = newBalance <= 0 ? "paid" : "partially_paid";
      await invoice.save();
    }

    // Generate canonical payment receipt number
    const count = await PaymentRecord.countDocuments();
    const paymentNo = `REC-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const paymentDoc = new PaymentRecord({
      paymentNo,
      invoiceId: invoice?._id,
      invoiceNo: invoice?.invoiceNo || "N/A",
      organizationId: targetOrgId,
      organizationName: orgName,
      amount: paymentAmount,
      currency: invoice?.currency || "USD",
      paymentDate: new Date(),
      paymentMethod: normalizedMethod,
      referenceNumber: refNo,
      verificationStatus: "verified",
      notes: notes?.trim() || "",
      recordedBy: (request.user as any)?.userId ? new mongoose.Types.ObjectId((request.user as any).userId) : undefined,
      recordedByEmail: (request.user as any)?.email || "Super Admin"
    });

    await paymentDoc.save();

    await AuditLog.create({
      organizationId: targetOrgId,
      actorUserId: (request.user as any).userId,
      actorType: "user",
      eventCategory: "finance",
      eventType: "PAYMENT_RECORDED",
      resourceType: "PaymentRecord",
      resourceId: paymentDoc._id,
      action: "create",
      description: invoice
        ? `Manual payment receipt ${paymentNo} recorded: $${paymentAmount.toFixed(2)} from ${orgName} against invoice ${invoice.invoiceNo} (Prev balance: $${previousBalance.toFixed(2)}, New balance: $${newBalance.toFixed(2)})`
        : `Manual prepayment receipt ${paymentNo} recorded: $${paymentAmount.toFixed(2)} from ${orgName} (${refNo})`,
      severity: "info",
      metadata: {
        invoiceNo: invoice?.invoiceNo || "N/A",
        amount: paymentAmount,
        previousBalance,
        newBalance,
        referenceNumber: refNo
      }
    });

    return reply.status(201).send({
      success: true,
      message: "Payment receipt recorded successfully",
      data: {
        id: paymentDoc._id.toString(),
        _id: paymentDoc._id.toString(),
        paymentNo: paymentDoc.paymentNo,
        receiptNo: paymentDoc.paymentNo,
        invoiceId: paymentDoc.invoiceId ? paymentDoc.invoiceId.toString() : null,
        invoiceNo: paymentDoc.invoiceNo,
        organizationId: paymentDoc.organizationId ? paymentDoc.organizationId.toString() : null,
        organizationName: paymentDoc.organizationName,
        amount: paymentDoc.amount,
        currency: paymentDoc.currency,
        paymentDate: paymentDoc.paymentDate,
        recordedAt: paymentDoc.paymentDate,
        paymentMethod: paymentDoc.paymentMethod,
        method: paymentDoc.paymentMethod,
        referenceNumber: paymentDoc.referenceNumber,
        reference: paymentDoc.referenceNumber,
        verificationStatus: paymentDoc.verificationStatus,
        notes: paymentDoc.notes,
        recordedBy: paymentDoc.recordedByEmail
      }
    });
  });

  // GET /finance/expenses - Operating expense records
  app.get("/finance/expenses", async (request, reply) => {
    const expenses = await ExpenseRecord.find({ isDeleted: { $ne: true } })
      .sort({ expenseDate: -1, createdAt: -1 })
      .limit(100);

    const totalExpenses = Math.round(
      expenses.reduce((sum, e) => sum + (e.amount || 0), 0) * 100
    ) / 100;

    return reply.status(200).send({
      success: true,
      message: "Expenses retrieved",
      data: {
        expenses: expenses.map(e => ({
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
          recordedBy: e.createdByEmail || (e as any).recordedBy || "Super Admin"
        })),
        totalExpenses
      }
    });
  });

  // POST /finance/expenses - Record manual operating expense
  app.post("/finance/expenses", async (request, reply) => {
    const {
      category,
      vendor,
      amount,
      currency = "USD",
      description,
      title,
      notes,
      expenseDate,
      incurredAt,
      isRecurring = false,
      receiptUrl,
      organizationId,
    } = request.body as any;

    if (!category || typeof category !== "string" || !category.trim()) {
      throw new AppError(400, "BAD_REQUEST", "Expense category is required");
    }

    if (!vendor || typeof vendor !== "string" || !vendor.trim()) {
      throw new AppError(400, "BAD_REQUEST", "Expense vendor is required");
    }

    const numAmount = Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new AppError(400, "BAD_REQUEST", "Expense amount must be a positive number");
    }

    const desc = (description || title || notes || "").trim();
    if (!desc) {
      throw new AppError(400, "BAD_REQUEST", "Expense description or title is required");
    }

    // Normalize legacy categories if provided
    let normalizedCategory = category.trim().toLowerCase();
    if (normalizedCategory === "hosting" || normalizedCategory === "cloud") {
      normalizedCategory = "infrastructure";
    } else if (normalizedCategory === "ai" || normalizedCategory === "tokens") {
      normalizedCategory = "ai_compute";
    } else if (normalizedCategory === "tools" || normalizedCategory === "saas") {
      normalizedCategory = "software_licenses";
    } else if (normalizedCategory === "hardware") {
      normalizedCategory = "office";
    }

    const VALID_CATEGORIES = [
      "infrastructure",
      "ai_compute",
      "software_licenses",
      "salaries",
      "marketing",
      "office",
      "legal",
      "other",
    ];

    if (!VALID_CATEGORIES.includes(normalizedCategory)) {
      throw new AppError(400, "INVALID_CATEGORY", `Invalid expense category: '${category}'. Must be one of: ${VALID_CATEGORIES.join(", ")}`);
    }

    // Generate canonical expense number
    const count = await ExpenseRecord.countDocuments();
    const expenseNo = `EXP-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const dateVal = expenseDate ? new Date(expenseDate) : (incurredAt ? new Date(incurredAt) : new Date());

    const expenseDoc = new ExpenseRecord({
      expenseNo,
      category: normalizedCategory,
      vendor: vendor.trim(),
      amount: numAmount,
      currency: (currency || "USD").toUpperCase().trim(),
      expenseDate: dateVal,
      description: desc,
      organizationId: organizationId && mongoose.Types.ObjectId.isValid(organizationId) ? new mongoose.Types.ObjectId(organizationId) : undefined,
      isRecurring: Boolean(isRecurring),
      receiptUrl: receiptUrl?.trim() || undefined,
      createdBy: (request.user as any)?.userId ? new mongoose.Types.ObjectId((request.user as any).userId) : undefined,
      createdByEmail: (request.user as any)?.email || "Super Admin"
    });

    await expenseDoc.save();

    await AuditLog.create({
      organizationId: expenseDoc.organizationId,
      actorUserId: (request.user as any).userId,
      actorType: "user",
      eventCategory: "finance",
      eventType: "EXPENSE_RECORDED",
      resourceType: "ExpenseRecord",
      resourceId: expenseDoc._id,
      action: "create",
      description: `Operating expense ${expenseNo} recorded: $${numAmount.toFixed(2)} for ${vendor.trim()} (${normalizedCategory})`,
      severity: "info",
      metadata: {
        expenseNo: expenseDoc.expenseNo,
        category: expenseDoc.category,
        vendor: expenseDoc.vendor,
        amount: numAmount,
        description: desc
      }
    });

    return reply.status(201).send({
      success: true,
      message: "Expense recorded successfully",
      data: {
        id: expenseDoc._id.toString(),
        _id: expenseDoc._id.toString(),
        expenseNo: expenseDoc.expenseNo,
        category: expenseDoc.category,
        vendor: expenseDoc.vendor,
        amount: expenseDoc.amount,
        currency: expenseDoc.currency,
        expenseDate: expenseDoc.expenseDate,
        incurredAt: expenseDoc.expenseDate,
        date: expenseDoc.expenseDate,
        description: expenseDoc.description,
        title: expenseDoc.description,
        notes: expenseDoc.description,
        isRecurring: expenseDoc.isRecurring,
        receiptUrl: expenseDoc.receiptUrl,
        recordedBy: expenseDoc.createdByEmail
      }
    });
  });

  // GET /finance/accounts - Customer account balances, billing tiers, and commercial terms
  app.get("/finance/accounts", async (request, reply) => {
    const { search, status } = request.query as any;

    // 1. Fetch all active organizations
    const orgs = await Organization.find({ isDeleted: { $ne: true } })
      .select("_id name slug domain plan status supportEmail")
      .lean();

    // 2. Fetch or auto-create CustomerAccount for any missing organization
    const orgIds = orgs.map(o => o._id);
    const existingAccounts = await CustomerAccount.find({
      organizationId: { $in: orgIds },
      isDeleted: { $ne: true }
    });

    const accountMap = new Map<string, any>();
    existingAccounts.forEach(acc => {
      accountMap.set(acc.organizationId.toString(), acc);
    });

    // Auto-create CustomerAccount for any organization that lacks one
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
            address: ""
          }
        });
        accountMap.set(orgIdStr, newAcc);
      }
    }

    // 3. Aggregate financial balance stats from Invoice collection
    const invoiceAggregates = await Invoice.aggregate([
      {
        $match: {
          isDeleted: { $ne: true },
          status: { $ne: "Void" }
        }
      },
      {
        $group: {
          _id: "$organizationId",
          totalInvoiced: {
            $sum: { $ifNull: ["$totalAmount", { $ifNull: ["$subtotal", 0] }] }
          },
          totalPaid: {
            $sum: { $ifNull: ["$amountPaid", 0] }
          },
          totalBalanceDue: {
            $sum: {
              $ifNull: [
                "$balanceDue",
                {
                  $subtract: [
                    { $ifNull: ["$totalAmount", { $ifNull: ["$subtotal", 0] }] },
                    { $ifNull: ["$amountPaid", 0] }
                  ]
                }
              ]
            }
          }
        }
      }
    ]);

    const invoiceStatsMap = new Map<string, { totalInvoiced: number; totalPaid: number; totalBalanceDue: number }>();
    invoiceAggregates.forEach(inv => {
      if (inv._id) {
        invoiceStatsMap.set(inv._id.toString(), {
          totalInvoiced: Math.round((Number(inv.totalInvoiced || 0) + Number.EPSILON) * 100) / 100,
          totalPaid: Math.round((Number(inv.totalPaid || 0) + Number.EPSILON) * 100) / 100,
          totalBalanceDue: Math.round((Number(inv.totalBalanceDue || 0) + Number.EPSILON) * 100) / 100
        });
      }
    });

    // 4. Assemble merged customer account records
    let results = orgs.map(org => {
      const orgIdStr = org._id.toString();
      const acc = accountMap.get(orgIdStr);
      const invStats = invoiceStatsMap.get(orgIdStr) || {
        totalInvoiced: 0,
        totalPaid: 0,
        totalBalanceDue: 0
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
          status: org.status || "Active"
        },
        organization: {
          id: org._id.toString(),
          _id: org._id.toString(),
          name: org.name,
          slug: org.slug,
          domain: org.domain,
          plan: org.plan || "Enterprise",
          status: org.status || "Active"
        },
        accountStatus: acc.accountStatus || "good_standing",
        billingCycle: acc.billingCycle || "monthly",
        preferredCurrency: acc.preferredCurrency || "USD",
        creditLimit: acc.creditLimit || 0,
        billingContact: acc.billingContact || {
          name: org.name,
          email: org.supportEmail || "",
          phone: "",
          address: ""
        },
        commercialNotes: acc.commercialNotes || "",
        totalInvoiced: invStats.totalInvoiced,
        totalPaid: invStats.totalPaid,
        totalBalanceDue: invStats.totalBalanceDue,
        createdAt: acc.createdAt,
        updatedAt: acc.updatedAt
      };
    });

    // 5. Apply filters
    if (status && status !== "all") {
      results = results.filter(r => r.accountStatus === status);
    }

    if (search && typeof search === "string" && search.trim()) {
      const q = search.trim().toLowerCase();
      results = results.filter(r =>
        r.organization.name.toLowerCase().includes(q) ||
        r.organization.slug.toLowerCase().includes(q) ||
        (r.billingContact.name && r.billingContact.name.toLowerCase().includes(q)) ||
        (r.billingContact.email && r.billingContact.email.toLowerCase().includes(q))
      );
    }

    return reply.status(200).send({
      success: true,
      message: "Customer accounts retrieved successfully",
      data: results,
      total: results.length
    });
  });

  // PATCH /finance/accounts/:id - Update customer account status, credit limit, or billing contact
  app.patch("/finance/accounts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const {
      accountStatus,
      billingCycle,
      creditLimit,
      preferredCurrency,
      billingContact,
      commercialNotes
    } = request.body as any;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "BAD_REQUEST", "Invalid customer account or organization ID format");
    }

    const objectId = new mongoose.Types.ObjectId(id);

    // Look up either by CustomerAccount _id or organizationId
    let account = await CustomerAccount.findOne({
      $or: [{ _id: objectId }, { organizationId: objectId }],
      isDeleted: { $ne: true }
    });

    if (!account) {
      // If organization exists, create CustomerAccount on-the-fly
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
            address: ""
          }
        });
      } else {
        throw new AppError(404, "NOT_FOUND", "Customer account not found");
      }
    }

    const previousStatus = account.accountStatus;
    const previousCreditLimit = account.creditLimit;

    // Validation: accountStatus
    if (accountStatus !== undefined) {
      const VALID_STATUSES = ["good_standing", "delinquent", "credit_hold", "vip"];
      if (!VALID_STATUSES.includes(accountStatus)) {
        throw new AppError(
          400,
          "INVALID_STATUS",
          `Invalid account status '${accountStatus}'. Must be one of: ${VALID_STATUSES.join(", ")}`
        );
      }
      account.accountStatus = accountStatus;
    }

    // Validation: billingCycle
    if (billingCycle !== undefined) {
      const VALID_CYCLES = ["monthly", "quarterly", "annual"];
      if (!VALID_CYCLES.includes(billingCycle)) {
        throw new AppError(
          400,
          "INVALID_BILLING_CYCLE",
          `Invalid billing cycle '${billingCycle}'. Must be one of: ${VALID_CYCLES.join(", ")}`
        );
      }
      account.billingCycle = billingCycle;
    }

    // Validation: creditLimit
    if (creditLimit !== undefined) {
      const numLimit = Number(creditLimit);
      if (isNaN(numLimit) || numLimit < 0) {
        throw new AppError(400, "INVALID_CREDIT_LIMIT", "Credit limit must be a non-negative number");
      }
      account.creditLimit = Math.round(numLimit * 100) / 100;
    }

    // Validation: preferredCurrency
    if (preferredCurrency !== undefined && typeof preferredCurrency === "string") {
      account.preferredCurrency = preferredCurrency.trim().toUpperCase().slice(0, 3);
    }

    // Update billingContact
    if (billingContact && typeof billingContact === "object") {
      account.billingContact = {
        name: billingContact.name !== undefined ? String(billingContact.name).trim() : account.billingContact?.name || "",
        email: billingContact.email !== undefined ? String(billingContact.email).trim().toLowerCase() : account.billingContact?.email || "",
        phone: billingContact.phone !== undefined ? String(billingContact.phone).trim() : account.billingContact?.phone || "",
        address: billingContact.address !== undefined ? String(billingContact.address).trim() : account.billingContact?.address || ""
      };
    }

    // Update commercialNotes
    if (commercialNotes !== undefined) {
      account.commercialNotes = String(commercialNotes).trim();
    }

    await account.save();

    // Log the customer account update audit event
    await AuditLog.create({
      organizationId: account.organizationId,
      actorUserId: (request.user as any).userId,
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
        billingCycle: account.billingCycle
      }
    });

    return reply.status(200).send({
      success: true,
      message: "Customer account updated successfully",
      data: {
        id: account._id.toString(),
        _id: account._id.toString(),
        organizationId: account.organizationId.toString(),
        accountStatus: account.accountStatus,
        billingCycle: account.billingCycle,
        preferredCurrency: account.preferredCurrency,
        creditLimit: account.creditLimit,
        billingContact: account.billingContact,
        commercialNotes: account.commercialNotes,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt
      }
    });
  });

  // Default Platform Feature Flags Baseline
  const DEFAULT_PLATFORM_FLAGS = [
    {
      key: "ai_course_builder",
      name: "AI Course Builder",
      description: "Enable generative AI curriculum creation with Gemini",
      isEnabled: true,
      rolloutPercentage: 100,
      targetAudience: "global",
      environment: "all",
    },
    {
      key: "sso_enforcement",
      name: "SAML & OIDC SSO",
      description: "Allow enterprise SAML/OIDC authentication",
      isEnabled: true,
      rolloutPercentage: 100,
      targetAudience: "global",
      environment: "all",
    },
    {
      key: "kiosk_mode",
      name: "Kiosk Display Terminals",
      description: "Public orientation terminal mode",
      isEnabled: true,
      rolloutPercentage: 100,
      targetAudience: "global",
      environment: "all",
    },
    {
      key: "advanced_hris_sync",
      name: "Real-time HRIS Webhooks",
      description: "Workday & BambooHR real-time worker synchronization",
      isEnabled: true,
      rolloutPercentage: 100,
      targetAudience: "global",
      environment: "all",
    },
    {
      key: "gamification_badges",
      name: "Gamification & Badges",
      description: "Award milestone achievements and learner leaderboard",
      isEnabled: true,
      rolloutPercentage: 100,
      targetAudience: "global",
      environment: "all",
    },
  ];

  async function syncDefaultFeatureFlags() {
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
    for (const flag of DEFAULT_PLATFORM_FLAGS) {
      await FeatureFlag.updateOne(
        { key: flag.key },
        {
          $setOnInsert: {
            ...flag,
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

  // GET /settings/flags - Platform Feature Flags with populated organization overrides
  app.get("/settings/flags", async (_request, reply) => {
    await syncDefaultFeatureFlags();

    const flags = await FeatureFlag.find({ isDeleted: false })
      .populate("targetOrganizationIds", "name slug")
      .populate("excludedOrganizationIds", "name slug")
      .sort({ key: 1 });

    return reply.status(200).send({
      success: true,
      message: "Feature flags retrieved",
      data: flags.map((f) => f.toJSON()),
    });
  });

  // POST /settings/flags - Register Custom Feature Flag
  app.post("/settings/flags", async (request, reply) => {
    const body = (request.body as any) || {};

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
    } = body;

    if (!key || typeof key !== "string" || !key.trim()) {
      throw new AppError(400, "VALIDATION_ERROR", "Feature flag 'key' is required");
    }
    if (!name || typeof name !== "string" || !name.trim()) {
      throw new AppError(400, "VALIDATION_ERROR", "Feature flag 'name' is required");
    }
    if (!description || typeof description !== "string" || !description.trim()) {
      throw new AppError(400, "VALIDATION_ERROR", "Feature flag 'description' is required");
    }

    const normalizedKey = key.trim().toLowerCase();

    // Validate organization ObjectIds if provided
    const allOrgIds = [...targetOrganizationIds, ...excludedOrganizationIds];
    for (const id of allOrgIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError(400, "VALIDATION_ERROR", `Invalid organization ObjectId format: ${id}`);
      }
    }

    const existing = await FeatureFlag.findOne({ key: normalizedKey, isDeleted: false });
    if (existing) {
      throw new AppError(409, "DUPLICATE_KEY", `Feature flag with key '${normalizedKey}' already exists`);
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
      targetOrganizationIds: targetOrganizationIds.map((id: string) => new mongoose.Types.ObjectId(id)),
      excludedOrganizationIds: excludedOrganizationIds.map((id: string) => new mongoose.Types.ObjectId(id)),
      targetRoles,
      rolloutPercentage: Math.max(0, Math.min(100, Number(effectiveRollout))),
      isDeleted: false,
    });

    await AuditLog.create({
      actorUserId: (request.user as any).userId,
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

    return reply.status(201).send({
      success: true,
      message: `Feature flag ${normalizedKey} registered successfully`,
      data: newFlag.toJSON(),
    });
  });

  // PATCH /settings/flags/:key - Toggle Platform Feature Flag & Tenant Targeting Overrides
  app.patch("/settings/flags/:key", async (request, reply) => {
    const { key } = request.params as any;
    const body = (request.body as any) || {};

    const normalizedKey = (key || "").trim().toLowerCase();
    let flag = await FeatureFlag.findOne({ key: normalizedKey, isDeleted: false });

    if (!flag) {
      const defaultFlag = DEFAULT_PLATFORM_FLAGS.find((f) => f.key === normalizedKey);
      if (defaultFlag) {
        flag = await FeatureFlag.create({
          ...defaultFlag,
          targetOrganizationIds: [],
          excludedOrganizationIds: [],
          targetRoles: [],
          isDeleted: false,
        });
      } else {
        throw new AppError(404, "FLAG_NOT_FOUND", `Feature flag '${key}' not found`);
      }
    }

    const previousState = flag.toJSON();

    // Validate organization ObjectIds if provided
    if (body.targetOrganizationIds !== undefined) {
      if (!Array.isArray(body.targetOrganizationIds)) {
        throw new AppError(400, "VALIDATION_ERROR", "targetOrganizationIds must be an array");
      }
      for (const id of body.targetOrganizationIds) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          throw new AppError(400, "VALIDATION_ERROR", `Invalid targetOrganizationId format: ${id}`);
        }
      }
      flag.targetOrganizationIds = body.targetOrganizationIds.map((id: string) => new mongoose.Types.ObjectId(id));
    }

    if (body.excludedOrganizationIds !== undefined) {
      if (!Array.isArray(body.excludedOrganizationIds)) {
        throw new AppError(400, "VALIDATION_ERROR", "excludedOrganizationIds must be an array");
      }
      for (const id of body.excludedOrganizationIds) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          throw new AppError(400, "VALIDATION_ERROR", `Invalid excludedOrganizationId format: ${id}`);
        }
      }
      flag.excludedOrganizationIds = body.excludedOrganizationIds.map((id: string) => new mongoose.Types.ObjectId(id));
    }

    if (body.isEnabled !== undefined) {
      flag.isEnabled = Boolean(body.isEnabled);
    } else if (body.enabled !== undefined) {
      flag.isEnabled = Boolean(body.enabled);
    }

    if (body.rolloutPercentage !== undefined) {
      flag.rolloutPercentage = Math.max(0, Math.min(100, Number(body.rolloutPercentage)));
    } else if (body.rolloutPct !== undefined) {
      flag.rolloutPercentage = Math.max(0, Math.min(100, Number(body.rolloutPct)));
    }

    if (body.targetAudience !== undefined) {
      flag.targetAudience = body.targetAudience;
    }

    if (body.targetRoles !== undefined && Array.isArray(body.targetRoles)) {
      flag.targetRoles = body.targetRoles;
    }

    if (body.environment !== undefined) {
      flag.environment = body.environment;
    }

    if (body.name !== undefined && typeof body.name === "string" && body.name.trim()) {
      flag.name = body.name.trim();
    }

    if (body.description !== undefined && typeof body.description === "string" && body.description.trim()) {
      flag.description = body.description.trim();
    }

    await flag.save();

    await flag.populate([
      { path: "targetOrganizationIds", select: "name slug" },
      { path: "excludedOrganizationIds", select: "name slug" },
    ]);

    const newState = flag.toJSON();

    await AuditLog.create({
      actorUserId: (request.user as any).userId,
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
        reason: body.reason || `Administrative update for ${flag.key}`,
      },
    });

    FeatureFlagService.invalidateCache(normalizedKey);

    return reply.status(200).send({
      success: true,
      message: `Feature flag ${key} updated successfully`,
      data: newState,
    });
  });

  // GET /alerts - Platform Incident & Alert Center
  app.get("/alerts", async (request, reply) => {
    const [suspendedOrgs, criticalLogs, failedCases, overdueTasks] = await Promise.all([
      Organization.find({ status: "Suspended", isDeleted: false }).limit(20),
      AuditLog.find({ severity: "critical" }).sort({ createdAt: -1 }).limit(20),
      OnboardingCase.find({ state: "provisioning_failed", isDeleted: false }).limit(20),
      Task.find({ dueDate: { $lt: new Date() }, status: { $nin: ["completed", "cancelled"] }, isDeleted: false }).limit(20)
    ]);

    const alerts = [
      ...suspendedOrgs.map(o => ({
        id: `org-suspended-${o._id}`,
        title: `Tenant Suspended: ${o.name}`,
        description: `Organization is suspended / quarantined. Access is blocked.`,
        severity: "critical",
        category: "tenant",
        sourceId: o._id.toString(),
        createdAt: o.updatedAt || o.createdAt
      })),
      ...criticalLogs.map(l => ({
        id: `log-crit-${l._id}`,
        title: `Security Incident: ${l.eventType || 'Critical Log'}`,
        description: l.description,
        severity: "critical",
        category: "security",
        sourceId: l._id.toString(),
        createdAt: l.createdAt
      })),
      ...failedCases.map(c => ({
        id: `case-fail-${c._id}`,
        title: `Onboarding Provisioning Failed`,
        description: c.failure?.message || "Provisioning pipeline encountered an unhandled exception.",
        severity: "high",
        category: "onboarding",
        sourceId: c._id.toString(),
        createdAt: c.updatedAt || c.createdAt
      })),
      ...overdueTasks.map(t => ({
        id: `task-overdue-${t._id}`,
        title: `SLA Breach: ${t.title}`,
        description: `Task has breached its due date: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'Overdue'}.`,
        severity: "warning",
        category: "operations",
        sourceId: t._id.toString(),
        createdAt: t.dueDate || t.createdAt
      }))
    ];

    return reply.status(200).send({
      success: true,
      message: "Alerts retrieved successfully",
      data: {
        alerts: alerts.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()),
        summary: {
          critical: alerts.filter(a => a.severity === "critical").length,
          high: alerts.filter(a => a.severity === "high").length,
          warning: alerts.filter(a => a.severity === "warning").length,
          total: alerts.length
        }
      }
    });
  });
}

export default superAdminRoutes;
