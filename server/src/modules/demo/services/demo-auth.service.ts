import crypto from "crypto";
import mongoose from "mongoose";
import { verifyPassword, hashPassword } from "../../../utils/crypto.js";
import AppError from "../../../common/errors/app-error.js";
import { demoConfig } from "../../../config/index.js";
import {
  getDemoUserModel,
  getDemoTenantModel,
  getDemoSessionModel,
  getDemoActivityLogModel,
  getDemoRiskAlertModel,
} from "../models/index.js";
import { DemoResetService } from "./demo-reset.service.js";

export interface DemoTokenPayload {
  demoUserId: string;
  demoTenantId: string;
  role: string;
  sessionId: string;
  email: string;
  companyName: string;
  isDemo: true;
}

export class DemoAuthService {
  /**
   * Generates a signed JWT specifically for the demo environment.
   */
  public generateDemoToken(payload: DemoTokenPayload, jwtSigner: (p: any, opt?: any) => string): string {
    return jwtSigner(payload, {
      expiresIn: `${demoConfig.sessionDurationMinutes}m`,
    });
  }

  /**
   * Performs attributable login for a demo user.
   */
  public async login(
    email: string,
    password: string,
    jwtSigner: (p: any, opt?: any) => string,
    ipAddress?: string,
    userAgent?: string,
    deviceInfo?: string
  ) {
    if (DemoResetService.isResetting()) {
      throw new AppError(
        503,
        "DEMO_RESETTING",
        "The demo environment is currently undergoing an administrative reset. Please try again in a few moments."
      );
    }

    const DemoUser = getDemoUserModel();
    const DemoTenant = getDemoTenantModel();
    const DemoSession = getDemoSessionModel();
    const DemoActivityLog = getDemoActivityLogModel();
    const DemoRiskAlert = getDemoRiskAlertModel();

    const user = await DemoUser.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      throw new AppError(401, "UNAUTHORIZED", "Invalid demo credentials.");
    }

    const tenant = await DemoTenant.findById(user.demoTenantId);
    if (!tenant) {
      throw new AppError(403, "DEMO_TENANT_NOT_FOUND", "Demo company record does not exist.");
    }

    // Check Tenant Status
    if (tenant.status === "SUSPENDED" || tenant.status === "REVOKED") {
      throw new AppError(403, "DEMO_TENANT_SUSPENDED", `Demo access for ${tenant.name} has been ${tenant.status.toLowerCase()}.`);
    }

    if (tenant.expiresAt && tenant.expiresAt < new Date()) {
      await DemoTenant.updateOne({ _id: tenant._id }, { status: "EXPIRED" });
      throw new AppError(403, "DEMO_EXPIRED", "Your demo period has expired. Please contact sales to extend access.");
    }

    // Check User Status
    if (user.status === "SUSPENDED" || user.status === "REVOKED") {
      throw new AppError(403, "DEMO_USER_SUSPENDED", `Your demo account has been ${user.status.toLowerCase()}.`);
    }

    if (user.expiresAt && user.expiresAt < new Date()) {
      await DemoUser.updateOne({ _id: user._id }, { status: "EXPIRED" });
      throw new AppError(403, "DEMO_USER_EXPIRED", "Your individual demo account has expired.");
    }

