import { FastifyReply, FastifyRequest } from "fastify";
import { GamificationService } from "../services/gamification.service.js";

export class GamificationController {
  constructor(private readonly service: GamificationService) {}

  getProfile = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const profile = await this.service.getProfile(user.organizationId, user.userId);

    return reply.status(200).send({
      success: true,
      message: "Gamification profile retrieved successfully",
      data: profile,
    });
  };

  awardPoints = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;

    const profile = await this.service.awardPoints(
      user.organizationId,
      user.userId,
      body.action || "general_activity",
      body.points || 10,
      body.description || "Completed onboarding activity"
    );

    return reply.status(200).send({
      success: true,
      message: "Points awarded successfully",
      data: profile,
    });
  };

  recordStreak = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const profile = await this.service.recordActivityStreak(user.organizationId, user.userId);

    return reply.status(200).send({
      success: true,
      message: "Activity streak recorded successfully",
      data: profile,
    });
  };

  getLeaderboard = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const leaderboard = await this.service.getLeaderboard(user.organizationId);

    return reply.status(200).send({
      success: true,
      message: "Organization leaderboard retrieved successfully",
      data: leaderboard,
    });
  };
}
