import { FastifyReply, FastifyRequest } from "fastify";
import WorkflowService from "../services/workflow.service.js";

export class WorkflowController {
  constructor(private readonly service: WorkflowService) {}

  listRules = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const query = request.query as any;

    const rules = await this.service.listRules(user.organizationId, query.triggerType);

    return reply.status(200).send({
      success: true,
      message: "Workflow rules retrieved successfully",
      data: rules,
    });
  };

  getRule = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    const rule = await this.service.getRule(params.id, user.organizationId);

    return reply.status(200).send({
      success: true,
      message: "Workflow rule retrieved successfully",
      data: rule,
    });
  };

  createRule = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;

    const rule = await this.service.createRule(user.organizationId, user.userId, body);

    return reply.status(201).send({
      success: true,
      message: "Workflow rule created successfully",
      data: rule,
    });
  };

  updateRule = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = request.body as any;

    const rule = await this.service.updateRule(params.id, user.organizationId, body);

    return reply.status(200).send({
      success: true,
      message: "Workflow rule updated successfully",
      data: rule,
    });
  };

  toggleActive = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = request.body as any;

    const rule = await this.service.toggleRuleActive(params.id, user.organizationId, body.isActive);

    return reply.status(200).send({
      success: true,
      message: `Workflow rule ${body.isActive ? "enabled" : "disabled"} successfully`,
      data: rule,
    });
  };

  deleteRule = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    await this.service.deleteRule(params.id, user.organizationId);

    return reply.status(200).send({
      success: true,
      message: "Workflow rule deleted successfully",
      data: null,
    });
  };

  getExecutionLogs = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const query = request.query as any;

    const pagination = {
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 50,
    };

    const result = await this.service.getExecutionLogs(user.organizationId, query.ruleId, pagination);

    return reply.status(200).send({
      success: true,
      message: "Workflow execution logs retrieved successfully",
      data: result.logs,
      meta: {
        total: result.total,
        page: pagination.page,
        limit: pagination.limit,
      },
    });
  };

  testRun = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = request.body as any;

    const result = await this.service.triggerTestRun(params.id, user.organizationId, body.targetUserId);

    return reply.status(200).send({
      success: true,
      message: result.message,
      data: { executedCount: result.executedCount },
    });
  };
}

export default WorkflowController;
