import fastifyCookie from "@fastify/cookie";
import { FastifyInstance } from "fastify";
import jwtConfig from "../config/jwt.config.js";

export async function registerCookie(app: FastifyInstance) {
  const secret = process.env.COOKIE_SECRET || jwtConfig.cookieSecret;
  if (!secret || secret.length < 8) {
    throw new Error("FATAL: COOKIE_SECRET must be configured with at least 8 characters.");
  }

  await app.register(fastifyCookie, {
    secret,
    hook: "onRequest",
    parseOptions: {},
  });
}

export default registerCookie;
