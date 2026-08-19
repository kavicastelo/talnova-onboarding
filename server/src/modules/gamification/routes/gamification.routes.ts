import { FastifyInstance } from "fastify";
import { GamificationController } from "../controllers/gamification.controller.js";
import { GamificationService } from "../services/gamification.service.js";
import { authenticate } from "../../../middleware/auth.middleware.js";

export async function gamificationRoutes(app: FastifyInstance) {
  const service = new GamificationService();
  const controller = new GamificationController(service);

  // Authenticate all routes
  app.addHook("preHandler", authenticate);

  // GET /api/v1/gamification/profile
  app.get("/profile", controller.getProfile as any);

  // POST /api/v1/gamification/award-points
  app.post("/award-points", controller.awardPoints as any);

  // POST /api/v1/gamification/streak
  app.post("/streak", controller.recordStreak as any);

  // GET /api/v1/gamification/leaderboard
  app.get("/leaderboard", controller.getLeaderboard as any);
}

export default gamificationRoutes;
