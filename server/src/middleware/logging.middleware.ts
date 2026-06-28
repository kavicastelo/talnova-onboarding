import { FastifyInstance } from "fastify";

export function registerLogging(app: FastifyInstance) {
  app.addHook("onRequest", async (request) => {
    (request as any).startTime = process.hrtime();
    request.log.info({
      reqId: request.id,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    }, `📥 Incoming Request: ${request.method} ${request.url}`);
  });

  app.addHook("onResponse", async (request, reply) => {
    const startTime = (request as any).startTime;
    let duration = 0;
    if (startTime) {
      const diff = process.hrtime(startTime);
      duration = diff[0] * 1e3 + diff[1] * 1e-6; // convert to milliseconds
    }
    request.log.info({
      reqId: request.id,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      durationMs: Number(duration.toFixed(2)),
    }, `📤 Outgoing Response: ${request.method} ${request.url} - ${reply.statusCode} (${duration.toFixed(2)}ms)`);
  });
}

export default registerLogging;
