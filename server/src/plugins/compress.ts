import fastifyCompress from "@fastify/compress";
import { FastifyInstance } from "fastify";

export async function registerCompress(app: FastifyInstance) {
  await app.register(fastifyCompress, { global: true });
}

export default registerCompress;
