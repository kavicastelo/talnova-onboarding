import { FastifyReply, FastifyRequest } from "fastify";
import { AIAssistantService } from "../services/ai-assistant.service.js";

export class AIAssistantController {
  constructor(private readonly service: AIAssistantService) {}

  chat = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;

    if (!body.message || typeof body.message !== "string") {
      return reply.status(400).send({
        success: false,
        message: "Message prompt is required",
      });
    }

    const conversation = await this.service.chat(
      user.organizationId,
      user.userId,
      user.role || "employee",
      body.message,
      body.conversationId
    );

    return reply.status(200).send({
      success: true,
      message: "AI response generated successfully",
      data: conversation,
    });
  };

  getConversations = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const conversations = await this.service.getConversations(user.organizationId, user.userId);

    return reply.status(200).send({
      success: true,
      message: "AI conversations retrieved successfully",
      data: conversations,
    });
  };

  getConversationById = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    const conversation = await this.service.getConversationById(user.organizationId, user.userId, params.id);

    if (!conversation) {
      return reply.status(404).send({
        success: false,
        message: "Conversation not found",
      });
    }

    return reply.status(200).send({
      success: true,
      message: "AI conversation thread retrieved successfully",
      data: conversation,
    });
  };

  logFeedback = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;

    const conversation = await this.service.logFeedback(
      user.organizationId,
      user.userId,
      body.conversationId,
      body.messageId,
      body.rating,
      body.comment
    );

    return reply.status(200).send({
      success: true,
      message: "Feedback logged successfully",
      data: conversation,
    });
  };
}
