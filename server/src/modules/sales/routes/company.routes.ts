import { FastifyInstance, FastifyPluginAsync } from "fastify";
import CompanyController from "../controllers/company.controller.js";

export const companyRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const controller = new CompanyController();

  // List companies with filtering, search, and pagination
  app.get("/", controller.getCompanies);

  // Create new company
  app.post("/", controller.createCompany);

  // Get company 360 overview (contacts, deals, tasks, threads, metrics)
  app.get("/:id/360", controller.getCompany360);

  // Get company by ID
  app.get("/:id", controller.getCompanyById);

  // Update company fields
  app.patch("/:id", controller.updateCompany);

  // Delete company (fails if active deals exist)
  app.delete("/:id", controller.deleteCompany);

  // Add note to company
  app.post("/:id/notes", controller.addNote);
};

export default companyRoutes;
