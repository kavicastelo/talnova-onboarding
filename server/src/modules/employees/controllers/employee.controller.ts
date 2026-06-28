import { FastifyReply, FastifyRequest } from "fastify";
import { EmployeeService } from "../services/employee.service.js";

export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  getMe = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const profile = await this.employeeService.getProfile(user.userId);

    return reply.status(200).send({
      success: true,
      message: "Profile retrieved successfully",
      data: profile,
    });
  };

  updateMe = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const profile = await this.employeeService.updateProfile(user.userId, request.body as any);

    return reply.status(200).send({
      success: true,
      message: "Profile updated successfully",
      data: profile,
    });
  };

  updatePreferences = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const profile = await this.employeeService.updatePreferences(user.userId, request.body as any);

    return reply.status(200).send({
      success: true,
      message: "Preferences updated successfully",
      data: profile,
    });
  };

  changePassword = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;
    await this.employeeService.changePassword(user.userId, body.oldPassword, body.newPassword);

    return reply.status(200).send({
      success: true,
      message: "Password updated successfully",
      data: null,
    });
  };

  listEmployees = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const query = request.query as any;
    const { departmentId, teamId, managerId, status, search, page, limit, sortBy, sortOrder } = query;

    const filter = {
      organizationId: user.organizationId,
      departmentId,
      teamId,
      managerId,
      status,
      search,
    };

    const pagination = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      sortBy,
      sortOrder,
    };

    const result = await this.employeeService.listEmployees(filter, pagination);

    return reply.status(200).send({
      success: true,
      message: "Employees list retrieved successfully",
      data: result.employees,
      meta: {
        total: result.total,
        page: pagination.page,
        limit: pagination.limit,
      },
    });
  };

  getEmployee = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const employee = await this.employeeService.getEmployee(params.id, user.organizationId);

    return reply.status(200).send({
      success: true,
      message: "Employee details retrieved successfully",
      data: employee,
    });
  };

  inviteEmployee = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;
    const employee = await this.employeeService.inviteEmployee(user.organizationId, body, user.userId);

    return reply.status(201).send({
      success: true,
      message: "Employee invited successfully",
      data: employee,
    });
  };

  updateEmployee = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const employee = await this.employeeService.updateEmployee(
      params.id,
      user.organizationId,
      request.body as any
    );

    return reply.status(200).send({
      success: true,
      message: "Employee updated successfully",
      data: employee,
    });
  };

  deleteEmployee = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    await this.employeeService.deleteEmployee(params.id, user.organizationId, user.userId);

    return reply.status(200).send({
      success: true,
      message: "Employee deleted successfully",
      data: null,
    });
  };
}

export default EmployeeController;
