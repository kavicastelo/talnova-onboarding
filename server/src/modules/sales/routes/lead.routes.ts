import { FastifyInstance, FastifyPluginAsync } from "fastify";
import LeadController from "../controllers/lead.controller.js";

export const leadRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const controller = new LeadController();

  // List and search leads with pagination
  app.get("/", controller.getLeads);

  // Create new lead
  app.post("/", controller.createLead);

  // Check duplicate candidates (by email, phone, name, company)
  app.post("/check-duplicates", controller.checkDuplicates);

  // Merge duplicate leads into a primary lead
  app.post("/merge", controller.mergeLeads);

  // CSV Import Preview with column auto-mapping
  app.post("/import/preview", controller.previewImport);

  // CSV Import Execution with duplicate resolution
  app.post("/import/execute", controller.executeImport);

  // Get lead by ID
  app.get("/:id", controller.getLeadById);

  // Get potential duplicate leads for a specific lead
  app.get("/:id/duplicates", controller.getDuplicatesForLead);

  // Update lead fields
  app.patch("/:id", controller.updateLead);

  // Delete lead
  app.delete("/:id", controller.deleteLead);

  // Update lead status with optional note and disqualification reason
  app.patch("/:id/status", controller.updateLeadStatus);

  // Add note to lead
  app.post("/:id/notes", controller.addLeadNote);

  // Recalculate lead score based on profile, engagement, and rules
  app.post("/:id/recalculate-score", controller.recalculateLeadScore);

  // Record a custom score event
  app.post("/:id/score-event", controller.recordScoreEvent);
};

export default leadRoutes;
