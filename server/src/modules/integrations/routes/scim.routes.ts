import { FastifyInstance } from "fastify";
import { scimController } from "../controllers/scim.controller.js";

export async function scimRoutes(app: FastifyInstance) {
  // SCIM 2.0 Discovery
  app.get("/ServiceProviderConfig", scimController.getServiceProviderConfig);
  app.get("/ResourceTypes", scimController.getResourceTypes);

  // SCIM 2.0 User Provisioning (RFC 7644)
  app.post("/Users", scimController.createUser);
  app.get("/Users", scimController.listUsers);
  app.get("/Users/:id", scimController.getUser);
  app.put("/Users/:id", scimController.updateUser);
  app.patch("/Users/:id", scimController.patchUser);
  app.delete("/Users/:id", scimController.deleteUser);
}

export default scimRoutes;
