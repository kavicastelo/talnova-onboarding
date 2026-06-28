import fastifyCookie from "@fastify/cookie";
import { FastifyInstance } from "fastify";
import jwtConfig from "../config/jwt.config.js";

export async function registerCookie(app: FastifyInstance) {
  await app.register(fastifyCookie, {
    secret: jwtConfig.cookieSecret,
  });
}

export default registerCookie;
