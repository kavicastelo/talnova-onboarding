import { FastifyInstance } from "fastify";
import { AuthController } from "../controllers/auth.controller.js";
import { AuthService } from "../services/auth.service.js";
import UserRepository from "../repositories/user.repository.js";
import SessionRepository from "../repositories/session.repository.js";
import loginSchema from "../schemas/login.schema.js";
import { authenticate } from "../../../middleware/auth.middleware.js";

export async function authRoutes(app: FastifyInstance) {
  const userRepository = new UserRepository();
  const sessionRepository = new SessionRepository();
  const authService = new AuthService(userRepository, sessionRepository, app.jwt);
  const controller = new AuthController(authService);

  // POST /api/v1/auth/login
  app.post(
    "/login",
    {
      schema: {
        body: loginSchema,
      },
    },
    controller.login
  );

  // POST /api/v1/auth/refresh
  app.post("/refresh", controller.refresh);

  // POST /api/v1/auth/logout
  app.post(
    "/logout",
    {
      onRequest: [authenticate],
    },
    controller.logout
  );

  // POST /api/v1/auth/forgot-password (Stub)
  app.post("/forgot-password", async (request, reply) => {
    return reply.status(200).send({
      success: true,
      message: "If the email is registered, a password reset link has been sent.",
      data: null,
    });
  });

  // POST /api/v1/auth/reset-password (Stub)
  app.post("/reset-password", async (request, reply) => {
    return reply.status(200).send({
      success: true,
      message: "Password reset successful.",
      data: null,
    });
  });

  // POST /api/v1/auth/invitations/accept (Stub)
  app.post("/invitations/accept", async (request, reply) => {
    return reply.status(200).send({
      success: true,
      message: "Invitation accepted successfully.",
      data: null,
    });
  });
}

export default authRoutes;
