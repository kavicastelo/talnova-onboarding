import { FastifyReply, FastifyRequest } from "fastify";
import mongoose from "mongoose";
import crypto from "crypto";
import { KioskService } from "../services/kiosk.service.js";
import AppError from "../../../common/errors/app-error.js";
import { KioskJourneyModel } from "../models/kiosk-journey.model.js";
import { KioskSessionModel } from "../models/kiosk-session.model.js";
import { KioskDeviceModel } from "../models/kiosk-device.model.js";
import { FeatureTelemetryService } from "../../super-admin/services/feature-telemetry.service.js";
import kioskEmergencyStream from "../services/kiosk-emergency-stream.js";
import { kioskSyntheticProbeService } from "../services/kiosk-synthetic-probe.service.js";

export class KioskController {
  constructor(private readonly kioskService: KioskService) {}

  private async resolveAuthenticatedUser(request: FastifyRequest): Promise<any> {
    let user = request.user as any;
    const authHeader = request.headers.authorization;
    if (!user && authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      try {
        await request.jwtVerify();
        user = request.user;
      } catch (err: any) {
        if (err instanceof AppError) {
          throw err;
        }
        const isExpired =
          err.code === "FST_JWT_AUTHORIZATION_TOKEN_EXPIRED" ||
          err.name === "TokenExpiredError" ||
          err.message?.toLowerCase().includes("expired");
        throw new AppError(
          401,
          isExpired ? "TOKEN_EXPIRED" : "UNAUTHORIZED",
          isExpired ? "Authentication token has expired" : "Invalid token signature"
        );
      }
    }

    if (user && user.role === "kiosk_device" && user.deviceId) {
      const rawToken = authHeader ? authHeader.replace(/^Bearer\s+/i, "").trim() : "";
      if (rawToken) {
        const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
        const device = await KioskDeviceModel.findOne({
          deviceId: user.deviceId,
          organizationId: user.organizationId,
          isDeleted: false,
          paired: { $ne: false },
          status: { $nin: ["decommissioned", "suspended", "revoked"] }
        });
        if (!device || (device.tokenRef && device.tokenRef !== hash)) {
          throw new AppError(401, "DEVICE_REVOKED", "Device credentials have been revoked or invalidated.");
        }
      }
    }

    return user;
  }

  // --- Journey CRUD & Lifecycle ---

