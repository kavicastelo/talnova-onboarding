import { FastifyReply, FastifyRequest } from "fastify";
import TaskService from "../services/task.service.js";

export class TaskController {
  constructor(private readonly service: TaskService) {}

  listTasks = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const query = request.query as any;

    const filter: Record<string, any> = {
      organizationId: user.organizationId,
    };

    if (query.assignedToUserId) filter.assignedToUserId = query.assignedToUserId;
    if (query.employeeId) filter.employeeId = query.employeeId;
    if (query.createdBy) filter.createdBy = query.createdBy;
    if (query.status) filter.status = query.status;
    if (query.stage) filter.stage = query.stage;
    if (query.category) filter.category = query.category;
    if (query.priority) filter.priority = query.priority;
    if (query.isOverdue === "true") filter.isOverdue = true;

    // Default to tasks assigned to current user if "assignedToMe" flag is passed
    if (query.assignedToMe === "true") {
      filter.assignedToUserId = user.userId;
    }

    const pagination = {
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 50,
      sortBy: query.sortBy || "createdAt",
      sortOrder: query.sortOrder || "desc",
    };

    const result = await this.service.listTasks(filter as any, pagination);

    return reply.status(200).send({
      success: true,
      message: "Tasks list retrieved successfully",
      data: result.tasks,
      meta: {
        total: result.total,
        page: pagination.page,
        limit: pagination.limit,
      },
    });
  };

  getTask = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    const task = await this.service.getTask(params.id, user.organizationId);

    return reply.status(200).send({
      success: true,
      message: "Task retrieved successfully",
      data: task,
    });
  };

  createTask = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;

    const task = await this.service.createTask(user.organizationId, user.userId, body);

    return reply.status(201).send({
      success: true,
      message: "Task created successfully",
      data: task,
    });
  };

  updateStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = request.body as any;

    const task = await this.service.updateTaskStatus(
      params.id,
      user.organizationId,
      user.userId,
      body.status,
      body.note
    );

    return reply.status(200).send({
      success: true,
      message: "Task status updated successfully",
      data: task,
    });
  };

  addComment = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = request.body as any;

    const task = await this.service.addComment(params.id, user.organizationId, user.userId, body.comment);

    return reply.status(200).send({
      success: true,
      message: "Task comment added successfully",
      data: task,
    });
  };

  deleteTask = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    await this.service.deleteTask(params.id, user.organizationId);

    return reply.status(200).send({
      success: true,
      message: "Task deleted successfully",
      data: null,
    });
  };
}

export default TaskController;
