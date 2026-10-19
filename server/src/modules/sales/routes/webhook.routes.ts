import { FastifyInstance, FastifyPluginAsync } from "fastify";
import webhookController from "../controllers/webhook.controller.js";

export const webhookRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Support AWS SNS plain-text JSON delivery
  app.addContentTypeParser(
    "text/plain",
    { parseAs: "string" },
    (_req, body: string, done) => {
      try {
        if (!body || body.trim() === "") {
          return done(null, {});
        }
        const json = JSON.parse(body);
        done(null, json);
      } catch {
        done(null, body);
      }
    }
  );

  // Amazon SES / SNS webhook
  app.post("/ses", (req, reply) => webhookController.handleSesWebhook(req, reply));

  // SendGrid Event webhook
  app.post("/sendgrid", (req, reply) => webhookController.handleSendGridWebhook(req, reply));

  // Meta WhatsApp Cloud API webhooks
  app.get("/whatsapp", (req, reply) => webhookController.verifyWhatsAppWebhook(req, reply));
  app.post("/whatsapp", (req, reply) => webhookController.handleWhatsAppWebhook(req, reply));
};

export default webhookRoutes;
