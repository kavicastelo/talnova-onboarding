import { FastifyInstance } from "fastify";
import { KnowledgeBaseController } from "../controllers/article.controller.js";
import { KnowledgeBaseService } from "../services/article.service.js";
import { KnowledgeBaseRepository } from "../repositories/article.repository.js";
import { QuickLinkController } from "../controllers/quick-link.controller.js";
import { QuickLinkService } from "../services/quick-link.service.js";
import { QuickLinkRepository } from "../repositories/quick-link.repository.js";
import { authenticate, optionalAuthenticate, requireRole } from "../../../middleware/auth.middleware.js";
import { extractLocale } from "../../../middleware/locale.middleware.js";
import { createArticleSchema, updateArticleSchema } from "../schemas/article.schema.js";

export async function knowledgeBaseRoutes(app: FastifyInstance) {
  const repository = new KnowledgeBaseRepository();
  const service = new KnowledgeBaseService(repository);
  const controller = new KnowledgeBaseController(service);

  const qlRepository = new QuickLinkRepository();
  const qlService = new QuickLinkService(qlRepository);
  const qlController = new QuickLinkController(qlService);

  // Quick Links routes
  app.get(
    "/quick-links",
    { preHandler: [optionalAuthenticate] },
    qlController.getQuickLinks as any
  );

  app.post(
    "/quick-links",
    { preHandler: [authenticate, requireRole(["owner", "admin"])] },
    qlController.createQuickLink as any
  );

  app.patch(
    "/quick-links/:id",
    { preHandler: [authenticate, requireRole(["owner", "admin"])] },
    qlController.updateQuickLink as any
  );

  app.delete(
    "/quick-links/:id",
    { preHandler: [authenticate, requireRole(["owner", "admin"])] },
    qlController.deleteQuickLink as any
  );

  // GET /api/v1/knowledge-base/popular
  app.get(
    "/popular",
    { preHandler: [optionalAuthenticate, extractLocale] },
    controller.getPopularArticles as any
  );

  // GET /api/v1/knowledge-base
  app.get(
    "/",
    { preHandler: [optionalAuthenticate, extractLocale] },
    controller.listArticles as any
  );

  // GET /api/v1/knowledge-base/:id
  app.get(
    "/:id",
    { preHandler: [optionalAuthenticate, extractLocale] },
    controller.getArticle as any
  );

  // POST /api/v1/knowledge-base
  app.post(
    "/",
    {
      preHandler: [authenticate, requireRole(["owner", "admin"])],
      schema: { body: createArticleSchema },
    },
    controller.createArticle as any
  );

  // PATCH /api/v1/knowledge-base/:id
  app.patch(
    "/:id",
    {
      preHandler: [authenticate, requireRole(["owner", "admin"])],
      schema: { body: updateArticleSchema },
    },
    controller.updateArticle as any
  );

  // DELETE /api/v1/knowledge-base/:id
  app.delete(
    "/:id",
    { preHandler: [authenticate, requireRole(["owner", "admin"])] },
    controller.deleteArticle as any
  );

  // POST /api/v1/knowledge-base/:id/publish
  app.post(
    "/:id/publish",
    { preHandler: [authenticate, requireRole(["owner", "admin"])] },
    controller.publishArticle as any
  );

  // POST /api/v1/knowledge-base/:id/archive
  app.post(
    "/:id/archive",
    { preHandler: [authenticate, requireRole(["owner", "admin"])] },
    controller.archiveArticle as any
  );
}

export default knowledgeBaseRoutes;
