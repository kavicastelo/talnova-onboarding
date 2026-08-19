import { FastifyReply, FastifyRequest } from "fastify";
import { AIAssistantService } from "../services/ai-assistant.service.js";
import { AICourseBuilderService } from "../services/ai-course-builder.service.js";

export class AIAssistantController {
  constructor(
    private readonly service: AIAssistantService,
    private readonly courseBuilderService = new AICourseBuilderService()
  ) {}

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

  generateCourseDraft = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;

    if (!body.prompt || typeof body.prompt !== "string") {
      return reply.status(400).send({
        success: false,
        message: "Prompt is required for course generation",
      });
    }

    const draft = await this.courseBuilderService.generateJourneyOutline(
      user.organizationId,
      user.userId,
      body.prompt,
      body.targetRole,
      body.department
    );

    return reply.status(201).send({
      success: true,
      message: "AI course draft generated successfully",
      data: draft,
    });
  };

  getCourseDrafts = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const drafts = await this.courseBuilderService.getDrafts(user.organizationId);

    return reply.status(200).send({
      success: true,
      message: "AI course drafts retrieved successfully",
      data: drafts,
    });
  };

  getCourseDraftById = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    const draft = await this.courseBuilderService.getDraftById(user.organizationId, params.id);
    if (!draft) {
      return reply.status(404).send({
        success: false,
        message: "Course draft not found",
      });
    }

    return reply.status(200).send({
      success: true,
      message: "AI course draft retrieved successfully",
      data: draft,
    });
  };

  regenerateModule = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = request.body as any;

    const draft = await this.courseBuilderService.regenerateModule(
      user.organizationId,
      user.userId,
      params.id,
      body.moduleId
    );

    return reply.status(200).send({
      success: true,
      message: "Module regenerated successfully",
      data: draft,
    });
  };

  publishCourseDraft = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    const result = await this.courseBuilderService.publishDraftToJourney(
      user.organizationId,
      user.userId,
      params.id
    );

    return reply.status(200).send({
      success: true,
      message: "Course draft published to live Journeys successfully",
      data: result,
    });
  };

  deleteCourseDraft = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    await this.courseBuilderService.deleteDraft(user.organizationId, params.id);

    return reply.status(200).send({
      success: true,
      message: "Course draft deleted successfully",
    });
  };
}
