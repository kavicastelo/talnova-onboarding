import { FastifyReply, FastifyRequest } from "fastify";
import { OrganizationService } from "../services/organization.service.js";

export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  getCurrent = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const org = await this.orgService.getOrganization(user.organizationId);

    return reply.status(200).send({
      success: true,
      message: "Organization retrieved successfully",
      data: org,
    });
  };

  updateCurrent = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const org = await this.orgService.updateOrganization(user.organizationId, request.body as any);

    return reply.status(200).send({
      success: true,
      message: "Organization updated successfully",
      data: org,
    });
  };

  updateBranding = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const org = await this.orgService.updateBranding(user.organizationId, request.body as any);

    return reply.status(200).send({
      success: true,
      message: "Branding updated successfully",
      data: org,
    });
  };

  updateSecurity = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const org = await this.orgService.updateSecurity(user.organizationId, request.body as any);

    return reply.status(200).send({
      success: true,
      message: "Security settings updated successfully",
      data: org,
    });
  };

  listDepartments = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const org = await this.orgService.getOrganization(user.organizationId);
    const activeDepts = org.departments.filter((d) => d.active);

    return reply.status(200).send({
      success: true,
      message: "Departments retrieved successfully",
      data: activeDepts,
    });
  };

  createDepartment = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const dept = await this.orgService.createDepartment(user.organizationId, request.body as any);

    return reply.status(201).send({
      success: true,
      message: "Department created successfully",
      data: dept,
    });
  };

  updateDepartment = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const dept = await this.orgService.updateDepartment(
      user.organizationId,
      params.id,
      request.body as any
    );

    return reply.status(200).send({
      success: true,
      message: "Department updated successfully",
      data: dept,
    });
  };

  deleteDepartment = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    await this.orgService.deleteDepartment(user.organizationId, params.id);

    return reply.status(200).send({
      success: true,
      message: "Department deleted successfully",
      data: null,
    });
  };

  listTeams = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const org = await this.orgService.getOrganization(user.organizationId);
    const activeTeams = org.teams.filter((t) => t.active);

    return reply.status(200).send({
      success: true,
      message: "Teams retrieved successfully",
      data: activeTeams,
    });
  };

  createTeam = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const team = await this.orgService.createTeam(user.organizationId, request.body as any);

    return reply.status(201).send({
      success: true,
      message: "Team created successfully",
      data: team,
    });
  };

  updateTeam = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const team = await this.orgService.updateTeam(
      user.organizationId,
      params.id,
      request.body as any
    );

    return reply.status(200).send({
      success: true,
      message: "Team updated successfully",
      data: team,
    });
  };

  deleteTeam = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    await this.orgService.deleteTeam(user.organizationId, params.id);

    return reply.status(200).send({
      success: true,
      message: "Team deleted successfully",
      data: null,
    });
  };
}

export default OrganizationController;
