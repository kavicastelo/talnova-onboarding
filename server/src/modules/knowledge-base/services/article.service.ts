import KnowledgeBaseRepository, {
  ArticleFilter,
  UserContext,
  PaginationOptions,
} from "../repositories/article.repository.js";
import AppError from "../../../common/errors/app-error.js";
import mongoose from "mongoose";
import KnowledgeIndexingService from "./knowledge-indexing.service.js";

export class KnowledgeBaseService {
  private indexingService: KnowledgeIndexingService;

  constructor(private readonly repository: KnowledgeBaseRepository) {
    this.indexingService = new KnowledgeIndexingService();
  }

  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w-]+/g, "")
      .replace(/--+/g, "-");
  }

  private generateKeywords(title: string, summary?: string, tags?: string[]): string[] {
    const words = `${title} ${summary || ""} ${(tags || []).join(" ")}`
      .toLowerCase()
      .split(/[^a-z0-9]/)
      .filter((w) => w.length > 2);
    return Array.from(new Set(words));
  }

  async getArticle(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    userContext: UserContext
  ) {
    const article = await this.repository.findByIdAndOrg(id, orgId, userContext);
    if (!article) {
      throw new AppError(404, "NOT_FOUND", "Article not found or access denied");
    }

    // Trigger asynchronous view count increment
    this.repository.incrementViews(article._id).catch(() => undefined);

    return article;
  }

  async listArticles(
    filter: ArticleFilter,
    userContext: UserContext,
    pagination: PaginationOptions
  ) {
    return this.repository.find(filter, userContext, pagination);
  }

  async createArticle(
    orgId: string | mongoose.Types.ObjectId,
    articleData: {
      title: string;
      summary?: string;
      content: { blocks: any[] };
      categoryId?: string;
      tags?: string[];
      visibility?: {
        access: "all" | "department" | "team" | "custom";
        departments?: string[];
        teams?: string[];
        users?: string[];
      };
      attachments?: Array<{ title: string; uploadId: string; downloadable?: boolean }>;
    },
    userId: string | mongoose.Types.ObjectId
  ) {
    const slug = this.slugify(articleData.title) + "-" + Math.random().toString(36).substring(2, 6);
    const searchKeywords = this.generateKeywords(articleData.title, articleData.summary, articleData.tags);

    // Convert visibility references to ObjectIds
    const visibility = {
      access: articleData.visibility?.access || "all",
      departments: articleData.visibility?.departments?.map((d) => new mongoose.Types.ObjectId(d)),
      teams: articleData.visibility?.teams?.map((t) => new mongoose.Types.ObjectId(t)),
      users: articleData.visibility?.users?.map((u) => new mongoose.Types.ObjectId(u)),
    };

    // Convert attachments
    const attachments = articleData.attachments?.map((a) => ({
      _id: new mongoose.Types.ObjectId(),
      title: a.title,
      uploadId: new mongoose.Types.ObjectId(a.uploadId),
      downloadable: a.downloadable ?? true,
    })) || [];

    const newArticle = {
      organizationId: new mongoose.Types.ObjectId(orgId),
      title: articleData.title,
      slug,
      summary: articleData.summary,
      content: {
        blocks: articleData.content?.blocks?.map((b, index) => ({
          _id: new mongoose.Types.ObjectId(),
          type: b.type,
          content: b.content,
          uploadId: b.uploadId ? new mongoose.Types.ObjectId(b.uploadId) : undefined,
          embedUrl: b.embedUrl,
          order: b.order ?? index,
        })) || [],
      },
      categoryId: articleData.categoryId ? new mongoose.Types.ObjectId(articleData.categoryId) : undefined,
      tags: articleData.tags || [],
      visibility,
      attachments,
      publishing: {
        status: (articleData as any).status === "published" ? ("published" as const) : ("draft" as const),
        publishedAt: (articleData as any).status === "published" ? new Date() : undefined,
        version: 1,
      },
      searchKeywords,
      createdBy: new mongoose.Types.ObjectId(userId),
      isDeleted: false,
    };

    const created = await this.repository.create(newArticle as any);
    if (created.publishing?.status === "published") {
      this.indexingService.indexArticle(created).catch(() => undefined);
    }
    return created;
  }

  async updateArticle(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    updateData: any,
    userId: string | mongoose.Types.ObjectId,
    userContext: UserContext
  ) {
    // Check ownership/permissions
    const article = await this.repository.findByIdAndOrg(id, orgId, userContext);
    if (!article) {
      throw new AppError(404, "NOT_FOUND", "Article not found or access denied");
    }

    if (updateData.title && updateData.title !== article.title) {
      updateData.slug = this.slugify(updateData.title) + "-" + Math.random().toString(36).substring(2, 6);
    }

    updateData.searchKeywords = this.generateKeywords(
      updateData.title || article.title,
      updateData.summary || article.summary,
      updateData.tags || article.tags
    );

    // Map visibility ObjectIds if provided
    if (updateData.visibility) {
      updateData.visibility = {
        access: updateData.visibility.access || "all",
        departments: updateData.visibility.departments?.map((d: string) => new mongoose.Types.ObjectId(d)),
        teams: updateData.visibility.teams?.map((t: string) => new mongoose.Types.ObjectId(t)),
        users: updateData.visibility.users?.map((u: string) => new mongoose.Types.ObjectId(u)),
      };
    }

    // Map content blocks
    if (updateData.content?.blocks) {
      updateData.content.blocks = updateData.content.blocks.map((b: any, index: number) => ({
        _id: b._id ? new mongoose.Types.ObjectId(b._id) : new mongoose.Types.ObjectId(),
        type: b.type,
        content: b.content,
        uploadId: b.uploadId ? new mongoose.Types.ObjectId(b.uploadId) : undefined,
        embedUrl: b.embedUrl,
        order: b.order ?? index,
      }));
    }

    // Map attachments
    if (updateData.attachments) {
      updateData.attachments = updateData.attachments.map((a: any) => ({
        _id: a._id ? new mongoose.Types.ObjectId(a._id) : new mongoose.Types.ObjectId(),
        title: a.title,
        uploadId: new mongoose.Types.ObjectId(a.uploadId),
        downloadable: a.downloadable ?? true,
      }));
    }

    updateData.updatedBy = new mongoose.Types.ObjectId(userId);

    const updated = await this.repository.update(id, updateData);
    if (updated) {
      if (updated.publishing?.status === "published") {
        this.indexingService.indexArticle(updated).catch(() => undefined);
      } else {
        this.indexingService.deindexArticle(orgId, id).catch(() => undefined);
      }
    }
    return updated;
  }

  async deleteArticle(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    userContext: UserContext
  ) {
    await this.getArticle(id, orgId, userContext);
    const deleted = await this.repository.softDelete(id, userId);
    this.indexingService.deindexArticle(orgId, id).catch(() => undefined);
    return deleted;
  }

  async publishArticle(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    userContext: UserContext
  ) {
    const article = await this.getArticle(id, orgId, userContext);

    const version =
      article.publishing.status === "published"
        ? article.publishing.version + 1
        : article.publishing.version;

    const publishing = {
      status: "published" as const,
      publishedAt: new Date(),
      version,
    };

    const published = await this.repository.update(id, {
      publishing,
      updatedBy: new mongoose.Types.ObjectId(userId),
    } as any);

    if (published) {
      this.indexingService.indexArticle(published).catch(() => undefined);
    }
    return published;
  }

  async archiveArticle(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    userContext: UserContext
  ) {
    await this.getArticle(id, orgId, userContext);

    const publishing = {
      status: "archived" as const,
      version: 1,
    };

    const archived = await this.repository.update(id, {
      publishing,
      updatedBy: new mongoose.Types.ObjectId(userId),
    } as any);

    this.indexingService.deindexArticle(orgId, id).catch(() => undefined);
    return archived;
  }

  async getPopularArticles(
    orgId: string | mongoose.Types.ObjectId,
    userContext: UserContext,
    limit = 5
  ) {
    const filter: ArticleFilter = { organizationId: orgId, status: "published" };
    const pagination: PaginationOptions = {
      page: 1,
      limit,
      sortBy: "analytics.views",
      sortOrder: "desc",
    };

    const result = await this.repository.find(filter, userContext, pagination);
    return result.articles;
  }
}

export default KnowledgeBaseService;
