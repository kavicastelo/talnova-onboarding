import { FastifyReply, FastifyRequest } from "fastify";
import AppError from "../../../common/errors/app-error.js";
import config from "../../../config/index.js";
import { Organization } from "../../organizations/models/organization.model.js";
import { KioskDeviceModel } from "../models/kiosk-device.model.js";
import { KioskSecurityService } from "../services/kiosk-security.service.js";
import { SignedUrlQuerySchema } from "../validation/journey.schema.js";

const securityService = new KioskSecurityService();

/**
 * Middleware hook to verify HMAC-SHA256 signature parameters for public kiosk journey access.
 */
export async function verifySignedUrl(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as Record<string, string>;
  const journeyId = params?.id;

  if (!journeyId) {
    throw new AppError(400, "BAD_REQUEST", "Journey identifier is required in route params");
  }

  // 1. Validate query parameter structure
  const parseResult = SignedUrlQuerySchema.safeParse(request.query);
  if (!parseResult.success) {
    throw new AppError(400, "BAD_REQUEST", parseResult.error.issues[0].message);
  }

  const { o: orgId, exp, sig } = parseResult.data;

  // 2. Validate cryptographic signature
  const secret = config.jwt.secret;
  const isValid = securityService.verifySignature(journeyId, orgId, parseInt(exp, 10), sig, secret);
  if (!isValid) {
    throw new AppError(403, "INVALID_SIGNATURE", "Invalid or expired kiosk signature URL");
  }

  // 3. Enforce tenant active checks (prevent suspended organization access)
  const org = await Organization.findById(orgId);
  if (!org) {
    throw new AppError(404, "NOT_FOUND", "Organization not found");
  }
  if (org.status === "Suspended") {
    throw new AppError(403, "FORBIDDEN", "Your organization has been suspended. Access denied.");
  }

  // Attach kiosk context to request
  request.kioskContext = {
    organizationId: orgId,
    journeyId
  };
}

/**
 * Middleware hook to verify registered device connection JWTs for diagnostics & heartbeats.
 */
export async function verifyDeviceToken(request: FastifyRequest, reply: FastifyReply) {
  try {
    // 1. Verify standard JWT bearer token on authorization header
    await request.jwtVerify();
    const payload = request.user as any;

    if (!payload || payload.role !== "kiosk_device") {
      throw new AppError(403, "FORBIDDEN", "Unauthorized. Device token signature required.");
    }

    // 2. Validate the device is still active in the database
    const device = await KioskDeviceModel.findOne({
      deviceId: payload.deviceId,
      organizationId: payload.organizationId
    });

    if (!device) {
      throw new AppError(401, "UNAUTHORIZED", "Device registration has been revoked or suspended.");
    }
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(401, "UNAUTHORIZED", "Invalid or expired device connection key.");
  }
}
