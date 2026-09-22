import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Workflow,
  Plus,
  Play,
  Zap,
  Search,
  Trash2,
  X,
  History,
  Activity,
} from 'lucide-react';
import {
  useWorkflows,
  useWorkflowExecutions,
  useCreateWorkflow,
  useToggleWorkflow,
  useDeleteWorkflow,
  useTriggerTestRun,
} from '../hooks/useWorkflows';
import { useJourneys } from '../hooks/useJourneys';
import { useEmployees } from '../hooks/useEmployees';
import { useDocumentTemplates } from '../hooks/useDocuments';
import { useMilestoneTemplates } from '../hooks/useMilestones';
import { useTaskTemplates } from '../hooks/useTaskTemplates';
import { WorkflowRuleItem, WorkflowAction, WorkflowCondition } from '../services/workflow.service';
import { SimplePagination } from '../components/SimplePagination';
import { SearchableSelect } from '../components/SearchableSelect';
import { usePagination } from '../hooks/usePagination';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '../components/Dialog';

export function Workflows() {
  const { t } = useTranslation(['workflows', 'common']);
  const [activeTab, setActiveTab] = useState<'rules' | 'logs'>('rules');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTriggerFilter, setSelectedTriggerFilter] = useState<string>('all');

  // Modal / Drawer States
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [testRunModalRule, setTestRunModalRule] = useState<WorkflowRuleItem | null>(null);
  const [selectedTestUser, setSelectedTestUser] = useState('');

  // Workflow Builder Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<number>(10);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [triggerType, setTriggerType] = useState<"user_created" | "journey_completed" | "task_completed" | "stage_entered" | "checkin_due" | "milestone_completed">('user_created');
  const [conditions, setConditions] = useState<WorkflowCondition[]>([]);
  const [actions, setActions] = useState<WorkflowAction[]>([
    { type: 'assign_journey', params: { journeyId: '' } },
  ]);

  // Queries & Mutations
  const { data: rules = [], isLoading: isLoadingRules } = useWorkflows(selectedTriggerFilter !== 'all' ? selectedTriggerFilter : undefined);
  const { data: logsData, isLoading: isLoadingLogs } = useWorkflowExecutions();
  const { data: journeys = [] } = useJourneys();
  const { data: employeesData } = useEmployees({ limit: 1000 });
  const { data: documentTemplates = [] } = useDocumentTemplates();
  const { data: milestoneTemplates = [] } = useMilestoneTemplates();
  const { data: taskTemplates = [] } = useTaskTemplates({ isActive: true });

  const createWorkflowMutation = useCreateWorkflow();
  const toggleWorkflowMutation = useToggleWorkflow();
  const deleteWorkflowMutation = useDeleteWorkflow();
  const triggerTestRunMutation = useTriggerTestRun();

  const employees = employeesData?.employees || [];
  const logs = logsData?.logs || [];

  const filteredRules = rules.filter((r) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return r.name.toLowerCase().includes(q) || (r.description && r.description.toLowerCase().includes(q));
    }
    return true;
  });

  const rulesPagination = usePagination({ data: filteredRules, initialPageSize: 6 });
  const logsPagination = usePagination({ data: logs, initialPageSize: 10 });

  const handleAddCondition = () => {
    setConditions((prev) => [...prev, { field: 'department', operator: 'equals', value: 'Engineering' }]);
  };

  const handleRemoveCondition = (index: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddAction = () => {
    setActions((prev) => [
      ...prev,
      { type: 'assign_journey', params: { journeyId: '' } },
    ]);
  };

  const handleRemoveAction = (index: number) => {
    setActions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateWorkflow = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!name.trim()) {
      setValidationError(t('validation.titleRequired', 'Rule title is required.'));
      return;
    }

    if (actions.length === 0) {
      setValidationError(t('validation.actionRequired', 'At least one action step is required.'));
      return;
    }

    for (let i = 0; i < actions.length; i++) {
      const act = actions[i];
      if (act.type === 'assign_journey' && !act.params.journeyId) {
        setValidationError(t('validation.journeyRequired', 'Target template is required for journey assignment.'));
        return;
      }
      if (act.type === 'assign_checklist' && !act.params.checklistTemplateId) {
        setValidationError(t('validation.checklistRequired', 'Target checklist template is required.'));
        return;
      }
      if (act.type === 'create_task' && !act.params.taskTitle) {
        setValidationError(t('validation.taskTitleRequired', 'Task title is required for task creation.'));
        return;
      }
    }

    createWorkflowMutation.mutate(
      {
        name,
        title: name,
        description,
        triggerType,
        conditions,
        actions,
        priority,
        isActive: true,
      },
      {
        onSuccess: () => {
          setIsBuilderOpen(false);
          setName('');
          setDescription('');
          setConditions([]);
          setPriority(10);
          setValidationError(null);
        },
        onError: (err: any) => {
          setValidationError(err?.response?.data?.message || t('validation.failedSave', 'Failed to save workflow rule.'));
        },
      }
    );
  };

  const handleExecuteTestRun = () => {
    if (!testRunModalRule || !selectedTestUser) return;
    triggerTestRunMutation.mutate(
      { id: testRunModalRule._id, targetUserId: selectedTestUser },
      {
        onSuccess: () => {
          setTestRunModalRule(null);
          setSelectedTestUser('');
          setActiveTab('logs');
        },
      }
    );
  };

  const getTriggerBadge = (trigger: string) => {
    const labels: Record<string, string> = {
      user_created: t('triggers.user_created', 'New User Created'),
      journey_completed: t('triggers.journey_completed', 'Journey Completed'),
      task_completed: t('triggers.task_completed', 'Task Completed'),
      stage_entered: t('triggers.stage_entered', 'Stage Entered'),
      checkin_due: t('triggers.checkin_due', 'Compliance Checkin Due'),
      milestone_completed: t('triggers.milestone_completed', 'Milestone Completed'),
    };
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800">
        <Zap className="w-3 h-3 text-indigo-500" />
        {labels[trigger] || trigger}
      </span>
    );
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'success':
        return <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full dark:bg-emerald-950 dark:text-emerald-300">{t('status.success', 'Success')}</span>;
      case 'partial_failure':
        return <span className="px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 rounded-full dark:bg-amber-950 dark:text-amber-300">{t('status.partialFailure', 'Partial Failure')}</span>;
      case 'pending_delay':
        return <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full dark:bg-blue-950 dark:text-blue-300">{t('status.pendingDelay', 'Pending Delay')}</span>;
      default:
        return <span className="px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded-full dark:bg-red-950 dark:text-red-300">{t('status.failed', 'Failed')}</span>;
    }
  };

  const getActionLabel = (type: string) => {
    const map: Record<string, string> = {
      assign_journey: t('builderModal.actionTypes.assignJourney', 'Assign Onboarding Journey'),
      assign_checklist: t('builderModal.actionTypes.assignChecklist', 'Assign Checklist Template'),
      create_task: t('builderModal.actionTypes.createTask', 'Create Operational Task'),
      send_notification: t('builderModal.actionTypes.sendNotification', 'Send Multi-Channel Notification'),
      assign_document: t('builderModal.actionTypes.assignDocument', 'Assign E-Signature Document Template'),
      trigger_buddy: t('builderModal.actionTypes.triggerBuddy', 'Trigger Buddy Pairing'),
      trigger_webhook: t('builderModal.actionTypes.triggerWebhook', 'Trigger Outbound Webhook'),
      assign_milestone: t('builderModal.actionTypes.assignMilestone', 'Assign Milestone Check-in Program'),
    };
    return map[type] || type.replace('_', ' ');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Title Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
              <Workflow className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              {t('title', 'Workflow Automation Engine')}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              {t('subtitle', 'Event-driven automation rules for auto-assigning journeys, provisioning tasks, and dispatching multi-channel alerts.')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('logs')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium text-sm rounded-xl transition-all"
            >
              <History className="w-4 h-4" />
              {t('executionLogs', 'Execution Logs')}
            </button>
            <button
              id="create-rule-btn"
              onClick={() => setIsBuilderOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl transition-all shadow-sm shadow-indigo-200 dark:shadow-none"
            >
              <Plus className="w-4 h-4" />
              {t('createRule', 'Create Rule')}
            </button>
          </div>
        </div>

        {/* Tab & Search Bar */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-3">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('rules')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'rules'
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
                  }`}
              >
                {t('tabs.rules', 'Active Workflow Rules')} ({rules.length})
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'logs'
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
                  }`}
              >
                {t('tabs.logs', 'Audit Execution History')} ({logs.length})
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder={t('filters.searchPlaceholder', 'Search workflow rules...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <select
                value={selectedTriggerFilter}
                onChange={(e) => setSelectedTriggerFilter(e.target.value)}
                className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">{t('filters.allTriggers', 'All Event Triggers')}</option>
                <option value="user_created">{t('filters.userCreated', 'New User Created')}</option>
                <option value="journey_completed">{t('filters.journeyCompleted', 'Journey Completed')}</option>
                <option value="task_completed">{t('filters.taskCompleted', 'Task Completed')}</option>
                <option value="stage_entered">{t('filters.stageEntered', 'Stage Entered')}</option>
                <option value="milestone_completed">{t('filters.milestoneCompleted', 'Milestone Completed')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'rules' ? (
          isLoadingRules ? (
            <div className="flex justify-center items-center py-16">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-700">
              <Workflow className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold">{t('rulesList.emptyTitle', 'No Workflow Rules Configured')}</h3>
              <p className="text-slate-500 text-sm mt-1">{t('rulesList.emptyDesc', 'Create automated workflow rules to auto-assign learning paths and operational tasks.')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rulesPagination.paginatedData.map((rule) => (
                  <div
                    key={rule._id}
                    data-testid="workflow-rule-card"
                    className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-all"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            {getTriggerBadge(rule.triggerType)}
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
                              {t('rulesList.priority', 'Priority: {{priority}}', { priority: (rule as any).priority ?? 0 })}
                            </span>
                          </div>
                          <h3 className="text-lg font-bold mt-2">{rule.name}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rule.isActive
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                          >
                            {rule.isActive ? t('status.active', 'Active') : t('status.inactive', 'Inactive')}
                          </span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              id={`rule-toggle-${rule._id}`}
                              checked={rule.isActive}
                              onChange={(e) =>
                                toggleWorkflowMutation.mutate({ id: rule._id, isActive: e.target.checked })
                              }
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                          </label>
                        </div>
                      </div>

                      {rule.description && (
                        <p className="text-sm text-slate-500 dark:text-slate-400">{rule.description}</p>
                      )}

                      {/* Conditions Box */}
                      {rule.conditions && rule.conditions.length > 0 && (
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 text-xs space-y-1">
                          <span className="font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                            {t('rulesList.conditionsHeader', 'Conditions:')}
                          </span>
                          {rule.conditions.map((c, i) => (
                            <div key={i} className="text-slate-600 dark:text-slate-300 font-mono">
                              {t('rulesList.conditionIf', 'IF')} <span className="font-semibold">{c.field}</span> {c.operator}{' '}
                              <span className="text-indigo-600 dark:text-indigo-400">{c.value}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Actions Box */}
                      {rule.actions && rule.actions.length > 0 && (
                        <div className="bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl p-3 text-xs space-y-1 border border-indigo-100 dark:border-indigo-900/30">
                          <span className="font-semibold text-indigo-500 uppercase tracking-wider block mb-1">
                            {t('rulesList.actionsTriggered', 'Actions Triggered:')}
                          </span>
                          {rule.actions.map((act, i) => (
                            <div key={i} className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <Zap className="w-3 h-3 text-indigo-500" />
                              <span className="capitalize">{getActionLabel(act.type)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700/60">
                      <span className="text-xs text-slate-400">
                        {t('rulesList.updatedAt', 'Updated {{date}}', { date: new Date(rule.updatedAt).toLocaleDateString() })}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setTestRunModalRule(rule)}
                          className="px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 rounded-lg transition-all flex items-center gap-1"
                        >
                          <Play className="w-3 h-3" />
                          {t('rulesList.testRun', 'Test Run')}
                        </button>

                        <button
                          onClick={() => deleteWorkflowMutation.mutate(rule._id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-all"
                          title={t('rulesList.deleteRuleTitle', 'Delete Rule')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <SimplePagination
                currentPage={rulesPagination.page}
                totalPages={rulesPagination.totalPages}
                totalItems={rulesPagination.totalItems}
                startIndex={rulesPagination.startIndex}
                endIndex={rulesPagination.endIndex}
                pageSize={rulesPagination.pageSize}
                onPageChange={rulesPagination.setPage}
                onPageSizeChange={rulesPagination.setPageSize}
                itemLabel={t('rulesList.rulesLabel', 'rules')}
              />
            </div>
          )
        ) : (
          /* Execution Logs Tab */
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            {isLoadingLogs ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p>{t('logsList.empty', 'No execution logs recorded yet.')}</p>
              </div>
            ) : (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-400 uppercase">
                      <tr>
                        <th className="p-4">{t('logsList.headerTrigger', 'Trigger Event')}</th>
                        <th className="p-4">{t('logsList.headerRule', 'Workflow Rule')}</th>
                        <th className="p-4">{t('logsList.headerTarget', 'Target Employee')}</th>
                        <th className="p-4">{t('logsList.headerStatus', 'Status')}</th>
                        <th className="p-4">{t('logsList.headerSteps', 'Steps Executed')}</th>
                        <th className="p-4">{t('logsList.headerExecutedAt', 'Executed At')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {logsPagination.paginatedData.map((log) => (
                        <tr key={log._id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                          <td className="p-4 font-medium">{getTriggerBadge(log.triggerEvent)}</td>
                          <td className="p-4 font-medium">{log.workflowRuleId?.name || t('logsList.defaultRuleName', 'Workflow Rule')}</td>
                          <td className="p-4">
                            {log.targetUserId?.profile?.firstName} {log.targetUserId?.profile?.lastName}
                          </td>
                          <td className="p-4">{getStatusBadge(log.status)}</td>
                          <td className="p-4 text-xs font-mono">{t('logsList.stepsCount', '{{count}} steps', { count: log.stepResults?.length || 0 })}</td>
                          <td className="p-4 text-xs text-slate-400">{new Date(log.executedAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 border-t">
                  <SimplePagination
                    currentPage={logsPagination.page}
                    totalPages={logsPagination.totalPages}
                    totalItems={logsPagination.totalItems}
                    startIndex={logsPagination.startIndex}
                    endIndex={logsPagination.endIndex}
                    pageSize={logsPagination.pageSize}
                    onPageChange={logsPagination.setPage}
                    onPageSizeChange={logsPagination.setPageSize}
                    itemLabel={t('logsList.logsLabel', 'logs')}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Interactive Workflow Builder Modal */}
      <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border/60 bg-card">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-600" />
              {t('builderModal.title', 'Configure Automated Workflow Rule')}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {t('builderModal.desc', 'Define trigger events, evaluation filters, and downstream action steps.')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateWorkflow} className="flex flex-col flex-1 overflow-hidden">
            <DialogBody className="space-y-4 text-sm">
              {validationError && (
                <div
                  id="rule-validation-error"
                  className="p-3 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 text-xs rounded-xl border border-red-200 dark:border-red-800 font-medium"
                >
                  {validationError}
                </div>
              )}

              <div>
                <label className="block font-medium mb-1 text-xs">{t('builderModal.nameLabel', 'Workflow Rule Title / Name *')}</label>
                <input
                  id="rule-title-input"
                  type="text"
                  required
                  placeholder={t('builderModal.namePlaceholder', 'e.g. Auto Assign Eng Onboarding')}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium mb-1 text-xs">{t('builderModal.triggerLabel', 'Event Trigger *')}</label>
                  <select
                    id="rule-trigger-select"
                    value={triggerType}
                    onChange={(e) => setTriggerType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                  >
                    <option value="user_created">{t('builderModal.triggers.user_created', 'ON_USER_CREATED (New User Created / Hired)')}</option>
                    <option value="journey_completed">{t('builderModal.triggers.journey_completed', 'ON_JOURNEY_COMPLETED (Journey Completed)')}</option>
                    <option value="task_completed">{t('builderModal.triggers.task_completed', 'ON_TASK_COMPLETED (Task Completed)')}</option>
                    <option value="stage_entered">{t('builderModal.triggers.stage_entered', 'ON_STAGE_ENTERED (Stage Entered)')}</option>
                    <option value="milestone_completed">{t('builderModal.triggers.milestone_completed', 'ON_MILESTONE_COMPLETED (Milestone Check-in Completed)')}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1 text-xs">{t('builderModal.priorityLabel', 'Priority (Higher runs first)')}</label>
                  <input
                    id="rule-priority-input"
                    type="number"
                    min="0"
                    max="1000"
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                </div>
              </div>

              {/* Conditions Section */}
              <div className="border border-slate-200 dark:border-slate-700 p-4 rounded-xl space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-400">
                    {t('builderModal.conditionsTitle', 'IF Filter Conditions (Optional)')}
                  </h4>
                  <button
                    type="button"
                    id="add-condition-btn"
                    onClick={handleAddCondition}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t('builderModal.addCondition', 'Add Condition')}
                  </button>
                </div>

                {conditions.map((cond, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      id={`condition-field-select-${idx}`}
                      value={cond.field}
                      onChange={(e) => {
                        const updated = [...conditions];
                        updated[idx].field = e.target.value as any;
                        setConditions(updated);
                      }}
                      className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      <option value="department">{t('builderModal.conditionFields.department', 'Department')}</option>
                      <option value="role">{t('builderModal.conditionFields.role', 'Role')}</option>
                      <option value="jobTitle">{t('builderModal.conditionFields.jobTitle', 'Job Title')}</option>
                    </select>

                    <select
                      id={`condition-operator-select-${idx}`}
                      value={cond.operator}
                      onChange={(e) => {
                        const updated = [...conditions];
                        updated[idx].operator = e.target.value as any;
                        setConditions(updated);
                      }}
                      className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      <option value="equals">{t('builderModal.conditionOperators.equals', 'Equals')}</option>
                      <option value="not_equals">{t('builderModal.conditionOperators.notEquals', 'Not Equals')}</option>
                      <option value="contains">{t('builderModal.conditionOperators.contains', 'Contains')}</option>
                    </select>

                    <input
                      id={`condition-value-input-${idx}`}
                      type="text"
                      value={cond.value as string}
                      onChange={(e) => {
                        const updated = [...conditions];
                        updated[idx].value = e.target.value;
                        setConditions(updated);
                      }}
                      placeholder={t('builderModal.conditionValuePlaceholder', 'Value')}
                      className="flex-1 px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                    />

                    <button
                      type="button"
                      onClick={() => handleRemoveCondition(idx)}
                      className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                      title={t('builderModal.removeCondition', 'Remove Condition')}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Actions Section */}
              <div className="border border-slate-200 dark:border-slate-700 p-4 rounded-xl space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-400">
                    {t('builderModal.actionsTitle', 'THEN Actions Pipeline *')}
                  </h4>
                  <button
                    type="button"
                    id="add-action-btn"
                    onClick={handleAddAction}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t('builderModal.addAction', 'Add Action Step')}
                  </button>
                </div>

                {actions.map((act, idx) => (
                  <div key={idx} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-indigo-600">
                        {t('builderModal.stepLabel', 'Step {{number}}', { number: idx + 1 })}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAction(idx)}
                        className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                        title={t('builderModal.removeAction', 'Remove Action')}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <select
                      id={`action-type-select-${idx}`}
                      value={act.type}
                      onChange={(e) => {
                        const updated = [...actions];
                        updated[idx].type = e.target.value as any;
                        setActions(updated);
                        if (validationError) setValidationError(null);
                      }}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      <option value="assign_journey">{t('builderModal.actionTypes.assignJourney', 'Assign Onboarding Journey')}</option>
                      <option value="assign_checklist">{t('builderModal.actionTypes.assignChecklist', 'Assign Checklist Template')}</option>
                      <option value="create_task">{t('builderModal.actionTypes.createTask', 'Create Operational Task')}</option>
                      <option value="send_notification">{t('builderModal.actionTypes.sendNotification', 'Send Multi-Channel Notification')}</option>
                      <option value="assign_document">{t('builderModal.actionTypes.assignDocument', 'Assign E-Signature Document Template')}</option>
                      <option value="trigger_buddy">{t('builderModal.actionTypes.triggerBuddy', 'Trigger Buddy Pairing')}</option>
                      <option value="trigger_webhook">{t('builderModal.actionTypes.triggerWebhook', 'Trigger Outbound Webhook')}</option>
                      <option value="assign_milestone">{t('builderModal.actionTypes.assignMilestone', 'Assign Milestone Check-in Program')}</option>
                    </select>

                    {act.type === 'assign_milestone' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-1">{t('builderModal.milestoneTemplateLabel', 'Milestone Template (Optional)')}</label>
                          <select
                            value={act.params.templateId || ''}
                            onChange={(e) => {
                              const updated = [...actions];
                              updated[idx].params = { ...updated[idx].params, templateId: e.target.value };
                              setActions(updated);
                              if (validationError) setValidationError(null);
                            }}
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                          >
                            <option value="">{t('builderModal.milestoneAutoDetect', 'Auto-Detect by Target Day')}</option>
                            {milestoneTemplates.map((mt: any) => (
                              <option key={mt._id} value={mt._id}>
                                {t('builderModal.milestoneDayOption', 'Day {{day}} - {{title}}', { day: mt.targetDay, title: mt.title })}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-1">{t('builderModal.targetDayLabel', 'Target Day (e.g. 30, 60, 90, 180)')}</label>
                          <select
                            value={act.params.targetDay || 30}
                            onChange={(e) => {
                              const updated = [...actions];
                              updated[idx].params = { ...updated[idx].params, targetDay: Number(e.target.value) };
                              setActions(updated);
                              if (validationError) setValidationError(null);
                            }}
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                          >
                            <option value={30}>{t('builderModal.targetDayOption', 'Day {{day}} Milestone', { day: 30 })}</option>
                            <option value={60}>{t('builderModal.targetDayOption', 'Day {{day}} Milestone', { day: 60 })}</option>
                            <option value={90}>{t('builderModal.targetDayOption', 'Day {{day}} Milestone', { day: 90 })}</option>
                            <option value={180}>{t('builderModal.targetDayOption', 'Day {{day}} Milestone', { day: 180 })}</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {act.type === 'assign_journey' && (
                      <div>
                        <select
                          id={`action-target-journey-select-${idx}`}
                          value={act.params.journeyId || ''}
                          onChange={(e) => {
                            const updated = [...actions];
                            updated[idx].params = { ...updated[idx].params, journeyId: e.target.value };
                            setActions(updated);
                            if (validationError) setValidationError(null);
                          }}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                        >
                          <option value="">{t('builderModal.selectJourneyPlaceholder', 'Select Journey Template')}</option>
                          {journeys.map((j: any) => (
                            <option key={j._id} value={j._id}>
                              {j.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {act.type === 'assign_document' && (
                      <select
                        value={act.params.documentTemplateId || ''}
                        onChange={(e) => {
                          const updated = [...actions];
                          updated[idx].params = { ...updated[idx].params, documentTemplateId: e.target.value };
                          setActions(updated);
                        }}
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                      >
                        <option value="">{t('builderModal.selectDocumentPlaceholder', 'Select Document Template')}</option>
                        {documentTemplates.map((dt: any) => (
                          <option key={dt._id} value={dt._id}>
                            {dt.title} ({dt.category})
                          </option>
                        ))}
                      </select>
                    )}

                    {act.type === 'trigger_buddy' && (
                      <SearchableSelect
                        clearable
                        value={act.params.buddyUserId || ''}
                        onChange={(val) => {
                          const updated = [...actions];
                          updated[idx].params = { ...updated[idx].params, buddyUserId: val };
                          setActions(updated);
                        }}
                        placeholder={t('builderModal.buddyPlaceholder', 'Auto-Select Available Buddy or Search...')}
                        searchPlaceholder={t('builderModal.buddySearchPlaceholder', 'Search buddy by name, department...')}
                        options={[
                          { value: '', label: t('builderModal.buddyAutoOption', 'Auto-Select Available Buddy in Organization') },
                          ...employees.map((emp: any) => ({
                            value: emp.id,
                            label: emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || t('builderModal.unnamedEmployee', 'Unnamed'),
                            sublabel: emp.email,
                            badge: emp.department || t('builderModal.employeeRoleFallback', 'Employee'),
                          }))
                        ]}
                      />
                    )}

                    {act.type === 'trigger_webhook' && (
                      <input
                        type="url"
                        placeholder={t('builderModal.webhookPlaceholder', 'Webhook Target URL (e.g. https://api.hris.com/v1/webhook)')}
                        value={act.params.webhookUrl || ''}
                        onChange={(e) => {
                          const updated = [...actions];
                          updated[idx].params = { ...updated[idx].params, webhookUrl: e.target.value };
                          setActions(updated);
                        }}
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                      />
                    )}

                    {act.type === 'assign_checklist' && (
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">{t('builderModal.checklistTemplateLabel', 'Checklist Template *')}</label>
                        <select
                          id={`action-target-checklist-select-${idx}`}
                          value={act.params.checklistTemplateId || ''}
                          onChange={(e) => {
                            const updated = [...actions];
                            updated[idx].params = { ...updated[idx].params, checklistTemplateId: e.target.value };
                            setActions(updated);
                            if (validationError) setValidationError(null);
                          }}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                        >
                          <option value="">{t('builderModal.selectChecklistPlaceholder', 'Select Checklist Template')}</option>
                          {taskTemplates.map((tt: any) => (
                            <option key={tt._id} value={tt._id}>
                              {tt.title} {t('builderModal.checklistItemsCount', '({{count}} items)', { count: tt.items?.length || 0 })}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {act.type === 'create_task' && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder={t('builderModal.taskTitlePlaceholder', 'Task Title (e.g. IT Workstation Provisioning) *')}
                          value={act.params.taskTitle || ''}
                          onChange={(e) => {
                            const updated = [...actions];
                            updated[idx].params = { ...updated[idx].params, taskTitle: e.target.value };
                            setActions(updated);
                            if (validationError) setValidationError(null);
                          }}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                        />
                        <textarea
                          placeholder={t('builderModal.taskDescPlaceholder', 'Task Description / Instructions (Optional)')}
                          value={act.params.taskDescription || ''}
                          rows={2}
                          onChange={(e) => {
                            const updated = [...actions];
                            updated[idx].params = { ...updated[idx].params, taskDescription: e.target.value };
                            setActions(updated);
                          }}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg resize-none"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-0.5">{t('builderModal.assignedRoleLabel', 'Assigned To Role')}</label>
                            <select
                              value={act.params.taskAssigneeRole || 'employee'}
                              onChange={(e) => {
                                const updated = [...actions];
                                updated[idx].params = { ...updated[idx].params, taskAssigneeRole: e.target.value as any };
                                setActions(updated);
                              }}
                              className="w-full px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                            >
                              <option value="employee">{t('builderModal.roles.employee', 'New Hire (Employee)')}</option>
                              <option value="manager">{t('builderModal.roles.manager', 'Direct Manager')}</option>
                              <option value="it_admin">{t('builderModal.roles.it_admin', 'IT Administrator')}</option>
                              <option value="hr_admin">{t('builderModal.roles.hr_admin', 'HR Administrator')}</option>
                              <option value="buddy">{t('builderModal.roles.buddy', 'Assigned Buddy')}</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-0.5">{t('builderModal.categoryLabel', 'Category')}</label>
                            <select
                              value={act.params.taskCategory || 'general'}
                              onChange={(e) => {
                                const updated = [...actions];
                                updated[idx].params = { ...updated[idx].params, taskCategory: e.target.value as any };
                                setActions(updated);
                              }}
                              className="w-full px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                            >
                              <option value="general">{t('builderModal.categories.general', 'General')}</option>
                              <option value="it_setup">{t('builderModal.categories.it_setup', 'IT Setup')}</option>
                              <option value="equipment">{t('builderModal.categories.equipment', 'Hardware / Equipment')}</option>
                              <option value="hr_paperwork">{t('builderModal.categories.hr_paperwork', 'HR Paperwork')}</option>
                              <option value="training">{t('builderModal.categories.training', 'Training')}</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-0.5">{t('builderModal.stageLabel', 'Stage')}</label>
                            <select
                              value={act.params.taskStage || 'day_1'}
                              onChange={(e) => {
                                const updated = [...actions];
                                updated[idx].params = { ...updated[idx].params, taskStage: e.target.value as any };
                                setActions(updated);
                              }}
                              className="w-full px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                            >
                              <option value="preboarding">{t('builderModal.stages.preboarding', 'Pre-boarding')}</option>
                              <option value="day_1">{t('builderModal.stages.day_1', 'Day 1')}</option>
                              <option value="week_1">{t('builderModal.stages.week_1', 'Week 1')}</option>
                              <option value="month_1">{t('builderModal.stages.month_1', 'Month 1')}</option>
                              <option value="custom">{t('builderModal.stages.custom', 'Custom')}</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-0.5">{t('builderModal.priorityLabelTask', 'Priority')}</label>
                            <select
                              value={act.params.taskPriority || 'normal'}
                              onChange={(e) => {
                                const updated = [...actions];
                                updated[idx].params = { ...updated[idx].params, taskPriority: e.target.value as any };
                                setActions(updated);
                              }}
                              className="w-full px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                            >
                              <option value="low">{t('builderModal.priorities.low', 'Low')}</option>
                              <option value="normal">{t('builderModal.priorities.normal', 'Normal')}</option>
                              <option value="high">{t('builderModal.priorities.high', 'High')}</option>
                              <option value="critical">{t('builderModal.priorities.critical', 'Critical')}</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-0.5">{t('builderModal.dueInLabel', 'Due In (Days from trigger)')}</label>
                            <input
                              type="number"
                              min="0"
                              max="365"
                              value={act.params.relativeOffsetDays ?? 7}
                              onChange={(e) => {
                                const updated = [...actions];
                                updated[idx].params = { ...updated[idx].params, relativeOffsetDays: Number(e.target.value) };
                                setActions(updated);
                              }}
                              className="w-full px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </DialogBody>

            <DialogFooter className="p-4 sm:px-6 border-t border-border/60 bg-muted/30">
              <button
                type="button"
                onClick={() => setIsBuilderOpen(false)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-medium cursor-pointer transition-colors"
              >
                {t('builderModal.cancel', 'Cancel')}
              </button>
              <button
                id="save-activate-rule-btn"
                type="submit"
                disabled={createWorkflowMutation.isPending}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:bg-primary/90 transition-all cursor-pointer shadow-sm"
              >
                {createWorkflowMutation.isPending ? t('builderModal.saving', 'Saving...') : t('builderModal.save', 'Save & Activate')}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Test Run Trigger Modal */}
      <Dialog open={!!testRunModalRule} onOpenChange={(open) => { if (!open) setTestRunModalRule(null); }}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-4 border-b border-border/60 bg-card">
            <DialogTitle className="text-lg font-bold">{t('testRunModal.title', 'Trigger Workflow Test Run')}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {t('testRunModal.desc', 'Select a target employee to evaluate rule conditions and execute action steps for "{{name}}".', { name: testRunModalRule?.name })}
            </DialogDescription>
          </DialogHeader>

          {testRunModalRule && (
            <DialogBody className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-foreground">{t('testRunModal.targetEmployeeLabel', 'Target Employee *')}</label>
                <SearchableSelect
                  value={selectedTestUser}
                  onChange={(val) => setSelectedTestUser(val)}
                  placeholder={t('testRunModal.targetEmployeePlaceholder', 'Search & select target employee...')}
                  searchPlaceholder={t('testRunModal.searchEmployeePlaceholder', 'Search employee by name, email...')}
                  options={employees.map((emp: any) => ({
                    value: emp.id,
                    label: emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || t('builderModal.unnamedEmployee', 'Unnamed'),
                    sublabel: emp.email,
                    badge: emp.department || t('builderModal.employeeRoleFallback', 'Employee'),
                  }))}
                />
              </div>
            </DialogBody>
          )}

          <DialogFooter className="p-4 sm:px-6 border-t border-border/60 bg-muted/30">
            <button
              type="button"
              onClick={() => setTestRunModalRule(null)}
              className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-medium cursor-pointer transition-colors"
            >
              {t('testRunModal.cancel', 'Cancel')}
            </button>
            <button
              type="button"
              onClick={handleExecuteTestRun}
              disabled={!selectedTestUser || triggerTestRunMutation.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:bg-primary/90 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Play className="w-3.5 h-3.5" />
              {triggerTestRunMutation.isPending ? t('testRunModal.running', 'Running...') : t('testRunModal.execute', 'Execute Test Run')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Workflows;
