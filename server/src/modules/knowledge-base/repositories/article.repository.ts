import { Article, IArticle } from "../models/article.model.js";
import mongoose from "mongoose";

export interface ArticleFilter {
  organizationId: string | mongoose.Types.ObjectId;
  status?: "draft" | "published" | "archived";
  categoryId?: string | mongoose.Types.ObjectId;
  tags?: string[];
  search?: string;
}

export interface UserContext {
  userId: string | mongoose.Types.ObjectId;
  role: "owner" | "admin" | "manager" | "employee";
  departmentId?: string | mongoose.Types.ObjectId;
  teamId?: string | mongoose.Types.ObjectId;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export class KnowledgeBaseRepository {
  private buildVisibilityFilter(user: UserContext): Record<string, any> {
    // Owners and Admins bypass visibility restrictions
    if (user.role === "owner" || user.role === "admin") {
      return {};
    }

    const conditions: Record<string, any>[] = [{ "visibility.access": "all" }];

    if (user.departmentId) {
      conditions.push({
        "visibility.access": "department",
        "visibility.departments": new mongoose.Types.ObjectId(user.departmentId),
      });
    }

    if (user.teamId) {
      conditions.push({
        "visibility.access": "team",
        "visibility.teams": new mongoose.Types.ObjectId(user.teamId),
      });
    }

    conditions.push({
      "visibility.access": "custom",
      "visibility.users": new mongoose.Types.ObjectId(user.userId),
    });

    return { $or: conditions };
  }

  async findById(id: string | mongoose.Types.ObjectId): Promise<IArticle | null> {
    return Article.findOne({ _id: id, isDeleted: false });
  }

  async findByIdAndOrg(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    userContext?: UserContext
  ): Promise<IArticle | null> {
    const query: Record<string, any> = {
      _id: id,
      organizationId: orgId,
      isDeleted: false,
    };

    if (userContext) {
      const visibilityFilter = this.buildVisibilityFilter(userContext);
      Object.assign(query, visibilityFilter);
      if (userContext.role === "employee" || userContext.role === "manager") {
        query["publishing.status"] = "published";
      }
    }

    return Article.findOne(query);
  }

  async find(
    filter: ArticleFilter,
    userContext: UserContext,
    pagination: PaginationOptions
  ): Promise<{ articles: IArticle[]; total: number }> {
    const query: Record<string, any> = {
      organizationId: filter.organizationId,
      isDeleted: false,
    };

    if (userContext.role === "employee" || userContext.role === "manager") {
      query["publishing.status"] = "published";
    } else if (filter.status) {
      query["publishing.status"] = filter.status;
    }

    if (filter.categoryId) {
      query.categoryId = new mongoose.Types.ObjectId(filter.categoryId);
    }
    if (filter.tags && filter.tags.length > 0) {
      query.tags = { $in: filter.tags };
    }

    // Apply visibility filter
    const visibilityFilter = this.buildVisibilityFilter(userContext);
    Object.assign(query, visibilityFilter);

    // Apply text search if query exists
    if (filter.search) {
      query.$text = { $search: filter.search };
    }

    const total = await Article.countDocuments(query);

    const page = Math.max(1, pagination.page);
    const limit = Math.max(1, pagination.limit);
    const skip = (page - 1) * limit;

    const sortField = pagination.sortBy || "createdAt";
    const sortOrder = pagination.sortOrder === "asc" ? 1 : -1;

    // If text search, sort by score by default if no sortBy provided
    const sortOption: Record<string, any> = {};
    if (filter.search && !pagination.sortBy) {
      sortOption.score = { $meta: "textScore" };
    } else {
      sortOption[sortField] = sortOrder;
    }

    const projection = filter.search ? { score: { $meta: "textScore" } } : {};

    const articles = await Article.find(query, projection)
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    return { articles, total };
  }

  async create(articleData: Partial<IArticle>): Promise<IArticle> {
    const article = new Article(articleData);
    return article.save();
  }

  async update(
    id: string | mongoose.Types.ObjectId,
    updateData: Partial<IArticle>
  ): Promise<IArticle | null> {
    return Article.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: updateData },
      { new: true }
    );
  }

  async softDelete(
    id: string | mongoose.Types.ObjectId,
    deletedBy: string | mongoose.Types.ObjectId
  ): Promise<IArticle | null> {
    return Article.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          updatedBy: new mongoose.Types.ObjectId(deletedBy),
        },
      },
      { new: true }
    );
  }

  async incrementViews(id: string | mongoose.Types.ObjectId): Promise<void> {
    await Article.updateOne(
      { _id: id },
      {
        $inc: { "analytics.views": 1 },
        $set: { "analytics.lastViewedAt": new Date() },
      }
    );
  }
}

export default KnowledgeBaseRepository;
