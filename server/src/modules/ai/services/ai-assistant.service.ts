import mongoose from "mongoose";
import AIConversation from "../models/ai-conversation.model.js";
import Article from "../../knowledge-base/models/article.model.js";
import EmployeeAssignment from "../../assignments/models/assignment.model.js";
import User from "../../auth/models/user.model.js";

export class AIAssistantService {
  /**
   * Process user prompt & generate tenant-safe AI response with citations (AI-001, AI-002, AI-003, AI-004)
   */
  async chat(
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    role: string,
    messageText: string,
    conversationId?: string
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    const userObjectId = new mongoose.Types.ObjectId(userId.toString());

    let conversation;

    if (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) {
      conversation = await AIConversation.findOne({
        _id: new mongoose.Types.ObjectId(conversationId),
        organizationId: orgObjectId,
        userId: userObjectId,
      });
    }

    if (!conversation) {
      conversation = await AIConversation.create({
        organizationId: orgObjectId,
        userId: userObjectId,
        title: messageText.length > 30 ? `${messageText.slice(0, 30)}...` : messageText,
        messages: [],
        feedback: [],
      });
    }

    // 1. Add User Message
    conversation.messages.push({
      sender: "user",
      content: messageText,
      timestamp: new Date(),
    });

    // 2. Perform RAG Knowledge Base Search
    const STOP_WORDS = new Set([
      "what", "is", "the", "for", "during", "and", "or", "in", "on", "at", "to", "a", "an", "of",
      "how", "can", "tell", "about", "please", "me", "are", "do", "does", "with", "this", "that",
      "from", "your", "our", "policy", "guidelines", "rules", "company", "many", "much"
    ]);

    const allWords = messageText
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const keyTerms = allWords.filter((w) => !STOP_WORDS.has(w));
    const searchTerms = keyTerms.length > 0 ? keyTerms : allWords;
    const searchRegex = searchTerms.length > 0 ? new RegExp(searchTerms.join("|"), "i") : null;

    let matchingArticles: any[] = [];

    if (searchRegex) {
      const candidates = await Article.find({
        organizationId: orgObjectId,
        "publishing.status": "published",
        isDeleted: { $ne: true },
        $or: [
          { title: searchRegex },
          { summary: searchRegex },
          { searchKeywords: searchRegex },
          { tags: searchRegex },
          { "content.blocks.content": searchRegex },
        ],
      });

      // Score candidates by how many key terms appear in title, summary, tags, keywords
      const scored = candidates.map((art) => {
        let score = 0;
        const titleLower = art.title.toLowerCase();
        const summaryLower = (art.summary || "").toLowerCase();
        const tagsLower = (art.tags || []).map((t) => t.toLowerCase());
        const keywordsLower = (art.searchKeywords || []).map((k) => k.toLowerCase());

        for (const term of searchTerms) {
          if (titleLower.includes(term)) score += 15;
          if (summaryLower.includes(term)) score += 8;
          if (tagsLower.some((t) => t.includes(term))) score += 6;
          if (keywordsLower.some((k) => k.includes(term))) score += 6;
        }
        return { article: art, score };
      });

      scored.sort((a, b) => b.score - a.score);
      matchingArticles = scored.filter((s) => s.score > 0).slice(0, 3).map((s) => s.article);
    }

    // 3. Perform Task/Assignment Context Search
    const activeAssignments = await EmployeeAssignment.find({
      organizationId: orgObjectId,
      employeeId: userObjectId,
      status: "in_progress",
    }).limit(3);

    // 4. Synthesize AI Response & Citations
    const citations = matchingArticles.map((art) => ({
      title: art.title,
      url: `/kb/${art._id.toString()}`,
      articleId: art._id.toString(),
    }));

    const actionSuggestions = [
      { text: "View Tasks & Checklists", action: "/tasks" },
      { text: "View Onboarding Journeys", action: "/journeys" },
      { text: "Contact Buddy Support", action: "/buddy" },
    ];

    let aiContent = "";

    if (matchingArticles.length > 0) {
      const topArticle = matchingArticles[0];
      const mainText = topArticle.content?.blocks?.map((b: any) => b.content).filter(Boolean).join(" ") || "";
      const excerpt = mainText.length > 320 ? mainText.slice(0, 320) + "..." : mainText;
      aiContent = `Based on your company's policy document **"${topArticle.title}"**:\n\n${topArticle.summary ? topArticle.summary + "\n\n" : ""}${excerpt || topArticle.title}\n\nFor additional guidelines, please reference the official article below.`;
    } else if (activeAssignments.length > 0) {
      aiContent = `You currently have **${activeAssignments.length} active onboarding journey(s)** assigned. Your progress is on track! Check your assigned tasks to complete pending modules.`;
    } else {
      aiContent = `Welcome! I am your Talnova AI Onboarding Assistant. You can ask me questions about company policies, onboarding checklists, or assigned learning journeys. What can I help you with today?`;
    }

    // 5. Add AI Assistant Message
    conversation.messages.push({
      sender: "assistant",
      content: aiContent,
      citations,
      actionSuggestions,
      timestamp: new Date(),
    });

    await conversation.save();
    return conversation;
  }

  /**
   * List User Conversations (AI-005)
   */
  async getConversations(orgId: string | mongoose.Types.ObjectId, userId: string | mongoose.Types.ObjectId) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    const userObjectId = new mongoose.Types.ObjectId(userId.toString());

    return AIConversation.find({
      organizationId: orgObjectId,
      userId: userObjectId,
    }).sort({ updatedAt: -1 });
  }

  /**
   * Get Conversation Thread (AI-005)
   */
  async getConversationById(
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    conversationId: string
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    const userObjectId = new mongoose.Types.ObjectId(userId.toString());

    return AIConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      organizationId: orgObjectId,
      userId: userObjectId,
    });
  }

  /**
   * Log Response Feedback (AI-005)
   */
  async logFeedback(
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    conversationId: string,
    messageId: string,
    rating: "up" | "down",
    comment?: string
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    const userObjectId = new mongoose.Types.ObjectId(userId.toString());

    const conversation = await AIConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      organizationId: orgObjectId,
      userId: userObjectId,
    });

    if (!conversation) {
      throw new Error("Conversation thread not found");
    }

    conversation.feedback.push({
      messageId,
      rating,
      comment,
      timestamp: new Date(),
    });

    await conversation.save();
    return conversation;
  }
}
