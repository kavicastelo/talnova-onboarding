import fastifyJwt from "@fastify/jwt";
import { FastifyInstance } from "fastify";
import jwtConfig from "../config/jwt.config.js";

export async function registerJwt(app: FastifyInstance) {
  await app.register(fastifyJwt, {
    secret: jwtConfig.secret,
    cookie: {
      cookieName: "refreshToken",
      signed: false,
    },
    sign: {
      expiresIn: jwtConfig.accessTokenExpiry,
    },
  });
}

export default registerJwt;
