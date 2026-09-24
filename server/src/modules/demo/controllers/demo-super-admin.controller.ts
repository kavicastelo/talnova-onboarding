import { FastifyRequest, FastifyReply } from "fastify";
import mongoose from "mongoose";
import { hashPassword } from "../../../utils/crypto.js";
import AppError from "../../../common/errors/app-error.js";
import { demoConfig } from "../../../config/index.js";
import {
  getDemoTenantModel,
  getDemoUserModel,
  getDemoSessionModel,
  getDemoActivityLogModel,
  getDemoRiskAlertModel,
  getDemoResetLogModel,
} from "../models/index.js";
import { demoResetService } from "../services/demo-reset.service.js";
import { demoSessionService } from "../services/demo-session.service.js";
import { DEMO_PACKAGES } from "../seed/demo-seed-data.js";

export class DemoSuperAdminController {
  getOverview = async (_request: FastifyRequest, reply: FastifyReply) => {
    const DemoTenant = getDemoTenantModel();
    const DemoUser = getDemoUserModel();
    const DemoSession = getDemoSessionModel();
    const DemoRiskAlert = getDemoRiskAlertModel();
    const DemoResetLog = getDemoResetLogModel();

    const [tenantsCount, activeUsersCount, activeSessionsCount, openAlertsCount, lastReset] =
      await Promise.all([
        DemoTenant.countDocuments({ status: "ACTIVE" }),
        DemoUser.countDocuments({ status: "ACTIVE" }),
        DemoSession.countDocuments({ isValid: true, expiresAt: { $gt: new Date() } }),
        DemoRiskAlert.countDocuments({ status: "OPEN" }),
        DemoResetLog.findOne().sort({ createdAt: -1 }).lean(),
      ]);

    return reply.status(200).send({
      success: true,
      data: {
        tenantsCount,
        activeUsersCount,
        activeSessionsCount,
        openAlertsCount,
        lastReset: lastReset || null,
        watermarkEnabled: demoConfig.watermarkEnabled,
        sessionLimit: demoConfig.maxConcurrentSessions,
        idleTimeoutMinutes: demoConfig.inactivityTimeoutMinutes,
      },
    });
  };

  getCompanies = async (_request: FastifyRequest, reply: FastifyReply) => {
    const DemoTenant = getDemoTenantModel();
    const DemoUser = getDemoUserModel();

    const tenants = await DemoTenant.find().sort({ createdAt: -1 }).lean();

    const tenantIds = tenants.map((t) => t._id);
    const users = await DemoUser.find({ demoTenantId: { $in: tenantIds } }).lean();

    const userCountMap = new Map<string, number>();
    for (const u of users) {
      const key = u.demoTenantId.toString();
      userCountMap.set(key, (userCountMap.get(key) || 0) + 1);
    }

    const data = tenants.map((t) => ({
      ...t,
      usersCount: userCountMap.get(t._id.toString()) || 0,
    }));

    return reply.status(200).send({ success: true, data });
  };

