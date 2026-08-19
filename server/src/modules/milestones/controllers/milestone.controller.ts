import { FastifyReply, FastifyRequest } from "fastify";
import { MilestoneService } from "../services/milestone.service.js";

export class MilestoneController {
  constructor(private readonly milestoneService: MilestoneService) {}

  createTemplate = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;

    const template = await this.milestoneService.createTemplate(user.organizationId, user.userId, body);

    return reply.status(201).send({
      success: true,
      message: "Milestone template created successfully",
      data: template,
    });
  };

  listTemplates = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const templates = await this.milestoneService.listTemplates(user.organizationId);

    return reply.status(200).send({
      success: true,
      message: "Milestone templates retrieved successfully",
      data: templates,
    });
  };

  assignMilestone = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;

    const milestone = await this.milestoneService.assignMilestone(
      user.organizationId,
      body.templateId,
      body.employeeId,
      user.userId
    );

    return reply.status(201).send({
      success: true,
      message: "Milestone assigned successfully",
      data: milestone,
    });
  };

  getMyMilestones = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const milestones = await this.milestoneService.getEmployeeMilestones(user.organizationId, user.userId);

    return reply.status(200).send({
      success: true,
      message: "Employee milestones retrieved successfully",
      data: milestones,
    });
  };

  getTeamMilestones = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const milestones = await this.milestoneService.getManagerTeamMilestones(
      user.organizationId,
      user.userId,
      user.role
    );

    return reply.status(200).send({
      success: true,
      message: "Team milestones retrieved successfully",
      data: milestones,
    });
  };

  submitEmployeeSelfCheck = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = request.body as any;

    const milestone = await this.milestoneService.submitEmployeeSelfCheck(
      user.organizationId,
      params.id,
      user.userId,
      body
    );

    return reply.status(200).send({
      success: true,
      message: "Milestone self check-in submitted successfully",
      data: milestone,
    });
  };

  submitManagerReview = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = request.body as any;

    const milestone = await this.milestoneService.submitManagerReview(
      user.organizationId,
      params.id,
      user.userId,
      user.role,
      body
    );

    return reply.status(200).send({
      success: true,
      message: "Manager milestone review submitted successfully",
      data: milestone,
    });
  };
}
