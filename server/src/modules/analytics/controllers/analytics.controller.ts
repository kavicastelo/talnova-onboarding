import { FastifyReply, FastifyRequest } from "fastify";
import { AnalyticsService } from "../services/analytics.service.js";

export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  getSummary = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const summary = await this.service.getSummary(user.organizationId);

    return reply.status(200).send({
      success: true,
      message: "Analytics summary retrieved successfully",
      data: summary,
    });
  };
}
