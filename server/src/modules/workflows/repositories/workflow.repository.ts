import WorkflowRule, { IWorkflowRule } from "../models/workflow-rule.model.js";
import WorkflowExecutionLog, { IWorkflowExecutionLog } from "../models/workflow-execution.model.js";
import mongoose from "mongoose";

export interface PaginationOptions {
  page: number;
  limit: number;
}

export class WorkflowRepository {
  async findRules(
    orgId: string | mongoose.Types.ObjectId,
    triggerType?: string,
    onlyActive = false
  ): Promise<IWorkflowRule[]> {
    const query: Record<string, any> = {
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: false,
    };
    if (triggerType) {
      query.triggerType = triggerType;
    }
    if (onlyActive) {
      query.isActive = true;
    }
    return WorkflowRule.find(query)
      .populate("createdBy", "profile auth.email")
      .sort({ createdAt: -1 });
  }

  async findRuleById(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId
  ): Promise<IWorkflowRule | null> {
    return WorkflowRule.findOne({ _id: id, organizationId: orgId, isDeleted: false }).populate(
      "createdBy",
      "profile auth.email"
    );
  }

  async createRule(data: Partial<IWorkflowRule>): Promise<IWorkflowRule> {
    const rule = new WorkflowRule(data);
    return rule.save();
  }

  async updateRule(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    data: Partial<IWorkflowRule>
  ): Promise<IWorkflowRule | null> {
    return WorkflowRule.findOneAndUpdate(
      { _id: id, organizationId: orgId, isDeleted: false },
      { $set: data, $inc: { version: 1 } },
      { new: true }
    );
  }

  async toggleRuleActive(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    isActive: boolean
  ): Promise<IWorkflowRule | null> {
    return WorkflowRule.findOneAndUpdate(
      { _id: id, organizationId: orgId, isDeleted: false },
      { $set: { isActive } },
      { new: true }
    );
  }

  async softDeleteRule(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId
  ): Promise<IWorkflowRule | null> {
    return WorkflowRule.findOneAndUpdate(
      { _id: id, organizationId: orgId, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true }
    );
  }

  async createExecutionLog(data: Partial<IWorkflowExecutionLog>): Promise<IWorkflowExecutionLog> {
    const log = new WorkflowExecutionLog(data);
    return log.save();
  }

  async findExecutionLogs(
    orgId: string | mongoose.Types.ObjectId,
    ruleId?: string,
    pagination: PaginationOptions = { page: 1, limit: 50 }
  ): Promise<{ logs: IWorkflowExecutionLog[]; total: number }> {
    const query: Record<string, any> = {
      organizationId: new mongoose.Types.ObjectId(orgId),
    };
    if (ruleId) {
      query.workflowRuleId = new mongoose.Types.ObjectId(ruleId);
    }
    const total = await WorkflowExecutionLog.countDocuments(query);
    const page = Math.max(1, pagination.page);
    const limit = Math.max(1, pagination.limit);
    const skip = (page - 1) * limit;

    const logs = await WorkflowExecutionLog.find(query)
      .populate("workflowRuleId", "name triggerType")
      .populate("targetUserId", "profile auth.email employment")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return { logs, total };
  }
}

export default WorkflowRepository;
