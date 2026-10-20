import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { scimController } from "../controllers/scim.controller.js";

export async function scimRoutes(app: FastifyInstance) {
  const requireScimAuth = async (request: FastifyRequest, _reply: FastifyReply) => {
    const orgId = await scimController.resolveOrgId(request);
    (request as any).scimOrgId = orgId;
  };

  // SCIM 2.0 Discovery (Public per RFC 7644 Section 4)
  app.get("/ServiceProviderConfig", scimController.getServiceProviderConfig);
  app.get("/ResourceTypes", scimController.getResourceTypes);

  // SCIM 2.0 User Provisioning (RFC 7644) - Protected by SCIM Bearer authentication
  app.post("/Users", { preHandler: [requireScimAuth] }, scimController.createUser);
  app.get("/Users", { preHandler: [requireScimAuth] }, scimController.listUsers);
  app.get("/Users/:id", { preHandler: [requireScimAuth] }, scimController.getUser);
  app.put("/Users/:id", { preHandler: [requireScimAuth] }, scimController.updateUser);
  app.patch("/Users/:id", { preHandler: [requireScimAuth] }, scimController.patchUser);
  app.delete("/Users/:id", { preHandler: [requireScimAuth] }, scimController.deleteUser);
}

export default scimRoutes;
