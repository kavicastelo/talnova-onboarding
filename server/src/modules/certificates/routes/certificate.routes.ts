import { FastifyInstance } from "fastify";
import { CertificateController } from "../controllers/certificate.controller.js";
import { authenticate } from "../../../middleware/auth.middleware.js";

export async function certificateRoutes(app: FastifyInstance) {
  const controller = new CertificateController();

  // Public verification endpoints
  app.get("/public/:id", controller.getPublicCertificate as any);
  app.get("/verify/:id", controller.getPublicCertificate as any);

  // Authenticated employee endpoints
  app.register(async (authApp) => {
    authApp.addHook("preHandler", authenticate);

    authApp.get("/me", controller.getMyCertificates as any);
  });
}

export default certificateRoutes;
