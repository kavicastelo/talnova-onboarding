import fastifyHelmet from "@fastify/helmet";
import { FastifyInstance } from "fastify";

export async function registerHelmet(app: FastifyInstance) {
  await app.register(fastifyHelmet, {
    global: true,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
      },
    },
  });
}

export default registerHelmet;
