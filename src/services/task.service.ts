import { apiClient } from "../api/client";

export interface TaskItem {
  _id: string;
  organizationId: string;
  employeeId?: {
    _id: string;
    profile?: { firstName: string; lastName: string; avatarUrl?: string };
    auth?: { email: string };
    employment?: { jobTitle?: string; department?: string };
  };
  assignedToUserId: {
    _id: string;
    profile?: { firstName: string; lastName: string; avatarUrl?: string };
    auth?: { email: string };
    permissions?: { role: string };
  };
  createdBy: {
    _id: string;
    profile?: { firstName: string; lastName: string };
    auth?: { email: string };
  };
  title: string;
  description?: string;
  category: "it_setup" | "hr_paperwork" | "equipment" | "training" | "general";
  stage: "preboarding" | "day_1" | "week_1" | "month_1" | "custom";
  priority: "low" | "normal" | "high" | "critical";
  status: "pending" | "in_progress" | "completed" | "overdue" | "cancelled";
  dueDate?: string;
  relativeOffsetDays?: number;
  prerequisiteTaskIds?: Array<{
    _id: string;
    title: string;
    status: string;
    dueDate?: string;
  }>;
  completedAt?: string;
  completedBy?: string;
  comments: Array<{
    _id?: string;
    userId: {
      _id: string;
      profile?: { firstName: string; lastName: string };
      auth?: { email: string };
    };
    comment: string;
    createdAt: string;
  }>;
  statusHistory: Array<{
    status: string;
    changedBy: string;
    changedAt: string;
    note?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskPayload {
  assignedToUserId: string;
  employeeId?: string;
  title: string;
  description?: string;
  category?: "it_setup" | "hr_paperwork" | "equipment" | "training" | "general";
  stage?: "preboarding" | "day_1" | "week_1" | "month_1" | "custom";
  priority?: "low" | "normal" | "high" | "critical";
  dueDate?: string;
  relativeOffsetDays?: number;
  prerequisiteTaskIds?: string[];
}

export interface TaskListQuery {
  assignedToMe?: boolean;
  assignedToUserId?: string;
  employeeId?: string;
  status?: string;
  stage?: string;
  category?: string;
  priority?: string;
  isOverdue?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export class FrontendTaskService {
  async getTasks(params?: TaskListQuery): Promise<{ tasks: TaskItem[]; total: number }> {
    const query = new URLSearchParams();
    if (params) {
      if (params.assignedToMe) query.append("assignedToMe", "true");
      if (params.assignedToUserId) query.append("assignedToUserId", params.assignedToUserId);
      if (params.employeeId) query.append("employeeId", params.employeeId);
      if (params.status) query.append("status", params.status);
      if (params.stage) query.append("stage", params.stage);
      if (params.category) query.append("category", params.category);
      if (params.priority) query.append("priority", params.priority);
      if (params.isOverdue) query.append("isOverdue", "true");
      if (params.page) query.append("page", params.page.toString());
      if (params.limit) query.append("limit", params.limit.toString());
      if (params.sortBy) query.append("sortBy", params.sortBy);
      if (params.sortOrder) query.append("sortOrder", params.sortOrder);
    }
    const response = await apiClient.get<{ success: boolean; data: TaskItem[]; meta?: { total: number } }>(
      `/tasks?${query.toString()}`
    );
    return {
      tasks: response.data.data,
      total: response.data.meta?.total || response.data.data.length,
    };
  }

  async getTask(id: string): Promise<TaskItem> {
    const response = await apiClient.get<{ success: boolean; data: TaskItem }>(`/tasks/${id}`);
    return response.data.data;
  }

  async createTask(payload: CreateTaskPayload): Promise<TaskItem> {
    const response = await apiClient.post<{ success: boolean; data: TaskItem }>("/tasks", payload);
    return response.data.data;
  }

  async updateTaskStatus(id: string, status: string, note?: string): Promise<TaskItem> {
    const response = await apiClient.patch<{ success: boolean; data: TaskItem }>(`/tasks/${id}/status`, {
      status,
      note,
    });
    return response.data.data;
  }

  async addTaskComment(id: string, comment: string): Promise<TaskItem> {
    const response = await apiClient.post<{ success: boolean; data: TaskItem }>(`/tasks/${id}/comments`, {
      comment,
    });
    return response.data.data;
  }

  async deleteTask(id: string): Promise<void> {
    await apiClient.delete(`/tasks/${id}`);
  }
}

export const frontendTaskService = new FrontendTaskService();
export default frontendTaskService;
