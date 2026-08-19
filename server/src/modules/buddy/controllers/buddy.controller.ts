import { FastifyReply, FastifyRequest } from "fastify";
import { BuddyService } from "../services/buddy.service.js";

export class BuddyController {
  constructor(private readonly buddyService: BuddyService) {}

  registerProfile = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;

    const profile = await this.buddyService.registerBuddyProfile(user.organizationId, user.userId, body);

    return reply.status(200).send({
      success: true,
      message: "Buddy profile updated successfully",
      data: profile,
    });
  };

  listAvailableBuddies = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const buddies = await this.buddyService.listAvailableBuddies(user.organizationId);

    return reply.status(200).send({
      success: true,
      message: "Available buddies retrieved successfully",
      data: buddies,
    });
  };

  assignBuddy = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;

    const assignment = await this.buddyService.assignBuddy(
      user.organizationId,
      body.newHireUserId,
      body.buddyUserId,
      user.userId
    );

    return reply.status(201).send({
      success: true,
      message: "Buddy assigned to new hire successfully",
      data: assignment,
    });
  };

  getEmployeeBuddy = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const assignment = await this.buddyService.getEmployeeBuddy(user.organizationId, user.userId);

    return reply.status(200).send({
      success: true,
      message: "Assigned buddy retrieved successfully",
      data: assignment,
    });
  };

  getBuddyMentees = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const mentees = await this.buddyService.getBuddyMentees(user.organizationId, user.userId);

    return reply.status(200).send({
      success: true,
      message: "Assigned mentees retrieved successfully",
      data: mentees,
    });
  };

  updateChecklistTask = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = request.body as any;

    const assignment = await this.buddyService.updateChecklistTask(
      user.organizationId,
      params.id,
      body.taskId,
      body.completed
    );

    return reply.status(200).send({
      success: true,
      message: "Buddy checklist item updated successfully",
      data: assignment,
    });
  };

  logBuddyCheckin = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = request.body as any;

    const assignment = await this.buddyService.logBuddyCheckin(user.organizationId, params.id, body);

    return reply.status(200).send({
      success: true,
      message: "1-on-1 buddy check-in logged successfully",
      data: assignment,
    });
  };
}
