import { FastifyInstance, FastifyPluginAsync } from "fastify";
import ContactController from "../controllers/contact.controller.js";

export const contactRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const controller = new ContactController();

  // List contacts with filtering, search, and pagination
  app.get("/", controller.getContacts);

  // Create new contact
  app.post("/", controller.createContact);

  // Get contact by ID
  app.get("/:id", controller.getContactById);

  // Update contact fields
  app.patch("/:id", controller.updateContact);

  // Delete contact
  app.delete("/:id", controller.deleteContact);
};

export default contactRoutes;
