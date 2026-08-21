import React, { useState } from 'react';
import {
  CheckCircle2,
  Plus,
  Search,
  User,
  Calendar,
  Shield,
  X,
  Send,
  Trash2,
  Check,
} from 'lucide-react';
import {
  useTasks,
  useCreateTask,
  useUpdateTaskStatus,
  useAddTaskComment,
  useDeleteTask,
} from '../hooks/useTasks';
import { useEmployees } from '../hooks/useEmployees';
import { TaskItem } from '../services/task.service';
import { useRole } from '../context/RoleContext';

export function Tasks() {
  const { can } = useRole();
  const canManageTasks = can('create_task_template') || can('assign_task');

  const [activeTab, setActiveTab] = useState<'my' | 'assigned' | 'overdue' | 'all'>('my');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Drawer / Modal States
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [commentText, setCommentText] = useState('');

  // Create Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [category, setCategory] = useState<'it_setup' | 'hr_paperwork' | 'equipment' | 'training' | 'general'>('general');
  const [stage, setStage] = useState<'preboarding' | 'day_1' | 'week_1' | 'month_1' | 'custom'>('day_1');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'critical'>('normal');
  const [dueDate, setDueDate] = useState('');

  // API Queries & Mutations
  const { data: employeesData } = useEmployees({ limit: 100 });
  const { data: tasksData, isLoading } = useTasks({
    assignedToMe: activeTab === 'my',
    isOverdue: activeTab === 'overdue' ? true : undefined,
    stage: selectedStage !== 'all' ? selectedStage : undefined,
    category: categoryFilter !== 'all' ? categoryFilter : undefined,
    priority: priorityFilter !== 'all' ? priorityFilter : undefined,
  });

  const createTaskMutation = useCreateTask();
  const updateStatusMutation = useUpdateTaskStatus();
  const addCommentMutation = useAddTaskComment();
  const deleteTaskMutation = useDeleteTask();

  const employees = employeesData?.employees || [];
  const tasks = tasksData?.tasks || [];

  const filteredTasks = tasks.filter((t) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !assignedToUserId) return;

    createTaskMutation.mutate(
      {
        title,
        description,
        assignedToUserId,
        employeeId: employeeId || undefined,
        category,
        stage,
        priority,
        dueDate: dueDate || undefined,
      },
      {
        onSuccess: () => {
          setIsCreateModalOpen(false);
          setTitle('');
          setDescription('');
          setAssignedToUserId('');
          setEmployeeId('');
          setDueDate('');
        },
      }
    );
  };

  const handleToggleComplete = (task: TaskItem) => {
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    updateStatusMutation.mutate(
      { id: task._id, status: nextStatus },
      {
        onSuccess: () => {
          if (selectedTask?._id === task._id) {
            setSelectedTask((prev) => (prev ? { ...prev, status: nextStatus } : null));
          }
        },
      }
    );
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !commentText.trim()) return;

    addCommentMutation.mutate(
      { id: selectedTask._id, comment: commentText },
      {
        onSuccess: (updated) => {
          setSelectedTask(updated);
          setCommentText('');
        },
      }
    );
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'critical':
        return <span className="px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded-full dark:bg-red-950 dark:text-red-300">Critical</span>;
      case 'high':
        return <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 rounded-full dark:bg-amber-950 dark:text-amber-300">High</span>;
      case 'normal':
        return <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full dark:bg-blue-950 dark:text-blue-300">Normal</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700 rounded-full dark:bg-slate-800 dark:text-slate-300">Low</span>;
    }
  };

  const getStageBadge = (s: string) => {
    const labels: Record<string, string> = {
      preboarding: 'Preboarding',
      day_1: 'Day 1',
      week_1: 'Week 1',
      month_1: 'Month 1',
      custom: 'Custom',
    };
    return (
      <span className="px-2.5 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800">
        {labels[s] || s}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Title Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              Tasks & Onboarding Checklists
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Manage operational tasks, cross-person onboarding checklists, deadlines, and prerequisites.
            </p>
          </div>
          {canManageTasks && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl transition-all shadow-sm shadow-indigo-200 dark:shadow-none"
            >
              <Plus className="w-4 h-4" />
              Create Task
            </button>
          )}
        </div>

        {/* Filters & Navigation Tabs */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-4 shadow-sm">
          {/* Main Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
            <button
              onClick={() => setActiveTab('my')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'my'
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
            >
              My Tasks Inbox
            </button>
            <button
              onClick={() => setActiveTab('assigned')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'assigned'
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
            >
              Assigned Tasks
            </button>
            <button
              onClick={() => setActiveTab('overdue')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'overdue'
                  ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
            >
              Overdue Alert
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'all'
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
            >
              All Tasks
            </button>
          </div>

          {/* Sub-filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Stage Filter */}
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Stages</option>
              <option value="preboarding">Preboarding</option>
              <option value="day_1">Day 1</option>
              <option value="week_1">Week 1</option>
              <option value="month_1">Month 1</option>
              <option value="custom">Custom</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Categories</option>
              <option value="it_setup">IT Setup</option>
              <option value="hr_paperwork">HR Paperwork</option>
              <option value="equipment">Equipment</option>
              <option value="training">Training</option>
              <option value="general">General</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {/* Task List Grid */}
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-700">
            <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold">No Tasks Found</h3>
            <p className="text-slate-500 text-sm mt-1">There are no operational tasks matching your filter criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredTasks.map((task) => {
              const isCompleted = task.status === 'completed';
              const isOverdue = task.status === 'overdue' || (task.dueDate && new Date(task.dueDate) < new Date() && !isCompleted);

              return (
                <div
                  key={task._id}
                  className={`bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border transition-all hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isOverdue
                      ? 'border-red-200 dark:border-red-900/40 bg-red-50/10'
                      : isCompleted
                      ? 'border-emerald-200 dark:border-emerald-900/30 opacity-80'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Complete Checkbox Button */}
                    <button
                      onClick={() => handleToggleComplete(task)}
                      className={`mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                        isCompleted
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-slate-300 dark:border-slate-600 hover:border-indigo-500'
                      }`}
                    >
                      {isCompleted && <Check className="w-4 h-4 stroke-[3]" />}
                    </button>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          onClick={() => setSelectedTask(task)}
                          className={`font-semibold cursor-pointer hover:text-indigo-600 transition-colors ${
                            isCompleted ? 'line-through text-slate-400' : ''
                          }`}
                        >
                          {task.title}
                        </span>
                        {getStageBadge(task.stage)}
                        {getPriorityBadge(task.priority)}
                        {isOverdue && (
                          <span className="px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded-full dark:bg-red-950 dark:text-red-300">
                            Overdue
                          </span>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">
                          {task.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          Assignee: {task.assignedToUserId?.profile?.firstName || 'User'}{' '}
                          {task.assignedToUserId?.profile?.lastName || ''}
                        </span>

                        {task.employeeId && (
                          <span className="flex items-center gap-1">
                            <Shield className="w-3.5 h-3.5 text-slate-400" />
                            Target: {task.employeeId?.profile?.firstName}{' '}
                            {task.employeeId?.profile?.lastName}
                          </span>
                        )}

                        {task.dueDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            Due: {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-3 sm:pt-0">
                    <button
                      onClick={() => setSelectedTask(task)}
                      className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-all"
                    >
                      View Details
                    </button>

                    <button
                      onClick={() => deleteTaskMutation.mutate(task._id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-all"
                      title="Delete Task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Task Detail Drawer */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-xl bg-white dark:bg-slate-800 h-full p-6 overflow-y-auto shadow-2xl flex flex-col justify-between">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-700 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    {getStageBadge(selectedTask.stage)}
                    {getPriorityBadge(selectedTask.priority)}
                  </div>
                  <h2 className="text-xl font-bold mt-2">{selectedTask.title}</h2>
                </div>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Task Attributes */}
              <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-xs">Responsible Assignee</span>
                  <span className="font-medium">
                    {selectedTask.assignedToUserId?.profile?.firstName}{' '}
                    {selectedTask.assignedToUserId?.profile?.lastName}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-xs">Target Employee</span>
                  <span className="font-medium">
                    {selectedTask.employeeId?.profile?.firstName || 'N/A'}{' '}
                    {selectedTask.employeeId?.profile?.lastName || ''}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-xs">Status</span>
                  <span className="font-medium capitalize">{selectedTask.status}</span>
                </div>

                <div>
                  <span className="text-slate-400 block text-xs">Due Date</span>
                  <span className="font-medium">
                    {selectedTask.dueDate ? new Date(selectedTask.dueDate).toLocaleDateString() : 'None'}
                  </span>
                </div>
              </div>

              {/* Description */}
              {selectedTask.description && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Instructions & Context
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl">
                    {selectedTask.description}
                  </p>
                </div>
              )}

              {/* Comments Feed */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Activity Comments ({selectedTask.comments?.length || 0})
                </h4>

                <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                  {selectedTask.comments?.map((c, i) => (
                    <div key={i} className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl text-xs space-y-1">
                      <div className="flex justify-between text-slate-400">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {c.userId?.profile?.firstName} {c.userId?.profile?.lastName}
                        </span>
                        <span>{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">{c.comment}</p>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddComment} className="mt-3 flex gap-2">
                  <input
                    type="text"
                    placeholder="Add a comment..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-xs font-medium flex items-center gap-1"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-6 border-t border-slate-200 dark:border-slate-700 flex gap-3">
              <button
                onClick={() => handleToggleComplete(selectedTask)}
                className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-all ${
                  selectedTask.status === 'completed'
                    ? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {selectedTask.status === 'completed' ? 'Reopen Task' : 'Mark Task Complete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <h3 className="text-lg font-bold">Create Operational Task</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 text-sm">
              <div>
                <label className="block font-medium mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Set up laptop and IT permissions"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Instructions / Description</label>
                <textarea
                  rows={2}
                  placeholder="Additional guidance for responsible person..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Assign Responsible User *</label>
                  <select
                    required
                    value={assignedToUserId}
                    onChange={(e) => setAssignedToUserId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Responsible Assignee</option>
                    {employees.map((emp: any) => (
                      <option key={emp._id} value={emp._id}>
                        {emp.profile?.firstName} {emp.profile?.lastName} ({emp.permissions?.role || 'User'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1">Target Employee (Optional)</label>
                  <select
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Onboarding Employee</option>
                    {employees.map((emp: any) => (
                      <option key={emp._id} value={emp._id}>
                        {emp.profile?.firstName} {emp.profile?.lastName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="it_setup">IT Setup</option>
                    <option value="hr_paperwork">HR Paperwork</option>
                    <option value="equipment">Equipment</option>
                    <option value="training">Training</option>
                    <option value="general">General</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1">Stage</label>
                  <select
                    value={stage}
                    onChange={(e) => setStage(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="preboarding">Preboarding</option>
                    <option value="day_1">Day 1</option>
                    <option value="week_1">Week 1</option>
                    <option value="month_1">Month 1</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTaskMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-all"
                >
                  {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Tasks;
