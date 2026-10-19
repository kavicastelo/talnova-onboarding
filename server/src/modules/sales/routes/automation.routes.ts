import { FastifyInstance, FastifyPluginAsync } from "fastify";
import AutomationController from "../controllers/automation.controller.js";

export const automationRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const controller = new AutomationController();

  // List pre-built automation rules inventory and configuration
  app.get("/rules", controller.getRules);

  // Manually trigger an automation rule against a target entity
  app.post("/trigger", controller.triggerRule);

  // Trigger background stale scan for uncontacted leads and inactive deals
  app.post("/stale-scan", controller.runStaleScan);

  // Fetch recent automation execution logs
  app.get("/logs", controller.getLogs);
};

export default automationRoutes;
