import { FastifyInstance } from "fastify";
import { AIAssistantController } from "../controllers/ai-assistant.controller.js";
import { AIAssistantService } from "../services/ai-assistant.service.js";
import { authenticate } from "../../../middleware/auth.middleware.js";

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
}

export default aiAssistantRoutes;
