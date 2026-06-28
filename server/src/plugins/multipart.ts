import fastifyMultipart from "@fastify/multipart";
import { FastifyInstance } from "fastify";
import storageConfig from "../config/storage.config.js";

export async function registerMultipart(app: FastifyInstance) {
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: storageConfig.maxUploadSize,
    },
  });
}

export default registerMultipart;
