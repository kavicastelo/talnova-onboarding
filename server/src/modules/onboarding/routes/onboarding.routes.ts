import { FastifyInstance } from "fastify";
import { onboardingCaseController } from "../controllers/onboarding-case.controller.js";
import { authenticate, requireRole } from "../../../middleware/auth.middleware.js";
import {
  getExceptionsQuerySchema,
  resolveExceptionSchema,
} from "../schemas/onboarding.schema.js";

export async function onboardingRoutes(app: FastifyInstance) {
  app.register(async (authApp) => {
    authApp.addHook("preHandler", authenticate);

    // HR Ops Exception Workbench strictly requires Owner or Admin authorization
    const adminOnly = requireRole(["owner", "admin"]);

    authApp.get(
      "/exceptions",
      {
        preHandler: [adminOnly],
        schema: {
          querystring: getExceptionsQuerySchema,
        },
      },
      onboardingCaseController.getExceptions as any
    );

    authApp.post(
      "/exceptions/:caseId/resolve",
      {
        preHandler: [adminOnly],
        schema: {
          body: resolveExceptionSchema,
        },
      },
      onboardingCaseController.resolveException as any
    );
  });
}

export default onboardingRoutes;
