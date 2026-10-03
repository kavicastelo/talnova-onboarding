import crypto from "crypto";
import { FastifyReply, FastifyRequest } from "fastify";
import mongoose from "mongoose";
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
  const query = request.query as Record<string, string>;
  const body = request.body as any;
  const journeyId = params?.id || query?.journeyId || body?.sessions?.[0]?.journeyId;

  if (!journeyId) {
    throw new AppError(400, "BAD_REQUEST", "Journey identifier is required");
  }

  // 1. Validate query parameter structure
  const parseResult = SignedUrlQuerySchema.safeParse(request.query);
  if (!parseResult.success) {
    throw new AppError(400, "BAD_REQUEST", parseResult.error.issues[0].message);
  }

  const { o: orgId, exp, sig } = parseResult.data;

  // 2. Check expiration timestamp
  const expTimestamp = parseInt(exp, 10);
  const currentUnixTimestamp = Math.floor(Date.now() / 1000);
  if (expTimestamp < currentUnixTimestamp) {
    throw new AppError(401, "SIGNATURE_EXPIRED", "Kiosk signature URL has expired");
  }

  // 3. Validate cryptographic signature
  const secret = config.jwt.secret;
  const isValid = securityService.verifySignature(journeyId, orgId, expTimestamp, sig, secret);
  if (!isValid) {
    throw new AppError(403, "INVALID_SIGNATURE", "Invalid or expired kiosk signature URL");
  }

  // 4. Enforce tenant active checks (prevent suspended organization access)
  const isOrgObjectId = typeof orgId === "string" && mongoose.Types.ObjectId.isValid(orgId) && orgId.length === 24;
  const orgQuery = isOrgObjectId ? { _id: orgId } : { slug: orgId };
  const org = await Organization.findOne(orgQuery);
  if (!org) {
    throw new AppError(404, "NOT_FOUND", "Organization not found");
  }
  if (org.status === "Suspended") {
    throw new AppError(403, "FORBIDDEN", "Your organization has been suspended. Access denied.");
  }

  // Attach kiosk context to request
  request.kioskContext = {
    organizationId: org._id.toString(),
    journeyId
  };
}

/**
 * Middleware hook to verify registered device connection JWTs for diagnostics, heartbeats, and token rotation.
 */
export async function verifyDeviceToken(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    throw new AppError(401, "UNAUTHORIZED", "Device authorization credentials required");
  }

  const rawToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!rawToken) {
    throw new AppError(401, "UNAUTHORIZED", "Device authorization token is required");
  }

  let payload: any;
  try {
    // 1. Verify standard cryptographic JWT bearer token
    await request.jwtVerify();
    payload = request.user as any;
  } catch (jwtErr: any) {
    if (jwtErr instanceof AppError) {
      throw jwtErr;
    }
    const isExpired =
      jwtErr.code === "FST_JWT_AUTHORIZATION_TOKEN_EXPIRED" ||
      jwtErr.name === "TokenExpiredError" ||
      jwtErr.message?.toLowerCase().includes("expired");

    if (isExpired) {
      throw new AppError(401, "TOKEN_EXPIRED", "Device authentication token has expired");
    }

    // Forged token, arbitrary secret, invalid signature, or malformed structure
    throw new AppError(401, "UNAUTHORIZED", "Invalid device token signature");
  }

  // 2. Enforce strict device role check
  if (!payload || payload.role !== "kiosk_device") {
    throw new AppError(403, "FORBIDDEN", "Unauthorized. Device token signature required.");
  }

  // 3. Validate essential payload identity
  if (!payload.deviceId || !payload.organizationId) {
    throw new AppError(401, "UNAUTHORIZED", "Malformed device token payload: missing device or tenant identity");
  }

  const hash = crypto.createHash("sha256").update(rawToken).digest("hex");

  // 4. Query device strictly asserting status, paired, isDeleted, and tenant
  const device = await KioskDeviceModel.findOne({
    deviceId: payload.deviceId,
    organizationId: payload.organizationId,
    isDeleted: false,
    paired: { $ne: false },
    status: { $nin: ["decommissioned", "suspended", "revoked"] }
  });

  if (!device || (device.tokenRef && device.tokenRef !== hash)) {
    // Check if device belongs to another organization
    const foreignDevice = await KioskDeviceModel.findOne({
      deviceId: payload.deviceId,
      isDeleted: false
    });
    if (foreignDevice && foreignDevice.organizationId.toString() !== payload.organizationId.toString()) {
      throw new AppError(403, "TENANT_MISMATCH", "Device belongs to another organization");
    }

    throw new AppError(401, "DEVICE_REVOKED", "Device credentials have been revoked or invalidated.");
  }

  // 5. Check if token expiration date recorded in DB has passed
  if (device.tokenExpiresAt && device.tokenExpiresAt.getTime() < Date.now()) {
    throw new AppError(401, "TOKEN_EXPIRED", "Device authentication token has expired");
  }

  // 6. Verify tenant is active (not suspended or deleted)
  const isOrgObjectId =
    typeof payload.organizationId === "string" &&
    mongoose.Types.ObjectId.isValid(payload.organizationId) &&
    payload.organizationId.length === 24;
  const orgQuery = isOrgObjectId ? { _id: payload.organizationId } : { slug: payload.organizationId };
  const org = await Organization.findOne(orgQuery);
  if (!org) {
    throw new AppError(404, "NOT_FOUND", "Organization not found");
  }
  if (org.status === "Suspended") {
    throw new AppError(403, "ORGANIZATION_SUSPENDED", "Your organization has been suspended. Access denied.");
  }

  // Attach kiosk context to request
  request.kioskContext = {
    organizationId: payload.organizationId.toString(),
    deviceId: payload.deviceId,
    device
  };
}
