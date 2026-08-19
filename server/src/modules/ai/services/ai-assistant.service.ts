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
    const cleanedWords = messageText
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const searchRegex = cleanedWords.length > 0 ? new RegExp(cleanedWords.join("|"), "i") : /.*/;

    const matchingArticles = await Article.find({
      organizationId: orgObjectId,
      "publishing.status": "published",
      isDeleted: { $ne: true },
      $or: [{ title: searchRegex }, { summary: searchRegex }, { searchKeywords: searchRegex }],
    }).limit(3);

    // 3. Perform Task/Assignment Context Search
    const activeAssignments = await EmployeeAssignment.find({
      organizationId: orgObjectId,
      employeeId: userObjectId,
      status: "in_progress",
    }).limit(3);

    // 4. Synthesize AI Response & Citations
    const citations = matchingArticles.map((art) => ({
      title: art.title,
      url: `/knowledge-base/${art.slug}`,
      articleId: art._id.toString(),
    }));

    const actionSuggestions = [
      { text: "View Tasks & Checklists", action: "/tasks" },
      { text: "View Onboarding Journeys", action: "/journeys" },
      { text: "Contact Buddy Support", action: "/buddy" },
    ];

    let aiContent = "";

    if (matchingArticles.length > 0) {
      aiContent = `Based on your company's knowledge base article **"${matchingArticles[0].title}"**:\n\n${matchingArticles[0].summary || matchingArticles[0].title}...\n\nFor more detailed step-by-step instructions, please reference the official article below.`;
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
