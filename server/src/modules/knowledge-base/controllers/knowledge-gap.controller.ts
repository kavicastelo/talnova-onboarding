import { FastifyRequest, FastifyReply } from "fastify";
import KnowledgeGapService from "../services/knowledge-gap.service.js";
import KnowledgeIndexingService from "../services/knowledge-indexing.service.js";
import Article from "../models/article.model.js";

export class KnowledgeGapController {
  private gapService = new KnowledgeGapService();
  private indexingService = new KnowledgeIndexingService();

  /**
   * GET /api/v1/kb/gaps - List knowledge gaps for current tenant
   */
  async listGaps(req: FastifyRequest, reply: FastifyReply) {
    const user = req.user as any;
    const { status, page, limit } = req.query as any;

    const result = await this.gapService.listGaps(user.organizationId, {
      status,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
    });

    return reply.send({
      success: true,
      data: result.gaps,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  }

  /**
   * POST /api/v1/kb/gaps/:id/quick-answer - Resolve gap by providing a quick answer
   */
  async resolveWithQuickAnswer(req: FastifyRequest, reply: FastifyReply) {
    const user = req.user as any;
    const { id } = req.params as { id: string };
    const { answer } = req.body as { answer: string };

    if (!answer || !answer.trim()) {
      return reply.status(400).send({
        success: false,
        error: { message: "Answer content is required" },
      });
    }

    const updatedGap = await this.gapService.resolveWithQuickAnswer(
      user.organizationId,
      id,
      answer.trim(),
      user.userId
    );

    return reply.send({
      success: true,
      data: updatedGap,
    });
  }

  /**
   * POST /api/v1/kb/gaps/:id/link-article - Resolve gap by linking to an existing article
   */
  async resolveWithArticle(req: FastifyRequest, reply: FastifyReply) {
    const user = req.user as any;
    const { id } = req.params as { id: string };
    const { articleId } = req.body as { articleId: string };

    if (!articleId) {
      return reply.status(400).send({
        success: false,
        error: { message: "Article ID is required" },
      });
    }

    const updatedGap = await this.gapService.resolveWithArticle(
      user.organizationId,
      id,
      articleId,
      user.userId
    );

    return reply.send({
      success: true,
      data: updatedGap,
    });
  }

  /**
   * POST /api/v1/kb/gaps/:id/dismiss - Dismiss a knowledge gap
   */
  async dismissGap(req: FastifyRequest, reply: FastifyReply) {
    const user = req.user as any;
    const { id } = req.params as { id: string };

    const updatedGap = await this.gapService.dismissGap(
      user.organizationId,
      id,
      user.userId
    );

    return reply.send({
      success: true,
      data: updatedGap,
    });
  }

  /**
   * POST /api/v1/kb/reindex - Trigger full re-indexing of all tenant articles
   */
  async reindexAll(req: FastifyRequest, reply: FastifyReply) {
    const user = req.user as any;
    const articles = await Article.find({
      organizationId: user.organizationId,
      "publishing.status": "published",
      isDeleted: { $ne: true },
    });

    let totalChunks = 0;
    for (const art of articles) {
      totalChunks += await this.indexingService.indexArticle(art);
    }

    return reply.send({
      success: true,
      data: {
        articlesIndexed: articles.length,
        totalChunksCreated: totalChunks,
      },
    });
  }
}

export default KnowledgeGapController;