  createCompany = async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, slug, domain, contactEmail, entitlementPackage, durationDays = 30 } =
      request.body as any;

    if (!name || !slug || !domain || !contactEmail) {
      throw new AppError(400, "VALIDATION_ERROR", "All company fields are required.");
    }

    const DemoTenant = getDemoTenantModel();
    const existing = await DemoTenant.findOne({ slug: slug.toLowerCase().trim() });
    if (existing) {
      throw new AppError(409, "SLUG_EXISTS", "A demo tenant with this slug already exists.");
    }

    const pkgKey = (entitlementPackage as keyof typeof DEMO_PACKAGES) || "STANDARD";
    const allowedFeatures = DEMO_PACKAGES[pkgKey]?.features || DEMO_PACKAGES.STANDARD.features;

    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    const tenant = await DemoTenant.create({
      name,
      slug: slug.toLowerCase().trim(),
      domain,
      contactEmail,
      entitlementPackage: pkgKey,
      allowedFeatures,
      expiresAt,
      status: "ACTIVE",
      riskLevel: "NORMAL",
      sessionLimit: demoConfig.maxConcurrentSessions,
    });

    return reply.status(201).send({
      success: true,
      message: `Demo company '${name}' provisioned successfully.`,
      data: tenant,
    });
  };

  updateCompany = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const { status, entitlementPackage, allowedFeatures, extendDays } = request.body as any;

    const DemoTenant = getDemoTenantModel();
    const updateData: any = {};

    if (status) updateData.status = status;
    if (entitlementPackage) {
      updateData.entitlementPackage = entitlementPackage;
      if (DEMO_PACKAGES[entitlementPackage as keyof typeof DEMO_PACKAGES]) {
        updateData.allowedFeatures = DEMO_PACKAGES[entitlementPackage as keyof typeof DEMO_PACKAGES].features;
      }
    }
    if (allowedFeatures && Array.isArray(allowedFeatures)) {
      updateData.allowedFeatures = allowedFeatures;
    }
    if (extendDays && typeof extendDays === "number") {
      const current = await DemoTenant.findById(id);
      const baseDate = current?.expiresAt && current.expiresAt > new Date() ? current.expiresAt : new Date();
      updateData.expiresAt = new Date(baseDate.getTime() + extendDays * 24 * 60 * 60 * 1000);
      if (status !== "SUSPENDED" && status !== "REVOKED") {
        updateData.status = "ACTIVE";
      }
    }

    const tenant = await DemoTenant.findByIdAndUpdate(id, updateData, { new: true });
    if (!tenant) {
      throw new AppError(404, "TENANT_NOT_FOUND", "Demo company not found.");
    }

    return reply.status(200).send({
      success: true,
      message: `Demo company '${tenant.name}' updated.`,
      data: tenant,
    });
  };

  getUsers = async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.query as any;
    const DemoUser = getDemoUserModel();
    const DemoTenant = getDemoTenantModel();

    const query: any = {};
    if (tenantId) {
      query.demoTenantId = new mongoose.Types.ObjectId(tenantId);
    }

    const users = await DemoUser.find(query).sort({ createdAt: -1 }).select("-passwordHash").lean();
    const tenants = await DemoTenant.find().select("name slug").lean();
    const tenantMap = new Map(tenants.map((t) => [t._id.toString(), t.name]));

    const data = users.map((u) => ({
      ...u,
      companyName: tenantMap.get(u.demoTenantId.toString()) || "Unknown Company",
    }));

    return reply.status(200).send({ success: true, data });
  };

  createUser = async (request: FastifyRequest, reply: FastifyReply) => {
    const { demoTenantId, email, fullName, role = "demo_employee", department, jobTitle, password = "DemoPass123!" } =
      request.body as any;

    if (!demoTenantId || !email || !fullName) {
      throw new AppError(400, "VALIDATION_ERROR", "demoTenantId, email, and fullName are required.");
    }

    const DemoUser = getDemoUserModel();
    const DemoTenant = getDemoTenantModel();

    const tenant = await DemoTenant.findById(demoTenantId);
    if (!tenant) {
      throw new AppError(404, "TENANT_NOT_FOUND", "Selected demo company does not exist.");
    }

    const existing = await DemoUser.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      throw new AppError(409, "USER_EXISTS", "A demo user with this email already exists.");
    }

    const passwordHash = await hashPassword(password);
    const user = await DemoUser.create({
      demoTenantId: tenant._id,
      email: email.toLowerCase().trim(),
      fullName,
      role,
      department: department || "General",
      jobTitle: jobTitle || "Demo Participant",
      passwordHash,
      status: "ACTIVE",
      expiresAt: tenant.expiresAt,
    });

    return reply.status(201).send({
      success: true,
      message: `Demo user '${fullName}' created.`,
      data: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        companyName: tenant.name,
        expiresAt: user.expiresAt,
      },
    });
  };

  updateUser = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const { status, role, department, jobTitle } = request.body as any;

    const DemoUser = getDemoUserModel();
    const user = await DemoUser.findByIdAndUpdate(
      id,
      { status, role, department, jobTitle },
      { new: true }
    ).select("-passwordHash");

    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "Demo user not found.");
    }

    return reply.status(200).send({
      success: true,
      message: `Demo user '${user.fullName}' updated.`,
      data: user,
    });
  };

  getSessions = async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.query as any;
    const sessions = await demoSessionService.listActiveSessions(tenantId);
    return reply.status(200).send({ success: true, data: sessions });
  };

  terminateSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const { sessionId } = request.params as any;
    const adminUser = (request.user as any)?.email || "Super Admin";
    const result = await demoSessionService.terminateSession(sessionId, adminUser);
    return reply.status(200).send(result);
  };

  getActivityLogs = async (request: FastifyRequest, reply: FastifyReply) => {
    const { limit = "50" } = request.query as any;
    const DemoActivityLog = getDemoActivityLogModel();
    const DemoUser = getDemoUserModel();
    const DemoTenant = getDemoTenantModel();

    const limitNum = Math.min(100, parseInt(limit, 10) || 50);
    const logs = await DemoActivityLog.find().sort({ createdAt: -1 }).limit(limitNum).lean();

    const userIds = logs.map((l) => l.demoUserId).filter(Boolean);
    const tenantIds = logs.map((l) => l.demoTenantId).filter(Boolean);

    const [users, tenants] = await Promise.all([
      DemoUser.find({ _id: { $in: userIds } }).select("fullName email").lean(),
      DemoTenant.find({ _id: { $in: tenantIds } }).select("name").lean(),
    ]);

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));
    const tenantMap = new Map(tenants.map((t) => [t._id.toString(), t.name]));

    const data = logs.map((l) => ({
      ...l,
      userName: l.demoUserId ? userMap.get(l.demoUserId.toString())?.fullName : undefined,
      userEmail: l.demoUserId ? userMap.get(l.demoUserId.toString())?.email : undefined,
      companyName: l.demoTenantId ? tenantMap.get(l.demoTenantId.toString()) : undefined,
    }));

    return reply.status(200).send({ success: true, data });
  };

  getRiskAlerts = async (request: FastifyRequest, reply: FastifyReply) => {
    const { status } = request.query as any;
    const alerts = await demoSessionService.getRiskAlerts(status);
    return reply.status(200).send({ success: true, data: alerts });
  };

  resolveRiskAlert = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const { notes } = (request.body as any) || {};
    const adminUser = (request.user as any)?.email || "Super Admin";
    const alert = await demoSessionService.resolveRiskAlert(id, adminUser, notes);
    return reply.status(200).send({ success: true, data: alert });
  };

  getEntitlements = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      success: true,
      packages: DEMO_PACKAGES,
    });
  };

  resetDemo = async (request: FastifyRequest, reply: FastifyReply) => {
    const { confirmText } = (request.body as any) || {};
    const requiredConfirmation = demoConfig.resetConfirmationKey || "RESET DEMO";

    if (confirmText !== requiredConfirmation) {
      throw new AppError(
        400,
        "INVALID_CONFIRMATION",
        `Reset confirmation failed. You must provide confirmText: '${requiredConfirmation}'`
      );
    }

    const adminUser = (request.user as any)?.email || "Super Admin";
    const role = (request.user as any)?.role || "super_admin";

    const result = await demoResetService.executeReset(adminUser, role);

    return reply.status(200).send({
      success: true,
      message: "Demo environment has been completely and deterministically reset.",
      data: result,
    });
  };

  getResetHistory = async (_request: FastifyRequest, reply: FastifyReply) => {
    const DemoResetLog = getDemoResetLogModel();
    const history = await DemoResetLog.find().sort({ createdAt: -1 }).limit(20).lean();
    return reply.status(200).send({ success: true, data: history });
  };

  getTelemetryAnalytics = async (_request: FastifyRequest, reply: FastifyReply) => {
    const { getDemoFeatureUsageModel } = await import("../models/index.js");
    const DemoFeatureUsage = getDemoFeatureUsageModel();

    const [topFeatures, restrictedAttempts, totalEvents, recentEvents] = await Promise.all([
      DemoFeatureUsage.aggregate([
        { $match: { action: { $in: ["view", "click"] } } },
        { $group: { _id: "$featureKey", count: { $sum: 1 }, uniqueUsers: { $addToSet: "$userEmail" } } },
        { $project: { featureKey: "$_id", count: 1, uniqueUsersCount: { $size: "$uniqueUsers" } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      DemoFeatureUsage.aggregate([
        { $match: { status: "RESTRICTED" } },
        { $group: { _id: { feature: "$featureKey", company: "$companyName" }, count: { $sum: 1 }, lastAttempt: { $max: "$createdAt" } } },
        { $project: { feature: "$_id.feature", company: "$_id.company", count: 1, lastAttempt: 1 } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),
      DemoFeatureUsage.countDocuments(),
      DemoFeatureUsage.find().sort({ createdAt: -1 }).limit(30).lean(),
    ]);

    return reply.status(200).send({
      success: true,
      data: {
        totalEvents,
        topFeatures,
        restrictedAttempts,
        recentEvents,
      },
    });
  };
}

export const demoSuperAdminController = new DemoSuperAdminController();
export default demoSuperAdminController;
