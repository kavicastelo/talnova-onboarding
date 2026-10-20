import { FastifyRequest, FastifyReply } from "fastify";
import User from "../modules/auth/models/user.model.js";

export const SUDO_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Middleware ensuring that super-admins executing destructive or high-risk actions
 * have verified their credentials within the last 15 minutes.
 */
export async function requireSudoMode(request: FastifyRequest, reply: FastifyReply) {
  const userPayload = (request as any).user;
  if (!userPayload?.userId) {
    return reply.status(401).send({
      success: false,
      code: "UNAUTHORIZED",
      message: "Authentication required before sudo verification",
    });
  }

  // Fetch the fresh user document from MongoDB to inspect security metadata
  const user = await User.findById(userPayload.userId).select("security permissions profile");
  if (!user) {
    return reply.status(401).send({
      success: false,
      code: "USER_NOT_FOUND",
      message: "Authenticated user record not found",
    });
  }

  const lastSudoVerifiedAt = user.security?.lastSudoVerifiedAt
    ? new Date(user.security.lastSudoVerifiedAt).getTime()
    : 0;

  const now = Date.now();
  const isSudoActive = lastSudoVerifiedAt > 0 && lastSudoVerifiedAt > now - SUDO_TIMEOUT_MS;

  if (!isSudoActive) {
    return reply.status(403).send({
      success: false,
      error: "Forbidden",
      code: "SUDO_CONFIRMATION_REQUIRED",
      message: "High-risk administrative action requires recent sudo confirmation (password re-authentication within 15 minutes).",
      data: {
        lastSudoVerifiedAt: user.security?.lastSudoVerifiedAt || null,
        timeoutMinutes: 15,
      },
    });
  }

  // Sudo active: attach validated metadata to request
  (request as any).sudoVerified = true;
  (request as any).sudoVerifiedAt = new Date(lastSudoVerifiedAt);
}

export default requireSudoMode;
