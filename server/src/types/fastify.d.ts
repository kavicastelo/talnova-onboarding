import { TokenPayload } from "../modules/auth/services/auth.service.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: TokenPayload;
  }
}
