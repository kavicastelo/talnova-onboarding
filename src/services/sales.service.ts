import { apiClient } from '../api/client';
import { ApiResponse, PaginatedResponse } from '../types';

export interface SalesPaginatedResponse<T> {
  items: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'engaged'
  | 'qualified'
  | 'opportunity'
  | 'converted'
  | 'nurturing'
  | 'disqualified'
  | 'unresponsive'
  | 'lost'
  | 'duplicate';

export type LeadPriority = 'low' | 'normal' | 'high' | 'urgent';

export type LeadSource =
  | 'website'
  | 'product_demo'
  | 'referral'
  | 'campaign'
  | 'import'
  | 'inbound_email'
  | 'other';

export type CompanySize =
  | '1-10'
  | '11-50'
  | '51-200'
  | '201-500'
  | '501-1000'
  | '1000+';

export interface LeadScoreEvent {
  rule: string;
  points: number;
  timestamp: string | Date;
}

export interface LeadNote {
  _id?: string;
  content: string;
  createdBy?: {
    _id: string;
    name?: string;
    email?: string;
  };
  createdAt: string | Date;
}

export interface LeadItem {
  _id: string;
  name: string;
  email: string;
  normalizedEmail?: string;
  phone?: string;
  normalizedPhone?: string;
  whatsapp?: string;
  companyName: string;
  jobTitle?: string;
  industry?: string;
  companySize?: CompanySize;
  country?: string;
  region?: string;
  source: LeadSource;
  sourceDetails?: string;
  status: LeadStatus;
  disqualificationReason?: string;
  score: number;
  priority: LeadPriority;
  scoreBreakdown?: LeadScoreEvent[];
  interestedProduct?: string;
  estimatedBudget?: number;
  currency: string;
  expectedPurchaseDate?: string;
  assignedOwnerId?: {
    _id: string;
    name?: string;
    email?: string;
    role?: string;
  };
  tags: string[];
  notes?: LeadNote[];
  lastContactDate?: string;
  nextFollowUpDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  source?: string;
  ownerId?: string;
  priority?: string;
  minScore?: number;
  maxScore?: number;
  sortBy?: 'createdAt' | 'score' | 'priority' | 'lastContactDate' | 'name' | 'companyName';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateLeadPayload {
  name: string;
  email: string;
  companyName: string;
  phone?: string;
  whatsapp?: string;
  jobTitle?: string;
  industry?: string;
  companySize?: CompanySize;
  source?: LeadSource;
  sourceDetails?: string;
  status?: LeadStatus;
  priority?: LeadPriority;
  estimatedBudget?: number;
  currency?: string;
  assignedOwnerId?: string;
  tags?: string[];
}

export interface UpdateLeadPayload extends Partial<CreateLeadPayload> {
  lastContactDate?: string;
  nextFollowUpDate?: string;
}

export interface UpdateLeadStatusPayload {
  status: LeadStatus;
  disqualificationReason?: string;
  note?: string;
}

export interface CsvPreviewResponse {
  headers: string[];
  suggestedMapping: Record<string, string>;
  sampleRows: Array<Record<string, string>>;
  sampleMapped: Array<Record<string, any>>;
  totalRows: number;
}

export interface CsvExecutePayload {
  csvContent: string;
  mapping?: Record<string, string>;
  duplicateStrategy?: 'skip' | 'overwrite' | 'create_duplicate';
  defaultValues?: {
    source?: string;
    assignedOwnerId?: string;
    tags?: string[];
  };
}

export interface CsvExecuteResponse {
  batchId: string;
  totalRows: number;
  validRows: number;
  created: number;
  updated: number;
  duplicatesSkipped: number;
  invalidCount: number;
  errors: Array<{ row: number; email?: string; reason: string }>;
}

export const salesService = {
  // Leads API
  getLeads: async (params?: LeadQueryParams): Promise<SalesPaginatedResponse<LeadItem>> => {
    const response = await apiClient.get<ApiResponse<SalesPaginatedResponse<LeadItem>>>('/sales/leads', {
      params,
    });
    return response.data.data;
  },

  getLeadById: async (id: string): Promise<LeadItem> => {
    const response = await apiClient.get<ApiResponse<LeadItem>>(`/sales/leads/${id}`);
    return response.data.data;
  },

  createLead: async (payload: CreateLeadPayload): Promise<LeadItem> => {
    const response = await apiClient.post<ApiResponse<LeadItem>>('/sales/leads', payload);
    return response.data.data;
  },

  updateLead: async (id: string, payload: UpdateLeadPayload): Promise<LeadItem> => {
    const response = await apiClient.patch<ApiResponse<LeadItem>>(`/sales/leads/${id}`, payload);
    return response.data.data;
  },

  updateLeadStatus: async (id: string, payload: UpdateLeadStatusPayload): Promise<LeadItem> => {
    const response = await apiClient.patch<ApiResponse<LeadItem>>(`/sales/leads/${id}/status`, payload);
    return response.data.data;
  },

  deleteLead: async (id: string): Promise<{ success: boolean; id: string }> => {
    const response = await apiClient.delete<ApiResponse<{ success: boolean; id: string }>>(
      `/sales/leads/${id}`
    );
    return response.data.data;
  },

  addLeadNote: async (id: string, content: string): Promise<LeadItem> => {
    const response = await apiClient.post<ApiResponse<LeadItem>>(`/sales/leads/${id}/notes`, {
      content,
    });
    return response.data.data;
  },

  recalculateScore: async (id: string): Promise<LeadItem> => {
    const response = await apiClient.post<ApiResponse<LeadItem>>(`/sales/leads/${id}/recalculate-score`);
    return response.data.data;
  },

  recordScoreEvent: async (id: string, rule: string, points: number): Promise<LeadItem> => {
    const response = await apiClient.post<ApiResponse<LeadItem>>(`/sales/leads/${id}/score-event`, {
      rule,
      points,
    });
    return response.data.data;
  },

  // Duplicates & Merge
  checkDuplicates: async (payload: {
    email?: string;
    phone?: string;
    name?: string;
    companyName?: string;
    excludeLeadId?: string;
  }): Promise<any> => {
    const response = await apiClient.post<ApiResponse<any>>('/sales/leads/check-duplicates', payload);
    return response.data.data;
  },

  mergeLeads: async (payload: {
    primaryLeadId: string;
    secondaryLeadIds: string[];
    fieldOverrides?: Record<string, any>;
  }): Promise<LeadItem> => {
    const response = await apiClient.post<ApiResponse<LeadItem>>('/sales/leads/merge', payload);
    return response.data.data;
  },

  // CSV Import
  previewCsvImport: async (csvContent: string): Promise<CsvPreviewResponse> => {
    const response = await apiClient.post<ApiResponse<CsvPreviewResponse>>('/sales/leads/import/preview', {
      csvContent,
    });
    return response.data.data;
  },

  executeCsvImport: async (payload: CsvExecutePayload): Promise<CsvExecuteResponse> => {
    const response = await apiClient.post<ApiResponse<CsvExecuteResponse>>('/sales/leads/import/execute', payload);
    return response.data.data;
  },

  // Companies & Contacts API
  getCompanies: async (params?: any): Promise<PaginatedResponse<any>> => {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<any>>>('/sales/companies', {
      params,
    });
    return response.data.data;
  },

  getContacts: async (params?: any): Promise<PaginatedResponse<any>> => {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<any>>>('/sales/contacts', {
      params,
    });
    return response.data.data;
  },

  // Pipeline API
  getPipelines: async (): Promise<PipelineItem[]> => {
    const response = await apiClient.get<ApiResponse<PipelineItem[]>>('/sales/pipelines');
    return response.data.data;
  },

  getDefaultPipeline: async (): Promise<PipelineItem> => {
    const response = await apiClient.get<ApiResponse<PipelineItem>>('/sales/pipelines/default');
    return response.data.data;
  },

  getPipelineById: async (id: string): Promise<PipelineItem> => {
    const response = await apiClient.get<ApiResponse<PipelineItem>>(`/sales/pipelines/${id}`);
    return response.data.data;
  },

  createPipeline: async (payload: { name: string; isDefault?: boolean; stages?: PipelineStage[] }): Promise<PipelineItem> => {
    const response = await apiClient.post<ApiResponse<PipelineItem>>('/sales/pipelines', payload);
    return response.data.data;
  },

  updatePipeline: async (id: string, payload: { name?: string; isDefault?: boolean }): Promise<PipelineItem> => {
    const response = await apiClient.patch<ApiResponse<PipelineItem>>(`/sales/pipelines/${id}`, payload);
    return response.data.data;
  },

  setPipelineStages: async (id: string, stages: PipelineStage[]): Promise<PipelineItem> => {
    const response = await apiClient.put<ApiResponse<PipelineItem>>(`/sales/pipelines/${id}/stages`, { stages });
    return response.data.data;
  },

  addPipelineStage: async (id: string, stage: PipelineStage): Promise<PipelineItem> => {
    const response = await apiClient.post<ApiResponse<PipelineItem>>(`/sales/pipelines/${id}/stages`, stage);
    return response.data.data;
  },

  updatePipelineStage: async (id: string, stageKey: string, payload: Partial<PipelineStage>): Promise<PipelineItem> => {
    const response = await apiClient.patch<ApiResponse<PipelineItem>>(`/sales/pipelines/${id}/stages/${stageKey}`, payload);
    return response.data.data;
  },

  deletePipelineStage: async (id: string, stageKey: string): Promise<PipelineItem> => {
    const response = await apiClient.delete<ApiResponse<PipelineItem>>(`/sales/pipelines/${id}/stages/${stageKey}`);
    return response.data.data;
  },

  deletePipeline: async (id: string): Promise<{ success: boolean; id: string }> => {
    const response = await apiClient.delete<ApiResponse<{ success: boolean; id: string }>>(`/sales/pipelines/${id}`);
    return response.data.data;
  },

  // Deals API
  getDeals: async (params?: DealQueryParams): Promise<SalesPaginatedResponse<DealItem>> => {
    const response = await apiClient.get<ApiResponse<DealItem[]> & { pagination: SalesPaginatedResponse<DealItem>['pagination'] }>('/sales/deals', {
      params,
    });
    return {
      items: response.data.data,
      pagination: response.data.pagination || {
        total: response.data.data.length,
        page: 1,
        limit: 25,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
  },

  getDealById: async (id: string): Promise<DealItem> => {
    const response = await apiClient.get<ApiResponse<DealItem>>(`/sales/deals/${id}`);
    return response.data.data;
  },

  createDeal: async (payload: CreateDealPayload): Promise<DealItem> => {
    const response = await apiClient.post<ApiResponse<DealItem>>('/sales/deals', payload);
    return response.data.data;
  },

  updateDeal: async (id: string, payload: UpdateDealPayload): Promise<DealItem> => {
    const response = await apiClient.patch<ApiResponse<DealItem>>(`/sales/deals/${id}`, payload);
    return response.data.data;
  },

  updateDealStage: async (id: string, payload: UpdateDealStagePayload): Promise<DealItem> => {
    const response = await apiClient.patch<ApiResponse<DealItem>>(`/sales/deals/${id}/stage`, payload);
    return response.data.data;
  },

  deleteDeal: async (id: string): Promise<{ success: boolean; id: string }> => {
    const response = await apiClient.delete<ApiResponse<{ success: boolean; id: string }>>(`/sales/deals/${id}`);
    return response.data.data;
  },

  handoffDealToOnboarding: async (
    id: string,
    payload?: HandoffDealPayload
  ): Promise<HandoffDealResponse> => {
    const response = await apiClient.post<ApiResponse<HandoffDealResponse>>(
      `/sales/deals/${id}/handoff`,
      payload || {}
    );
    return response.data.data;
  },

  getKanbanBoard: async (params?: KanbanQueryParams): Promise<KanbanBoardData> => {
    const response = await apiClient.get<ApiResponse<KanbanBoardData>>('/sales/deals/kanban', { params });
    return response.data.data;
  },

  getPipelineSummary: async (params?: PipelineSummaryQueryParams): Promise<PipelineSummaryData> => {
    const response = await apiClient.get<ApiResponse<PipelineSummaryData>>('/sales/deals/summary', { params });
    return response.data.data;
  },

  // Sales Tasks & Activities API
  getTasks: async (params?: TaskQueryParams): Promise<SalesPaginatedResponse<TaskItem> & { counters?: TaskCounters }> => {
    const response = await apiClient.get<ApiResponse<TaskItem[]> & { pagination: any; counters: TaskCounters }>('/sales/tasks', { params });
    return {
      items: response.data.data,
      pagination: response.data.pagination,
      counters: response.data.counters,
    };
  },

  getCalendarTasks: async (params: CalendarQueryParams): Promise<CalendarViewData> => {
    const response = await apiClient.get<ApiResponse<CalendarViewData>>('/sales/tasks/calendar', { params });
    return response.data.data;
  },

  getTaskById: async (id: string): Promise<TaskItem> => {
    const response = await apiClient.get<ApiResponse<TaskItem>>(`/sales/tasks/${id}`);
    return response.data.data;
  },

  createTask: async (payload: CreateTaskPayload): Promise<TaskItem> => {
    const response = await apiClient.post<ApiResponse<TaskItem>>('/sales/tasks', payload);
    return response.data.data;
  },

  updateTask: async (id: string, payload: UpdateTaskPayload): Promise<TaskItem> => {
    const response = await apiClient.patch<ApiResponse<TaskItem>>(`/sales/tasks/${id}`, payload);
    return response.data.data;
  },

  completeTask: async (id: string, payload?: CompleteTaskPayload): Promise<TaskItem> => {
    const response = await apiClient.patch<ApiResponse<TaskItem>>(`/sales/tasks/${id}/complete`, payload || {});
    return response.data.data;
  },

  deleteTask: async (id: string): Promise<{ success: boolean; id: string }> => {
    const response = await apiClient.delete<ApiResponse<{ success: boolean; id: string }>>(`/sales/tasks/${id}`);
    return response.data.data;
  },
};

export interface PipelineStage {
  _id?: string;
  key: string;
  name: string;
  probability: number;
  order: number;
  requiredFields?: string[];
  slaDays?: number;
}

export interface PipelineItem {
  _id: string;
  name: string;
  isDefault: boolean;
  stages: PipelineStage[];
  createdAt: string;
  updatedAt: string;
}

export interface DealStageHistory {
  fromStage: string;
  toStage: string;
  changedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  changedAt: string;
  daysInPreviousStage?: number;
}

export interface DealItem {
  _id: string;
  name: string;
  companyId: any;
  primaryContactId?: any;
  leadId?: any;
  pipelineId: any;
  stage: string;
  ownerId?: any;
  value: number;
  weightedValue?: number;
  currency: string;
  annualRecurringRevenue: number;
  oneTimeImplementationFee: number;
  probability: number;
  expectedCloseDate?: string;
  actualCloseDate?: string;
  competitors?: string[];
  nextAction?: string;
  lossReason?: string;
  lossDetails?: string;
  wonDetails?: {
    contractSignedDate?: string;
    approvedBy?: any;
    onboardingHandedOff?: boolean;
    handoffDate?: string;
    organizationId?: string;
  };
  packageId?: any;
  stageHistory: DealStageHistory[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDealPayload {
  name: string;
  companyId: string;
  primaryContactId?: string;
  leadId?: string;
  pipelineId?: string;
  stage?: string;
  ownerId?: string;
  value?: number;
  currency?: string;
  annualRecurringRevenue?: number;
  oneTimeImplementationFee?: number;
  probability?: number;
  expectedCloseDate?: string;
  actualCloseDate?: string;
  competitors?: string[];
  nextAction?: string;
  lossReason?: string;
  lossDetails?: string;
  packageId?: string;
  notes?: string;
}

export type UpdateDealPayload = Partial<CreateDealPayload>;

export interface UpdateDealStagePayload {
  stage: string;
  probability?: number;
  lossReason?: string;
  lossDetails?: string;
  actualCloseDate?: string;
  wonDetails?: {
    contractSignedDate?: string;
    approvedBy?: string;
    organizationId?: string;
    onboardingHandedOff?: boolean;
    handoffDate?: string;
  };
}

export interface HandoffDealPayload {
  organizationName?: string;
  adminEmail?: string;
  notes?: string;
}

export interface HandoffDealResponse {
  dealId: string;
  organizationId: string;
  customerAccountId: string;
  ownerUserId?: string;
  packageName: string;
  alreadyCompleted?: boolean;
}

export interface DealQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  companyId?: string;
  pipelineId?: string;
  stage?: string;
  ownerId?: string;
  currency?: string;
  minProbability?: number;
  maxProbability?: number;
  minValue?: number;
  maxValue?: number;
  minExpectedCloseDate?: string;
  maxExpectedCloseDate?: string;
  sortBy?: 'name' | 'value' | 'probability' | 'expectedCloseDate' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface KanbanQueryParams {
  pipelineId?: string;
  ownerId?: string;
  currency?: string;
  search?: string;
}

export interface KanbanStageData {
  key: string;
  name: string;
  order: number;
  probability: number;
  slaDays?: number;
  requiredFields?: string[];
  dealCount: number;
  count?: number;
  totalValue: number;
  weightedValue: number;
  deals: DealItem[];
}

export type KanbanStageColumn = KanbanStageData;

export interface KanbanBoardData {
  pipeline: {
    _id: string;
    name: string;
    isDefault: boolean;
  };
  stages: KanbanStageData[];
  totals: {
    dealCount: number;
    totalValue: number;
    weightedValue: number;
  };
}

export interface PipelineSummaryQueryParams {
  pipelineId?: string;
  currency?: string;
  ownerId?: string;
}

export interface PipelineSummaryData {
  totalDeals: number;
  totalValue: number;
  weightedValue: number;
  avgDealSize: number;
  winRate: number;
  closedWonCount: number;
  closedLostCount: number;
  currencyBreakdown: Array<{
    currency: string;
    count: number;
    totalValue: number;
    weightedValue: number;
  }>;
  stageBreakdown: Array<{
    stage: string;
    count: number;
    totalValue: number;
    weightedValue: number;
  }>;
}

export type TaskType = 'call' | 'meeting' | 'email' | 'demo' | 'proposal' | 'follow_up' | 'other';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface TaskItem {
  _id: string;
  title: string;
  description?: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  completedAt?: string;
  completedBy?: any;
  assignedTo?: any;
  leadId?: any;
  contactId?: any;
  companyId?: any;
  dealId?: any;
  outcomeNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  type?: TaskType;
  priority?: TaskPriority;
  dueDate: string;
  assignedTo?: string;
  leadId?: string;
  contactId?: string;
  companyId?: string;
  dealId?: string;
}

export interface UpdateTaskPayload extends Partial<CreateTaskPayload> {
  status?: TaskStatus;
  outcomeNotes?: string;
}

export interface CompleteTaskPayload {
  outcomeNotes?: string;
  completedAt?: string;
}

export interface TaskQueryParams {
  search?: string;
  type?: TaskType;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedTo?: string;
  leadId?: string;
  contactId?: string;
  companyId?: string;
  dealId?: string;
  dueFilter?: 'overdue' | 'today' | 'upcoming' | 'all';
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: 'dueDate' | 'priority' | 'title' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface CalendarQueryParams {
  startDate: string;
  endDate: string;
  assignedTo?: string;
  type?: TaskType;
  status?: TaskStatus;
}

export interface CalendarDayData {
  date: string;
  count: number;
  tasks: TaskItem[];
}

export interface CalendarViewData {
  startDate: string;
  endDate: string;
  totalTasks: number;
  days: CalendarDayData[];
}

export interface TaskCounters {
  overdue: number;
  today: number;
  upcoming: number;
  completed: number;
}

export default salesService;


