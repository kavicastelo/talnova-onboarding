import { apiClient } from "../api/client";

export interface WorkflowCondition {
  field: "department" | "role" | "jobTitle" | "location" | "employmentStatus";
  operator: "equals" | "not_equals" | "in" | "contains";
  value: string | string[];
}

export interface WorkflowAction {
  type: "assign_journey" | "create_task" | "send_notification" | "trigger_buddy" | "delay";
  params: {
    journeyId?: string;
    taskTitle?: string;
    taskDescription?: string;
    taskCategory?: "it_setup" | "hr_paperwork" | "equipment" | "training" | "general";
    taskStage?: "preboarding" | "day_1" | "week_1" | "month_1" | "custom";
    taskPriority?: "low" | "normal" | "high" | "critical";
    taskAssigneeRole?: "employee" | "manager" | "hr" | "it";
    notificationTitle?: string;
    notificationMessage?: string;
    notificationChannel?: "in_app" | "email";
    delayMinutes?: number;
  };
}

export interface WorkflowRuleItem {
  _id: string;
  organizationId: string;
  name: string;
  description?: string;
  triggerType: "user_created" | "journey_completed" | "task_completed" | "stage_entered" | "checkin_due";
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  isActive: boolean;
  version: number;
  createdBy?: {
    _id: string;
    profile?: { firstName: string; lastName: string };
    auth?: { email: string };
  };
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecutionLogItem {
  _id: string;
  organizationId: string;
  workflowRuleId?: {
    _id: string;
    name: string;
    triggerType: string;
  };
  triggerEvent: string;
  targetUserId?: {
    _id: string;
    profile?: { firstName: string; lastName: string };
    auth?: { email: string };
    employment?: { department?: string; jobTitle?: string };
  };
  status: "success" | "partial_failure" | "failed" | "pending_delay";
  conditionsEvaluated: boolean;
  stepResults: Array<{
    stepIndex: number;
    actionType: string;
    status: string;
    resultMessage?: string;
    executedAt: string;
  }>;
  errorDetails?: string;
  executedAt: string;
  completedAt?: string;
}

export interface CreateWorkflowRulePayload {
  name: string;
  description?: string;
  triggerType: "user_created" | "journey_completed" | "task_completed" | "stage_entered" | "checkin_due";
  conditions?: WorkflowCondition[];
  actions: WorkflowAction[];
  isActive?: boolean;
}

export class FrontendWorkflowService {
  async getRules(triggerType?: string): Promise<WorkflowRuleItem[]> {
    const query = triggerType ? `?triggerType=${triggerType}` : "";
    const response = await apiClient.get<{ success: boolean; data: WorkflowRuleItem[] }>(
      `/workflows${query}`
    );
    return response.data.data;
  }

  async getRule(id: string): Promise<WorkflowRuleItem> {
    const response = await apiClient.get<{ success: boolean; data: WorkflowRuleItem }>(`/workflows/${id}`);
    return response.data.data;
  }

  async createRule(payload: CreateWorkflowRulePayload): Promise<WorkflowRuleItem> {
    const response = await apiClient.post<{ success: boolean; data: WorkflowRuleItem }>("/workflows", payload);
    return response.data.data;
  }

  async updateRule(id: string, payload: Partial<CreateWorkflowRulePayload>): Promise<WorkflowRuleItem> {
    const response = await apiClient.patch<{ success: boolean; data: WorkflowRuleItem }>(
      `/workflows/${id}`,
      payload
    );
    return response.data.data;
  }

  async toggleRuleActive(id: string, isActive: boolean): Promise<WorkflowRuleItem> {
    const response = await apiClient.patch<{ success: boolean; data: WorkflowRuleItem }>(
      `/workflows/${id}/toggle`,
      { isActive }
    );
    return response.data.data;
  }

  async deleteRule(id: string): Promise<void> {
    await apiClient.delete(`/workflows/${id}`);
  }

  async getExecutionLogs(ruleId?: string, page = 1, limit = 50): Promise<{ logs: WorkflowExecutionLogItem[]; total: number }> {
    const query = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
    if (ruleId) query.append("ruleId", ruleId);
    const response = await apiClient.get<{
      success: boolean;
      data: WorkflowExecutionLogItem[];
      meta?: { total: number };
    }>(`/workflows/executions?${query.toString()}`);
    return {
      logs: response.data.data,
      total: response.data.meta?.total || response.data.data.length,
    };
  }

  async triggerTestRun(id: string, targetUserId: string): Promise<{ executedCount: number }> {
    const response = await apiClient.post<{ success: boolean; data: { executedCount: number } }>(
      `/workflows/${id}/test-run`,
      { targetUserId }
    );
    return response.data.data;
  }
}

export const frontendWorkflowService = new FrontendWorkflowService();
export default frontendWorkflowService;
