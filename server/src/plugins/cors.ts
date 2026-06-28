import fastifyCors from "@fastify/cors";
import { FastifyInstance } from "fastify";
import corsConfig from "../config/cors.config.js";
import { appConfig } from "../config/index.js";

export async function registerCors(app: FastifyInstance) {
  await app.register(fastifyCors, {
    origin: appConfig.isProduction ? corsConfig.allowedOrigins : true, // allow all origins in dev, restrict in prod
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
}

export default registerCors;
