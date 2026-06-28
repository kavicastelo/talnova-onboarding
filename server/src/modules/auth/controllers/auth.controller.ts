import { FastifyReply, FastifyRequest } from "fastify";
import { AuthService } from "../services/auth.service.js";
import AppError from "../../../common/errors/app-error.js";
import { appConfig } from "../../../config/index.js";
import { LoginInput } from "../schemas/login.schema.js";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  login = async (
    request: FastifyRequest<{ Body: LoginInput }>,
    reply: FastifyReply
  ) => {
    const { email, password } = request.body;
    const ipAddress = request.ip;
    const deviceInfo = request.headers["user-agent"];

    const result = await this.authService.login(email, password, ipAddress, deviceInfo);

    // Set refresh token cookie
    reply.setCookie("refreshToken", result.refreshToken, {
      path: "/api/v1/auth",
      httpOnly: true,
      secure: appConfig.isProduction,
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return reply.status(200).send({
      success: true,
      message: "Login successful",
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    });
  };

  refresh = async (request: FastifyRequest, reply: FastifyReply) => {
    const refreshToken = request.cookies.refreshToken;
    if (!refreshToken) {
      throw new AppError(401, "UNAUTHORIZED", "Refresh token missing");
    }

    try {
      const result = await this.authService.refresh(refreshToken);

      // Set new rotated refresh token cookie
      reply.setCookie("refreshToken", result.refreshToken, {
        path: "/api/v1/auth",
        httpOnly: true,
        secure: appConfig.isProduction,
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      return reply.status(200).send({
        success: true,
        message: "Token refreshed successfully",
        data: {
          accessToken: result.accessToken,
        },
      });
    } catch (error) {
      // Clear cookie on failed refresh
      reply.clearCookie("refreshToken", {
        path: "/api/v1/auth",
      });
      throw error;
    }
  };

  logout = async (request: FastifyRequest, reply: FastifyReply) => {
    // If authenticated, invalidate session using the request.user payload
    const user = request.user as any;
    if (user?.sessionId) {
      await this.authService.logout(user.sessionId);
    }

    // Always clear the cookie
    reply.clearCookie("refreshToken", {
      path: "/api/v1/auth",
    });

    return reply.status(200).send({
      success: true,
      message: "Logout successful",
      data: null,
    });
  };
}

export default AuthController;
