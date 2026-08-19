import { FastifyReply, FastifyRequest } from "fastify";
import { HROperationsService } from "../services/hr-operations.service.js";

export class HROperationsController {
  constructor(private readonly hrService: HROperationsService) {}

  getDashboardMetrics = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const metrics = await this.hrService.getDashboardMetrics(user.organizationId);

    return reply.status(200).send({
      success: true,
      message: "HR operational dashboard metrics retrieved successfully",
      data: metrics,
    });
  };

  getExceptionQueue = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const exceptions = await this.hrService.getExceptionQueue(user.organizationId);

    return reply.status(200).send({
      success: true,
      message: "Onboarding exception queue retrieved successfully",
      data: exceptions,
    });
  };

  updateLifecycleState = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = request.body as any;

    const updatedUser = await this.hrService.updateLifecycleState(
      user.organizationId,
      params.userId,
      body.state,
      body.reason,
      body.extensionDays
    );

    return reply.status(200).send({
      success: true,
      message: "Employee onboarding lifecycle state updated successfully",
      data: updatedUser,
    });
  };

  executeBulkAction = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;

    const result = await this.hrService.executeBulkAction(
      user.organizationId,
      user.userId,
      body.action,
      body.employeeIds,
      body.payload || {}
    );

    return reply.status(200).send({
      success: true,
      message: `Bulk ${body.action} executed successfully for ${result.processedCount} employees`,
      data: result,
    });
  };

  generateComplianceReport = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const report = await this.hrService.generateComplianceReport(user.organizationId);

    return reply.status(200).send({
      success: true,
      message: "HR compliance report generated successfully",
      data: report,
    });
  };
}

export default HROperationsController;
