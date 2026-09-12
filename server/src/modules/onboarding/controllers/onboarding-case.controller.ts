import { FastifyReply, FastifyRequest } from "fastify";
import { OnboardingCaseService, onboardingCaseService } from "../services/onboarding-case.service.js";
import { GetExceptionsQuery, ResolveExceptionBody } from "../schemas/onboarding.schema.js";

export class OnboardingCaseController {
  constructor(private readonly service: OnboardingCaseService = onboardingCaseService) {}

  getExceptions = async (
    request: FastifyRequest<{ Querystring: GetExceptionsQuery }>,
    reply: FastifyReply
  ) => {
    const user = (request as any).user;
    const organizationId = user.organizationId;
    const filter = request.query;

    const result = await this.service.getExceptionCases(organizationId, filter);

    return reply.status(200).send({
      success: true,
      message: "Quarantined onboarding exception cases retrieved successfully.",
      data: result.cases,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  };

  resolveException = async (
    request: FastifyRequest<{
      Params: { caseId: string };
      Body: ResolveExceptionBody;
    }>,
    reply: FastifyReply
  ) => {
    const user = (request as any).user;
    const organizationId = user.organizationId;
    const actorUserId = user.userId;
    const { caseId } = request.params;
    const resolution = request.body;

    const result = await this.service.resolveException(
      caseId,
      organizationId,
      actorUserId,
      resolution,
      {
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      }
    );

    return reply.status(200).send(result);
  };
}

export const onboardingCaseController = new OnboardingCaseController();
export default onboardingCaseController;
