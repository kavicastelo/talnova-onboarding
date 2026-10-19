import { FastifyInstance, FastifyPluginAsync } from "fastify";
import InboxController from "../controllers/inbox.controller.js";

export const inboxRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const controller = new InboxController();

  // List threads with filters (channel, status, assignedTo, unread, search) and pagination
  app.get("/", controller.listThreads);

  // Initialize a new outbound communication thread
  app.post("/", controller.createThread);

  // Retrieve single thread by ID with full chronological message history
  app.get("/:id", controller.getThreadById);

  // Send an outbound reply message on an existing thread
  app.post("/:id/reply", controller.sendReply);

  // Update thread status, owner assignment, or entity linkages
  app.patch("/:id", controller.updateThread);

  // Mark all unread inbound messages in thread as read
  app.post("/:id/read", controller.markThreadRead);
};

export default inboxRoutes;
