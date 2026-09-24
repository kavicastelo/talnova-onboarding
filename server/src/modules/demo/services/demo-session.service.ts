import mongoose from "mongoose";
import AppError from "../../../common/errors/app-error.js";
import { demoConfig } from "../../../config/index.js";
import {
  getDemoSessionModel,
  getDemoUserModel,
  getDemoRiskAlertModel,
  getDemoActivityLogModel,
} from "../models/index.js";

export class DemoSessionService {
  /**
   * Validates a session against expiration, validity, and inactivity timeouts.
   */
  public async validateSession(sessionId: string, currentIp?: string) {
    const DemoSession = getDemoSessionModel();
    const DemoActivityLog = getDemoActivityLogModel();
    const DemoRiskAlert = getDemoRiskAlertModel();

    const session = await DemoSession.findOne({ sessionId });
    if (!session) {
      throw new AppError(401, "UNAUTHORIZED", "Invalid demo session.");
    }

    if (!session.isValid) {
      throw new AppError(
        401,
        "SESSION_REVOKED",
        session.suspiciousReason || "Demo session has been invalidated or terminated."
      );
    }

    if (session.expiresAt < new Date()) {
      await DemoSession.updateOne({ _id: session._id }, { isValid: false, suspiciousReason: "Session expired" });
      throw new AppError(401, "SESSION_EXPIRED", "Demo session has expired. Please log in again.");
    }

    // Inactivity timeout verification (default 15 minutes)
    const inactivityLimitMs = demoConfig.inactivityTimeoutMinutes * 60 * 1000;
    const idleDurationMs = Date.now() - new Date(session.lastActivityAt).getTime();

    if (idleDurationMs > inactivityLimitMs) {
      await DemoSession.updateOne(
        { _id: session._id },
        { isValid: false, suspiciousReason: `Terminated due to ${demoConfig.inactivityTimeoutMinutes}m of inactivity` }
      );
      throw new AppError(
        401,
        "SESSION_IDLE_TIMEOUT",
        `Session expired due to ${demoConfig.inactivityTimeoutMinutes} minutes of inactivity.`
      );
    }

    // Rapid IP change detection during active session
    if (currentIp && session.ipAddress && session.ipAddress !== currentIp) {
      session.riskStatus = "HIGH_RISK";
      session.suspiciousReason = `Sudden IP shift detected: ${session.ipAddress} -> ${currentIp}`;
      await DemoSession.updateOne(
        { _id: session._id },
        { riskStatus: "HIGH_RISK", suspiciousReason: session.suspiciousReason }
      );

      await DemoRiskAlert.create({
        demoTenantId: session.demoTenantId,
        demoUserId: session.demoUserId,
        alertType: "RAPID_IP_CHANGE",
        severity: "HIGH",
        status: "OPEN",
        signals: [
          `Active session IP changed from ${session.ipAddress} to ${currentIp}`,
          `Session ID: ${session.sessionId}`,
        ],
        details: {
          previousIp: session.ipAddress,
          newIp: currentIp,
          timestamp: new Date(),
        },
      });

      await DemoActivityLog.create({
        demoTenantId: session.demoTenantId,
        demoUserId: session.demoUserId,
        action: "SUSPICIOUS_IP_SHIFT",
        category: "SECURITY",
        description: `Rapid IP change detected during session ${session.sessionId}: ${session.ipAddress} -> ${currentIp}`,
        severity: "warning",
      });
    }

    // Update last activity timestamp
    await DemoSession.updateOne({ _id: session._id }, { lastActivityAt: new Date() });

    return session;
  }

  /**
   * Terminates an active demo session immediately.
   */
  public async terminateSession(sessionId: string, terminatedBy: string = "Super Admin") {
    const DemoSession = getDemoSessionModel();
    const DemoActivityLog = getDemoActivityLogModel();

    const session = await DemoSession.findOneAndUpdate(
      { sessionId },
      { isValid: false, suspiciousReason: `Terminated by ${terminatedBy}` },
      { new: true }
    );

    if (!session) {
      throw new AppError(404, "SESSION_NOT_FOUND", "Demo session not found.");
    }

    await DemoActivityLog.create({
      demoTenantId: session.demoTenantId,
      demoUserId: session.demoUserId,
      action: "SESSION_TERMINATED",
      category: "SECURITY",
      description: `Demo session ${sessionId} forcibly terminated by ${terminatedBy}`,
      severity: "warning",
      metadata: { sessionId, terminatedBy },
    });

    return { success: true, message: `Session ${sessionId} has been terminated.` };
  }

  /**
   * Lists all active demo sessions with rich attribution metadata.
   */
  public async listActiveSessions(demoTenantId?: string) {
    const DemoSession = getDemoSessionModel();
    const DemoUser = getDemoUserModel();

    const query: any = {
      isValid: true,
      expiresAt: { $gt: new Date() },
    };

    if (demoTenantId) {
      query.demoTenantId = new mongoose.Types.ObjectId(demoTenantId);
    }

    const sessions = await DemoSession.find(query).sort({ lastActivityAt: -1 }).lean();

    const userIds = sessions.map((s) => s.demoUserId);
    const users = await DemoUser.find({ _id: { $in: userIds } }).lean();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    return sessions.map((s) => {
      const user = userMap.get(s.demoUserId.toString());
      return {
        ...s,
        userName: user?.fullName || "Unknown Demo User",
        userEmail: user?.email || "unknown@demo.com",
        userRole: user?.role || "demo_employee",
      };
    });
  }

  /**
   * Retrieves security and risk alerts.
   */
  public async getRiskAlerts(status?: string) {
    const DemoRiskAlert = getDemoRiskAlertModel();
    const DemoUser = getDemoUserModel();

    const query: any = {};
    if (status && status !== "ALL") {
      query.status = status;
    }

    const alerts = await DemoRiskAlert.find(query).sort({ createdAt: -1 }).lean();

    const userIds = alerts.map((a) => a.demoUserId).filter(Boolean);
    const users = await DemoUser.find({ _id: { $in: userIds } }).lean();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    return alerts.map((a) => {
      const user = a.demoUserId ? userMap.get(a.demoUserId.toString()) : undefined;
      return {
        ...a,
        userEmail: user?.email,
        userName: user?.fullName,
      };
    });
  }

  /**
   * Resolves or acknowledges a risk alert.
   */
  public async resolveRiskAlert(alertId: string, resolvedBy: string, resolutionNotes?: string) {
    const DemoRiskAlert = getDemoRiskAlertModel();
    const alert = await DemoRiskAlert.findByIdAndUpdate(
      alertId,
      {
        status: "RESOLVED",
        resolvedBy,
        resolvedAt: new Date(),
        resolutionNotes,
      },
      { new: true }
    );

    if (!alert) {
      throw new AppError(404, "ALERT_NOT_FOUND", "Demo risk alert not found.");
    }

    return alert;
  }
}

export const demoSessionService = new DemoSessionService();
export default demoSessionService;
