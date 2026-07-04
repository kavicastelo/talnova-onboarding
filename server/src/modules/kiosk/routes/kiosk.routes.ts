import { FastifyInstance } from "fastify";
import { KioskController } from "../controllers/kiosk.controller.js";
import { KioskService } from "../services/kiosk.service.js";
import { KioskJourneyRepository } from "../repositories/kiosk-journey.repository.js";
import { KioskDeviceRepository } from "../repositories/kiosk-device.repository.js";
import { KioskAnalyticsRepository } from "../repositories/kiosk-analytics.repository.js";
import { KioskSecurityService } from "../services/kiosk-security.service.js";
import { authenticate, requireRole } from "../../../middleware/auth.middleware.js";
import { verifySignedUrl, verifyDeviceToken } from "../plugins/kiosk-auth.plugin.js";
import {
  CreateKioskJourneySchema,
  UpdateKioskJourneySchema,
  KioskDeviceHeartbeatSchema,
  KioskAnalyticsBulkSyncSchema
} from "../validation/index.js";
import { z } from "zod";
import mongoose from "mongoose";
import { storageConfig } from "../../../config/index.js";
import AppError from "../../../common/errors/app-error.js";

export async function kioskRoutes(app: FastifyInstance) {
  const journeyRepo = new KioskJourneyRepository();
  const deviceRepo = new KioskDeviceRepository();
  const analyticsRepo = new KioskAnalyticsRepository();
  const securityService = new KioskSecurityService();

  const kioskService = new KioskService(
    journeyRepo,
    deviceRepo,
    analyticsRepo,
    securityService,
    app.jwt
  );

  const controller = new KioskController(kioskService);

  // --- PUBLIC ENDPOINTS (No Admin Auth) ---

  // GET /api/v1/kiosk/journeys/play/:id (Kiosk Playback via Signed URL)
  app.get(
    "/journeys/play/:id",
    {
      preHandler: [verifySignedUrl]
    },
    controller.getJourney
  );

  // GET /api/v1/kiosk/uploads/:id (Retrieve/stream public kiosk uploads via redirect)
  app.get(
    "/uploads/:id",
    async (request, reply) => {
      const params = request.params as any;
      
      let upload;
      try {
        upload = await mongoose.model("Upload").findById(params.id);
      } catch (err) {
        throw new AppError(400, "BAD_REQUEST", "Invalid upload ID format");
      }
      
      if (!upload) {
        throw new AppError(404, "NOT_FOUND", "Upload asset not found");
      }
      
      if (upload.storage?.publicUrl) {
        return reply.status(302).redirect(upload.storage.publicUrl);
      }
      
      // Local dev/private fallback: generate presigned GET URL
      const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
      const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
      const s3Client = new S3Client({
        region: "auto",
        endpoint: storageConfig.endpoint,
        credentials: {
          accessKeyId: storageConfig.accessKeyId,
          secretAccessKey: storageConfig.secretAccessKey,
        },
        forcePathStyle: true,
      });
      
      const command = new GetObjectCommand({
        Bucket: upload.storage.bucket,
        Key: upload.storage.objectKey,
      });
      
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      return reply.status(302).redirect(signedUrl);
    }
  );

  // POST /api/v1/kiosk/journeys/:id/auth/pin (Validate PIN)
  app.post(
    "/journeys/:id/auth/pin",
    {
      schema: {
        body: z.object({
          pinCode: z.string().min(1, "PIN code is required")
        })
      }
    },
    controller.validatePIN
  );

  // POST /api/v1/kiosk/devices/pair (Pair Code validation endpoint - public to physical devices)
  app.post(
    "/devices/pair",
    {
      schema: {
        body: z.object({
          code: z.string().length(6, "Pairing code must be exactly 6 digits"),
          deviceId: z.string().min(1, "Hardware GUID/fingerprint is required"),
          name: z.string().min(1, "Device name is required"),
          location: z.string().min(1, "Device location is required")
        })
      }
    },
    controller.pairDevice
  );

  // --- DEVICE AUTHORIZED ENDPOINTS ---

  // POST /api/v1/kiosk/devices/heartbeat (Device token heartbeat ping)
  app.post(
    "/devices/heartbeat",
    {
      preHandler: [verifyDeviceToken],
      schema: {
        body: KioskDeviceHeartbeatSchema
      }
    },
    controller.heartbeat
  );

  // POST /api/v1/kiosk/analytics/sync (Offline analytics bulk upload)
  app.post(
    "/analytics/sync",
    {
      preHandler: [
        async (request, reply) => {
          const authHeader = request.headers.authorization;
          if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
            try {
              const decoded = app.jwt.decode<any>(authHeader.substring(7));
              if (decoded?.role === "kiosk_device") {
                await verifyDeviceToken(request, reply);
                return;
              }
            } catch (err) {
              // Fail-through to standard authenticate
            }
          }
          await authenticate(request, reply);
        }
      ],
      schema: {
        body: KioskAnalyticsBulkSyncSchema
      }
    },
    controller.syncAnalytics
  );

  // --- ADMIN AUTHORIZED ENDPOINTS (Requires Owner/Admin Role) ---

  app.register(async (adminGroup) => {
    adminGroup.addHook("preHandler", authenticate);
    adminGroup.addHook("preHandler", requireRole(["owner", "admin"]));

    // GET /api/v1/kiosk/journeys
    adminGroup.get("/journeys", controller.listJourneys);

    // GET /api/v1/kiosk/journeys/:id
    adminGroup.get("/journeys/:id", controller.getJourney);

    // POST /api/v1/kiosk/journeys
    adminGroup.post(
      "/journeys",
      {
        schema: {
          body: CreateKioskJourneySchema
        }
      },
      controller.createJourney
    );

    // PUT /api/v1/kiosk/journeys/:id
    adminGroup.put(
      "/journeys/:id",
      {
        schema: {
          body: UpdateKioskJourneySchema
        }
      },
      controller.updateJourney
    );

    // DELETE /api/v1/kiosk/journeys/:id
    adminGroup.delete("/journeys/:id", controller.deleteJourney);

    // POST /api/v1/kiosk/journeys/:id/publish
    adminGroup.post("/journeys/:id/publish", controller.publishJourney);

    // POST /api/v1/kiosk/devices/pair/code (Generate pairing code)
    adminGroup.post(
      "/devices/pair/code",
      {
        schema: {
          body: z.object({
            deviceId: z.string().min(1, "Hardware GUID is required")
          })
        }
      },
      controller.generatePairingCode
    );

    // GET /api/v1/kiosk/devices (List paired devices)
    adminGroup.get("/devices", controller.listDevices);

    // POST /api/v1/kiosk/devices/:id/pair-journey (Link device to journey)
    adminGroup.post(
      "/devices/:id/pair-journey",
      {
        schema: {
          body: z.object({
            journeyId: z.string().nullable()
          })
        }
      },
      controller.pairJourneyToDevice
    );

    // GET /api/v1/kiosk/journeys/:id/analytics
    adminGroup.get("/journeys/:id/analytics", controller.getJourneyAnalyticsSummary);
  });
}

export default kioskRoutes;
