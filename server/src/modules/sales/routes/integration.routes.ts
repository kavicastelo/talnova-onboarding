import { FastifyInstance, FastifyPluginAsync } from "fastify";
import SalesIntegrationController from "../controllers/sales-integration.controller.js";

export const integrationRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const controller = new SalesIntegrationController();

  app.get("/", controller.listIntegrations);
  app.get("/:category/:provider", controller.getIntegration);
  app.post("/:category/:provider", controller.saveIntegration);
  app.post("/:category/:provider/test", controller.testIntegration);
  app.delete("/:category/:provider", controller.deleteIntegration);
};

export default integrationRoutes;
