import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { FastifyInstance } from "fastify";

export async function registerSwagger(app: FastifyInstance) {
  // Register swagger core
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "Talnova Onboarding API Documentation",
        description: "API endpoints for the Talnova Onboarding Platform learning engine, knowledge base, uploads, and notification systems.",
        version: "1.0.0",
      },
      servers: [
        {
          url: "http://localhost:8080",
          description: "Development Server",
        },
      ],
      components: {
        securitySchemes: {
          cookieAuth: {
            type: "apiKey",
            in: "cookie",
            name: "access_token",
            description: "Session access token stored in HTTPOnly cookie",
          },
        },
      },
      security: [
        {
          cookieAuth: [],
        },
      ],
    },
  });

  // Register swagger UI
  await app.register(fastifySwaggerUi, {
    routePrefix: "/documentation",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });
}

export default registerSwagger;
