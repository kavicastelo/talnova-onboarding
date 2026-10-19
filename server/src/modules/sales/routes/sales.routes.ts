import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { authenticate, requireRole } from "../../../middleware/auth.middleware.js";
import { integrationRoutes } from "./integration.routes.js";
import { leadRoutes } from "./lead.routes.js";
import { companyRoutes } from "./company.routes.js";
import { contactRoutes } from "./contact.routes.js";
import { pipelineRoutes } from "./pipeline.routes.js";
import { dealRoutes } from "./deal.routes.js";
import { taskRoutes } from "./task.routes.js";
import { campaignRoutes } from "./campaign.routes.js";
import { webhookRoutes } from "./webhook.routes.js";
import { inboxRoutes } from "./inbox.routes.js";
import { automationRoutes } from "./automation.routes.js";
import { aiRoutes } from "./ai.routes.js";
import { analyticsRoutes } from "./analytics.routes.js";

export const salesRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Public webhook routes (unprotected by JWT, protected by cryptographic signature/secret verification)
  await app.register(webhookRoutes, { prefix: "/webhooks" });

  // Encapsulated authenticated super_admin sales routes
  await app.register(async (authApp) => {
    authApp.addHook("onRequest", authenticate);
    authApp.addHook("onRequest", requireRole(["super_admin"]));

    // Health and ping verification route for sales module
    authApp.get("/ping", async () => {
      return {
        status: "ok",
        module: "sales",
        timestamp: new Date().toISOString(),
      };
    });

    // Mount integration routes
    await authApp.register(integrationRoutes, { prefix: "/integrations" });

    // Mount lead routes
    await authApp.register(leadRoutes, { prefix: "/leads" });

    // Mount company directory routes
    await authApp.register(companyRoutes, { prefix: "/companies" });

    // Mount contact directory routes
    await authApp.register(contactRoutes, { prefix: "/contacts" });

    // Mount sales pipeline configuration routes
    await authApp.register(pipelineRoutes, { prefix: "/pipelines" });

    // Mount deals and weighted pipeline routes
    await authApp.register(dealRoutes, { prefix: "/deals" });

    // Mount sales tasks and calendar routes
    await authApp.register(taskRoutes, { prefix: "/tasks" });

    // Mount campaigns and templates routes
    await authApp.register(campaignRoutes, { prefix: "/campaigns" });

    // Mount unified inbox and communication thread routes
    await authApp.register(inboxRoutes, { prefix: "/inbox" });

    // Mount sales workflow automation engine routes
    await authApp.register(automationRoutes, { prefix: "/automation" });

    // Mount AI sales intelligence routes
    await authApp.register(aiRoutes, { prefix: "/ai" });

    // Mount sales analytics & action center routes
    await authApp.register(analyticsRoutes, { prefix: "/analytics" });
  });
};

export default salesRoutes;
