import { FastifyInstance, FastifyPluginAsync } from "fastify";
import CampaignController from "../controllers/campaign.controller.js";

export const campaignRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const controller = new CampaignController();

  // Template endpoints (placed before /:id parameterized routes)
  app.get("/templates", controller.getTemplates);
  app.post("/templates", controller.createTemplate);
  app.post("/templates/preview", controller.previewTemplate);
  app.get("/templates/:id", controller.getTemplateById);
  app.patch("/templates/:id", controller.updateTemplate);
  app.delete("/templates/:id", controller.deleteTemplate);

  // Audience segmentation & estimation endpoints (placed before /:id)
  app.post("/audience/estimate", controller.estimateAudience);
  app.post("/audience/resolve", controller.resolveAudience);

  // Campaign endpoints
  app.get("/", controller.getCampaigns);
  app.post("/", controller.createCampaign);
  app.get("/:id", controller.getCampaignById);
  app.patch("/:id", controller.updateCampaign);
  app.patch("/:id/status", controller.updateCampaignStatus);
  app.post("/:id/clone", controller.cloneCampaign);
  app.post("/:id/recipients", controller.addRecipients);
  app.post("/:id/launch", controller.launchCampaign);
  app.post("/:id/pause", controller.pauseCampaign);
  app.post("/:id/resume", controller.resumeCampaign);
  app.post("/:id/cancel", controller.cancelCampaign);
  app.get("/:id/status-live", controller.getExecutionStatus);
  app.delete("/:id", controller.deleteCampaign);
};

export default campaignRoutes;
