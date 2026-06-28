import { FastifyReply, FastifyRequest } from "fastify";
import { JourneyService } from "../services/journey.service.js";

export class JourneyController {
  constructor(private readonly journeyService: JourneyService) {}

  getJourney = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const journey = await this.journeyService.getJourney(params.id, user.organizationId);

    return reply.status(200).send({
      success: true,
      message: "Journey retrieved successfully",
      data: journey,
    });
  };

  listJourneys = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const query = request.query as any;

    const filter = {
      organizationId: user.organizationId,
      status: query.status,
      category: query.category,
      tags: query.tags ? (Array.isArray(query.tags) ? query.tags : [query.tags]) : undefined,
      search: query.search,
    };

    const pagination = {
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };

    const result = await this.journeyService.listJourneys(filter, pagination);

    return reply.status(200).send({
      success: true,
      message: "Journeys list retrieved successfully",
      data: result.journeys,
      meta: {
        total: result.total,
        page: pagination.page,
        limit: pagination.limit,
      },
    });
  };

  createJourney = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;
    const journey = await this.journeyService.createJourney(user.organizationId, body, user.userId);

    return reply.status(201).send({
      success: true,
      message: "Journey created successfully",
      data: journey,
    });
  };

  updateJourney = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const journey = await this.journeyService.updateJourney(
      params.id,
      user.organizationId,
      request.body as any,
      user.userId
    );

    return reply.status(200).send({
      success: true,
      message: "Journey updated successfully",
      data: journey,
    });
  };

  deleteJourney = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    await this.journeyService.deleteJourney(params.id, user.organizationId, user.userId);

    return reply.status(200).send({
      success: true,
      message: "Journey deleted successfully",
      data: null,
    });
  };

  publishJourney = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const journey = await this.journeyService.publishJourney(params.id, user.organizationId, user.userId);

    return reply.status(200).send({
      success: true,
      message: "Journey published successfully",
      data: journey,
    });
  };

  archiveJourney = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const journey = await this.journeyService.archiveJourney(params.id, user.organizationId, user.userId);

    return reply.status(200).send({
      success: true,
      message: "Journey archived successfully",
      data: journey,
    });
  };

  duplicateJourney = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = request.body as any;
    const journey = await this.journeyService.duplicateJourney(
      params.id,
      user.organizationId,
      body.title,
      user.userId
    );

    return reply.status(201).send({
      success: true,
      message: "Journey duplicated successfully",
      data: journey,
    });
  };

  getJourneyAnalytics = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const journey = await this.journeyService.getJourney(params.id, user.organizationId);

    return reply.status(200).send({
      success: true,
      message: "Journey analytics retrieved successfully",
      data: journey.analytics,
    });
  };
}

export default JourneyController;
