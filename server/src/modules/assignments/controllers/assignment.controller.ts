import { FastifyReply, FastifyRequest } from "fastify";
import { EmployeeAssignmentService } from "../services/assignment.service.js";

export class EmployeeAssignmentController {
  constructor(private readonly service: EmployeeAssignmentService) {}

  getAssignment = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const assignment = await this.service.getAssignment(params.id, user.organizationId);

    // Security check: employees can only retrieve their own assignments
    if (user.role === "employee" && assignment.employeeId.toString() !== user.userId) {
      return reply.status(403).send({
        success: false,
        message: "Forbidden: You cannot access another employee's assignment.",
      });
    }

    return reply.status(200).send({
      success: true,
      message: "Assignment retrieved successfully",
      data: assignment,
    });
  };

  listAssignments = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const query = request.query as any;

    let targetEmployeeId = query.employeeId;
    if (user.role === "employee") {
      targetEmployeeId = user.userId;
    }

    const filter = {
      organizationId: user.organizationId,
      employeeId: targetEmployeeId,
      status: query.status,
      journeyId: query.journeyId,
    };

    const pagination = {
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };

    const result = await this.service.listAssignments(filter, pagination);

    return reply.status(200).send({
      success: true,
      message: "Assignments retrieved successfully",
      data: result.assignments,
      meta: {
        total: result.total,
        page: pagination.page,
        limit: pagination.limit,
      },
    });
  };

  getMyAssignments = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const query = request.query as any;

    const filter = {
      organizationId: user.organizationId,
      employeeId: user.userId,
      status: query.status,
    };

    const pagination = {
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
    };

    const result = await this.service.listAssignments(filter, pagination);

    return reply.status(200).send({
      success: true,
      message: "My assignments retrieved successfully",
      data: result.assignments,
      meta: {
        total: result.total,
        page: pagination.page,
        limit: pagination.limit,
      },
    });
  };

  getMyActiveAssignments = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const query = request.query as any;

    // Filter to get only assigned, in_progress, and overdue assignments
    const filter = {
      organizationId: user.organizationId,
      employeeId: user.userId,
      status: query.status || { $in: ["assigned", "in_progress", "overdue"] },
    };

    const pagination = {
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
    };

    const result = await this.service.listAssignments(filter as any, pagination);

    return reply.status(200).send({
      success: true,
      message: "Active assignments retrieved successfully",
      data: result.assignments,
      meta: {
        total: result.total,
        page: pagination.page,
        limit: pagination.limit,
      },
    });
  };

  getMyCompletedAssignments = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const query = request.query as any;

    const filter = {
      organizationId: user.organizationId,
      employeeId: user.userId,
      status: "completed",
    };

    const pagination = {
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
    };

    const result = await this.service.listAssignments(filter, pagination);

    return reply.status(200).send({
      success: true,
      message: "Completed assignments retrieved successfully",
      data: result.assignments,
      meta: {
        total: result.total,
        page: pagination.page,
        limit: pagination.limit,
      },
    });
  };

  assignJourney = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;

    if (user.role === "employee" && body.employeeId !== user.userId) {
      return reply.status(403).send({
        success: false,
        message: "Forbidden: Employees can only self-assign journeys.",
      });
    }

    const assignment = await this.service.assignJourney(
      user.organizationId,
      body.employeeId,
      body.journeyId,
      user.userId,
      {
        dueDate: body.dueDate,
        priority: body.priority,
      },
      user.role === "employee"
    );

    return reply.status(201).send({
      success: true,
      message: "Journey assigned successfully",
      data: assignment,
    });
  };

  startAssignment = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const assignment = await this.service.startAssignment(params.id, user.organizationId);

    return reply.status(200).send({
      success: true,
      message: "Assignment started successfully",
      data: assignment,
    });
  };

  completeLesson = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = request.body as any;

    const assignment = await this.service.completeLesson(
      params.id,
      user.organizationId,
      body.moduleId,
      body.lessonId,
      body.timeSpentSeconds,
      body.completedBlockIds
    );

    return reply.status(200).send({
      success: true,
      message: "Lesson progress updated successfully",
      data: assignment,
    });
  };

  submitQuiz = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = request.body as any;

    const result = await this.service.submitQuiz(
      params.id,
      user.organizationId,
      body.moduleId,
      body.lessonId,
      body.answers
    );

    return reply.status(200).send({
      success: true,
      message: "Quiz submitted and evaluated successfully",
      data: result,
    });
  };
}

export default EmployeeAssignmentController;
