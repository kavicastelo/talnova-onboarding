import { FastifyInstance, FastifyPluginAsync } from "fastify";
import PipelineController from "../controllers/pipeline.controller.js";

export const pipelineRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const controller = new PipelineController();

  // Get default pipeline (auto-seeds if none exists)
  app.get("/default", controller.getDefaultPipeline);

  // List all pipelines
  app.get("/", controller.getPipelines);

  // Get pipeline by ID
  app.get("/:id", controller.getPipelineById);

  // Create new pipeline
  app.post("/", controller.createPipeline);

  // Update pipeline metadata (name, isDefault)
  app.patch("/:id", controller.updatePipeline);

  // Set/reorder stages
  app.put("/:id/stages", controller.setStages);

  // Add single stage
  app.post("/:id/stages", controller.addStage);

  // Update single stage
  app.patch("/:id/stages/:stageKey", controller.updateSingleStage);

  // Delete single stage (blocked if deals occupy stage)
  app.delete("/:id/stages/:stageKey", controller.deleteStage);

  // Delete pipeline (blocked if default or deals assigned)
  app.delete("/:id", controller.deletePipeline);
};

export default pipelineRoutes;
