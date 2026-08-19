import WorkflowRepository, { PaginationOptions } from "../repositories/workflow.repository.js";
import AppError from "../../../common/errors/app-error.js";
import mongoose from "mongoose";
import workflowEngine from "./workflow.engine.js";

export class WorkflowService {
  constructor(private readonly repository: WorkflowRepository) {}

  async listRules(orgId: string | mongoose.Types.ObjectId, triggerType?: string) {
    return this.repository.findRules(orgId, triggerType);
  }

  async getRule(id: string | mongoose.Types.ObjectId, orgId: string | mongoose.Types.ObjectId) {
    const rule = await this.repository.findRuleById(id, orgId);
    if (!rule) {
      throw new AppError(404, "NOT_FOUND", "Workflow rule not found");
    }
    return rule;
  }

  async createRule(
    orgId: string | mongoose.Types.ObjectId,
    createdBy: string | mongoose.Types.ObjectId,
    data: {
      name: string;
      description?: string;
      triggerType: "user_created" | "journey_completed" | "task_completed" | "stage_entered" | "checkin_due";
      conditions?: any[];
      actions: any[];
      isActive?: boolean;
    }
  ) {
    const ruleData = {
      organizationId: new mongoose.Types.ObjectId(orgId),
      createdBy: new mongoose.Types.ObjectId(createdBy),
      name: data.name,
      description: data.description,
      triggerType: data.triggerType,
      conditions: data.conditions || [],
      actions: data.actions || [],
      isActive: data.isActive ?? true,
      version: 1,
    };
    return this.repository.createRule(ruleData as any);
  }

  async updateRule(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    data: Partial<{
      name: string;
      description: string;
      triggerType: "user_created" | "journey_completed" | "task_completed" | "stage_entered" | "checkin_due";
      conditions: any[];
      actions: any[];
      isActive: boolean;
    }>
  ) {
    const rule = await this.repository.updateRule(id, orgId, data as any);
    if (!rule) {
      throw new AppError(404, "NOT_FOUND", "Workflow rule not found");
    }
    return rule;
  }

  async toggleRuleActive(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    isActive: boolean
  ) {
    const rule = await this.repository.toggleRuleActive(id, orgId, isActive);
    if (!rule) {
      throw new AppError(404, "NOT_FOUND", "Workflow rule not found");
    }
    return rule;
  }

  async deleteRule(id: string | mongoose.Types.ObjectId, orgId: string | mongoose.Types.ObjectId) {
    const rule = await this.repository.softDeleteRule(id, orgId);
    if (!rule) {
      throw new AppError(404, "NOT_FOUND", "Workflow rule not found");
    }
    return rule;
  }

  async getExecutionLogs(
    orgId: string | mongoose.Types.ObjectId,
    ruleId?: string,
    pagination: PaginationOptions = { page: 1, limit: 50 }
  ) {
    return this.repository.findExecutionLogs(orgId, ruleId, pagination);
  }

  async triggerTestRun(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    targetUserId: string
  ) {
    const rule = await this.getRule(id, orgId);
    const executedCount = await workflowEngine.processEvent(
      orgId,
      rule.triggerType,
      targetUserId,
      { isTestRun: true }
    );
    return { executedCount, message: `Test run triggered for workflow "${rule.name}"` };
  }
}

export default WorkflowService;
