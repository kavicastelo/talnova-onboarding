import mongoose from "mongoose";
import KnowledgeChunk, { IKnowledgeChunk } from "../models/knowledge-chunk.model.js";
import { IArticle } from "../models/article.model.js";
import EmbeddingService from "./embedding.service.js";

export class KnowledgeIndexingService {
  private embeddingService: EmbeddingService;

  constructor() {
    this.embeddingService = new EmbeddingService();
  }

  /**
   * Split article content blocks into semantic chunks preserving headings and section boundaries.
   */
  private extractSemanticChunks(article: IArticle): Array<{ heading?: string; content: string }> {
    const chunks: Array<{ heading?: string; content: string }> = [];

    let currentHeading = article.title;
    let currentBuffer: string[] = [];

    // Include summary as initial chunk if present
    if (article.summary && article.summary.trim().length > 0) {
      chunks.push({
        heading: "Overview",
        content: `${article.title}: ${article.summary.trim()}`,
      });
    }

    const blocks = article.content?.blocks || [];

    for (const block of blocks) {
      const text = block.content ? block.content.trim() : "";
      if (!text) continue;

      if (block.type === "callout" || block.type === "code") {
        // High-importance callout / policy rule
        chunks.push({
          heading: currentHeading,
          content: text,
        });
      } else if (text.length > 800) {
        // Break large blocks into ~400 character paragraphs
        const sentences = text.split(/(?<=[.?!])\s+/);
        let subBuffer = "";
        for (const sentence of sentences) {
          if ((subBuffer + " " + sentence).length > 500) {
            if (subBuffer.trim()) {
              chunks.push({ heading: currentHeading, content: subBuffer.trim() });
            }
            subBuffer = sentence;
          } else {
            subBuffer = subBuffer ? `${subBuffer} ${sentence}` : sentence;
          }
        }
        if (subBuffer.trim()) {
          chunks.push({ heading: currentHeading, content: subBuffer.trim() });
        }
      } else {
        currentBuffer.push(text);
        // Flush buffer every ~300 words
        if (currentBuffer.join(" ").length > 400) {
          chunks.push({
            heading: currentHeading,
            content: currentBuffer.join("\n"),
          });
          currentBuffer = [];
        }
      }
    }

    if (currentBuffer.length > 0) {
      chunks.push({
        heading: currentHeading,
        content: currentBuffer.join("\n"),
      });
    }

    // If article had no content blocks, use title + summary + tags
    if (chunks.length === 0) {
      chunks.push({
        heading: article.title,
        content: `${article.title}. ${(article.tags || []).join(", ")}`,
      });
    }

    return chunks;
  }

  /**
   * Index an article: deactivates prior chunks and stores newly embedded chunks.
   */
  async indexArticle(
    article: IArticle,
    providerConfig?: any,
    secrets?: any
  ): Promise<number> {
    const orgId = article.organizationId;
    const resourceId = article._id;

    // 1. Deactivate prior chunks for this resource
    await KnowledgeChunk.updateMany(
      { organizationId: orgId, resourceId },
      { $set: { status: "inactive" } }
    );

    // 2. If article is deleted, draft, or archived, do not generate active chunks
    if (article.isDeleted || article.publishing?.status !== "published") {
      return 0;
    }

    // 3. Extract semantic chunks
    const rawChunks = this.extractSemanticChunks(article);
    const chunkDocs: Array<Partial<IKnowledgeChunk>> = [];

    for (let i = 0; i < rawChunks.length; i++) {
      const chunk = rawChunks[i];
      const embedding = await this.embeddingService.generateEmbedding(
        `${article.title} - ${chunk.heading || ""}: ${chunk.content}`,
        providerConfig,
        secrets
      );

      chunkDocs.push({
        organizationId: orgId,
        resourceId,
        resourceType: "article",
        title: article.title,
        chunkIndex: i,
        heading: chunk.heading,
        content: chunk.content,
        tokens: Math.ceil(chunk.content.length / 4),
        embedding,
        visibility: {
          access: article.visibility?.access || "all",
          departments: article.visibility?.departments || [],
          teams: article.visibility?.teams || [],
          users: article.visibility?.users || [],
        },
        version: article.publishing?.version || 1,
        status: "active",
      });
    }

    if (chunkDocs.length > 0) {
      await KnowledgeChunk.insertMany(chunkDocs);
    }

    return chunkDocs.length;
  }

  /**
   * Deactivate/remove chunks when an article is deleted or unpublished.
   */
  async deindexArticle(
    orgId: string | mongoose.Types.ObjectId,
    resourceId: string | mongoose.Types.ObjectId
  ): Promise<void> {
    await KnowledgeChunk.updateMany(
      { organizationId: orgId, resourceId },
      { $set: { status: "inactive" } }
    );
  }

  /**
   * Create and immediately index a Quick Answer as an active knowledge chunk.
   */
  async indexQuickAnswer(
    orgId: string | mongoose.Types.ObjectId,
    resourceId: string | mongoose.Types.ObjectId,
    question: string,
    answer: string
  ): Promise<void> {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    const resObjectId = new mongoose.Types.ObjectId(resourceId.toString());

    // Deactivate previous
    await KnowledgeChunk.updateMany(
      { organizationId: orgObjectId, resourceId: resObjectId },
      { $set: { status: "inactive" } }
    );

    const fullText = `FAQ: ${question}\nAnswer: ${answer}`;
    const embedding = await this.embeddingService.generateEmbedding(fullText);

    await KnowledgeChunk.create({
      organizationId: orgObjectId,
      resourceId: resObjectId,
      resourceType: "quick_answer",
      title: question,
      chunkIndex: 0,
      heading: "Quick Answer",
      content: answer,
      tokens: Math.ceil(answer.length / 4),
      embedding,
      visibility: { access: "all" },
      version: 1,
      status: "active",
    });
  }
}

export default KnowledgeIndexingService;
