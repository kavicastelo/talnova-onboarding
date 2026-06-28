import { FastifyReply, FastifyRequest } from "fastify";
import { KnowledgeBaseService } from "../services/article.service.js";

export class KnowledgeBaseController {
  constructor(private readonly service: KnowledgeBaseService) {}

  private extractUserContext(request: FastifyRequest) {
    const user = request.user as any;
    return {
      userId: user.userId,
      role: user.role,
      departmentId: user.departmentId,
      teamId: user.teamId,
    };
  }

  getArticle = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const userContext = this.extractUserContext(request);

    const article = await this.service.getArticle(params.id, user.organizationId, userContext);

    return reply.status(200).send({
      success: true,
      message: "Article retrieved successfully",
      data: article,
    });
  };

  listArticles = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const query = request.query as any;
    const userContext = this.extractUserContext(request);

    const filter = {
      organizationId: user.organizationId,
      status: query.status,
      categoryId: query.categoryId,
      tags: query.tags ? (Array.isArray(query.tags) ? query.tags : [query.tags]) : undefined,
      search: query.search,
    };

    const pagination = {
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };

    const result = await this.service.listArticles(filter, userContext, pagination);

    return reply.status(200).send({
      success: true,
      message: "Articles retrieved successfully",
      data: result.articles,
      meta: {
        total: result.total,
        page: pagination.page,
        limit: pagination.limit,
      },
    });
  };

  createArticle = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;
    const article = await this.service.createArticle(user.organizationId, body, user.userId);

    return reply.status(201).send({
      success: true,
      message: "Article created successfully",
      data: article,
    });
  };

  updateArticle = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const userContext = this.extractUserContext(request);

    const article = await this.service.updateArticle(
      params.id,
      user.organizationId,
      request.body as any,
      user.userId,
      userContext
    );

    return reply.status(200).send({
      success: true,
      message: "Article updated successfully",
      data: article,
    });
  };

  deleteArticle = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const userContext = this.extractUserContext(request);

    await this.service.deleteArticle(params.id, user.organizationId, user.userId, userContext);

    return reply.status(200).send({
      success: true,
      message: "Article deleted successfully",
      data: null,
    });
  };

  publishArticle = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const userContext = this.extractUserContext(request);

    const article = await this.service.publishArticle(
      params.id,
      user.organizationId,
      user.userId,
      userContext
    );

    return reply.status(200).send({
      success: true,
      message: "Article published successfully",
      data: article,
    });
  };

  archiveArticle = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const userContext = this.extractUserContext(request);

    const article = await this.service.archiveArticle(
      params.id,
      user.organizationId,
      user.userId,
      userContext
    );

    return reply.status(200).send({
      success: true,
      message: "Article archived successfully",
      data: article,
    });
  };

  getPopularArticles = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const query = request.query as any;
    const userContext = this.extractUserContext(request);

    const limit = query.limit ? parseInt(query.limit, 10) : 5;
    const articles = await this.service.getPopularArticles(user.organizationId, userContext, limit);

    return reply.status(200).send({
      success: true,
      message: "Popular articles retrieved successfully",
      data: articles,
    });
  };
}

export default KnowledgeBaseController;
