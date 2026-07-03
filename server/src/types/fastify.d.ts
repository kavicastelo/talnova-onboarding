import { TokenPayload } from "../modules/auth/services/auth.service.js";
import { SupportedLocale } from "../config/localization.config.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: TokenPayload;
    /** Resolved locale attached by extractLocale middleware. Defaults to "en". */
    locale: SupportedLocale;
  }
}
