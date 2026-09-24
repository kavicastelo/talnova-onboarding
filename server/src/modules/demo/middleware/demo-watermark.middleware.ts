import { FastifyRequest, FastifyReply } from "fastify";
import { demoConfig } from "../../../config/index.js";

/**
 * Appends watermark and demo attribution headers to every demo response.
 */
export async function attachDemoHeaders(request: FastifyRequest, reply: FastifyReply) {
  reply.header("X-Demo-Environment", "true");
  reply.header("X-Demo-Watermark-Enabled", String(demoConfig.watermarkEnabled));

  if (request.demoUser) {
    const shortSession = request.demoUser.sessionId.split("-")[0].toUpperCase();
    reply.header(
      "X-Demo-Attribution",
      `${request.demoUser.companyName || "DEMO"} | ${request.demoUser.email} | ${shortSession}`
    );
  }
}