    // Verify Password
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      await DemoActivityLog.create({
        demoTenantId: tenant._id,
        demoUserId: user._id,
        action: "LOGIN_FAILED",
        category: "SECURITY",
        description: `Failed demo login attempt for ${user.email} from IP: ${ipAddress || "unknown"}`,
        endpoint: "/api/v1/demo/auth/login",
        ipAddress,
        userAgent,
        severity: "warning",
      });
      throw new AppError(401, "UNAUTHORIZED", "Invalid demo credentials.");
    }

    // Check Concurrent Sessions & Credential Sharing Risk
    const activeSessions = await DemoSession.find({
      demoUserId: user._id,
      isValid: true,
      expiresAt: { $gt: new Date() },
    });

    let riskStatus: "NORMAL" | "SUSPICIOUS" | "HIGH_RISK" | "BLOCKED" = "NORMAL";
    let suspiciousReason: string | undefined;

    if (activeSessions.length >= tenant.sessionLimit) {
      // Check if IP, Device, or User Agent is different
      const differentDeviceOrIp = activeSessions.some(
        (s) =>
          (s.ipAddress && ipAddress && s.ipAddress !== ipAddress) ||
          (s.deviceInfo && deviceInfo && s.deviceInfo !== deviceInfo) ||
          (s.userAgent && userAgent && s.userAgent !== userAgent)
      );

      if (differentDeviceOrIp) {
        riskStatus = "SUSPICIOUS";
        suspiciousReason = `Concurrent session detected from new IP (${ipAddress || "unknown"}) / Device (${deviceInfo || "unknown"}).`;

        // Create Risk Alert in Super Admin monitoring
        await DemoRiskAlert.create({
          demoTenantId: tenant._id,
          demoUserId: user._id,
          alertType: "CONCURRENT_SESSIONS",
          severity: "HIGH",
          status: "OPEN",
          signals: [
            `${activeSessions.length + 1} overlapping active sessions`,
            `Previous IP: ${activeSessions[0].ipAddress || "unknown"} -> New IP: ${ipAddress || "unknown"}`,
            `Device: ${deviceInfo || "unknown"}`,
          ],
          details: {
            userEmail: user.email,
            companyName: tenant.name,
            currentIp: ipAddress,
            previousIp: activeSessions[0].ipAddress,
            timestamp: new Date(),
          },
        });

        // Terminate existing sessions to enforce max concurrent session limit
        await DemoSession.updateMany(
          { demoUserId: user._id, isValid: true },
          { isValid: false, suspiciousReason: "Superseded by new concurrent session" }
        );
      } else {
        // Same IP/device refreshing session
        await DemoSession.updateMany(
          { demoUserId: user._id, isValid: true },
          { isValid: false, suspiciousReason: "Re-authenticated on same device" }
        );
      }
    }

    const sessionId = crypto.randomUUID();
    const sessionExpiresAt = new Date(Date.now() + demoConfig.sessionDurationMinutes * 60 * 1000);

    const session = await DemoSession.create({
      sessionId,
      demoUserId: user._id,
      demoTenantId: tenant._id,
      tokenVersion: 1,
      ipAddress,
      deviceInfo,
      userAgent,
      isValid: true,
      riskStatus,
      suspiciousReason,
      lastActivityAt: new Date(),
      expiresAt: sessionExpiresAt,
    });

    // Update user's last login
    await DemoUser.updateOne({ _id: user._id }, { lastLoginAt: new Date() });

    // Generate Token
    const tokenPayload: DemoTokenPayload = {
      demoUserId: (user._id as mongoose.Types.ObjectId).toString(),
      demoTenantId: (tenant._id as mongoose.Types.ObjectId).toString(),
      role: user.role,
      sessionId,
      email: user.email,
      companyName: tenant.name,
      isDemo: true,
    };

    const token = this.generateDemoToken(tokenPayload, jwtSigner);

    // Build Watermark Attribution Object
    const dateFormatted = new Date().toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).toUpperCase();

    const shortSessionId = sessionId.split("-")[0].toUpperCase();
    const watermarkText = `${tenant.name.toUpperCase()} | ${user.fullName.toUpperCase()} | DEMO | SESSION: ${tenant.slug.toUpperCase()}-${shortSessionId} | ${dateFormatted}`;

    // Log Activity
    await DemoActivityLog.create({
      demoTenantId: tenant._id,
      demoUserId: user._id,
      action: "LOGIN",
      category: "AUTH",
      description: `Demo user ${user.fullName} (${user.email}) logged in successfully`,
      endpoint: "/api/v1/demo/auth/login",
      ipAddress,
      userAgent,
      severity: riskStatus === "SUSPICIOUS" ? "warning" : "info",
      metadata: { sessionId, riskStatus, suspiciousReason },
    });

    return {
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        department: user.department,
        jobTitle: user.jobTitle,
        expiresAt: user.expiresAt,
      },
      tenant: {
        id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        entitlementPackage: tenant.entitlementPackage,
        allowedFeatures: tenant.allowedFeatures,
        expiresAt: tenant.expiresAt,
      },
      session: {
        sessionId,
        expiresAt: sessionExpiresAt,
        riskStatus,
      },
      watermark: {
        text: watermarkText,
        companyName: tenant.name,
        userName: user.fullName,
        sessionId: shortSessionId,
        date: dateFormatted,
      },
    };
  }

  /**
   * Logs out a demo user by invalidating their active session.
   */
  public async logout(sessionId: string, userId?: string, tenantId?: string) {
    const DemoSession = getDemoSessionModel();
    const DemoActivityLog = getDemoActivityLogModel();

    await DemoSession.updateOne(
      { sessionId },
      { isValid: false, suspiciousReason: "User logged out explicitly" }
    );

    if (userId && tenantId) {
      await DemoActivityLog.create({
        demoTenantId: new mongoose.Types.ObjectId(tenantId),
        demoUserId: new mongoose.Types.ObjectId(userId),
        action: "LOGOUT",
        category: "AUTH",
        description: "Demo user explicitly logged out",
        severity: "info",
        metadata: { sessionId },
      });
    }

    return { success: true, message: "Logged out successfully" };
  }
}

export const demoAuthService = new DemoAuthService();
export default demoAuthService;
