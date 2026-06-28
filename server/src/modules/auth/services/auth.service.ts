import UserRepository from "../repositories/user.repository.js";
import SessionRepository from "../repositories/session.repository.js";
import AppError from "../../../common/errors/app-error.js";
import { verifyPassword } from "../../../utils/crypto.js";
import mongoose from "mongoose";

export interface TokenPayload {
  userId: string;
  organizationId: string;
  role: string;
  sessionId: string;
  tokenVersion: number;
}

export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly jwt: {
      sign: (payload: any, options?: any) => string;
      verify: (token: string) => any;
    }
  ) {}

  /**
   * Log in a user by verifying their credentials and starting an active session.
   */
  async login(
    email: string,
    password: string,
    ipAddress?: string,
    deviceInfo?: string
  ) {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new AppError(401, "UNAUTHORIZED", "Invalid email or password");
    }

    // Check if account is locked
    if (user.security.lockedUntil && user.security.lockedUntil > new Date()) {
      const lockRemainingMinutes = Math.ceil(
        (user.security.lockedUntil.getTime() - Date.now()) / (60 * 1000)
      );
      throw new AppError(
        403,
        "FORBIDDEN",
        `Account is locked. Please try again in ${lockRemainingMinutes} minute(s).`
      );
    }

    // Verify Password
    const isValid = await verifyPassword(password, user.auth.passwordHash);
    if (!isValid) {
      // Increment failed login attempts
      const updatedUser = await this.userRepository.incrementFailedLogin(user._id);
      if (updatedUser && updatedUser.security.failedLoginAttempts >= 5) {
        const lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes lock
        await this.userRepository.lockAccount(user._id, lockedUntil);
        throw new AppError(
          403,
          "FORBIDDEN",
          "Account locked due to 5 consecutive failed login attempts. Try again in 15 minutes."
        );
      }
      throw new AppError(401, "UNAUTHORIZED", "Invalid email or password");
    }

    // Successful login - reset login failures and lock
    await this.userRepository.resetFailedLogin(user._id);

    // Create session (expires in 30 days)
    const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const session = await this.sessionRepository.create({
      userId: user._id as mongoose.Types.ObjectId,
      organizationId: user.organizationId,
      tokenVersion: 1,
      deviceInfo,
      ipAddress,
      expiresAt: sessionExpiresAt,
      isValid: true,
      lastActivityAt: new Date(),
    });

    // Update lastLoginAt
    await this.userRepository.update(user._id, {
      "auth.lastLoginAt": new Date(),
    } as any);

    // Generate Tokens
    const payload: TokenPayload = {
      userId: (user._id as mongoose.Types.ObjectId).toString(),
      organizationId: user.organizationId.toString(),
      role: user.permissions.role,
      sessionId: (session._id as mongoose.Types.ObjectId).toString(),
      tokenVersion: 1,
    };

    const accessToken = this.jwt.sign(payload, { expiresIn: "15m" });
    const refreshToken = this.jwt.sign(payload, { expiresIn: "30d" });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.auth.email,
        firstName: user.profile.firstName,
        lastName: user.profile.lastName,
        role: user.permissions.role,
        organizationId: user.organizationId,
      },
    };
  }

  /**
   * Refreshes the access token using the rotating refresh token mechanism.
   */
  async refresh(token: string) {
    let decoded: TokenPayload;
    try {
      decoded = this.jwt.verify(token) as TokenPayload;
    } catch (error) {
      throw new AppError(401, "TOKEN_EXPIRED", "Session expired or invalid token");
    }

    const session = await this.sessionRepository.findById(decoded.sessionId);

    // If session doesn't exist, is invalid, or tokenVersion doesn't match (indicating reuse!)
    if (!session || !session.isValid || session.tokenVersion !== decoded.tokenVersion) {
      if (session) {
        // Break session and invalidate all active user sessions for security breach detection
        await this.sessionRepository.invalidateAllUserSessions(session.userId);
      }
      throw new AppError(401, "INVALID_TOKEN", "Authentication failed. Session terminated.");
    }

    // Rotate refresh token - Increment DB tokenVersion
    const updatedSession = await this.sessionRepository.incrementTokenVersion(session._id);
    if (!updatedSession) {
      throw new AppError(401, "INVALID_TOKEN", "Authentication failed");
    }

    // Retrieve user to carry correct role permissions
    const user = await this.userRepository.findById(session.userId);
    if (!user || user.employment.status === "inactive") {
      throw new AppError(401, "UNAUTHORIZED", "User profile inactive or deleted");
    }

    // Generate new payload with incremented tokenVersion
    const newPayload: TokenPayload = {
      userId: user._id.toString(),
      organizationId: user.organizationId.toString(),
      role: user.permissions.role,
      sessionId: updatedSession._id.toString(),
      tokenVersion: updatedSession.tokenVersion,
    };

    const accessToken = this.jwt.sign(newPayload, { expiresIn: "15m" });
    const refreshToken = this.jwt.sign(newPayload, { expiresIn: "30d" });

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Logs out the user by terminating the active session.
   */
  async logout(sessionId: string) {
    await this.sessionRepository.invalidateSession(sessionId);
  }
}

export default AuthService;
