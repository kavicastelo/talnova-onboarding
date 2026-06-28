import { FastifyInstance } from "fastify";

export function registerRequestId(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    reply.header("X-Request-Id", request.id);
  });
}

export default registerRequestId;
