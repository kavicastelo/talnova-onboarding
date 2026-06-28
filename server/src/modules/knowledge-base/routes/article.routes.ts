import { FastifyInstance } from "fastify";
import { KnowledgeBaseController } from "../controllers/article.controller.js";
import { KnowledgeBaseService } from "../services/article.service.js";
import { KnowledgeBaseRepository } from "../repositories/article.repository.js";
import { authenticate, requireRole } from "../../../middleware/auth.middleware.js";
import { createArticleSchema, updateArticleSchema } from "../schemas/article.schema.js";

export async function knowledgeBaseRoutes(app: FastifyInstance) {
  const repository = new KnowledgeBaseRepository();
  const service = new KnowledgeBaseService(repository);
  const controller = new KnowledgeBaseController(service);

  // Authenticate all routes
  app.addHook("preHandler", authenticate);

  // GET /api/v1/knowledge-base/popular
  app.get("/popular", controller.getPopularArticles as any);

  // GET /api/v1/knowledge-base
  app.get("/", controller.listArticles as any);

  // GET /api/v1/knowledge-base/:id
  app.get("/:id", controller.getArticle as any);

  // POST /api/v1/knowledge-base
  app.post(
    "/",
    {
      preHandler: [requireRole(["owner", "admin"])],
      schema: { body: createArticleSchema },
    },
    controller.createArticle as any
  );

  // PATCH /api/v1/knowledge-base/:id
  app.patch(
    "/:id",
    {
      preHandler: [requireRole(["owner", "admin"])],
      schema: { body: updateArticleSchema },
    },
    controller.updateArticle as any
  );

  // DELETE /api/v1/knowledge-base/:id
  app.delete(
    "/:id",
    { preHandler: [requireRole(["owner", "admin"])] },
    controller.deleteArticle as any
  );

  // POST /api/v1/knowledge-base/:id/publish
  app.post(
    "/:id/publish",
    { preHandler: [requireRole(["owner", "admin"])] },
    controller.publishArticle as any
  );

  // POST /api/v1/knowledge-base/:id/archive
  app.post(
    "/:id/archive",
    { preHandler: [requireRole(["owner", "admin"])] },
    controller.archiveArticle as any
  );
}

export default knowledgeBaseRoutes;
