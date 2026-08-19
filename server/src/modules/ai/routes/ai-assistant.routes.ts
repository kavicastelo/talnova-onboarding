import { FastifyInstance } from "fastify";
import { AIAssistantController } from "../controllers/ai-assistant.controller.js";
import { AIAssistantService } from "../services/ai-assistant.service.js";
import { authenticate, requireRole } from "../../../middleware/auth.middleware.js";

export async function aiAssistantRoutes(app: FastifyInstance) {
  const service = new AIAssistantService();
  const controller = new AIAssistantController(service);

  // Authenticate all routes
  app.addHook("preHandler", authenticate);

  // POST /api/v1/ai/chat
  app.post("/chat", controller.chat as any);

  // GET /api/v1/ai/conversations
  app.get("/conversations", controller.getConversations as any);

  // GET /api/v1/ai/conversations/:id
  app.get("/conversations/:id", controller.getConversationById as any);

  // POST /api/v1/ai/feedback
  app.post("/feedback", controller.logFeedback as any);

  // AI Course & Journey Builder (AI-006 .. AI-010)
  app.post("/course-builder/generate", { preHandler: [requireRole(["owner", "admin"])] }, controller.generateCourseDraft as any);
  app.get("/course-builder/drafts", { preHandler: [requireRole(["owner", "admin"])] }, controller.getCourseDrafts as any);
  app.get("/course-builder/drafts/:id", { preHandler: [requireRole(["owner", "admin"])] }, controller.getCourseDraftById as any);
  app.post("/course-builder/drafts/:id/regenerate-module", { preHandler: [requireRole(["owner", "admin"])] }, controller.regenerateModule as any);
  app.post("/course-builder/drafts/:id/publish", { preHandler: [requireRole(["owner", "admin"])] }, controller.publishCourseDraft as any);
  app.delete("/course-builder/drafts/:id", { preHandler: [requireRole(["owner", "admin"])] }, controller.deleteCourseDraft as any);
}

export default aiAssistantRoutes;
