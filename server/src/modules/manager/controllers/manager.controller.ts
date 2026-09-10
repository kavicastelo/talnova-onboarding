import { FastifyReply, FastifyRequest } from "fastify";
import { ManagerService } from "../services/manager.service.js";

export class ManagerController {
  constructor(private readonly managerService: ManagerService) {}

  getManagerDashboard = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const data = await this.managerService.getManagerDashboard(
      user.organizationId,
      user.userId,
      user.role
    );

    return reply.status(200).send({
      success: true,
      message: "Manager dashboard retrieved successfully",
      data,
    });
  };

  getTeamOverview = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const [metrics, team] = await Promise.all([
      this.managerService.getManagerDashboard(
        user.organizationId,
        user.userId,
        user.role
      ),
      this.managerService.getTeamDirectReports(
        user.organizationId,
        user.userId,
        user.role
      ),
    ]);

    return reply.status(200).send({
      success: true,
      message: "Team overview retrieved successfully",
      data: {
        metrics,
        team,
        totalDirectReports: metrics.totalDirectReports,
        averageProgress: metrics.overallCompletionRate,
        overdueCount: metrics.overdueItemsCount,
      },
    });
  };

  getTeamDirectReports = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const data = await this.managerService.getTeamDirectReports(
      user.organizationId,
      user.userId,
      user.role
    );

    return reply.status(200).send({
      success: true,
      message: "Direct reports roster retrieved successfully",
      data,
    });
  };

  getDirectReportDetails = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const data = await this.managerService.getDirectReportDetails(
      user.organizationId,
      user.userId,
      user.role,
      params.employeeId
    );

    return reply.status(200).send({
      success: true,
      message: "Direct report details retrieved successfully",
      data,
    });
  };

  nudgeDirectReport = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = (request.body as any) || {};

    const data = await this.managerService.nudgeDirectReport(
      user.organizationId,
      user.userId,
      user.role,
      params.employeeId,
      body.message
    );

    return reply.status(200).send({
      success: true,
      message: data.message,
      data,
    });
  };

  signOffDirectReport = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = (request.body as any) || {};

    const data = await this.managerService.signOffDirectReport(
      user.organizationId,
      user.userId,
      user.role,
      params.employeeId,
      body.notes
    );

    return reply.status(200).send({
      success: true,
      message: data.message,
      data,
    });
  };
}
