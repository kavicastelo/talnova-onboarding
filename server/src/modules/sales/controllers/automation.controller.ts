import { FastifyRequest, FastifyReply } from "fastify";
import AutomationEngineService from "../services/automation-engine.service.js";
import AppError from "../../../common/errors/app-error.js";
import { z } from "zod";

const triggerRuleSchema = z.object({
  ruleId: z.string().min(1, "ruleId is required"),
  targetId: z.string().min(1, "targetId is required"),
});

export class AutomationController {
  private service: AutomationEngineService;

  constructor() {
    this.service = AutomationEngineService.getInstance();
  }

  /**
   * Get configured automation rules inventory and status
   * GET /api/v1/sales/automation/rules
   */
  getRules = async (_request: FastifyRequest, reply: FastifyReply) => {
    const rules = this.service.getRules();
    return reply.status(200).send({
      success: true,
      data: rules,
    });
  };

  /**
   * Manually trigger a rule for testing/admin execution
   * POST /api/v1/sales/automation/trigger
   */
  triggerRule = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = triggerRuleSchema.safeParse(request.body);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const orgId = (request as any).user?.organizationId;
    const result = await this.service.triggerRule(
      parseResult.data.ruleId,
      parseResult.data.targetId,
      orgId
    );

    return reply.status(200).send({
      success: true,
      message: "Automation rule dispatched successfully",
      data: result,
    });
  };

  /**
   * Run on-demand stale scan across leads and deals
   * POST /api/v1/sales/automation/stale-scan
   */
  runStaleScan = async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = (request as any).user?.organizationId;
    const result = await this.service.runStaleScan(orgId);

    return reply.status(200).send({
      success: true,
      message: "Stale entity scan completed",
      data: result,
    });
  };

  /**
   * Fetch recent automation execution logs
   * GET /api/v1/sales/automation/logs
   */
  getLogs = async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = (request as any).user?.organizationId;
    const query = request.query as { limit?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 20;

    const logs = await this.service.getRecentLogs(orgId, limit);
    return reply.status(200).send({
      success: true,
      data: logs,
    });
  };
}

export default AutomationController;