  createJourney = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const journey = await this.kioskService.createJourney(user.organizationId, request.body, user.userId);
    return reply.status(201).send({
      success: true,
      message: "Kiosk journey created successfully",
      data: journey
    });
  };

  updateJourney = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const journey = await this.kioskService.updateJourney(params.id, user.organizationId, request.body, user.userId);
    return reply.status(200).send({
      success: true,
      message: "Kiosk journey updated successfully",
      data: journey
    });
  };

  getJourney = async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = request.kioskContext?.organizationId || (request.user as any)?.organizationId;
    if (!orgId) {
      throw new AppError(401, "UNAUTHORIZED", "Organization context missing");
    }
    const params = request.params as any;
    const journey = await this.kioskService.getJourney(params.id, orgId);

    // Instrument feature telemetry (fire-and-forget)
    FeatureTelemetryService.recordUsage({
      featureKey: "kiosk_mode",
      organizationId: orgId,
      userId: (request.user as any)?.userId,
      userRole: (request.user as any)?.role || "frontline_worker_kiosk",
      actionName: "PLAY_KIOSK_JOURNEY",
      metadata: { journeyId: params.id },
    }).catch(() => {});

    return reply.status(200).send({
      success: true,
      message: "Kiosk journey retrieved successfully",
      data: journey
    });
  };

  getSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await this.resolveAuthenticatedUser(request);
    const orgId = user?.organizationId || request.kioskContext?.organizationId || (request.query as any)?.organizationId;
    const params = request.params as any;

    let session: any = null;
    const isObjectId = mongoose.Types.ObjectId.isValid(params.id);
    try {
      const query: Record<string, any> = isObjectId
        ? { _id: new mongoose.Types.ObjectId(params.id) }
        : { sessionToken: params.id };

      if (orgId) {
        query.organizationId = new mongoose.Types.ObjectId(orgId.toString());
      }
      session = await KioskSessionModel.findOne(query);

      // Fallback: Check KioskAnalytics legacy session store if not found
      if (!session) {
        session = await mongoose.model("KioskAnalytics").findOne({
          sessionId: params.id,
          ...(orgId ? { organizationId: orgId } : {}),
        });
      }
    } catch {
      // ignore
    }

    if (!session && orgId && isObjectId) {
      const foreignSession = await KioskSessionModel.findById(params.id);
      if (foreignSession && foreignSession.organizationId.toString() !== orgId.toString()) {
        throw new AppError(403, "TENANT_MISMATCH", "Cannot access session belonging to another organization");
      }
    }

    const resolvedOrgId = orgId || session?.organizationId;
    if (resolvedOrgId) {
      await FeatureTelemetryService.recordUsage({
        featureKey: "kiosk_mode",
        organizationId: resolvedOrgId,
        userId: user?.userId,
        userRole: user?.role || "frontline_worker_kiosk",
        actionName: "GET_KIOSK_SESSION",
        metadata: { sessionId: params.id },
      }).catch(() => {});
    }

    return reply.status(200).send({
      success: true,
      message: "Kiosk session retrieved successfully",
      data: session || { sessionId: params.id, status: "active" },
    });
  };

  createSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await this.resolveAuthenticatedUser(request);
    const body = request.body as any;
    const session = await this.kioskService.createSession(body, user);

    return reply.status(201).send({
      success: true,
      message: "Kiosk session created successfully",
      data: session
    });
  };

  updateSessionProgress = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await this.resolveAuthenticatedUser(request);
    const params = request.params as any;
    const body = request.body as any;
    const orgId = user?.organizationId || request.kioskContext?.organizationId;

    const session = await this.kioskService.updateSessionProgress(params.id, body, orgId);

    return reply.status(200).send({
      success: true,
      message: "Kiosk session progress updated successfully",
      data: session
    });
  };

  completeSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await this.resolveAuthenticatedUser(request);
    const params = request.params as any;
    const body = (request.body || {}) as any;
    const orgId = user?.organizationId || request.kioskContext?.organizationId;

    const session = await this.kioskService.completeSession(params.id, body, orgId);

    return reply.status(200).send({
      success: true,
      message: "Kiosk session completed successfully",
      data: session
    });
  };

  abortSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await this.resolveAuthenticatedUser(request);
    const params = request.params as any;
    const body = (request.body || {}) as any;
    const orgId = user?.organizationId || request.kioskContext?.organizationId;

    const session = await this.kioskService.abortSession(params.id, body, orgId);

    return reply.status(200).send({
      success: true,
      message: "Kiosk session aborted successfully",
      data: session
    });
  };

  timeoutSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await this.resolveAuthenticatedUser(request);
    const params = request.params as any;
    const body = (request.body || {}) as any;
    const orgId = user?.organizationId || request.kioskContext?.organizationId;

    const session = await this.kioskService.timeoutSession(params.id, body, orgId);

    return reply.status(200).send({
      success: true,
      message: "Kiosk session timed out successfully",
      data: session
    });
  };

  listJourneys = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const query = request.query as any;

    const filter = {
      organizationId: user.organizationId,
      status: query.status,
      search: query.search
    };

    const pagination = {
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder
    };

    const result = await this.kioskService.listJourneys(filter, pagination);
    return reply.status(200).send({
      success: true,
      message: "Kiosk journeys listed successfully",
      data: result.journeys,
      meta: {
        total: result.total,
        page: pagination.page,
        limit: pagination.limit
      }
    });
  };

  deleteJourney = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    await this.kioskService.deleteJourney(params.id, user.organizationId, user.userId);
    return reply.status(200).send({
      success: true,
      message: "Kiosk journey deleted successfully",
      data: null
    });
  };

  validateJourney = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const report = await this.kioskService.validateJourneyForPublish(params.id, user.organizationId);
    return reply.status(200).send({
      success: true,
      message: report.isValid ? "Journey passed pre-publish validation" : "Journey has pre-publish validation errors",
      data: report
    });
  };

  publishJourney = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = (request.body as any) || {};
    const journey = await this.kioskService.publishJourney(
      params.id,
      user.organizationId,
      user.userId,
      body.changelog,
      body.scheduling
    );
    return reply.status(200).send({
      success: true,
      message:
        journey.publishing?.status === "scheduled"
          ? "Kiosk journey scheduled for publication"
          : "Kiosk journey published successfully",
      data: journey
    });
  };

  unpublishJourney = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const journey = await this.kioskService.unpublishJourney(
      params.id,
      user.organizationId,
      user.userId
    );
    return reply.status(200).send({
      success: true,
      message: "Kiosk journey unpublished successfully and reverted to draft",
      data: journey
    });
  };

  rollbackJourney = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const targetVersion = parseInt(params.version, 10);
    if (isNaN(targetVersion) || targetVersion < 1) {
      throw new AppError(400, "BAD_REQUEST", "Valid target version number is required for rollback");
    }
    const journey = await this.kioskService.rollbackJourney(
      params.id,
      user.organizationId,
      targetVersion,
      user.userId
    );
    return reply.status(200).send({
      success: true,
      message: `Kiosk journey rolled back to version ${targetVersion} successfully`,
      data: journey
    });
  };

  listJourneyVersions = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const versions = await this.kioskService.listJourneyVersions(params.id, user.organizationId);
    return reply.status(200).send({
      success: true,
      message: "Kiosk journey versions retrieved successfully",
      data: versions
    });
  };

  getJourneyVersion = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const versionNum = parseInt(params.version, 10);
    if (isNaN(versionNum) || versionNum < 1) {
      throw new AppError(400, "BAD_REQUEST", "Valid version number is required");
    }
    const version = await this.kioskService.getJourneyVersion(
      params.id,
      user.organizationId,
      versionNum
    );
    return reply.status(200).send({
      success: true,
      message: "Kiosk journey version retrieved successfully",
      data: version
    });
  };

  getDeviceManifest = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const query = (request.query || {}) as any;
    const headers = request.headers as any;
    const deviceIdentifier = (params.deviceId || (params.id && params.id !== "me"))
      ? (params.deviceId || params.id)
      : user?.deviceId;

    if (!deviceIdentifier) {
      throw new AppError(400, "BAD_REQUEST", "Device identifier is required");
    }

    const orgId = user?.organizationId || request.kioskContext?.organizationId;
    if (!orgId) {
      throw new AppError(401, "UNAUTHORIZED", "Organization context missing");
    }

    // Check for explicit cross-tenant request via query or header
    const requestedOrgId = query?.organizationId || query?.o || headers["x-organization-id"];
    if (requestedOrgId && requestedOrgId.toString() !== orgId.toString()) {
      throw new AppError(
        403,
        "TENANT_MISMATCH",
        "Cross-tenant access forbidden. Target organization does not match authenticated tenant."
      );
    }

    const refDate = query?.now ? new Date(query.now) : new Date();
    const manifest = await this.kioskService.getDeviceManifest(
      deviceIdentifier,
      orgId,
      refDate,
      user
    );

    return reply.status(200).send({
      success: true,
      message: "Device manifest retrieved successfully",
      data: manifest
    });
  };

  triggerScheduledPublishing = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body as any) || {};
    const refDate = body.now ? new Date(body.now) : new Date();
    const result = await this.kioskService.processScheduledPublishing(refDate);
    return reply.status(200).send({
      success: true,
      message: "Scheduled publishing processed successfully",
      data: result
    });
  };

  // --- Device Management ---

  generatePairingCode = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = (request.body || {}) as any;

    const userId = user?.userId || user?.id || user?._id;
    const deviceId = typeof body?.deviceId === "string" && body.deviceId.trim() ? body.deviceId.trim() : undefined;
    const { code, expiresInSeconds } = await this.kioskService.generatePairingCode(user.organizationId, deviceId, userId);
    return reply.status(200).send({
      success: true,
      message: "Device pairing code generated successfully",
      code,
      expiresInSeconds,
      data: { code, expiresInSeconds }
    });
  };

  pairDevice = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;

    if (!body?.code || !body?.deviceId || !body?.name || !body?.location) {
      throw new AppError(400, "BAD_REQUEST", "Missing required pairing parameters (code, deviceId, name, location)");
    }

    const pairedByUserId = user?.userId || user?.id || user?._id || body.pairedBy;
    const result = await this.kioskService.pairDevice(body.code, body.deviceId, body.name, body.location, pairedByUserId);
    return reply.status(200).send({
      success: true,
      message: "Device paired successfully",
      deviceToken: result.token,
      device: {
        id: result.device._id.toString(),
        _id: result.device._id.toString(),
        name: result.device.name,
        deviceId: result.device.deviceId,
        hardwareGuid: (result.device as any).hardwareGuid || result.device.deviceId,
        location: result.device.location,
        status: result.device.status,
        paired: (result.device as any).paired ?? true
      },
      data: {
        deviceToken: result.token,
        token: result.token,
        device: result.device
      }
    });
  };

  enrollMdmDevice = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body as any) || {};
    const deviceId = body.deviceId || body.deviceHardwareId;

    if (!body.organizationSlug || !body.enrollmentSecret || !deviceId) {
      throw new AppError(
        400,
        "BAD_REQUEST",
        "Missing required MDM enrollment parameters (organizationSlug, enrollmentSecret, deviceId/deviceHardwareId)"
      );
    }

    const result = await this.kioskService.enrollMdmDevice({
      organizationSlug: body.organizationSlug,
      enrollmentSecret: body.enrollmentSecret,
      deviceId,
      name: body.name || body.deviceName,
      location: body.location || body.siteId,
      deviceModel: body.deviceModel,
      osVersion: body.osVersion,
      appVersion: body.appVersion,
    });

    return reply.status(200).send({
      success: true,
      message: "Device successfully enrolled via MDM AppConfig",
      deviceToken: result.token,
      token: result.token,
      device: {
        id: result.device._id.toString(),
        _id: result.device._id.toString(),
        name: result.device.name,
        deviceId: result.device.deviceId,
        hardwareGuid: (result.device as any).hardwareGuid || result.device.deviceId,
        location: result.device.location,
        status: result.device.status,
        paired: true,
      },
      data: {
        deviceToken: result.token,
        token: result.token,
        device: result.device,
        enrolled: true,
      },
    });
  };

  refreshDeviceToken = async (request: FastifyRequest, reply: FastifyReply) => {
    const devicePayload = request.user as any;
    const authHeader = request.headers.authorization;
    const currentToken = authHeader ? authHeader.replace(/^Bearer\s+/i, "") : "";

    const result = await this.kioskService.refreshDeviceToken(
      devicePayload.deviceId,
      devicePayload.organizationId,
      currentToken
    );

    return reply.status(200).send({
      success: true,
      message: "Device token refreshed successfully",
      deviceToken: result.token,
      token: result.token,
      device: {
        id: result.device._id.toString(),
        _id: result.device._id.toString(),
        name: result.device.name,
        deviceId: result.device.deviceId,
        hardwareGuid: (result.device as any).hardwareGuid || result.device.deviceId,
        location: result.device.location,
        status: result.device.status,
        paired: (result.device as any).paired ?? true
      },
      data: {
        deviceToken: result.token,
        token: result.token,
        device: result.device
      }
    });
  };

  heartbeat = async (request: FastifyRequest, reply: FastifyReply) => {
    const devicePayload = request.user as any;
    const body = (request.body || {}) as any;
    const query = (request.query || {}) as any;
    const headers = request.headers as any;

    const authOrgId = devicePayload?.organizationId || request.kioskContext?.organizationId;
    if (!authOrgId) {
      throw new AppError(401, "UNAUTHORIZED", "Organization context missing");
    }

    const requestedOrgId = body.organizationId || query.organizationId || query.o || headers["x-organization-id"];
    if (requestedOrgId && requestedOrgId.toString() !== authOrgId.toString()) {
      throw new AppError(
        403,
        "TENANT_MISMATCH",
        "Cross-tenant access forbidden. Target organization does not match authenticated device tenant."
      );
    }

    const rawBattery = body.batteryLevel !== undefined ? body.batteryLevel : body.telemetry?.batteryLevel;
    const telemetry = {
      ...(body.telemetry || {}),
      batteryLevel: rawBattery,
      appVersion: body.appVersion || body.telemetry?.appVersion,
      isCharging: body.isCharging !== undefined ? body.isCharging : body.telemetry?.isCharging,
      networkLatencyMs: body.networkLatencyMs !== undefined ? body.networkLatencyMs : body.telemetry?.networkLatencyMs,
      storageUsedBytes: body.storageUsedBytes !== undefined ? body.storageUsedBytes : body.telemetry?.storageUsedBytes,
      storageFreeBytes: body.storageFreeBytes !== undefined ? body.storageFreeBytes : body.telemetry?.storageFreeBytes,
      storageTotalBytes: body.storageTotalBytes !== undefined ? body.storageTotalBytes : body.telemetry?.storageTotalBytes,
      screenResolution: body.screenResolution || body.telemetry?.screenResolution,
      orientation: body.orientation || body.screenOrientation || body.telemetry?.orientation || body.telemetry?.screenOrientation
    };

    const result = await this.kioskService.heartbeat(
      devicePayload.deviceId,
      authOrgId,
      body.currentContentVersion || body.contentVersion || 0,
      telemetry
    );

    const activeEmergency = await this.kioskService.getActiveEmergency(authOrgId);

    const updatedDevice = (result as any).device || result;
    const commands = (result as any).commands || [];

    const updatedObj = typeof updatedDevice === "object" && updatedDevice !== null
      ? (typeof (updatedDevice as any).toObject === "function" ? (updatedDevice as any).toObject() : updatedDevice)
      : { device: updatedDevice };

    const serverTime = (result as any).serverTime || Date.now();

    const responsePayload: any = {
      success: true,
      status: "ok",
      serverTime,
      message: "Heartbeat logged successfully",
      data: {
        ...updatedObj,
        commands,
        serverTime,
        ...(activeEmergency ? { activeEmergency, emergencyActive: true } : {})
      },
      commands,
      ...(activeEmergency ? { activeEmergency, emergencyActive: true } : { activeEmergency: null, emergencyActive: false })
    };

    return reply.status(200).send(responsePayload);
  };

  queueCommand = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = (request.body || {}) as any;

    const deviceId = params.id || params.deviceId;
    const orgId = user?.organizationId || request.kioskContext?.organizationId;
    if (!orgId) {
      throw new AppError(401, "UNAUTHORIZED", "Organization context missing");
    }

    const command = await this.kioskService.queueCommand(deviceId, orgId, body);

    return reply.status(201).send({
      success: true,
      message: "Command queued successfully",
      data: command,
      command
    });
  };

  listDevices = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const query = request.query as any;

    const filter = {
      organizationId: user.organizationId,
      status: query.status
    };

    const pagination = {
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder
    };

    const result = await this.kioskService.listDevices(filter, pagination);
    return reply.status(200).send({
      success: true,
      message: "Kiosk devices listed successfully",
      data: result.devices,
      meta: {
        total: result.total,
        page: pagination.page,
        limit: pagination.limit
      }
    });
  };

  pairJourneyToDevice = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = request.body as any;

    const updated = await this.kioskService.pairJourneyToDevice(
      params.id,
      user.organizationId,
      body.journeyId || null
    );

    return reply.status(200).send({
      success: true,
      message: "Journey paired to device successfully",
      data: updated
    });
  };

  setDeviceAssignments = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    const assignments = await this.kioskService.setDeviceAssignments(
      params.id,
      user.organizationId,
      user.userId,
      request.body
    );

    return reply.status(200).send({
      success: true,
      message: "Device assignments updated successfully",
      data: assignments
    });
  };

  getDeviceAssignments = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    const assignments = await this.kioskService.getDeviceAssignments(
      params.id,
      user.organizationId
    );

    return reply.status(200).send({
      success: true,
      message: "Device assignments retrieved successfully",
      data: assignments
    });
  };


  revokeDevice = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = (request.body as any) || {};
    const query = (request.query as any) || {};
    const reason = body.reason || query.reason;

    const device = await this.kioskService.revokeDevice(
      params.id,
      user.organizationId,
      user.userId || user.id || user._id,
      reason
    );

    return reply.status(200).send({
      success: true,
      message: "Device enrollment revoked and decommissioned successfully",
      data: device
    });
  };

  // --- Player & Security API ---

  validatePIN = async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const body = request.body as any;

    if (!body?.pinCode) {
      throw new AppError(400, "BAD_REQUEST", "pinCode is required for verification");
    }

    const journey = await KioskJourneyModel.findById(params.id);
    if (!journey) {
      throw new AppError(404, "NOT_FOUND", "Kiosk journey not found");
    }

    const success = journey.settings.security.pinCode === body.pinCode;
    return reply.status(200).send({
      success,
      message: success ? "PIN code validated successfully" : "Invalid PIN code supplied"
    });
  };

  syncAnalytics = async (request: FastifyRequest, reply: FastifyReply) => {
    const userPayload = request.user as any;
    const body = (request.body || {}) as any;
    const query = (request.query || {}) as any;
    const headers = request.headers as any;

    const items = Array.isArray(body)
      ? body
      : (body?.events || body?.sessions || body?.completedSessions);
    if (!Array.isArray(items) || items.length === 0) {
      throw new AppError(400, "BAD_REQUEST", "events or sessions must be a non-empty array");
    }

    const orgId = userPayload?.organizationId || request.kioskContext?.organizationId;
    if (!orgId) {
      throw new AppError(401, "UNAUTHORIZED", "Organization context missing");
    }

    // Check for explicit cross-tenant request via body, query, or header
    const requestedOrgId = (!Array.isArray(body) && body.organizationId) || query.organizationId || query.o || headers["x-organization-id"];
    if (requestedOrgId && requestedOrgId.toString() !== orgId.toString()) {
      throw new AppError(
        403,
        "TENANT_MISMATCH",
        "Cross-tenant access forbidden. Target organization does not match authenticated device tenant."
      );
    }

    const result = await this.kioskService.syncAnalytics(orgId, body, userPayload?.deviceId);
    const syncedCount = result.syncedCount ?? (Array.isArray(result) ? result.length : 0);
    const duplicateCount = result.duplicateCount ?? 0;
    const failedCount = result.failedCount ?? 0;

    return reply.status(200).send({
      success: true,
      message: "Analytics synced successfully",
      syncedCount,
      duplicateCount,
      failedCount,
      data: {
        syncedCount,
        duplicateCount,
        failedCount,
        items: result.sessions || result.items || (Array.isArray(result) ? result : [])
      }
    });
  };

  getJourneyAnalyticsSummary = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const query = request.query as any;

    const summary = await this.kioskService.getJourneyAnalyticsSummary(
      params.id,
      user.organizationId,
      query.startDate,
      query.endDate
    );

    return reply.status(200).send({
      success: true,
      message: "Journey analytics summary retrieved successfully",
      data: summary
    });
  };

  getStepDropOffFunnel = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const query = request.query as any;

    const funnel = await this.kioskService.getJourneyDropOffFunnel(
      params.id,
      user.organizationId,
      query.startDate,
      query.endDate
    );

    return reply.status(200).send({
      success: true,
      message: "Step funnel drop-off analytics retrieved successfully",
      data: funnel
    });
  };

  identifyFrontlineWorker = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body as any) || {};
    let orgId = body.organizationId || (request.user as any)?.organizationId || (request.headers["x-organization-id"] as string);
    const identifier = body.identifier || body.badgeId || body.nationalId || body.employeeId || body.email;

    if (!orgId && body.kioskDeviceId) {
      const dev = await this.kioskService.getDeviceRepo().findById(body.kioskDeviceId);
      if (dev?.organizationId) {
        orgId = dev.organizationId.toString();
      }
    }

    if (!orgId && identifier) {
      const isHex = typeof identifier === "string" && /^[0-9a-fA-F]{24}$/.test(identifier);
      const candidate = await mongoose.model("User").findOne({
        $or: [
          { "employment.badgeId": identifier },
          { "employment.employeeId": identifier },
          { "employment.nationalId": identifier },
          { "auth.email": identifier.toLowerCase() },
          ...(isHex ? [{ _id: new mongoose.Types.ObjectId(identifier) }] : []),
        ],
        isDeleted: false,
      });
      if (candidate?.organizationId) {
        orgId = candidate.organizationId.toString();
      }
    }

    if (!orgId) {
      if (identifier) {
        throw new AppError(404, "WORKER_NOT_FOUND", "No frontline worker record found matching the provided badge or identity number.");
      }
      throw new AppError(400, "BAD_REQUEST", "organizationId is required for frontline worker identification");
    }

    const result = await this.kioskService.identifyFrontlineWorker(
      orgId,
      identifier,
      body.kioskDeviceId
    );

    return reply.status(200).send({
      success: true,
      message: "Frontline worker identified successfully",
      data: result,
    });
  };

  verifySupervisorPin = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body as any) || {};
    let orgId = body.organizationId || (request.user as any)?.organizationId || (request.headers["x-organization-id"] as string);
    const supId = body.supervisorIdentifier || body.supervisorId || body.email || body.employeeId || body.badgeId;
    const sessionId = body.sessionId;

    if (!orgId && sessionId) {
      const isHexSess = typeof sessionId === "string" && /^[0-9a-fA-F]{24}$/.test(sessionId);
      const sess = await mongoose.model("KioskSession").findOne(
        isHexSess ? { _id: new mongoose.Types.ObjectId(sessionId) } : { sessionToken: sessionId }
      );
      if (sess?.organizationId) {
        orgId = sess.organizationId.toString();
      }
    }

    if (!orgId && supId) {
      const isHexSup = typeof supId === "string" && /^[0-9a-fA-F]{24}$/.test(supId);
      const candidate = await mongoose.model("User").findOne({
        $or: [
          { "employment.badgeId": supId },
          { "auth.email": supId.toLowerCase() },
          ...(isHexSup ? [{ _id: new mongoose.Types.ObjectId(supId) }] : []),
        ],
        isDeleted: false,
      });
      if (candidate?.organizationId) {
        orgId = candidate.organizationId.toString();
      }
    }

    if (!orgId) {
      throw new AppError(400, "BAD_REQUEST", "organizationId is required for supervisor authorization");
    }

    const result = await this.kioskService.verifySupervisorPin(
      orgId,
      supId,
      body.pin,
      sessionId
    );

    return reply.status(200).send({
      success: true,
      message: "Supervisor PIN verified successfully",
      verified: result.verified,
      witnessToken: result.witnessToken,
      supervisor: result.supervisor,
      session: result.session,
      data: result,
    });
  };

  setSupervisorPin = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = (request.body as any) || {};
    const targetUserId = (body.supervisorId || body.supervisorIdentifier || user?.userId || "").trim();
    const orgId = user?.organizationId || (request.headers["x-organization-id"] as string);

    const result = await this.kioskService.setSupervisorPin(
      orgId,
      targetUserId,
      body.pin
    );

    return reply.status(200).send({
      success: true,
      message: "Supervisor PIN set successfully",
      data: result,
    });
  };

  updateDevice = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = (request.body || {}) as any;

    const deviceId = params.id || params.deviceId;
    const orgId = user?.organizationId || request.kioskContext?.organizationId;
    if (!orgId) {
      throw new AppError(401, "UNAUTHORIZED", "Organization context missing");
    }

    const device = await this.kioskService.updateDevice(deviceId, orgId, body);
    return reply.status(200).send({
      success: true,
      message: "Device updated successfully",
      data: device
    });
  };

  toggleMaintenanceMode = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = (request.body as any) || {};
    const isMaintenance = body.maintenance !== undefined ? Boolean(body.maintenance) : true;

    const device = await this.kioskService.setDeviceMaintenanceMode(
      params.id,
      user.organizationId,
      isMaintenance
    );

    return reply.status(200).send({
      success: true,
      message: `Kiosk device maintenance mode ${isMaintenance ? "activated" : "deactivated"}`,
      data: device,
    });
  };

  triggerFleetHealthSentinel = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = (request.body as any) || {};
    const result = await this.kioskService.scanKioskFleetHealth(user?.organizationId, body);

    return reply.status(200).send({
      success: true,
      message: "Kiosk fleet health sentinel scan completed",
      data: result,
    });
  };

  // --- Device Group Management (K-ASN-003) ---

  getDeviceGroups = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const query = (request.query as any) || {};

    const groups = await this.kioskService.getDeviceGroups(user.organizationId, {
      siteId: query.siteId,
      search: query.search
    });

    return reply.status(200).send({
      success: true,
      message: "Device groups retrieved successfully",
      data: groups
    });
  };

  getDeviceGroupById = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    const group = await this.kioskService.getDeviceGroupById(
      params.id,
      user.organizationId
    );

    return reply.status(200).send({
      success: true,
      message: "Device group retrieved successfully",
      data: group
    });
  };

  createDeviceGroup = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;

    const group = await this.kioskService.createDeviceGroup(
      user.organizationId,
      user.userId,
      request.body
    );

    return reply.status(201).send({
      success: true,
      message: "Device group created successfully",
      data: group
    });
  };

  updateDeviceGroup = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    const group = await this.kioskService.updateDeviceGroup(
      params.id,
      user.organizationId,
      request.body
    );

    return reply.status(200).send({
      success: true,
      message: "Device group updated successfully",
      data: group
    });
  };

  deleteDeviceGroup = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    await this.kioskService.deleteDeviceGroup(
      params.id,
      user.organizationId
    );

    return reply.status(200).send({
      success: true,
      message: "Device group deleted successfully",
      data: { id: params.id }
    });
  };

  getGroupAssignments = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    const assignments = await this.kioskService.getGroupAssignments(
      params.id,
      user.organizationId
    );

    return reply.status(200).send({
      success: true,
      message: "Group assignments retrieved successfully",
      data: assignments
    });
  };

  setGroupAssignments = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    const assignments = await this.kioskService.setGroupAssignments(
      params.id,
      user.organizationId,
      user.userId,
      request.body
    );

    return reply.status(200).send({
      success: true,
      message: "Group assignments updated successfully",
      data: assignments
    });
  };

  getDeviceCommands = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const query = (request.query || {}) as any;
    const headers = request.headers as any;

    const deviceIdentifier = (params.deviceId || (params.id && params.id !== "me"))
      ? (params.deviceId || params.id)
      : user?.deviceId;

    if (!deviceIdentifier) {
      throw new AppError(400, "BAD_REQUEST", "Device identifier is required");
    }

    const orgId = user?.organizationId || request.kioskContext?.organizationId;
    if (!orgId) {
      throw new AppError(401, "UNAUTHORIZED", "Organization context missing");
    }

    const requestedOrgId = query?.organizationId || query?.o || headers["x-organization-id"];
    if (requestedOrgId && requestedOrgId.toString() !== orgId.toString()) {
      throw new AppError(
        403,
        "TENANT_MISMATCH",
        "Cross-tenant access forbidden. Target organization does not match authenticated tenant."
      );
    }

    const commands = await this.kioskService.getDeviceCommands(
      deviceIdentifier,
      orgId,
      user
    );

    return reply.status(200).send({
      success: true,
      message: "Device commands retrieved successfully",
      data: commands,
      commands
    });
  };

  // --- K-SEC-004: Emergency Override & Broadcast Handlers ---

  private resolveEmergencyAuth(request: FastifyRequest): { orgId: string; actorId?: string; isWebhook: boolean } {
    const headers = request.headers as any;
    const body = (request.body || {}) as any;
    const query = (request.query || {}) as any;
    const user = request.user as any;

    const webhookKey = headers["x-emergency-webhook-key"] || headers["x-safety-webhook-secret"];
    const configuredSecret = process.env.EMERGENCY_WEBHOOK_KEY || "talnova_safety_webhook_secret";

    if (webhookKey && webhookKey === configuredSecret) {
      const orgId = body.organizationId || headers["x-organization-id"] || query.organizationId;
      if (!orgId) {
        throw new AppError(400, "BAD_REQUEST", "organizationId is required when triggering via safety webhook");
      }
      return { orgId: orgId.toString(), actorId: "safety_webhook", isWebhook: true };
    }

    if (!user || !user.organizationId) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required for emergency broadcast");
    }

    const allowedRoles = ["owner", "admin", "safety_officer", "super_admin"];
    if (user.role && !allowedRoles.includes(user.role)) {
      throw new AppError(403, "FORBIDDEN", "Only administrators or safety officers may trigger emergency broadcasts");
    }

    const requestedOrgId = body.organizationId || headers["x-organization-id"] || query.organizationId;
    if (requestedOrgId && requestedOrgId.toString() !== user.organizationId.toString()) {
      throw new AppError(
        403,
        "TENANT_MISMATCH",
        "Cross-tenant access forbidden. Target organization does not match authenticated tenant."
      );
    }

    return { orgId: user.organizationId.toString(), actorId: user.userId || user.id, isWebhook: false };
  }

  broadcastEmergency = async (request: FastifyRequest, reply: FastifyReply) => {
    const { orgId, actorId } = this.resolveEmergencyAuth(request);
    const body = request.body as any;

    const emergency = await this.kioskService.broadcastEmergency(orgId, body, actorId);

    return reply.status(201).send({
      success: true,
      message: "Emergency broadcast activated across all physical terminals",
      data: emergency,
      emergency
    });
  };

  clearEmergency = async (request: FastifyRequest, reply: FastifyReply) => {
    const { orgId, actorId } = this.resolveEmergencyAuth(request);
    const body = (request.body || {}) as any;

    const result = await this.kioskService.clearEmergency(orgId, actorId, body?.reason);

    return reply.status(200).send({
      success: true,
      message: result.message
    });
  };

  getEmergencyStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const query = (request.query || {}) as any;
    const headers = request.headers as any;

    const orgId = user?.organizationId || request.kioskContext?.organizationId || query?.organizationId || query?.o || headers["x-organization-id"];
    if (!orgId) {
      throw new AppError(401, "UNAUTHORIZED", "Organization context missing");
    }

    const emergency = await this.kioskService.getActiveEmergency(orgId.toString());

    return reply.status(200).send({
      success: true,
      active: Boolean(emergency),
      data: emergency || null,
      emergency: emergency || null
    });
  };

  streamEmergency = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const query = (request.query || {}) as any;
    const headers = request.headers as any;

    const orgId = user?.organizationId || request.kioskContext?.organizationId || query?.organizationId || query?.o || headers["x-organization-id"];
    if (!orgId) {
      throw new AppError(401, "UNAUTHORIZED", "Organization context missing for emergency stream");
    }

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("Access-Control-Allow-Origin", "*");
    if (typeof (reply.raw as any).flushHeaders === "function") {
      (reply.raw as any).flushHeaders();
    }

    const subscriberId = user?.deviceId || `client-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    kioskEmergencyStream.addSubscriber(orgId.toString(), subscriberId, reply);

    const activeEmergency = await this.kioskService.getActiveEmergency(orgId.toString());
    if (activeEmergency) {
      reply.raw.write(`event: emergency_broadcast\ndata: ${JSON.stringify(activeEmergency)}\n\n`);
    }

    return new Promise(() => {});
  };

  // --- K-ANA-003: Safety Compliance Reporting & Audit Packet Endpoints ---

  getComplianceSummary = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const query = (request.query || {}) as any;
    const orgId = user?.organizationId || request.kioskContext?.organizationId;
    if (!orgId) {
      throw new AppError(401, "UNAUTHORIZED", "Organization context missing");
    }

    const data = await this.kioskService.getComplianceSummary(orgId.toString(), {
      journeyId: query?.journeyId,
      startDate: query?.startDate,
      endDate: query?.endDate,
    });

    return reply.status(200).send({
      success: true,
      message: "Compliance summary retrieved successfully",
      data,
    });
  };

  getComplianceByDepartment = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const query = (request.query || {}) as any;
    const orgId = user?.organizationId || request.kioskContext?.organizationId;
    if (!orgId) {
      throw new AppError(401, "UNAUTHORIZED", "Organization context missing");
    }

    const data = await this.kioskService.getComplianceByDepartment(orgId.toString(), {
      journeyId: query?.journeyId,
      startDate: query?.startDate,
      endDate: query?.endDate,
    });

    return reply.status(200).send({
      success: true,
      message: "Department compliance breakdown retrieved successfully",
      data,
    });
  };

  exportComplianceReport = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const query = (request.query || {}) as any;
    const orgId = user?.organizationId || request.kioskContext?.organizationId;
    if (!orgId) {
      throw new AppError(401, "UNAUTHORIZED", "Organization context missing");
    }

    const format = (query?.format || "csv").toString().toLowerCase() === "json" ? "json" : "csv";

    const result = await this.kioskService.exportComplianceAuditPacket(orgId.toString(), {
      journeyId: query?.journeyId,
      startDate: query?.startDate,
      endDate: query?.endDate,
      department: query?.department,
      format,
    });

    if (format === "json") {
      return reply.status(200).send({
        success: true,
        message: "Compliance audit packet exported successfully",
        data: result,
      });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header(
        "Content-Disposition",
        `attachment; filename="compliance-audit-packet-${timestamp}.csv"`
      )
      .status(200)
      .send(result);
  };

  // =========================================================================
  // K-ENT-003: Enterprise Webhook Management
  // =========================================================================

  createWebhookSubscription = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = (request.body || {}) as any;
    const orgId = user?.organizationId || request.kioskContext?.organizationId || request.headers["x-organization-id"] || body?.organizationId;
    if (!orgId) {
      throw new AppError(401, "UNAUTHORIZED", "Organization context missing");
    }

    const subscription = await this.kioskService.createWebhookSubscription(orgId.toString(), body);
    return reply.status(201).send({
      success: true,
      message: "Webhook subscription registered successfully",
      data: subscription,
    });
  };

  getWebhookSubscriptions = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const orgId = user?.organizationId || request.kioskContext?.organizationId || request.headers["x-organization-id"] || (request.query as any)?.organizationId;
    if (!orgId) {
      throw new AppError(401, "UNAUTHORIZED", "Organization context missing");
    }

    const subscriptions = await this.kioskService.getWebhookSubscriptions(orgId.toString());
    return reply.status(200).send({
      success: true,
      data: subscriptions,
    });
  };

  getWebhookSubscriptionById = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const orgId = user?.organizationId || request.kioskContext?.organizationId || request.headers["x-organization-id"] || (request.query as any)?.organizationId;
    if (!orgId) {
      throw new AppError(401, "UNAUTHORIZED", "Organization context missing");
    }

    const subscription = await this.kioskService.getWebhookSubscriptionById(orgId.toString(), params.id);
    return reply.status(200).send({
      success: true,
      data: subscription,
    });
  };

  updateWebhookSubscription = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = (request.body || {}) as any;
    const orgId = user?.organizationId || request.kioskContext?.organizationId || request.headers["x-organization-id"] || body?.organizationId;
    if (!orgId) {
      throw new AppError(401, "UNAUTHORIZED", "Organization context missing");
    }

    const updated = await this.kioskService.updateWebhookSubscription(orgId.toString(), params.id, body);
    return reply.status(200).send({
      success: true,
      message: "Webhook subscription updated successfully",
      data: updated,
    });
  };

  deleteWebhookSubscription = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const orgId = user?.organizationId || request.kioskContext?.organizationId || request.headers["x-organization-id"] || (request.query as any)?.organizationId;
    if (!orgId) {
      throw new AppError(401, "UNAUTHORIZED", "Organization context missing");
    }

    const result = await this.kioskService.deleteWebhookSubscription(orgId.toString(), params.id);
    return reply.status(200).send({
      success: true,
      message: result.message,
    });
  };

  getWebhookDeliveries = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const query = (request.query || {}) as any;
    const orgId = user?.organizationId || request.kioskContext?.organizationId || request.headers["x-organization-id"] || query?.organizationId;
    if (!orgId) {
      throw new AppError(401, "UNAUTHORIZED", "Organization context missing");
    }

    const deliveries = await this.kioskService.getWebhookDeliveries(orgId.toString(), query);
    return reply.status(200).send({
      success: true,
      data: deliveries,
    });
  };

  testWebhookDispatch = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = (request.body || {}) as any;
    const orgId = user?.organizationId || request.kioskContext?.organizationId || request.headers["x-organization-id"] || body?.organizationId;
    if (!orgId) {
      throw new AppError(401, "UNAUTHORIZED", "Organization context missing");
    }

    const topic = body.topic || "kiosk.session.completed";
    const result = await this.kioskService.testWebhookDispatch(orgId.toString(), topic, body.payload);
    return reply.status(200).send({
      success: true,
      message: `Test webhook dispatched for topic: ${topic}`,
      data: result,
    });
  };

  // --- Synthetic Health & Fleet Monitoring (K-REL-003) ---

  getSyntheticHealth = async (request: FastifyRequest, reply: FastifyReply) => {
    const jwt = (request.server as any).jwt;
    const health = await kioskSyntheticProbeService.measureSubsystemHealth(jwt);
    const statusCode = health.status === "unhealthy" ? 503 : 200;
    return reply.status(statusCode).send(health);
  };

  authenticateSyntheticTerminal = async (request: FastifyRequest, reply: FastifyReply) => {
    const jwt = (request.server as any).jwt;
    const body = (request.body as any) || {};
    const result = await kioskSyntheticProbeService.authenticateSyntheticTerminal(
      jwt,
      body.organizationId,
      body.deviceId
    );
    return reply.status(200).send({
      success: true,
      message: "Synthetic test terminal authenticated successfully",
      token: result.token,
      deviceId: result.deviceId,
      organizationId: result.organizationId,
      expiresIn: "24h"
    });
  };

  getSyntheticSampleAsset = async (request: FastifyRequest, reply: FastifyReply) => {
    const asset = kioskSyntheticProbeService.getSampleStepAsset();
    return reply
      .header("Content-Type", asset.contentType)
      .header("Cache-Control", "public, max-age=3600")
      .status(200)
      .send(asset.data);
  };
}

export default KioskController;


