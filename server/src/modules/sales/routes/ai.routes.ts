import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { AIController } from "../controllers/ai.controller.js";

export const aiRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const controller = new AIController();

  // Generate or retrieve executive summary and recommendations for lead
  app.post("/leads/:id/summarize", controller.summarizeLead);

  // Retrieve historical AI insights for a specific lead
  app.get("/leads/:id/insights", controller.getLeadInsights);

  // Analyze deal risk, detect objections, and generate rescue playbook
  app.post("/deals/:id/analyze-risk", controller.analyzeDealRisk);

  // Retrieve historical AI insights for a specific deal
  app.get("/deals/:id/insights", controller.getDealInsights);

  // Update insight approval/review status
  app.patch("/insights/:id/status", controller.updateInsightStatus);

  // Command center overview: high-risk deals, high-intent leads, metrics summary
  app.get("/overview", controller.getOverview);

  // Conversational sales data co-pilot
  app.post("/chat", controller.chatWithSalesData);
};
