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

  getTimeToCompletion = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const metrics = await this.service.getTimeToCompletionMetrics(user.organizationId);

    return reply.status(200).send({
      success: true,
      message: "Time-to-completion metrics retrieved successfully",
      data: metrics,
    });
  };

  getBottlenecks = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const bottlenecks = await this.service.getQuizAndModuleBottlenecks(user.organizationId);

    return reply.status(200).send({
      success: true,
      message: "Quiz and module failure bottlenecks retrieved successfully",
      data: bottlenecks,
    });
  };

  exportCSV = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const csvContent = await this.service.exportAnalyticsCSV(user.organizationId);

    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", 'attachment; filename="onboarding-analytics.csv"')
      .send(csvContent);
  };

  createScheduledReport = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;

    const report = await this.service.createScheduledReport(user.organizationId, user.userId, body);

    return reply.status(201).send({
      success: true,
      message: "Scheduled report created successfully",
      data: report,
    });
  };

  listScheduledReports = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const reports = await this.service.listScheduledReports(user.organizationId);

    return reply.status(200).send({
      success: true,
      message: "Scheduled reports retrieved successfully",
      data: reports,
    });
  };

  deleteScheduledReport = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    await this.service.deleteScheduledReport(user.organizationId, params.id);

    return reply.status(200).send({
      success: true,
      message: "Scheduled report deleted successfully",
    });
  };
}
