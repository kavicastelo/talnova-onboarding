import { FastifyInstance, FastifyPluginAsync } from "fastify";
import DealController from "../controllers/deal.controller.js";

export const dealRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const controller = new DealController();

  // Kanban view grouped by pipeline stages
  app.get("/kanban", controller.getKanbanBoard);

  // Pipeline summary & weighted metric aggregations
  app.get("/summary", controller.getPipelineSummary);

  // Deal listing with search, filtering, and pagination
  app.get("/", controller.getDeals);

  // Single deal details
  app.get("/:id", controller.getDealById);

  // Create deal
  app.post("/", controller.createDeal);

  // Update deal attributes
  app.patch("/:id", controller.updateDeal);

  // Stage transition with validation and lossReason enforcement
  app.patch("/:id/stage", controller.updateDealStage);

  // Enterprise onboarding handoff
  app.post("/:id/handoff", controller.handoffDeal);

  // Delete deal
  app.delete("/:id", controller.deleteDeal);
};

export default dealRoutes;
