import { FastifyReply, FastifyRequest } from "fastify";
import mongoose from "mongoose";
import { KioskService } from "../services/kiosk.service.js";
import AppError from "../../../common/errors/app-error.js";
import { KioskJourneyModel } from "../models/kiosk-journey.model.js";
import { KioskSessionModel } from "../models/kiosk-session.model.js";
import { FeatureTelemetryService } from "../../super-admin/services/feature-telemetry.service.js";

export class KioskController {
  constructor(private readonly kioskService: KioskService) {}

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
    let user = request.user as any;
    if (!user && request.headers.authorization) {
      try {
        const token = request.headers.authorization.replace(/^Bearer\s+/i, "");
        user = (request.server as any).jwt.decode(token);
      } catch {
        // ignore
      }
    }
    const orgId = user?.organizationId || request.kioskContext?.organizationId || (request.query as any)?.organizationId;
    const params = request.params as any;

    let session: any = null;
    try {
      const isObjectId = mongoose.Types.ObjectId.isValid(params.id);
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
    const deviceIdentifier = (params.id && params.id !== "me") ? params.id : user.deviceId;
    if (!deviceIdentifier) {
      throw new AppError(400, "BAD_REQUEST", "Device identifier is required");
    }
    const manifest = await this.kioskService.getDeviceManifest(
      deviceIdentifier,
      user.organizationId
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
    const body = request.body as any;

    if (!body?.deviceId) {
      throw new AppError(400, "BAD_REQUEST", "deviceId is required to generate pairing code");
    }

    const { code, expiresInSeconds } = await this.kioskService.generatePairingCode(user.organizationId, body.deviceId);
    return reply.status(200).send({
      success: true,
      message: "Device pairing code generated successfully",
      code,
      expiresInSeconds,
      data: { code, expiresInSeconds }
    });
  };

  pairDevice = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;

    if (!body?.code || !body?.deviceId || !body?.name || !body?.location) {
      throw new AppError(400, "BAD_REQUEST", "Missing required pairing parameters (code, deviceId, name, location)");
    }

    const result = await this.kioskService.pairDevice(body.code, body.deviceId, body.name, body.location);
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

    const telemetry = {
      ...(body.telemetry || {}),
      batteryLevel: body.batteryLevel !== undefined
        ? (body.batteryLevel > 1 ? body.batteryLevel / 100 : body.batteryLevel)
        : body.telemetry?.batteryLevel,
      appVersion: body.appVersion || body.telemetry?.appVersion,
      isCharging: body.isCharging !== undefined ? body.isCharging : body.telemetry?.isCharging,
      networkLatencyMs: body.networkLatencyMs !== undefined ? body.networkLatencyMs : body.telemetry?.networkLatencyMs,
      storageUsedBytes: body.storageUsedBytes !== undefined ? body.storageUsedBytes : body.telemetry?.storageUsedBytes,
      storageFreeBytes: body.storageFreeBytes !== undefined ? body.storageFreeBytes : body.telemetry?.storageFreeBytes,
    };

    const updated = await this.kioskService.heartbeat(
      devicePayload.deviceId,
      devicePayload.organizationId,
      body.currentContentVersion || body.contentVersion || 0,
      telemetry
    );

    return reply.status(200).send({
      success: true,
      status: "ok",
      message: "Heartbeat logged successfully",
      data: updated
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

  revokeDevice = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    const device = await this.kioskService.revokeDevice(
      params.id,
      user.organizationId,
      user.userId
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
    const body = request.body as any;

    const items = body?.events || body?.sessions;
    if (!Array.isArray(items) || items.length === 0) {
      throw new AppError(400, "BAD_REQUEST", "events or sessions must be a non-empty array");
    }

    const orgId = userPayload?.organizationId || request.kioskContext?.organizationId;
    if (!orgId) {
      throw new AppError(401, "UNAUTHORIZED", "Organization context missing");
    }

    const result = await this.kioskService.syncAnalytics(orgId, body, userPayload?.deviceId);
    return reply.status(200).send({
      success: true,
      message: "Analytics synced successfully",
      syncedCount: result.length,
      data: {
        syncedCount: result.length,
        items: result
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
      body.pin
    );

    return reply.status(200).send({
      success: true,
      message: "Supervisor PIN verified successfully",
      data: result,
    });
  };

  setSupervisorPin = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = (request.body as any) || {};
    const targetUserId = body.supervisorId || user.userId;

    const result = await this.kioskService.setSupervisorPin(
      user.organizationId,
      targetUserId,
      body.pin
    );

    return reply.status(200).send({
      success: true,
      message: "Supervisor PIN set successfully",
      data: result,
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
}

export default KioskController;
