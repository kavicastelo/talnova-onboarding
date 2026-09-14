import React, { useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Plus,
  Search,
  User,
  Calendar,
  Shield,
  Send,
  Check,
  Laptop,
  Cpu,
  ExternalLink,
  FileText,
  RotateCcw,
  ListChecks,
} from 'lucide-react';
import {
  useTasks,
  useCreateTask,
  useUpdateTaskStatus,
  useAddTaskComment,
} from '../hooks/useTasks';
import { useEmployees } from '../hooks/useEmployees';
import { TaskItem, frontendTaskService } from '../services/task.service';
import { useRole } from '../context/RoleContext';
import { SimplePagination } from '../components/SimplePagination';
import { SearchableSelect } from '../components/SearchableSelect';
import { usePagination } from '../hooks/usePagination';
import { AutoVerificationBadge } from '../components/tasks/AutoVerificationBadge';
import { TaskDependencyTree } from '../components/tasks/TaskDependencyTree';
import { TaskRevocationModal } from '../components/tasks/TaskRevocationModal';
import { RoleChecklistManager } from '../components/tasks/RoleChecklistManager';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '../components/Dialog';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetFooter
} from '../components/Sheet';

export function Tasks() {
  const { can } = useRole();
  const canManageTasks = can('create_task_template') || can('assign_task') || can('manage_it_ops');

  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isItOpsRoute = location.pathname.includes('it-ops');
  const initialTab = (searchParams.get('tab') as any) === 'it_ops' || isItOpsRoute ? 'it_ops' : 'my';

  const [activeTab, setActiveTab] = useState<'my' | 'assigned' | 'overdue' | 'all' | 'direct_reports' | 'it_ops' | 'templates'>(initialTab);
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Drawer / Modal States
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [commentText, setCommentText] = useState('');

  // Revocation Modal State (Prompt 05 HITL Guardrail)
  const [revocationTask, setRevocationTask] = useState<TaskItem | null>(null);
  const [isRevocationModalOpen, setIsRevocationModalOpen] = useState(false);

  // Hardware Provisioning Modal States (Prompt 08 Step 3)
  const [isHardwareModalOpen, setIsHardwareModalOpen] = useState(false);
  const [hardwareTask, setHardwareTask] = useState<TaskItem | null>(null);
  const [hwDeviceType, setHwDeviceType] = useState<string>('laptop');
  const [hwSerialNumber, setHwSerialNumber] = useState('');
  const [hwAssetTag, setHwAssetTag] = useState('');
  const [hwCourierUrl, setHwCourierUrl] = useState('');
  const [hwCourierProvider, setHwCourierProvider] = useState('');
  const [hwReceiptFileName, setHwReceiptFileName] = useState('');
  const [hwReceiptFileUrl, setHwReceiptFileUrl] = useState('');
  const [hwMdmStatus, setHwMdmStatus] = useState<string>('pending_dispatch');
  const [isSavingHardware, setIsSavingHardware] = useState(false);

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
  const { data: employeesData } = useEmployees({ limit: 1000 });
  const { data: tasksData, isLoading, refetch } = useTasks({
    assignedToMe: activeTab === 'my',
    directReportsOnly: activeTab === 'direct_reports',
    isOverdue: activeTab === 'overdue' ? true : undefined,
    stage: selectedStage !== 'all' ? selectedStage : undefined,
    category: activeTab === 'it_ops' ? 'it_setup' : (categoryFilter !== 'all' ? categoryFilter : undefined),
    priority: priorityFilter !== 'all' ? priorityFilter : undefined,
  });

  const createTaskMutation = useCreateTask();
  const updateStatusMutation = useUpdateTaskStatus();
  const addCommentMutation = useAddTaskComment();

  const employees = employeesData?.employees || [];
  const tasks = tasksData?.tasks || [];

  const filteredTasks = tasks.filter((t) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.hardwareMetadata?.serialNumber && t.hardwareMetadata.serialNumber.toLowerCase().includes(q)) ||
        (t.hardwareMetadata?.assetTag && t.hardwareMetadata.assetTag.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    totalItems,
    totalPages,
    paginatedData: paginatedTasks,
    startIndex,
    endIndex,
  } = usePagination({ data: filteredTasks, initialPageSize: 10 });

  const handleOpenHardwareModal = (task: TaskItem) => {
    setHardwareTask(task);
    setHwDeviceType(task.hardwareMetadata?.deviceType || 'laptop');
    setHwSerialNumber(task.hardwareMetadata?.serialNumber || '');
    setHwAssetTag(task.hardwareMetadata?.assetTag || '');
    setHwCourierUrl(task.hardwareMetadata?.courierTrackingUrl || '');
    setHwCourierProvider(task.hardwareMetadata?.courierProvider || '');
    setHwReceiptFileName(task.hardwareMetadata?.receiptAttachment?.fileName || '');
    setHwReceiptFileUrl(task.hardwareMetadata?.receiptAttachment?.fileUrl || '');
    setHwMdmStatus(task.hardwareMetadata?.mdmStatus || 'pending_dispatch');
    setIsHardwareModalOpen(true);
  };

  const handleSaveHardware = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hardwareTask) return;
    setIsSavingHardware(true);
    try {
      const targetId = hardwareTask.taskCode || hardwareTask._id;
      const updated = await frontendTaskService.updateTaskHardware(targetId, {
        deviceType: hwDeviceType as any,
        serialNumber: hwSerialNumber.trim() || undefined,
        assetTag: hwAssetTag.trim() || undefined,
        courierTrackingUrl: hwCourierUrl.trim() || undefined,
        courierProvider: hwCourierProvider.trim() || undefined,
        mdmStatus: hwMdmStatus as any,
      });

      if (hwReceiptFileUrl.trim()) {
        await frontendTaskService.attachHardwareReceipt(targetId, {
          fileUrl: hwReceiptFileUrl.trim(),
          fileName: hwReceiptFileName.trim() || 'hardware_receipt.pdf',
        });
      }

      toast.success('Hardware provisioning details saved successfully');
      setIsHardwareModalOpen(false);
      refetch();
      if (selectedTask?._id === hardwareTask._id) {
        setSelectedTask(updated);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to update hardware details');
    } finally {
      setIsSavingHardware(false);
    }
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !assignedToUserId) {
      toast.error('Please enter a task title and select an assignee');
      return;
    }

    createTaskMutation.mutate(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        assignedToUserId,
        employeeId: employeeId || undefined,
        category,
        stage,
        priority,
        dueDate: dueDate || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Operational task created successfully');
          setIsCreateModalOpen(false);
          setTitle('');
          setDescription('');
          setAssignedToUserId('');
          setEmployeeId('');
          setDueDate('');
          setActiveTab('all');
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to create task');
        },
      }
    );
  };

  const handleToggleComplete = (task: TaskItem) => {
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    updateStatusMutation.mutate(
      { id: task.taskCode || task._id, status: nextStatus },
      {
        onSuccess: () => {
          if (selectedTask?._id === task._id) {
            setSelectedTask((prev) => (prev ? { ...prev, status: nextStatus } : null));
          }
        },
      }
    );
  };

  const handleVerifyTask = (task: TaskItem) => {
    updateStatusMutation.mutate(
      { id: task.taskCode || task._id, status: 'verified', note: 'Task verified by manager' },
      {
        onSuccess: (updated) => {
          toast.success('Task successfully verified by manager');
          if (selectedTask?._id === task._id) {
            setSelectedTask(updated);
          }
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to verify task');
        },
      }
    );
  };

  const handleRevokeVerification = async (taskId: string, reason: string, newStatus: 'revision_requested' | 'in_progress') => {
    await updateStatusMutation.mutateAsync({
      id: taskId,
      status: newStatus as any,
      note: `Revoked verification: ${reason}`,
    });
    refetch();
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !commentText.trim()) return;

    const targetId = selectedTask.taskCode || selectedTask._id;
    addCommentMutation.mutate(
      { id: targetId, comment: commentText },
      {
        onSuccess: (updated) => {
          setSelectedTask(updated);
          setCommentText('');
          toast.success('Comment added successfully');
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to add comment');
        }
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

  const getCategoryBadge = (c: string) => {
    const labels: Record<string, { label: string; color: string }> = {
      it_setup: { label: 'IT Setup', color: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800' },
      hr_paperwork: { label: 'HR Paperwork', color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800' },
      equipment: { label: 'Equipment', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
      training: { label: 'Training', color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800' },
      general: { label: 'General', color: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
    };
    const info = labels[c] || { label: c, color: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300' };
    return (
      <span className={`px-2.5 py-0.5 text-xs font-medium border rounded-md ${info.color}`}>
        {info.label}
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
              id="add-task-btn"
              data-testid="add-task-btn"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl transition-all shadow-sm shadow-indigo-200 dark:shadow-none cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Task
            </button>
          )}
        </div>

        {/* Filters & Navigation Tabs */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-4 shadow-sm">
          {/* Main Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
            <button
              id="tab-my-tasks"
              onClick={() => setActiveTab('my')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${activeTab === 'my'
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
            >
              My Tasks Inbox
            </button>
            <button
              id="tab-assigned-tasks"
              onClick={() => setActiveTab('assigned')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${activeTab === 'assigned'
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
            >
              Assigned Tasks
            </button>
            <button
              id="tab-overdue-tasks"
              onClick={() => setActiveTab('overdue')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${activeTab === 'overdue'
                ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
            >
              Overdue Alert
            </button>
            <button
              id="tab-all-tasks"
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${activeTab === 'all'
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-semibold'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
            >
              All Tasks
            </button>
            <button
              id="tab-direct-reports"
              data-testid="tab-direct-reports"
              onClick={() => setActiveTab('direct_reports')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${activeTab === 'direct_reports'
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-semibold'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
            >
              Direct Reports
            </button>
            <button
              id="tab-it-ops"
              data-testid="tab-it-ops"
              onClick={() => setActiveTab('it_ops')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'it_ops'
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-semibold'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
            >
              <Laptop className="w-4 h-4" />
              IT Hardware Queue
            </button>
            <button
              id="tab-templates"
              data-testid="tab-templates"
              onClick={() => setActiveTab('templates')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'templates'
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-semibold'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
            >
              <ListChecks className="w-4 h-4" />
              Checklist Templates
            </button>
          </div>

          {/* Sub-filters Bar */}
          {activeTab !== 'templates' && (
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
                id="category-filter-select"
                data-testid="category-filter-select"
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
          )}
        </div>

        {/* Templates view or Task List Grid */}
        {activeTab === 'templates' ? (
          <RoleChecklistManager />
        ) : isLoading ? (
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
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              {paginatedTasks.map((task) => {
                const isCompleted = task.status === 'completed' || task.status === 'verified';
                const isVerified = task.status === 'verified';
                const isOverdue = task.status === 'overdue' || (task.dueDate && new Date(task.dueDate) < new Date() && !isCompleted);
                const taskKey = task.taskCode || task._id;

                return (
                  <div
                    key={task._id}
                    id={`task-row-${taskKey}`}
                    className={`bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border transition-all hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isOverdue
                      ? 'border-red-200 dark:border-red-900/40 bg-red-50/10'
                      : isVerified
                        ? 'border-emerald-300 dark:border-emerald-900/50 bg-emerald-50/10'
                        : isCompleted
                          ? 'border-emerald-200 dark:border-emerald-900/30 opacity-80'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Complete Checkbox Button */}
                      <button
                        onClick={() => handleToggleComplete(task)}
                        className={`mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${isCompleted
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
                            className={`font-semibold cursor-pointer hover:text-indigo-600 transition-colors ${isCompleted && !isVerified ? 'line-through text-slate-400' : ''
                              }`}
                          >
                            {task.title}
                          </span>
                          {isVerified ? (
                            <span
                              id={`badge-verified-${taskKey}`}
                              className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-full border border-emerald-300 dark:border-emerald-800 flex items-center gap-1"
                            >
                              <Check className="w-3 h-3 stroke-[3]" /> Verified
                            </span>
                          ) : isCompleted ? (
                            <span
                              id={`badge-completed-${taskKey}`}
                              className="px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded-full border border-blue-200"
                            >
                              Completed
                            </span>
                          ) : null}
                          {getCategoryBadge(task.category)}
                          {getStageBadge(task.stage)}
                          {getPriorityBadge(task.priority)}
                          <AutoVerificationBadge
                            evidence={(task as any).autoVerification}
                            status={task.status}
                          />
                          <TaskDependencyTree
                            isLocked={(task as any).isLocked}
                            lockReason={(task as any).lockReason}
                          />
                          <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-50 text-indigo-700 rounded-full dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            Assigned: {task.assignedToUserId?.profile?.firstName || 'User'} {task.assignedToUserId?.profile?.lastName || ''}
                          </span>
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

                        {task.hardwareMetadata && (
                          <div className="flex flex-wrap items-center gap-3 text-xs pt-1.5 border-t border-slate-100 dark:border-slate-700/60 mt-1">
                            <span className="flex items-center gap-1 font-medium text-cyan-700 dark:text-cyan-300">
                              <Laptop className="w-3.5 h-3.5" />
                              {task.hardwareMetadata.deviceType?.toUpperCase() || 'HARDWARE'}
                            </span>
                            {task.hardwareMetadata.serialNumber && (
                              <span className="text-slate-600 dark:text-slate-300">
                                SN: <span className="font-mono">{task.hardwareMetadata.serialNumber}</span>
                              </span>
                            )}
                            {task.hardwareMetadata.assetTag && (
                              <span className="text-slate-600 dark:text-slate-300">
                                Tag: <span className="font-mono">{task.hardwareMetadata.assetTag}</span>
                              </span>
                            )}
                            {task.hardwareMetadata.mdmStatus && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">
                                MDM: {task.hardwareMetadata.mdmStatus}
                              </span>
                            )}
                            {task.hardwareMetadata.courierTrackingUrl && (
                              <a
                                href={task.hardwareMetadata.courierTrackingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline"
                              >
                                <ExternalLink className="w-3 h-3" /> Tracking
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 pt-3 sm:pt-0">
                      {(task.category === 'it_setup' || task.hardwareMetadata) && (
                        <button
                          id={`hardware-details-btn-${taskKey}`}
                          data-testid={`hardware-details-btn-${taskKey}`}
                          onClick={() => handleOpenHardwareModal(task)}
                          className="px-3 py-1.5 text-xs font-medium bg-cyan-50 text-cyan-700 hover:bg-cyan-100 dark:bg-cyan-950 dark:text-cyan-300 dark:hover:bg-cyan-900 border border-cyan-200 dark:border-cyan-800 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                          title="Hardware Provisioning & MDM"
                        >
                          <Cpu className="w-3.5 h-3.5" />
                          Hardware
                        </button>
                      )}

                      {task.status !== 'verified' ? (
                        <button
                          id={`verify-task-btn-${taskKey}`}
                          onClick={() => handleVerifyTask(task)}
                          className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all flex items-center gap-1 shadow-sm"
                          title="Verify Task"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          Verify Task
                        </button>
                      ) : (
                        <button
                          id={`revoke-task-btn-${taskKey}`}
                          onClick={() => {
                            setRevocationTask(task);
                            setIsRevocationModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded-lg transition-all flex items-center gap-1"
                          title="Revoke Verification (HITL Guardrail)"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Revoke
                        </button>
                      )}

                      <button
                        id={`view-details-btn-${taskKey}`}
                        onClick={() => setSelectedTask(task)}
                        className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-all"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <SimplePagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              startIndex={startIndex}
              endIndex={endIndex}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              itemLabel="tasks"
            />
          </div>
        )}
      </div>

      {/* Task Detail Drawer */}
      <Sheet open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        {selectedTask && (
          <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col justify-between overflow-hidden">
            <div className="space-y-6 p-6 overflow-y-auto max-h-[calc(100vh-80px)]">
              {/* Drawer Header */}
              <div className="flex items-start justify-between border-b border-border/60 pb-4 pr-6">
                <div>
                  <div className="flex items-center gap-2">
                    {getCategoryBadge(selectedTask.category)}
                    {getStageBadge(selectedTask.stage)}
                    {getPriorityBadge(selectedTask.priority)}
                  </div>
                  <SheetTitle className="text-xl font-bold mt-2">{selectedTask.title}</SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground mt-1">
                    Onboarding operational task details and verification controls.
                  </SheetDescription>
                </div>
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

              {/* Hardware Provisioning Card */}
              {(selectedTask.category === 'it_setup' || selectedTask.hardwareMetadata) && (
                <div id="drawer-hardware-details-card" className="bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-800 dark:text-cyan-300 flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-cyan-600" />
                      Hardware Provisioning & MDM
                    </h4>
                    <button
                      id="drawer-edit-hardware-btn"
                      onClick={() => handleOpenHardwareModal(selectedTask)}
                      className="px-2.5 py-1 text-xs font-medium bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900 transition-all cursor-pointer shadow-sm"
                    >
                      Update Details
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Device Type</span>
                      <span className="font-semibold capitalize text-slate-700 dark:text-slate-200">
                        {selectedTask.hardwareMetadata?.deviceType || 'Laptop'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px]">MDM Status</span>
                      <span className="font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
                        {selectedTask.hardwareMetadata?.mdmStatus || 'pending_dispatch'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px]">Serial Number</span>
                      <span className="font-mono text-slate-700 dark:text-slate-200">
                        {selectedTask.hardwareMetadata?.serialNumber || 'Not assigned'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px]">Asset Tag</span>
                      <span className="font-mono text-slate-700 dark:text-slate-200">
                        {selectedTask.hardwareMetadata?.assetTag || 'Not assigned'}
                      </span>
                    </div>

                    {selectedTask.hardwareMetadata?.courierTrackingUrl && (
                      <div className="col-span-2">
                        <span className="text-slate-400 block text-[11px]">Courier Tracking</span>
                        <a
                          href={selectedTask.hardwareMetadata.courierTrackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                        >
                          {selectedTask.hardwareMetadata.courierProvider ? `${selectedTask.hardwareMetadata.courierProvider}: ` : ''}
                          Track Package <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {selectedTask.hardwareMetadata?.receiptAttachment && (
                      <div className="col-span-2">
                        <span className="text-slate-400 block text-[11px]">Receipt / Purchase Proof</span>
                        <a
                          href={selectedTask.hardwareMetadata.receiptAttachment.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                        >
                          <FileText className="w-3 h-3" />
                          {selectedTask.hardwareMetadata.receiptAttachment.fileName || 'View Receipt'}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                    id="task-comment-input"
                    type="text"
                    placeholder="Add a comment..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    id="task-comment-submit-btn"
                    type="submit"
                    className="px-3 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-xs font-medium flex items-center gap-1"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>

            {/* Sticky Action Footer */}
            <SheetFooter className="p-4 sm:px-6 border-t border-border/60 bg-muted/30 shrink-0">
              <div className="flex items-center gap-2 w-full">
                {/* HITL Guardrail: Revoke Verification if verified */}
                {selectedTask.status === 'verified' && canManageTasks && (
                  <button
                    id="drawer-revoke-verification-btn"
                    onClick={() => {
                      setRevocationTask(selectedTask);
                      setIsRevocationModalOpen(true);
                    }}
                    className="py-2.5 px-3 rounded-xl font-medium text-xs border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Revoke Verification
                  </button>
                )}

                {/* Explicit Verification Action */}
                {selectedTask.status !== 'verified' && canManageTasks && selectedTask.requiresVerification && (
                  <button
                    id="drawer-verify-task-btn"
                    onClick={() => handleVerifyTask(selectedTask)}
                    className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-emerald-600 text-white hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    Verify Task
                  </button>
                )}

                <button
                  id="drawer-toggle-complete-btn"
                  onClick={() => handleToggleComplete(selectedTask)}
                  className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer shadow-sm ${
                    selectedTask.status === 'completed' || selectedTask.status === 'verified'
                      ? 'bg-muted text-foreground hover:bg-muted/80'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
                >
                  {selectedTask.status === 'completed' || selectedTask.status === 'verified' ? 'Reopen Task' : 'Mark Task Complete'}
                </button>
              </div>
            </SheetFooter>
          </SheetContent>
        )}
      </Sheet>

      {/* Create Task Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent id="create-task-modal" className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-4">
            <DialogTitle className="text-lg font-bold">Create Operational Task</DialogTitle>
            <DialogDescription>
              Assign standard or customized onboarding tasks to responsible team members.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTask} className="flex flex-col flex-1 overflow-hidden">
            <div className="overflow-y-auto p-5 sm:p-6 space-y-4 max-h-[calc(85vh-140px)] text-sm">
              <div>
                <label className="block font-medium mb-1 text-xs text-foreground">Task Title *</label>
                <input
                  id="task-title-input"
                  type="text"
                  required
                  placeholder="e.g. Set up laptop and IT permissions"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs"
                />
              </div>

              <div>
                <label className="block font-medium mb-1 text-xs text-foreground">Instructions / Description</label>
                <textarea
                  id="task-desc-input"
                  rows={2}
                  placeholder="Additional guidance for responsible person..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1 text-xs text-foreground">Assign Responsible User *</label>
                  <SearchableSelect
                    id="task-assignee-select"
                    required
                    value={assignedToUserId}
                    onChange={(val) => setAssignedToUserId(val)}
                    placeholder="Search & select assignee..."
                    searchPlaceholder="Search by name, role, email..."
                    options={employees.map((emp: any) => ({
                      value: emp.id,
                      label: `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim() || emp.name || 'Unnamed Employee',
                      sublabel: emp.email || emp.department,
                      badge: emp?.role || 'User',
                    }))}
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1 text-xs text-foreground">Target Employee (Optional)</label>
                  <SearchableSelect
                    id="task-target-employee-select"
                    clearable
                    value={employeeId}
                    onChange={(val) => setEmployeeId(val)}
                    placeholder="Search & select employee..."
                    searchPlaceholder="Search by name, department..."
                    options={employees.map((emp: any) => ({
                      value: emp.id,
                      label: `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim() || emp.name || 'Unnamed Employee',
                      sublabel: emp.department ? `Dept: ${emp.department}` : emp.email,
                    }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1 text-xs text-foreground">Category</label>
                  <select
                    id="task-category-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-2.5 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs cursor-pointer"
                  >
                    <option value="it_setup">IT Setup</option>
                    <option value="hr_paperwork">HR Paperwork</option>
                    <option value="equipment">Equipment</option>
                    <option value="training">Training</option>
                    <option value="general">General</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1 text-xs text-foreground">Stage</label>
                  <select
                    id="task-stage-select"
                    value={stage}
                    onChange={(e) => setStage(e.target.value as any)}
                    className="w-full px-2.5 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs cursor-pointer"
                  >
                    <option value="preboarding">Preboarding</option>
                    <option value="day_1">Day 1</option>
                    <option value="week_1">Week 1</option>
                    <option value="month_1">Month 1</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1 text-xs text-foreground">Priority</label>
                  <select
                    id="task-priority-select"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-2.5 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs cursor-pointer"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1 text-xs text-foreground">Due Date</label>
                <input
                  id="task-due-date-input"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="p-4 sm:px-6 border-t border-border/60 bg-muted/30">
              <button
                id="cancel-create-task-btn"
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-medium cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                id="submit-create-task-btn"
                type="submit"
                disabled={createTaskMutation.isPending}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:bg-primary/90 transition-all cursor-pointer shadow-sm"
              >
                {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Hardware Provisioning & MDM Modal */}
      <Dialog open={isHardwareModalOpen && !!hardwareTask} onOpenChange={setIsHardwareModalOpen}>
        <DialogContent id="hardware-provisioning-modal" className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-600 shrink-0">
                <Laptop className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">Hardware Provisioning & MDM</DialogTitle>
                <DialogDescription>
                  Configure asset tracking, MDM enrollment, and courier dispatch.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {hardwareTask && (
            <form onSubmit={handleSaveHardware} className="flex flex-col flex-1 overflow-hidden">
              <div className="overflow-y-auto p-5 sm:p-6 space-y-4 max-h-[calc(85vh-140px)] text-sm">
                <div className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl border border-border/60 space-y-1">
                  <span className="font-semibold block text-foreground">Task: {hardwareTask.title}</span>
                  <span>Assignee: {hardwareTask.assignedToUserId?.profile?.firstName || 'IT Admin'} | Target: {hardwareTask.employeeId?.profile?.firstName || 'New Hire'}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium mb-1 text-xs text-foreground">Device Type</label>
                    <select
                      id="hw-device-type-select"
                      value={hwDeviceType}
                      onChange={(e) => setHwDeviceType(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs cursor-pointer"
                    >
                      <option value="laptop">Laptop</option>
                      <option value="desktop">Desktop</option>
                      <option value="mobile">Mobile</option>
                      <option value="monitor">Monitor</option>
                      <option value="peripherals">Peripherals</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium mb-1 text-xs text-foreground">MDM Enrollment Status</label>
                    <select
                      id="hw-mdm-status-select"
                      value={hwMdmStatus}
                      onChange={(e) => setHwMdmStatus(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs cursor-pointer"
                    >
                      <option value="pending_dispatch">Pending Dispatch</option>
                      <option value="dispatched">Dispatched</option>
                      <option value="enrolled">Enrolled</option>
                      <option value="delivered">Delivered</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium mb-1 text-xs text-foreground">Serial Number</label>
                    <input
                      id="hw-serial-input"
                      type="text"
                      placeholder="e.g. C02G41KSMD6T"
                      value={hwSerialNumber}
                      onChange={(e) => setHwSerialNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-medium mb-1 text-xs text-foreground">Asset Tag</label>
                    <input
                      id="hw-asset-tag-input"
                      type="text"
                      placeholder="e.g. TAL-AST-9021"
                      value={hwAssetTag}
                      onChange={(e) => setHwAssetTag(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium mb-1 text-xs text-foreground">Courier Provider</label>
                    <input
                      id="hw-courier-provider-input"
                      type="text"
                      placeholder="e.g. FedEx / DHL / UPS"
                      value={hwCourierProvider}
                      onChange={(e) => setHwCourierProvider(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-medium mb-1 text-xs text-foreground">Tracking URL</label>
                    <input
                      id="hw-courier-url-input"
                      type="url"
                      placeholder="https://track.fedex.com/..."
                      value={hwCourierUrl}
                      onChange={(e) => setHwCourierUrl(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs"
                    />
                  </div>
                </div>

                <div className="border-t border-border/60 pt-3 space-y-2">
                  <span className="block font-medium text-xs text-foreground">
                    Hardware Receipt / Purchase Invoice Attachment
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">File Name</label>
                      <input
                        id="hw-receipt-name-input"
                        type="text"
                        placeholder="e.g. invoice_macbook.pdf"
                        value={hwReceiptFileName}
                        onChange={(e) => setHwReceiptFileName(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">File URL / Storage Link</label>
                      <input
                        id="hw-receipt-url-input"
                        type="url"
                        placeholder="https://storage.example.com/receipts/..."
                        value={hwReceiptFileUrl}
                        onChange={(e) => setHwReceiptFileUrl(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="p-4 sm:px-6 border-t border-border/60 bg-muted/30">
                <button
                  id="cancel-hardware-btn"
                  type="button"
                  onClick={() => setIsHardwareModalOpen(false)}
                  className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-medium cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="save-hardware-btn"
                  type="submit"
                  disabled={isSavingHardware}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  {isSavingHardware ? 'Saving...' : 'Save Hardware Details'}
                </button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Task Revocation Modal (Prompt 05 HITL Guardrail) */}
      <TaskRevocationModal
        isOpen={isRevocationModalOpen}
        onClose={() => {
          setIsRevocationModalOpen(false);
          setRevocationTask(null);
        }}
        task={
          revocationTask
            ? {
                id: revocationTask.taskCode || revocationTask._id,
                title: revocationTask.title,
                status: revocationTask.status,
                assignedToName: `${revocationTask.assignedToUserId?.profile?.firstName || ''} ${revocationTask.assignedToUserId?.profile?.lastName || ''}`.trim() || undefined,
              }
            : null
        }
        onConfirmRevocation={handleRevokeVerification}
      />
    </div>
  );
}

export default Tasks;
