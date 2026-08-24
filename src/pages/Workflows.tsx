import React, { useState } from 'react';
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
import { WorkflowRuleItem, WorkflowAction, WorkflowCondition } from '../services/workflow.service';
import { SimplePagination } from '../components/SimplePagination';
import { usePagination } from '../hooks/usePagination';

export function Workflows() {
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
  const [triggerType, setTriggerType] = useState<"user_created" | "journey_completed" | "task_completed" | "stage_entered" | "checkin_due">('user_created');
  const [conditions, setConditions] = useState<WorkflowCondition[]>([]);
  const [actions, setActions] = useState<WorkflowAction[]>([
    { type: 'send_notification', params: { notificationTitle: 'Welcome to Talnova', notificationMessage: 'Welcome to your onboarding path!' } },
  ]);

  // Queries & Mutations
  const { data: rules = [], isLoading: isLoadingRules } = useWorkflows(selectedTriggerFilter !== 'all' ? selectedTriggerFilter : undefined);
  const { data: logsData, isLoading: isLoadingLogs } = useWorkflowExecutions();
  const { data: journeys = [] } = useJourneys();
  const { data: employeesData } = useEmployees({ limit: 100 });

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
      { type: 'create_task', params: { taskTitle: 'Setup Workstation & Accounts', taskStage: 'day_1', taskPriority: 'high' } },
    ]);
  };

  const handleRemoveAction = (index: number) => {
    setActions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateWorkflow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || actions.length === 0) return;

    createWorkflowMutation.mutate(
      {
        name,
        description,
        triggerType,
        conditions,
        actions,
        isActive: true,
      },
      {
        onSuccess: () => {
          setIsBuilderOpen(false);
          setName('');
          setDescription('');
          setConditions([]);
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

  const getTriggerBadge = (t: string) => {
    const labels: Record<string, string> = {
      user_created: 'New User Created',
      journey_completed: 'Journey Completed',
      task_completed: 'Task Completed',
      stage_entered: 'Stage Entered',
      checkin_due: 'Compliance Checkin Due',
    };
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800">
        <Zap className="w-3 h-3 text-indigo-500" />
        {labels[t] || t}
      </span>
    );
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'success':
        return <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full dark:bg-emerald-950 dark:text-emerald-300">Success</span>;
      case 'partial_failure':
        return <span className="px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 rounded-full dark:bg-amber-950 dark:text-amber-300">Partial Failure</span>;
      case 'pending_delay':
        return <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full dark:bg-blue-950 dark:text-blue-300">Pending Delay</span>;
      default:
        return <span className="px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded-full dark:bg-red-950 dark:text-red-300">Failed</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Title Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
              <Workflow className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              Workflow Automation Engine
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Event-driven automation rules for auto-assigning journeys, provisioning tasks, and dispatching multi-channel alerts.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('logs')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium text-sm rounded-xl transition-all"
            >
              <History className="w-4 h-4" />
              Execution Logs
            </button>
            <button
              onClick={() => setIsBuilderOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl transition-all shadow-sm shadow-indigo-200 dark:shadow-none"
            >
              <Plus className="w-4 h-4" />
              Create Rule
            </button>
          </div>
        </div>

        {/* Tab & Search Bar */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-3">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('rules')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  activeTab === 'rules'
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
              >
                Active Workflow Rules ({rules.length})
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  activeTab === 'logs'
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
              >
                Audit Execution History ({logs.length})
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search rules..."
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
                <option value="all">All Event Triggers</option>
                <option value="user_created">User Created</option>
                <option value="journey_completed">Journey Completed</option>
                <option value="task_completed">Task Completed</option>
                <option value="stage_entered">Stage Entered</option>
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
              <h3 className="text-lg font-semibold">No Workflow Rules Configured</h3>
              <p className="text-slate-500 text-sm mt-1">Create automated workflow rules to auto-assign learning paths and operational tasks.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rulesPagination.paginatedData.map((rule) => (
                  <div
                    key={rule._id}
                    className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-all"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          {getTriggerBadge(rule.triggerType)}
                          <h3 className="text-lg font-bold mt-2">{rule.name}</h3>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rule.isActive}
                            onChange={(e) =>
                              toggleWorkflowMutation.mutate({ id: rule._id, isActive: e.target.checked })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>

                      {rule.description && (
                        <p className="text-sm text-slate-500 dark:text-slate-400">{rule.description}</p>
                      )}

                      {/* Conditions Box */}
                      {rule.conditions && rule.conditions.length > 0 && (
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 text-xs space-y-1">
                          <span className="font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                            Conditions:
                          </span>
                          {rule.conditions.map((c, i) => (
                            <div key={i} className="text-slate-600 dark:text-slate-300 font-mono">
                              IF <span className="font-semibold">{c.field}</span> {c.operator}{' '}
                              <span className="text-indigo-600 dark:text-indigo-400">{c.value}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Actions Box */}
                      {rule.actions && rule.actions.length > 0 && (
                        <div className="bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl p-3 text-xs space-y-1 border border-indigo-100 dark:border-indigo-900/30">
                          <span className="font-semibold text-indigo-500 uppercase tracking-wider block mb-1">
                            Actions Triggered:
                          </span>
                          {rule.actions.map((act, i) => (
                            <div key={i} className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <Zap className="w-3 h-3 text-indigo-500" />
                              <span className="capitalize">{act.type.replace('_', ' ')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700/60">
                      <span className="text-xs text-slate-400">
                        Updated {new Date(rule.updatedAt).toLocaleDateString()}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setTestRunModalRule(rule)}
                          className="px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 rounded-lg transition-all flex items-center gap-1"
                        >
                          <Play className="w-3 h-3" />
                          Test Run
                        </button>

                        <button
                          onClick={() => deleteWorkflowMutation.mutate(rule._id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-all"
                          title="Delete Rule"
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
                itemLabel="rules"
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
                <p>No workflow execution logs found.</p>
              </div>
            ) : (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-400 uppercase">
                      <tr>
                        <th className="p-4">Trigger Event</th>
                        <th className="p-4">Workflow Rule</th>
                        <th className="p-4">Target Employee</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Steps Executed</th>
                        <th className="p-4">Executed At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {logsPagination.paginatedData.map((log) => (
                        <tr key={log._id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                          <td className="p-4 font-medium">{getTriggerBadge(log.triggerEvent)}</td>
                          <td className="p-4 font-medium">{log.workflowRuleId?.name || 'Workflow Rule'}</td>
                          <td className="p-4">
                            {log.targetUserId?.profile?.firstName} {log.targetUserId?.profile?.lastName}
                          </td>
                          <td className="p-4">{getStatusBadge(log.status)}</td>
                          <td className="p-4 text-xs font-mono">{log.stepResults?.length || 0} steps</td>
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
                    itemLabel="logs"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Interactive Workflow Builder Modal */}
      {isBuilderOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Zap className="w-5 h-5 text-indigo-600" />
                Configure Automated Workflow Rule
              </h3>
              <button onClick={() => setIsBuilderOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWorkflow} className="space-y-4 text-sm">
              <div>
                <label className="block font-medium mb-1">Workflow Rule Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Engineering Onboarding Auto-Provisioning"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Event Trigger *</label>
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="user_created">WHEN: New Employee Created / Hired</option>
                  <option value="journey_completed">WHEN: Journey Completed</option>
                  <option value="task_completed">WHEN: Task Completed</option>
                  <option value="stage_entered">WHEN: Stage Entered</option>
                </select>
              </div>

              {/* Conditions Section */}
              <div className="border border-slate-200 dark:border-slate-700 p-4 rounded-xl space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-400">
                    IF Filter Conditions (Optional)
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddCondition}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Condition
                  </button>
                </div>

                {conditions.map((cond, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      value={cond.field}
                      onChange={(e) => {
                        const updated = [...conditions];
                        updated[idx].field = e.target.value as any;
                        setConditions(updated);
                      }}
                      className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      <option value="department">Department</option>
                      <option value="role">Role</option>
                      <option value="jobTitle">Job Title</option>
                    </select>

                    <select
                      value={cond.operator}
                      onChange={(e) => {
                        const updated = [...conditions];
                        updated[idx].operator = e.target.value as any;
                        setConditions(updated);
                      }}
                      className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      <option value="equals">Equals</option>
                      <option value="not_equals">Not Equals</option>
                      <option value="contains">Contains</option>
                    </select>

                    <input
                      type="text"
                      value={cond.value as string}
                      onChange={(e) => {
                        const updated = [...conditions];
                        updated[idx].value = e.target.value;
                        setConditions(updated);
                      }}
                      placeholder="Value"
                      className="flex-1 px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                    />

                    <button
                      type="button"
                      onClick={() => handleRemoveCondition(idx)}
                      className="p-1 text-slate-400 hover:text-red-600"
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
                    THEN Actions Pipeline *
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddAction}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Action Step
                  </button>
                </div>

                {actions.map((act, idx) => (
                  <div key={idx} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-indigo-600">Step {idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAction(idx)}
                        className="p-1 text-slate-400 hover:text-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <select
                      value={act.type}
                      onChange={(e) => {
                        const updated = [...actions];
                        updated[idx].type = e.target.value as any;
                        setActions(updated);
                      }}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      <option value="assign_journey">Assign Onboarding Journey</option>
                      <option value="create_task">Create Operational Task</option>
                      <option value="send_notification">Send Multi-Channel Notification</option>
                    </select>

                    {act.type === 'assign_journey' && (
                      <select
                        value={act.params.journeyId || ''}
                        onChange={(e) => {
                          const updated = [...actions];
                          updated[idx].params.journeyId = e.target.value;
                          setActions(updated);
                        }}
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                      >
                        <option value="">Select Journey Template</option>
                        {journeys.map((j: any) => (
                          <option key={j._id} value={j._id}>
                            {j.title}
                          </option>
                        ))}
                      </select>
                    )}

                    {act.type === 'create_task' && (
                      <input
                        type="text"
                        placeholder="Task Title (e.g. IT Workstation Provisioning)"
                        value={act.params.taskTitle || ''}
                        onChange={(e) => {
                          const updated = [...actions];
                          updated[idx].params.taskTitle = e.target.value;
                          setActions(updated);
                        }}
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBuilderOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createWorkflowMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-all"
                >
                  {createWorkflowMutation.isPending ? 'Saving Rule...' : 'Save Workflow Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Run Trigger Modal */}
      {testRunModalRule && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <h3 className="text-lg font-bold">Trigger Workflow Test Run</h3>
              <button onClick={() => setTestRunModalRule(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Select a target employee to evaluate rule conditions and execute action steps for "{testRunModalRule.name}".
            </p>

            <div>
              <label className="block text-xs font-medium mb-1">Target Employee</label>
              <select
                value={selectedTestUser}
                onChange={(e) => setSelectedTestUser(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select Target Employee</option>
                {employees.map((emp: any) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.profile?.firstName} {emp.profile?.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTestRunModalRule(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteTestRun}
                disabled={!selectedTestUser || triggerTestRunMutation.isPending}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-all flex items-center gap-1"
              >
                <Play className="w-3.5 h-3.5" />
                {triggerTestRunMutation.isPending ? 'Running...' : 'Execute Test Run'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Workflows;
