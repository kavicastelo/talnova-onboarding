import { FastifyInstance } from "fastify";
import { UploadController } from "../controllers/upload.controller.js";
import { UploadService } from "../services/upload.service.js";
import { UploadRepository } from "../repositories/upload.repository.js";
import { authenticate } from "../../../middleware/auth.middleware.js";
import { requestUploadUrlSchema, confirmUploadSchema } from "../schemas/upload.schema.js";

export async function uploadRoutes(app: FastifyInstance) {
  const repository = new UploadRepository();
  const service = new UploadService(repository);
  const controller = new UploadController(service);

  // Authenticate all routes
  app.addHook("preHandler", authenticate);

  // POST /api/v1/uploads/request-url
  app.post(
    "/request-url",
    { schema: { body: requestUploadUrlSchema } },
    controller.requestUploadUrl as any
  );

  // POST /api/v1/uploads/complete
  app.post(
    "/complete",
    { schema: { body: confirmUploadSchema } },
    controller.confirmUpload as any
  );

  // GET /api/v1/uploads/:id
  app.get("/:id", controller.getUpload as any);

  // GET /api/v1/uploads
  app.get("/", controller.listUploads as any);

  // DELETE /api/v1/uploads/:id
  app.delete("/:id", controller.deleteUpload as any);
}

export default uploadRoutes;
