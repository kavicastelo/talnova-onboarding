import { FastifyReply, FastifyRequest } from "fastify";
import mongoose from "mongoose";
import { KioskService } from "../services/kiosk.service.js";
import AppError from "../../../common/errors/app-error.js";
import { KioskJourneyModel } from "../models/kiosk-journey.model.js";
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
      session = await mongoose.model("KioskAnalytics").findOne({
        sessionId: params.id,
        ...(orgId ? { organizationId: orgId } : {}),
      });
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

  publishJourney = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const journey = await this.kioskService.publishJourney(params.id, user.organizationId, user.userId);
    return reply.status(200).send({
      success: true,
      message: "Kiosk journey published successfully",
      data: journey
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
