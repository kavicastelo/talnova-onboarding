import React, { useState, useEffect } from 'react';
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
  Truck,
  PackageCheck,
  Package,
  AlertCircle,
  Monitor,
  Smartphone,
  Key,
  HardHat,
  Wrench,
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
  DialogBody,
  DialogFooter
} from '../components/Dialog';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetFooter
} from '../components/Sheet';
import { useTranslation } from 'react-i18next';

export function Tasks() {
  const { t } = useTranslation(['tasks', 'common']);
  const { can } = useRole();
  const canManageTasks = can('create_task_template') || can('assign_task') || can('manage_it_ops');

  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isItOpsRoute = location.pathname.includes('it-ops');
  const initialTab = (searchParams.get('tab') as any) === 'it_ops' || isItOpsRoute ? 'it_ops' : 'my';

  const [activeTab, setActiveTab] = useState<'my' | 'assigned' | 'overdue' | 'all' | 'direct_reports' | 'it_ops' | 'templates'>(initialTab);

  useEffect(() => {
    if (isItOpsRoute) {
      setActiveTab('it_ops');
    }
  }, [isItOpsRoute]);
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // IT Hardware Queue sub-filters
  const [hwDeviceTypeFilter, setHwDeviceTypeFilter] = useState<string>('all');
  const [hwStatusFilter, setHwStatusFilter] = useState<string>('all');

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

  // Hardware Creation Form State
  const [createWithHardware, setCreateWithHardware] = useState(false);
  const [newHwDeviceType, setNewHwDeviceType] = useState<string>('laptop');
  const [newHwSerialNumber, setNewHwSerialNumber] = useState('');
  const [newHwAssetTag, setNewHwAssetTag] = useState('');
  const [newHwCourierProvider, setNewHwCourierProvider] = useState('');
  const [newHwCourierUrl, setNewHwCourierUrl] = useState('');
  const [newHwMdmStatus, setNewHwMdmStatus] = useState<string>('pending_dispatch');
  const [newHwReceiptFileName, setNewHwReceiptFileName] = useState('');
  const [newHwReceiptFileUrl, setNewHwReceiptFileUrl] = useState('');

  // Validation errors state
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [hwModalErrors, setHwModalErrors] = useState<Record<string, string>>({});

  // Create Form Base State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [category, setCategory] = useState<'it_setup' | 'hr_paperwork' | 'equipment' | 'training' | 'general'>('general');
  const [stage, setStage] = useState<'preboarding' | 'day_1' | 'week_1' | 'month_1' | 'custom'>('day_1');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'critical'>('normal');
  const [dueDate, setDueDate] = useState('');
  const [requiresVerification, setRequiresVerification] = useState(false);

  // API Queries & Mutations
  const { data: employeesData } = useEmployees({ limit: 1000 });
  const { data: tasksData, isLoading, refetch } = useTasks({
    assignedToMe: activeTab === 'my',
    directReportsOnly: activeTab === 'direct_reports',
    isOverdue: activeTab === 'overdue' ? true : undefined,
    stage: selectedStage !== 'all' ? selectedStage : undefined,
    category: activeTab === 'it_ops' ? undefined : (categoryFilter !== 'all' ? categoryFilter : undefined),
    isHardwareQueue: activeTab === 'it_ops' ? true : undefined,
    priority: priorityFilter !== 'all' ? priorityFilter : undefined,
  });

  const createTaskMutation = useCreateTask();
  const updateStatusMutation = useUpdateTaskStatus();
  const addCommentMutation = useAddTaskComment();

  const employees = employeesData?.employees || [];
  const tasks = tasksData?.tasks || [];

  // IT Hardware Queue Stats
  const hwQueueTasks = tasks.filter(
    (t) => t.category === 'it_setup' || t.category === 'equipment' || !!t.hardwareMetadata
  );
  const totalHardwareCount = hwQueueTasks.length;
  const pendingDispatchCount = hwQueueTasks.filter(
    (t) =>
      t.hardwareMetadata?.mdmStatus === 'pending_dispatch' ||
      (!t.hardwareMetadata?.mdmStatus && t.status === 'pending')
  ).length;
  const inTransitCount = hwQueueTasks.filter(
    (t) => t.hardwareMetadata?.mdmStatus === 'dispatched' || t.status === 'in_progress'
  ).length;
  const deliveredOrEnrolledCount = hwQueueTasks.filter(
    (t) =>
      t.hardwareMetadata?.mdmStatus === 'enrolled' ||
      t.hardwareMetadata?.mdmStatus === 'delivered' ||
      t.status === 'completed' ||
      t.status === 'verified'
  ).length;

  const filteredTasks = tasks.filter((t) => {
    if (activeTab === 'it_ops') {
      if (hwDeviceTypeFilter !== 'all') {
        const devType = t.hardwareMetadata?.deviceType || (t.category === 'it_setup' ? 'laptop' : 'equipment');
        if (devType !== hwDeviceTypeFilter) return false;
      }
      if (hwStatusFilter !== 'all') {
        const mdm = t.hardwareMetadata?.mdmStatus || (t.status === 'completed' || t.status === 'verified' ? 'delivered' : 'pending_dispatch');
        if (mdm !== hwStatusFilter) return false;
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.hardwareMetadata?.serialNumber && t.hardwareMetadata.serialNumber.toLowerCase().includes(q)) ||
        (t.hardwareMetadata?.assetTag && t.hardwareMetadata.assetTag.toLowerCase().includes(q)) ||
        (t.hardwareMetadata?.courierProvider && t.hardwareMetadata.courierProvider.toLowerCase().includes(q)) ||
        (t.hardwareMetadata?.deviceType && t.hardwareMetadata.deviceType.toLowerCase().includes(q))
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

  const validateHardwareFields = (
    fields: {
      courierUrl?: string;
      serialNumber?: string;
      assetTag?: string;
      courierProvider?: string;
      mdmStatus?: string;
    }
  ) => {
    const errors: Record<string, string> = {};
    if (fields.courierUrl && fields.courierUrl.trim()) {
      const url = fields.courierUrl.trim();
      if (!/^https?:\/\/.+/i.test(url)) {
        errors.courierUrl = t('validation.trackingUrlPrefix', { defaultValue: 'Tracking URL must start with http:// or https://' });
      }
    }
    if (fields.assetTag && fields.assetTag.trim().length > 0 && fields.assetTag.trim().length < 2) {
      errors.assetTag = t('validation.assetTagMinLength', { defaultValue: 'Asset tag must be at least 2 characters' });
    }
    if (fields.serialNumber && fields.serialNumber.trim().length > 0 && fields.serialNumber.trim().length < 2) {
      errors.serialNumber = t('validation.serialNumberMinLength', { defaultValue: 'Serial number must be at least 2 characters' });
    }
    if (fields.mdmStatus === 'dispatched' && !fields.courierProvider?.trim() && !fields.courierUrl?.trim()) {
      errors.courierProvider = t('validation.courierProviderRequired', { defaultValue: 'Courier provider or tracking URL recommended when dispatched' });
    }
    return errors;
  };

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
    setHwModalErrors({});
    setIsHardwareModalOpen(true);
  };

  const handleSaveHardware = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hardwareTask) return;

    const validationErrors = validateHardwareFields({
      courierUrl: hwCourierUrl,
      serialNumber: hwSerialNumber,
      assetTag: hwAssetTag,
      courierProvider: hwCourierProvider,
      mdmStatus: hwMdmStatus,
    });

    if (Object.keys(validationErrors).length > 0) {
      setHwModalErrors(validationErrors);
      toast.error(t('validation.fixErrorsBeforeSave', { defaultValue: 'Please fix validation errors before saving' }));
      return;
    }

    setHwModalErrors({});
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

      toast.success(t('toasts.hardwareSaved', { defaultValue: 'Hardware provisioning details saved successfully' }));
      setIsHardwareModalOpen(false);
      refetch();
      if (selectedTask?._id === hardwareTask._id) {
        setSelectedTask(updated);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || t('toasts.failedUpdateHardware', { defaultValue: 'Failed to update hardware details' }));
    } finally {
      setIsSavingHardware(false);
    }
  };

  const handleOpenCreateHardwareTask = () => {
    setTitle('');
    setDescription('');
    setAssignedToUserId('');
    setEmployeeId('');
    setDueDate('');
    setCategory('equipment');
    setCreateWithHardware(true);
    setNewHwDeviceType('laptop');
    setNewHwSerialNumber('');
    setNewHwAssetTag('');
    setNewHwCourierProvider('');
    setNewHwCourierUrl('');
    setNewHwMdmStatus('pending_dispatch');
    setNewHwReceiptFileName('');
    setNewHwReceiptFileUrl('');
    setFormErrors({});
    setIsCreateModalOpen(true);
  };

  const handleCategoryChange = (newCategory: 'it_setup' | 'hr_paperwork' | 'equipment' | 'training' | 'general') => {
    setCategory(newCategory);
    if (newCategory === 'equipment' || newCategory === 'it_setup') {
      setCreateWithHardware(true);
    }
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!title.trim()) {
      errors.title = t('validation.taskTitleRequired', { defaultValue: 'Task title is required' });
    }
    if (!assignedToUserId) {
      errors.assignedToUserId = t('validation.assigneeRequired', { defaultValue: 'Please select a responsible user' });
    }

    if (createWithHardware) {
      const hwErrors = validateHardwareFields({
        courierUrl: newHwCourierUrl,
        serialNumber: newHwSerialNumber,
        assetTag: newHwAssetTag,
        courierProvider: newHwCourierProvider,
        mdmStatus: newHwMdmStatus,
      });
      Object.assign(errors, hwErrors);
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error(t('validation.fixErrorsBeforeCreate', { defaultValue: 'Please fix validation errors before creating the task' }));
      return;
    }

    setFormErrors({});

    const hardwarePayload = createWithHardware
      ? {
          deviceType: newHwDeviceType,
          serialNumber: newHwSerialNumber.trim() || undefined,
          assetTag: newHwAssetTag.trim() || undefined,
          courierProvider: newHwCourierProvider.trim() || undefined,
          courierTrackingUrl: newHwCourierUrl.trim() || undefined,
          mdmStatus: newHwMdmStatus,
          receiptAttachment: newHwReceiptFileUrl.trim()
            ? {
                fileUrl: newHwReceiptFileUrl.trim(),
                fileName: newHwReceiptFileName.trim() || 'receipt.pdf',
                uploadedAt: new Date().toISOString(),
              }
            : undefined,
        }
      : undefined;

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
        requiresVerification: requiresVerification || undefined,
        hardwareMetadata: hardwarePayload as any,
      },
      {
        onSuccess: () => {
          toast.success(createWithHardware ? t('toasts.hardwareRegistered', { defaultValue: 'Hardware task & asset registered successfully' }) : t('toasts.taskCreated', { defaultValue: 'Operational task created successfully' }));
          setIsCreateModalOpen(false);
          setTitle('');
          setDescription('');
          setAssignedToUserId('');
          setEmployeeId('');
          setDueDate('');
          setRequiresVerification(false);
          setCreateWithHardware(false);
          setFormErrors({});
          refetch();
          if (createWithHardware && activeTab !== 'it_ops') {
            setActiveTab('it_ops');
          }
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || t('toasts.failedCreateTask', { defaultValue: 'Failed to create task' }));
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
          toast.success(t('toasts.verifiedByManager', { defaultValue: 'Task successfully verified by manager' }));
          if (selectedTask?._id === task._id) {
            setSelectedTask(updated);
          }
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || t('toasts.failedVerify', { defaultValue: 'Failed to verify task' }));
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
          toast.success(t('toasts.commentAdded', { defaultValue: 'Comment added successfully' }));
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || t('toasts.failedAddComment', { defaultValue: 'Failed to add comment' }));
        }
      }
    );
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'critical':
        return <span className="px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded-full dark:bg-red-950 dark:text-red-300">{t('priorities.critical', { defaultValue: 'Critical' })}</span>;
      case 'high':
        return <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 rounded-full dark:bg-amber-950 dark:text-amber-300">{t('priorities.high', { defaultValue: 'High' })}</span>;
      case 'normal':
        return <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full dark:bg-blue-950 dark:text-blue-300">{t('priorities.normal', { defaultValue: 'Normal' })}</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700 rounded-full dark:bg-slate-800 dark:text-slate-300">{t('priorities.low', { defaultValue: 'Low' })}</span>;
    }
  };

  const getStageBadge = (s: string) => {
    return (
      <span className="px-2.5 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800">
        {t(`stageLabels.${s}`, { defaultValue: s })}
      </span>
    );
  };

  const getCategoryBadge = (c: string) => {
    const colors: Record<string, string> = {
      it_setup: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800',
      hr_paperwork: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
      equipment: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
      training: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
      general: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    };
    const color = colors[c] || 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300';
    return (
      <span className={`px-2.5 py-0.5 text-xs font-medium border rounded-md ${color}`}>
        {t(`categoryLabels.${c}`, { defaultValue: c })}
      </span>
    );
  };

  const getDeviceIcon = (deviceType?: string) => {
    switch (deviceType?.toLowerCase()) {
      case 'laptop':
        return <Laptop className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />;
      case 'desktop':
        return <Monitor className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'monitor':
        return <Monitor className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'mobile':
        return <Smartphone className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case 'security_key':
        return <Key className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'safety_kit':
        return <HardHat className="w-4 h-4 text-orange-600 dark:text-orange-400" />;
      case 'tools':
        return <Wrench className="w-4 h-4 text-amber-700 dark:text-amber-400" />;
      case 'badge_access':
        return <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      default:
        return <Cpu className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />;
    }
  };

  const getDeviceLabel = (deviceType?: string) => {
    switch (deviceType?.toLowerCase()) {
      case 'laptop':
        return t('deviceTypes.laptop', { defaultValue: 'Laptop' });
      case 'desktop':
        return t('deviceTypes.desktop', { defaultValue: 'Desktop PC' });
      case 'monitor':
        return t('deviceTypes.monitor', { defaultValue: 'Monitors & Displays' });
      case 'mobile':
        return t('deviceTypes.mobile', { defaultValue: 'Mobile Devices' });
      case 'security_key':
        return t('deviceTypes.security_key', { defaultValue: 'Security Keys / Fobs' });
      case 'peripherals':
        return t('deviceTypes.peripherals', { defaultValue: 'Peripherals' });
      case 'notebook':
        return t('deviceTypes.notebook', { defaultValue: 'Notebooks / Stationery' });
      case 'safety_kit':
        return t('deviceTypes.safety_kit', { defaultValue: 'Safety Kits / PPE' });
      case 'uniform':
        return t('deviceTypes.uniform', { defaultValue: 'Uniforms / Workwear' });
      case 'tools':
        return t('deviceTypes.tools', { defaultValue: 'Field Tools' });
      case 'badge_access':
        return t('deviceTypes.badge_access', { defaultValue: 'Access Badges' });
      default:
        return deviceType ? deviceType.toUpperCase() : t('deviceTypes.other', { defaultValue: 'Other Assets' });
    }
  };

  const getMdmBadge = (status?: string) => {
    switch (status) {
      case 'pending_dispatch':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            {t('mdmStatuses.pending_dispatch', { defaultValue: 'Pending Prep & Dispatch' })}
          </span>
        );
      case 'dispatched':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-300 dark:border-blue-800 flex items-center gap-1">
            <Truck className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            {t('mdmStatuses.dispatched', { defaultValue: 'Dispatched / In Transit' })}
          </span>
        );
      case 'enrolled':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 flex items-center gap-1">
            <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
            {t('mdmStatuses.enrolled', { defaultValue: 'MDM Enrolled' })}
          </span>
        );
      case 'delivered':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
            <PackageCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            {t('mdmStatuses.delivered', { defaultValue: 'Delivered & Confirmed' })}
          </span>
        );
      case 'failed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300 border border-red-300 dark:border-red-800 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-red-600 dark:text-red-400" />
            {t('mdmStatuses.failed', { defaultValue: 'Delivery / MDM Failed' })}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {status || t('taskCard.none', { defaultValue: 'None' }).toUpperCase()}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Title Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
              {activeTab === 'it_ops' ? (
                <>
                  <Laptop className="w-8 h-8 text-cyan-600 dark:text-cyan-400" />
                  {t('hardware.title', { defaultValue: 'IT Hardware Provisioning Queue' })}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                  {t('title', { defaultValue: 'Tasks & Checklists' })}
                </>
              )}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              {activeTab === 'it_ops'
                ? t('hardware.subtitle', { defaultValue: 'Track equipment deployment, serial numbers, MDM enrollments, and asset handovers.' })
                : t('subtitle', { defaultValue: 'Manage onboarding tasks, checklist items, and hardware provisioning across your team.' })}
            </p>
          </div>
          {canManageTasks && (
            <div className="flex items-center gap-2">
              {activeTab === 'it_ops' && (
                <button
                  id="provision-hardware-btn"
                  data-testid="provision-hardware-btn"
                  onClick={handleOpenCreateHardwareTask}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-medium text-sm rounded-xl transition-all shadow-sm shadow-cyan-200 dark:shadow-none cursor-pointer"
                >
                  <Cpu className="w-4 h-4" />
                  {t('hardware.dispatchMdm', { defaultValue: 'Dispatch MDM Enrollment' })}
                </button>
              )}
              <button
                id="add-task-btn"
                data-testid="add-task-btn"
                onClick={() => {
                  setCategory('general');
                  setCreateWithHardware(false);
                  setFormErrors({});
                  setIsCreateModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl transition-all shadow-sm shadow-indigo-200 dark:shadow-none cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {t('createTask', { defaultValue: 'Create Task' })}
              </button>
            </div>
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
              {t('tabs.myTasks', { defaultValue: 'My Tasks' })}
            </button>
            <button
              id="tab-assigned-tasks"
              onClick={() => setActiveTab('assigned')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${activeTab === 'assigned'
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
            >
              {t('tabs.assignedTasks', { defaultValue: 'Assigned Tasks' })}
            </button>
            <button
              id="tab-overdue-tasks"
              onClick={() => setActiveTab('overdue')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${activeTab === 'overdue'
                ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
            >
              {t('tabs.overdueAlert', { defaultValue: 'Overdue Alert' })}
            </button>
            <button
              id="tab-all-tasks"
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${activeTab === 'all'
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-semibold'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
            >
              {t('tabs.all', { defaultValue: 'All Tasks' })}
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
              {t('tabs.directReports', { defaultValue: 'Direct Reports' })}
            </button>
            <button
              id="tab-it-ops"
              data-testid="tab-it-ops"
              onClick={() => setActiveTab('it_ops')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'it_ops'
                ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300 font-semibold border border-cyan-200 dark:border-cyan-800'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
            >
              <Laptop className="w-4 h-4" />
              {t('tabs.itHardwareQueue', { defaultValue: 'IT Hardware Queue' })}
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
              {t('tabs.checklistTemplates', { defaultValue: 'Checklist Templates' })}
            </button>
          </div>

          {/* IT Hardware Queue KPI Dashboard */}
          {activeTab === 'it_ops' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {t('kpis.totalAssets', { defaultValue: 'Total Assets' })}
                  </p>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{totalHardwareCount}</p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-amber-200/60 dark:border-amber-900/40 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    {t('kpis.pendingPrep', { defaultValue: 'Pending Prep' })}
                  </p>
                  <p className="text-xl font-bold text-amber-900 dark:text-amber-100">{pendingDispatchCount}</p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-blue-200/60 dark:border-blue-900/40 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    {t('kpis.inTransit', { defaultValue: 'In Transit / Dispatched' })}
                  </p>
                  <p className="text-xl font-bold text-blue-900 dark:text-blue-100">{inTransitCount}</p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    {t('kpis.deliveredEnrolled', { defaultValue: 'Delivered / Enrolled' })}
                  </p>
                  <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100">{deliveredOrEnrolledCount}</p>
                </div>
              </div>
            </div>
          )}

          {/* Sub-filters Bar: IT Hardware Queue Specific */}
          {activeTab === 'it_ops' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  id="hw-search-input"
                  type="text"
                  placeholder={t('filters.searchAssets', { defaultValue: 'Search assets, serial, courier...' })}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <select
                id="hw-device-type-filter"
                data-testid="hw-device-type-filter"
                value={hwDeviceTypeFilter}
                onChange={(e) => setHwDeviceTypeFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
              >
                <option value="all">{t('filters.allEquipmentTypes', { defaultValue: 'All Equipment Types' })}</option>
                <option value="laptop">{t('deviceTypes.laptop', { defaultValue: 'Laptops' })}</option>
                <option value="desktop">{t('deviceTypes.desktop', { defaultValue: 'Desktop PCs' })}</option>
                <option value="monitor">{t('deviceTypes.monitor', { defaultValue: 'Monitors & Displays' })}</option>
                <option value="mobile">{t('deviceTypes.mobile', { defaultValue: 'Mobile Devices' })}</option>
                <option value="security_key">{t('deviceTypes.security_key', { defaultValue: 'Security Keys / Fobs' })}</option>
                <option value="peripherals">{t('deviceTypes.peripherals', { defaultValue: 'Peripherals' })}</option>
                <option value="notebook">{t('deviceTypes.notebook', { defaultValue: 'Notebooks / Stationery' })}</option>
                <option value="safety_kit">{t('deviceTypes.safety_kit', { defaultValue: 'Safety Kits / PPE' })}</option>
                <option value="uniform">{t('deviceTypes.uniform', { defaultValue: 'Uniforms / Workwear' })}</option>
                <option value="tools">{t('deviceTypes.tools', { defaultValue: 'Field Tools' })}</option>
                <option value="badge_access">{t('deviceTypes.badge_access', { defaultValue: 'Access Badges' })}</option>
                <option value="other">{t('deviceTypes.other', { defaultValue: 'Other Assets' })}</option>
              </select>

              <select
                id="hw-status-filter"
                data-testid="hw-status-filter"
                value={hwStatusFilter}
                onChange={(e) => setHwStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
              >
                <option value="all">{t('filters.allDeliveryStatuses', { defaultValue: 'All Delivery & MDM Statuses' })}</option>
                <option value="pending_dispatch">{t('mdmStatuses.pending_dispatch', { defaultValue: 'Pending Prep & Dispatch' })}</option>
                <option value="dispatched">{t('mdmStatuses.dispatched', { defaultValue: 'Dispatched / In Transit' })}</option>
                <option value="enrolled">{t('mdmStatuses.enrolled', { defaultValue: 'MDM Enrolled' })}</option>
                <option value="delivered">{t('mdmStatuses.delivered', { defaultValue: 'Delivered & Confirmed' })}</option>
                <option value="failed">{t('mdmStatuses.failed', { defaultValue: 'Delivery / MDM Failed' })}</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
              >
                <option value="all">{t('filters.allPriorities', { defaultValue: 'All Priorities' })}</option>
                <option value="critical">{t('priorities.critical', { defaultValue: 'Critical' })}</option>
                <option value="high">{t('priorities.high', { defaultValue: 'High' })}</option>
                <option value="normal">{t('priorities.normal', { defaultValue: 'Normal' })}</option>
                <option value="low">{t('priorities.low', { defaultValue: 'Low' })}</option>
              </select>
            </div>
          )}

          {/* Sub-filters Bar: General Tasks */}
          {activeTab !== 'it_ops' && activeTab !== 'templates' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Search Input */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder={t('filters.searchTasks', { defaultValue: 'Search tasks...' })}
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
                <option value="all">{t('filters.allStages', { defaultValue: 'All Stages' })}</option>
                <option value="preboarding">{t('stageLabels.preboarding', { defaultValue: 'Preboarding' })}</option>
                <option value="day_1">{t('stageLabels.day_1', { defaultValue: 'Day 1' })}</option>
                <option value="week_1">{t('stageLabels.week_1', { defaultValue: 'Week 1' })}</option>
                <option value="month_1">{t('stageLabels.month_1', { defaultValue: 'Month 1' })}</option>
                <option value="custom">{t('stageLabels.custom', { defaultValue: 'Custom' })}</option>
              </select>

              {/* Category Filter */}
              <select
                id="category-filter-select"
                data-testid="category-filter-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">{t('filters.allCategories', { defaultValue: 'All Categories' })}</option>
                <option value="it_setup">{t('categoryLabels.it_setup', { defaultValue: 'IT Setup' })}</option>
                <option value="hr_paperwork">{t('categoryLabels.hr_paperwork', { defaultValue: 'HR Paperwork' })}</option>
                <option value="equipment">{t('categoryLabels.equipment', { defaultValue: 'Equipment' })}</option>
                <option value="training">{t('categoryLabels.training', { defaultValue: 'Training' })}</option>
                <option value="general">{t('categoryLabels.general', { defaultValue: 'General' })}</option>
              </select>

              {/* Priority Filter */}
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">{t('filters.allPriorities', { defaultValue: 'All Priorities' })}</option>
                <option value="critical">{t('priorities.critical', { defaultValue: 'Critical' })}</option>
                <option value="high">{t('priorities.high', { defaultValue: 'High' })}</option>
                <option value="normal">{t('priorities.normal', { defaultValue: 'Normal' })}</option>
                <option value="low">{t('priorities.low', { defaultValue: 'Low' })}</option>
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
            {activeTab === 'it_ops' ? (
              <>
                <Laptop className="w-12 h-12 text-cyan-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold">{t('emptyStates.hwEmptyTitle', { defaultValue: 'No Hardware Queue Items Found' })}</h3>
                <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
                  {t('emptyStates.hwEmptyDesc', { defaultValue: 'There are no hardware provisioning or IT equipment tasks matching your filter criteria.' })}
                </p>
                {canManageTasks && (
                  <button
                    onClick={handleOpenCreateHardwareTask}
                    className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> {t('emptyStates.provisionNewAsset', { defaultValue: 'Provision New Hardware Asset' })}
                  </button>
                )}
              </>
            ) : (
              <>
                <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold">{t('emptyStates.tasksEmptyTitle', { defaultValue: 'No Tasks Found' })}</h3>
                <p className="text-slate-500 text-sm mt-1">{t('emptyStates.tasksEmptyDesc', { defaultValue: 'There are no operational tasks matching your filter criteria.' })}</p>
              </>
            )}
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
                              <Check className="w-3 h-3 stroke-[3]" /> {t('taskCard.verified', { defaultValue: 'Verified' })}
                            </span>
                          ) : isCompleted ? (
                            <span
                              id={`badge-completed-${taskKey}`}
                              className="px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded-full border border-blue-200"
                            >
                              {t('taskCard.completed', { defaultValue: 'Completed' })}
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
                            {t('taskCard.assigned', {
                              name: `${task.assignedToUserId?.profile?.firstName || 'User'} ${task.assignedToUserId?.profile?.lastName || ''}`.trim(),
                              defaultValue: `Assigned: ${task.assignedToUserId?.profile?.firstName || 'User'} ${task.assignedToUserId?.profile?.lastName || ''}`.trim(),
                            })}
                          </span>
                          {isOverdue && (
                            <span className="px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded-full dark:bg-red-950 dark:text-red-300">
                              {t('taskCard.overdue', { defaultValue: 'Overdue' })}
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
                            {t('taskCard.assignee', {
                              name: `${task.assignedToUserId?.profile?.firstName || 'User'} ${task.assignedToUserId?.profile?.lastName || ''}`.trim(),
                              defaultValue: `Assignee: ${task.assignedToUserId?.profile?.firstName || 'User'} ${task.assignedToUserId?.profile?.lastName || ''}`.trim(),
                            })}
                          </span>

                          {task.employeeId && (
                            <span className="flex items-center gap-1">
                              <Shield className="w-3.5 h-3.5 text-slate-400" />
                              {t('taskCard.target', {
                                name: `${task.employeeId?.profile?.firstName || ''} ${task.employeeId?.profile?.lastName || ''}`.trim(),
                                defaultValue: `Target: ${task.employeeId?.profile?.firstName || ''} ${task.employeeId?.profile?.lastName || ''}`.trim(),
                              })}
                            </span>
                          )}

                          {task.dueDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {t('taskCard.due', {
                                date: new Date(task.dueDate).toLocaleDateString(),
                                defaultValue: `Due: ${new Date(task.dueDate).toLocaleDateString()}`,
                              })}
                            </span>
                          )}
                        </div>

                        {task.hardwareMetadata && (
                          <div className="flex flex-wrap items-center gap-2.5 text-xs pt-2 border-t border-slate-100 dark:border-slate-700/60 mt-1.5">
                            <span className="inline-flex items-center gap-1.5 font-medium px-2.5 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-200 border border-cyan-200/60 dark:border-cyan-800/60">
                              {getDeviceIcon(task.hardwareMetadata.deviceType)}
                              {getDeviceLabel(task.hardwareMetadata.deviceType)}
                            </span>
                            {task.hardwareMetadata.serialNumber && (
                              <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded text-[11px]">
                                <span className="text-slate-400 font-sans">{t('taskCard.sn', { defaultValue: 'SN:' })}</span>
                                <span className="font-mono font-semibold">{task.hardwareMetadata.serialNumber}</span>
                              </span>
                            )}
                            {task.hardwareMetadata.assetTag && (
                              <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded text-[11px]">
                                <span className="text-slate-400 font-sans">{t('taskCard.tag', { defaultValue: 'Tag:' })}</span>
                                <span className="font-mono font-semibold">{task.hardwareMetadata.assetTag}</span>
                              </span>
                            )}
                            {getMdmBadge(task.hardwareMetadata.mdmStatus)}
                            {task.hardwareMetadata.courierProvider && (
                              <span className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-1">
                                <Truck className="w-3 h-3 text-slate-400" />
                                {task.hardwareMetadata.courierProvider}
                              </span>
                            )}
                            {task.hardwareMetadata.courierTrackingUrl && (
                              <a
                                href={task.hardwareMetadata.courierTrackingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-cyan-600 dark:text-cyan-400 hover:underline font-medium text-[11px]"
                              >
                                <ExternalLink className="w-3 h-3" /> {t('taskCard.trackShipment', { defaultValue: 'Track Shipment' })}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 pt-3 sm:pt-0">
                      {(task.category === 'it_setup' || task.category === 'equipment' || task.hardwareMetadata) && (
                        <button
                          id={`hardware-details-btn-${taskKey}`}
                          data-testid={`hardware-details-btn-${taskKey}`}
                          onClick={() => handleOpenHardwareModal(task)}
                          className="px-3 py-1.5 text-xs font-medium bg-cyan-50 text-cyan-700 hover:bg-cyan-100 dark:bg-cyan-950 dark:text-cyan-300 dark:hover:bg-cyan-900 border border-cyan-200 dark:border-cyan-800 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                          title={t('taskCard.updateHardware', { defaultValue: 'Hardware & Equipment Tracking' })}
                        >
                          <Cpu className="w-3.5 h-3.5" />
                          {activeTab === 'it_ops'
                            ? t('taskCard.updateHardware', { defaultValue: 'Update Hardware' })
                            : t('taskCard.equipment', { defaultValue: 'Equipment' })}
                        </button>
                      )}

                      {task.status !== 'verified' ? (
                        <button
                          id={`verify-task-btn-${taskKey}`}
                          onClick={() => handleVerifyTask(task)}
                          className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all flex items-center gap-1 shadow-sm"
                          title={t('taskCard.verifyTask', { defaultValue: 'Verify Task' })}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          {t('taskCard.verifyTask', { defaultValue: 'Verify Task' })}
                        </button>
                      ) : (
                        <button
                          id={`revoke-task-btn-${taskKey}`}
                          onClick={() => {
                            setRevocationTask(task);
                            setIsRevocationModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded-lg transition-all flex items-center gap-1"
                          title={t('taskCard.revoke', { defaultValue: 'Revoke Verification' })}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          {t('taskCard.revoke', { defaultValue: 'Revoke' })}
                        </button>
                      )}

                      <button
                        id={`view-details-btn-${taskKey}`}
                        onClick={() => setSelectedTask(task)}
                        className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-all"
                      >
                        {t('taskCard.viewDetails', { defaultValue: 'View Details' })}
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
              itemLabel={activeTab === 'it_ops' ? t('taskCard.paginationLabelEquipment', { defaultValue: 'equipment items' }) : t('taskCard.paginationLabelTasks', { defaultValue: 'tasks' })}
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
                    {t('drawer.sheetDesc', { defaultValue: 'Onboarding operational task details and verification controls.' })}
                  </SheetDescription>
                </div>
              </div>

              {/* Task Attributes */}
              <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-xs">{t('drawer.responsibleAssignee', { defaultValue: 'Responsible Assignee' })}</span>
                  <span className="font-medium">
                    {selectedTask.assignedToUserId?.profile?.firstName}{' '}
                    {selectedTask.assignedToUserId?.profile?.lastName}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-xs">{t('drawer.targetEmployee', { defaultValue: 'Target Employee' })}</span>
                  <span className="font-medium">
                    {selectedTask.employeeId?.profile?.firstName || t('taskCard.none', { defaultValue: 'None' })}{' '}
                    {selectedTask.employeeId?.profile?.lastName || ''}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-xs">{t('drawer.status', { defaultValue: 'Status' })}</span>
                  <span className="font-medium capitalize">{selectedTask.status}</span>
                </div>

                <div>
                  <span className="text-slate-400 block text-xs">{t('drawer.dueDate', { defaultValue: 'Due Date' })}</span>
                  <span className="font-medium">
                    {selectedTask.dueDate ? new Date(selectedTask.dueDate).toLocaleDateString() : t('taskCard.none', { defaultValue: 'None' })}
                  </span>
                </div>
              </div>

              {/* Hardware Provisioning Card */}
              {(selectedTask.category === 'it_setup' || selectedTask.category === 'equipment' || selectedTask.hardwareMetadata) && (
                <div id="drawer-hardware-details-card" className="bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-800 dark:text-cyan-300 flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-cyan-600" />
                      {t('drawer.hwCardTitle', { defaultValue: 'Hardware & Equipment Tracking' })}
                    </h4>
                    <button
                      id="drawer-edit-hardware-btn"
                      onClick={() => handleOpenHardwareModal(selectedTask)}
                      className="px-2.5 py-1 text-xs font-medium bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900 transition-all cursor-pointer shadow-sm"
                    >
                      {t('drawer.updateDetails', { defaultValue: 'Update Details' })}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">{t('drawer.deviceType', { defaultValue: 'Device Type' })}</span>
                      <span className="font-semibold capitalize text-slate-700 dark:text-slate-200">
                        {getDeviceLabel(selectedTask.hardwareMetadata?.deviceType)}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px]">{t('drawer.mdmStatus', { defaultValue: 'MDM Status' })}</span>
                      <span className="font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
                        {selectedTask.hardwareMetadata?.mdmStatus
                          ? t(`mdmStatuses.${selectedTask.hardwareMetadata.mdmStatus}`, { defaultValue: selectedTask.hardwareMetadata.mdmStatus })
                          : t('mdmStatuses.pending_dispatch', { defaultValue: 'Pending Prep & Dispatch' })}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px]">{t('drawer.serialNumber', { defaultValue: 'Serial Number' })}</span>
                      <span className="font-mono text-slate-700 dark:text-slate-200">
                        {selectedTask.hardwareMetadata?.serialNumber || t('drawer.notAssigned', { defaultValue: 'Not assigned' })}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px]">{t('drawer.assetTag', { defaultValue: 'Asset Tag' })}</span>
                      <span className="font-mono text-slate-700 dark:text-slate-200">
                        {selectedTask.hardwareMetadata?.assetTag || t('drawer.notAssigned', { defaultValue: 'Not assigned' })}
                      </span>
                    </div>

                    {selectedTask.hardwareMetadata?.courierTrackingUrl && (
                      <div className="col-span-2">
                        <span className="text-slate-400 block text-[11px]">{t('drawer.courierTracking', { defaultValue: 'Courier Tracking' })}</span>
                        <a
                          href={selectedTask.hardwareMetadata.courierTrackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                        >
                          {selectedTask.hardwareMetadata.courierProvider ? `${selectedTask.hardwareMetadata.courierProvider}: ` : ''}
                          {t('drawer.trackPackage', { defaultValue: 'Track Package' })} <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {selectedTask.hardwareMetadata?.receiptAttachment && (
                      <div className="col-span-2">
                        <span className="text-slate-400 block text-[11px]">{t('drawer.receiptProof', { defaultValue: 'Receipt / Purchase Proof' })}</span>
                        <a
                          href={selectedTask.hardwareMetadata.receiptAttachment.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                        >
                          <FileText className="w-3 h-3" />
                          {selectedTask.hardwareMetadata.receiptAttachment.fileName || t('drawer.viewReceipt', { defaultValue: 'View Receipt' })}
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
                    {t('drawer.instructionsContext', { defaultValue: 'Instructions & Context' })}
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl">
                    {selectedTask.description}
                  </p>
                </div>
              )}

              {/* Comments Feed */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  {t('drawer.activityComments', {
                    count: selectedTask.comments?.length || 0,
                    defaultValue: `Activity Comments (${selectedTask.comments?.length || 0})`,
                  })}
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
                    placeholder={t('drawer.addCommentPlaceholder', { defaultValue: 'Add a comment...' })}
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
                    {t('drawer.revokeVerification', { defaultValue: 'Revoke Verification' })}
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
                    {t('taskCard.verifyTask', { defaultValue: 'Verify Task' })}
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
                  {selectedTask.status === 'completed' || selectedTask.status === 'verified'
                    ? t('drawer.reopenTask', { defaultValue: 'Reopen Task' })
                    : t('drawer.markTaskComplete', { defaultValue: 'Mark Task Complete' })}
                </button>
              </div>
            </SheetFooter>
          </SheetContent>
        )}
      </Sheet>

      {/* Create Task Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent id="create-task-modal" className="max-w-xl p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-4">
            <DialogTitle className="text-lg font-bold">
              {t('createModal.title', { defaultValue: 'Create Operational Task' })}
            </DialogTitle>
            <DialogDescription>
              {t('createModal.desc', { defaultValue: 'Assign standard or customized onboarding tasks to responsible team members.' })}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTask} className="flex flex-col flex-1 overflow-hidden">
            <DialogBody className="space-y-4 text-sm">
              <div>
                <label className="block font-medium mb-1 text-xs text-foreground">
                  {t('createModal.taskTitleLabel', { defaultValue: 'Task Title *' })}
                </label>
                <input
                  id="task-title-input"
                  type="text"
                  required
                  placeholder={t('createModal.taskTitlePlaceholder', { defaultValue: 'e.g. Issue Laptop & Configure IT Access' })}
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (formErrors.title) {
                      setFormErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.title;
                        return copy;
                      });
                    }
                  }}
                  className={`w-full px-3 py-2 bg-background border rounded-xl focus:outline-none focus:ring-2 text-xs ${
                    formErrors.title ? 'border-red-500 focus:ring-red-500/20' : 'border-border focus:ring-primary/20 focus:border-primary'
                  }`}
                />
                {formErrors.title && (
                  <p className="text-[11px] text-red-500 mt-1 font-medium">{formErrors.title}</p>
                )}
              </div>

              <div>
                <label className="block font-medium mb-1 text-xs text-foreground">
                  {t('createModal.instructionsLabel', { defaultValue: 'Instructions / Description' })}
                </label>
                <textarea
                  id="task-desc-input"
                  rows={2}
                  placeholder={t('createModal.instructionsPlaceholder', { defaultValue: 'Additional guidance for responsible person...' })}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1 text-xs text-foreground">
                    {t('createModal.assigneeLabel', { defaultValue: 'Assign Responsible User *' })}
                  </label>
                  <SearchableSelect
                    id="task-assignee-select"
                    required
                    value={assignedToUserId}
                    onChange={(val) => {
                      setAssignedToUserId(val);
                      if (formErrors.assignedToUserId) {
                        setFormErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.assignedToUserId;
                          return copy;
                        });
                      }
                    }}
                    placeholder={t('createModal.assigneePlaceholder', { defaultValue: 'Search & select assignee...' })}
                    searchPlaceholder={t('createModal.assigneeSearchPlaceholder', { defaultValue: 'Search by name, role, email...' })}
                    options={employees.map((emp: any) => ({
                      value: emp.id,
                      label: `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim() || emp.name || 'Unnamed Employee',
                      sublabel: emp.email || emp.department,
                      badge: emp?.role || 'User',
                    }))}
                  />
                  {formErrors.assignedToUserId && (
                    <p className="text-[11px] text-red-500 mt-1 font-medium">{formErrors.assignedToUserId}</p>
                  )}
                </div>

                <div>
                  <label className="block font-medium mb-1 text-xs text-foreground">
                    {t('createModal.targetEmployeeLabel', { defaultValue: 'Target Employee (Optional)' })}
                  </label>
                  <SearchableSelect
                    id="task-target-employee-select"
                    clearable
                    value={employeeId}
                    onChange={(val) => setEmployeeId(val)}
                    placeholder={t('createModal.targetEmployeePlaceholder', { defaultValue: 'Search & select employee...' })}
                    searchPlaceholder={t('createModal.targetEmployeeSearchPlaceholder', { defaultValue: 'Search by name, department...' })}
                    options={employees.map((emp: any) => ({
                      value: emp.id,
                      label: `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim() || emp.name || 'Unnamed Employee',
                      sublabel: emp.department ? `Dept: ${emp.department}` : emp.email,
                    }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1 text-xs text-foreground">
                    {t('createModal.categoryLabel', { defaultValue: 'Category' })}
                  </label>
                  <select
                    id="task-category-select"
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value as any)}
                    className="w-full px-2.5 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs cursor-pointer"
                  >
                    <option value="equipment">{t('categoryLabels.equipment', { defaultValue: 'Equipment' })}</option>
                    <option value="it_setup">{t('categoryLabels.it_setup', { defaultValue: 'IT Setup' })}</option>
                    <option value="hr_paperwork">{t('categoryLabels.hr_paperwork', { defaultValue: 'HR Paperwork' })}</option>
                    <option value="training">{t('categoryLabels.training', { defaultValue: 'Training' })}</option>
                    <option value="general">{t('categoryLabels.general', { defaultValue: 'General' })}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1 text-xs text-foreground">
                    {t('createModal.stageLabel', { defaultValue: 'Stage' })}
                  </label>
                  <select
                    id="task-stage-select"
                    value={stage}
                    onChange={(e) => setStage(e.target.value as any)}
                    className="w-full px-2.5 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs cursor-pointer"
                  >
                    <option value="preboarding">{t('stageLabels.preboarding', { defaultValue: 'Preboarding' })}</option>
                    <option value="day_1">{t('stageLabels.day_1', { defaultValue: 'Day 1' })}</option>
                    <option value="week_1">{t('stageLabels.week_1', { defaultValue: 'Week 1' })}</option>
                    <option value="month_1">{t('stageLabels.month_1', { defaultValue: 'Month 1' })}</option>
                    <option value="custom">{t('stageLabels.custom', { defaultValue: 'Custom' })}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1 text-xs text-foreground">
                    {t('createModal.priorityLabel', { defaultValue: 'Priority' })}
                  </label>
                  <select
                    id="task-priority-select"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-2.5 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs cursor-pointer"
                  >
                    <option value="low">{t('priorities.low', { defaultValue: 'Low' })}</option>
                    <option value="normal">{t('priorities.normal', { defaultValue: 'Normal' })}</option>
                    <option value="high">{t('priorities.high', { defaultValue: 'High' })}</option>
                    <option value="critical">{t('priorities.critical', { defaultValue: 'Critical' })}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1 text-xs text-foreground">
                  {t('createModal.dueDateLabel', { defaultValue: 'Due Date' })}
                </label>
                <input
                  id="task-due-date-input"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="task-verification-checkbox"
                  type="checkbox"
                  checked={requiresVerification}
                  onChange={(e) => setRequiresVerification(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                />
                <label htmlFor="task-verification-checkbox" className="text-xs font-medium cursor-pointer text-foreground">
                  {t('createModal.requiresSignoffLabel', { defaultValue: 'Requires Admin / Manager Sign-off to complete' })}
                </label>
              </div>

              {/* Hardware / MDM Provisioning Inline Toggle */}
              <div className="pt-3 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Laptop className="h-4 w-4 text-cyan-500" />
                    <div>
                      <span className="text-xs font-semibold text-foreground block">
                        {t('createModal.provisionHardwareTitle', { defaultValue: 'Provision Hardware Asset' })}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {t('createModal.provisionHardwareSubtitle', { defaultValue: 'Attach asset tag, serial number & courier tracking' })}
                      </span>
                    </div>
                  </div>
                  <input
                    id="task-hardware-checkbox"
                    data-testid="task-hardware-checkbox"
                    type="checkbox"
                    checked={createWithHardware}
                    onChange={(e) => setCreateWithHardware(e.target.checked)}
                    className="rounded border-border text-cyan-600 focus:ring-cyan-500 h-4 w-4 cursor-pointer"
                  />
                </div>

                {createWithHardware && (
                  <div className="mt-3 p-3 bg-muted/40 border border-border/60 rounded-xl space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-medium mb-1 text-xs text-foreground">
                          {t('createModal.hwDeviceTypeLabel', { defaultValue: 'Hardware Equipment Type *' })}
                        </label>
                        <select
                          id="new-hw-device-type-select"
                          data-testid="new-hw-device-type-select"
                          value={newHwDeviceType}
                          onChange={(e) => setNewHwDeviceType(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs cursor-pointer"
                        >
                          <option value="laptop">{t('deviceTypes.laptop', { defaultValue: 'Laptop' })}</option>
                          <option value="desktop">{t('deviceTypes.desktop', { defaultValue: 'Desktop PC' })}</option>
                          <option value="monitor">{t('deviceTypes.monitor', { defaultValue: 'Monitor / Display' })}</option>
                          <option value="mobile">{t('deviceTypes.mobile', { defaultValue: 'Mobile Phone / Tablet' })}</option>
                          <option value="security_key">{t('deviceTypes.security_key', { defaultValue: 'Hardware Security Key / Fob' })}</option>
                          <option value="peripherals">{t('deviceTypes.peripherals', { defaultValue: 'Peripherals (Keyboard, Mouse, Headset)' })}</option>
                          <option value="notebook">{t('deviceTypes.notebook', { defaultValue: 'Notebook / Stationery' })}</option>
                          <option value="safety_kit">{t('deviceTypes.safety_kit', { defaultValue: 'Safety Kit / PPE' })}</option>
                          <option value="uniform">{t('deviceTypes.uniform', { defaultValue: 'Uniform / Workwear' })}</option>
                          <option value="tools">{t('deviceTypes.tools', { defaultValue: 'Field Equipment / Tools' })}</option>
                          <option value="badge_access">{t('deviceTypes.badge_access', { defaultValue: 'Access Badge / Keycard' })}</option>
                          <option value="other">{t('deviceTypes.other', { defaultValue: 'Other Equipment' })}</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-medium mb-1 text-xs text-foreground">
                          {t('createModal.hwStatusLabel', { defaultValue: 'Courier / Provisioning Status' })}
                        </label>
                        <select
                          id="new-hw-status-select"
                          data-testid="new-hw-status-select"
                          value={newHwMdmStatus}
                          onChange={(e) => setNewHwMdmStatus(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs cursor-pointer"
                        >
                          <option value="pending_dispatch">{t('mdmStatuses.pending_dispatch', { defaultValue: 'Pending Dispatch / Preparing' })}</option>
                          <option value="dispatched">{t('mdmStatuses.dispatched', { defaultValue: 'Dispatched / In Transit' })}</option>
                          <option value="enrolled">{t('mdmStatuses.enrolled', { defaultValue: 'MDM Enrolled' })}</option>
                          <option value="delivered">{t('mdmStatuses.delivered', { defaultValue: 'Delivered / In Possession' })}</option>
                          <option value="failed">{t('mdmStatuses.failed', { defaultValue: 'Delivery / Enrollment Failed' })}</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-medium mb-1 text-xs text-foreground">
                          {t('createModal.hwSerialLabel', { defaultValue: 'Serial Number' })}
                        </label>
                        <input
                          id="new-hw-serial-input"
                          data-testid="new-hw-serial-input"
                          type="text"
                          placeholder={t('createModal.hwSerialPlaceholder', { defaultValue: 'e.g. C02G41KSMD6T' })}
                          value={newHwSerialNumber}
                          onChange={(e) => {
                            setNewHwSerialNumber(e.target.value);
                            if (formErrors.serialNumber) {
                              setFormErrors((prev) => {
                                const copy = { ...prev };
                                delete copy.serialNumber;
                                return copy;
                              });
                            }
                          }}
                          className={`w-full px-2.5 py-1.5 bg-background border rounded-xl focus:outline-none focus:ring-2 font-mono text-xs ${
                            formErrors.serialNumber ? 'border-red-500 focus:ring-red-500/20' : 'border-border focus:ring-cyan-500'
                          }`}
                        />
                        {formErrors.serialNumber && (
                          <p className="text-[11px] text-red-500 mt-1 font-medium">{formErrors.serialNumber}</p>
                        )}
                      </div>

                      <div>
                        <label className="block font-medium mb-1 text-xs text-foreground">
                          {t('createModal.hwAssetTagLabel', { defaultValue: 'Asset Tag' })}
                        </label>
                        <input
                          id="new-hw-asset-tag-input"
                          data-testid="new-hw-asset-tag-input"
                          type="text"
                          placeholder={t('createModal.hwAssetTagPlaceholder', { defaultValue: 'e.g. TAL-AST-9021' })}
                          value={newHwAssetTag}
                          onChange={(e) => {
                            setNewHwAssetTag(e.target.value);
                            if (formErrors.assetTag) {
                              setFormErrors((prev) => {
                                const copy = { ...prev };
                                delete copy.assetTag;
                                return copy;
                              });
                            }
                          }}
                          className={`w-full px-2.5 py-1.5 bg-background border rounded-xl focus:outline-none focus:ring-2 font-mono text-xs ${
                            formErrors.assetTag ? 'border-red-500 focus:ring-red-500/20' : 'border-border focus:ring-cyan-500'
                          }`}
                        />
                        {formErrors.assetTag && (
                          <p className="text-[11px] text-red-500 mt-1 font-medium">{formErrors.assetTag}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-medium mb-1 text-xs text-foreground">
                          {t('createModal.hwCourierProviderLabel', { defaultValue: 'Courier Provider' })}
                        </label>
                        <input
                          id="new-hw-courier-provider-input"
                          data-testid="new-hw-courier-provider-input"
                          type="text"
                          placeholder={t('createModal.hwCourierProviderPlaceholder', { defaultValue: 'e.g. FedEx / DHL / UPS' })}
                          value={newHwCourierProvider}
                          onChange={(e) => {
                            setNewHwCourierProvider(e.target.value);
                            if (formErrors.courierProvider) {
                              setFormErrors((prev) => {
                                const copy = { ...prev };
                                delete copy.courierProvider;
                                return copy;
                              });
                            }
                          }}
                          className="w-full px-2.5 py-1.5 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs"
                        />
                        {formErrors.courierProvider && (
                          <p className="text-[11px] text-amber-500 mt-1 font-medium">{formErrors.courierProvider}</p>
                        )}
                      </div>

                      <div>
                        <label className="block font-medium mb-1 text-xs text-foreground">
                          {t('createModal.hwCourierUrlLabel', { defaultValue: 'Courier Tracking URL' })}
                        </label>
                        <input
                          id="new-hw-courier-url-input"
                          data-testid="new-hw-courier-url-input"
                          type="url"
                          placeholder={t('createModal.hwCourierUrlPlaceholder', { defaultValue: 'https://track.fedex.com/...' })}
                          value={newHwCourierUrl}
                          onChange={(e) => {
                            setNewHwCourierUrl(e.target.value);
                            if (formErrors.courierUrl) {
                              setFormErrors((prev) => {
                                const copy = { ...prev };
                                delete copy.courierUrl;
                                return copy;
                              });
                            }
                          }}
                          className={`w-full px-2.5 py-1.5 bg-background border rounded-xl focus:outline-none focus:ring-2 text-xs ${
                            formErrors.courierUrl ? 'border-red-500 focus:ring-red-500/20' : 'border-border focus:ring-cyan-500'
                          }`}
                        />
                        {formErrors.courierUrl && (
                          <p className="text-[11px] text-red-500 mt-1 font-medium">{formErrors.courierUrl}</p>
                        )}
                      </div>
                    </div>

                    <div className="pt-1 border-t border-border/40">
                      <label className="block text-[11px] text-muted-foreground mb-1 font-medium">
                        {t('createModal.hwReceiptLabel', { defaultValue: 'Receipt / Storage Link (Optional)' })}
                      </label>
                      <input
                        id="new-hw-receipt-url-input"
                        data-testid="new-hw-receipt-url-input"
                        type="url"
                        placeholder={t('createModal.hwReceiptPlaceholder', { defaultValue: 'https://storage.example.com/receipts/...' })}
                        value={newHwReceiptFileUrl}
                        onChange={(e) => setNewHwReceiptFileUrl(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </DialogBody>

            <DialogFooter className="p-4 sm:px-6 border-t border-border/60 bg-muted/30">
              <button
                id="cancel-create-task-btn"
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-medium cursor-pointer transition-colors"
              >
                {t('createModal.cancel', { defaultValue: 'Cancel' })}
              </button>
              <button
                id="submit-create-task-btn"
                data-testid="submit-create-task-btn"
                type="submit"
                disabled={createTaskMutation.isPending}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:bg-primary/90 transition-all cursor-pointer shadow-sm"
              >
                {createTaskMutation.isPending
                  ? t('createModal.creating', { defaultValue: 'Creating...' })
                  : createWithHardware
                  ? t('createModal.createAndRegister', { defaultValue: 'Create & Register Asset' })
                  : t('createModal.createTaskBtn', { defaultValue: 'Create Task' })}
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
                <DialogTitle className="text-lg font-bold">
                  {t('hardwareModal.title', { defaultValue: 'Hardware Provisioning & MDM' })}
                </DialogTitle>
                <DialogDescription>
                  {t('hardwareModal.desc', { defaultValue: 'Configure asset tracking, MDM enrollment, and courier dispatch.' })}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {hardwareTask && (
            <form onSubmit={handleSaveHardware} className="flex flex-col flex-1 overflow-hidden">
              <DialogBody className="space-y-4 text-sm">
                <div className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl border border-border/60 space-y-1">
                  <span className="font-semibold block text-foreground">
                    {t('hardwareModal.taskHeader', { title: hardwareTask.title, defaultValue: `Task: ${hardwareTask.title}` })}
                  </span>
                  <span>
                    {t('hardwareModal.assigneeTargetHeader', {
                      assignee: hardwareTask.assignedToUserId?.profile?.firstName || 'IT Admin',
                      target: hardwareTask.employeeId?.profile?.firstName || 'New Hire',
                      defaultValue: `Assignee: ${hardwareTask.assignedToUserId?.profile?.firstName || 'IT Admin'} | Target: ${hardwareTask.employeeId?.profile?.firstName || 'New Hire'}`,
                    })}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium mb-1 text-xs text-foreground">
                      {t('hardwareModal.deviceTypeLabel', { defaultValue: 'Equipment / Device Type' })}
                    </label>
                    <select
                      id="hw-device-type-select"
                      value={hwDeviceType}
                      onChange={(e) => setHwDeviceType(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs cursor-pointer"
                    >
                      <option value="laptop">{t('deviceTypes.laptop', { defaultValue: 'Laptop' })}</option>
                      <option value="desktop">{t('deviceTypes.desktop', { defaultValue: 'Desktop PC' })}</option>
                      <option value="monitor">{t('deviceTypes.monitor', { defaultValue: 'Monitor / Display' })}</option>
                      <option value="mobile">{t('deviceTypes.mobile', { defaultValue: 'Mobile Phone / Tablet' })}</option>
                      <option value="security_key">{t('deviceTypes.security_key', { defaultValue: 'Hardware Security Key / Fob' })}</option>
                      <option value="peripherals">{t('deviceTypes.peripherals', { defaultValue: 'Peripherals (Keyboard, Mouse, Headset)' })}</option>
                      <option value="notebook">{t('deviceTypes.notebook', { defaultValue: 'Notebook / Stationery' })}</option>
                      <option value="safety_kit">{t('deviceTypes.safety_kit', { defaultValue: 'Safety Kit / PPE' })}</option>
                      <option value="uniform">{t('deviceTypes.uniform', { defaultValue: 'Uniform / Workwear' })}</option>
                      <option value="tools">{t('deviceTypes.tools', { defaultValue: 'Field Equipment / Tools' })}</option>
                      <option value="badge_access">{t('deviceTypes.badge_access', { defaultValue: 'Access Badge / Keycard' })}</option>
                      <option value="other">{t('deviceTypes.other', { defaultValue: 'Other Equipment' })}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium mb-1 text-xs text-foreground">
                      {t('hardwareModal.deliveryStatusLabel', { defaultValue: 'Delivery / MDM Status' })}
                    </label>
                    <select
                      id="hw-mdm-status-select"
                      value={hwMdmStatus}
                      onChange={(e) => setHwMdmStatus(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs cursor-pointer"
                    >
                      <option value="pending_dispatch">{t('mdmStatuses.pending_dispatch', { defaultValue: 'Pending Dispatch / Preparing' })}</option>
                      <option value="dispatched">{t('mdmStatuses.dispatched', { defaultValue: 'Dispatched / In Transit' })}</option>
                      <option value="enrolled">{t('mdmStatuses.enrolled', { defaultValue: 'MDM Enrolled' })}</option>
                      <option value="delivered">{t('mdmStatuses.delivered', { defaultValue: 'Delivered / In Possession' })}</option>
                      <option value="failed">{t('mdmStatuses.failed', { defaultValue: 'Delivery / Enrollment Failed' })}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium mb-1 text-xs text-foreground">
                      {t('hardwareModal.serialNumberLabel', { defaultValue: 'Serial Number' })}
                    </label>
                    <input
                      id="hw-serial-input"
                      type="text"
                      placeholder="e.g. C02G41KSMD6T"
                      value={hwSerialNumber}
                      onChange={(e) => {
                        setHwSerialNumber(e.target.value);
                        if (hwModalErrors.serialNumber) {
                          setHwModalErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.serialNumber;
                            return copy;
                          });
                        }
                      }}
                      className={`w-full px-3 py-2 bg-background border rounded-xl focus:outline-none focus:ring-2 font-mono text-xs ${
                        hwModalErrors.serialNumber ? 'border-red-500 focus:ring-red-500/20' : 'border-border focus:ring-cyan-500'
                      }`}
                    />
                    {hwModalErrors.serialNumber && (
                      <p className="text-[11px] text-red-500 mt-1 font-medium">{hwModalErrors.serialNumber}</p>
                    )}
                  </div>

                  <div>
                    <label className="block font-medium mb-1 text-xs text-foreground">
                      {t('hardwareModal.assetTagLabel', { defaultValue: 'Asset Tag' })}
                    </label>
                    <input
                      id="hw-asset-tag-input"
                      type="text"
                      placeholder="e.g. TAL-AST-9021"
                      value={hwAssetTag}
                      onChange={(e) => {
                        setHwAssetTag(e.target.value);
                        if (hwModalErrors.assetTag) {
                          setHwModalErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.assetTag;
                            return copy;
                          });
                        }
                      }}
                      className={`w-full px-3 py-2 bg-background border rounded-xl focus:outline-none focus:ring-2 font-mono text-xs ${
                        hwModalErrors.assetTag ? 'border-red-500 focus:ring-red-500/20' : 'border-border focus:ring-cyan-500'
                      }`}
                    />
                    {hwModalErrors.assetTag && (
                      <p className="text-[11px] text-red-500 mt-1 font-medium">{hwModalErrors.assetTag}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium mb-1 text-xs text-foreground">
                      {t('hardwareModal.courierProviderLabel', { defaultValue: 'Courier Provider' })}
                    </label>
                    <input
                      id="hw-courier-provider-input"
                      type="text"
                      placeholder="e.g. FedEx / DHL / UPS"
                      value={hwCourierProvider}
                      onChange={(e) => {
                        setHwCourierProvider(e.target.value);
                        if (hwModalErrors.courierProvider) {
                          setHwModalErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.courierProvider;
                            return copy;
                          });
                        }
                      }}
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs"
                    />
                    {hwModalErrors.courierProvider && (
                      <p className="text-[11px] text-amber-500 mt-1 font-medium">{hwModalErrors.courierProvider}</p>
                    )}
                  </div>

                  <div>
                    <label className="block font-medium mb-1 text-xs text-foreground">
                      {t('hardwareModal.trackingUrlLabel', { defaultValue: 'Tracking URL' })}
                    </label>
                    <input
                      id="hw-courier-url-input"
                      type="url"
                      placeholder="https://track.fedex.com/..."
                      value={hwCourierUrl}
                      onChange={(e) => {
                        setHwCourierUrl(e.target.value);
                        if (hwModalErrors.courierUrl) {
                          setHwModalErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.courierUrl;
                            return copy;
                          });
                        }
                      }}
                      className={`w-full px-3 py-2 bg-background border rounded-xl focus:outline-none focus:ring-2 text-xs ${
                        hwModalErrors.courierUrl ? 'border-red-500 focus:ring-red-500/20' : 'border-border focus:ring-cyan-500'
                      }`}
                    />
                    {hwModalErrors.courierUrl && (
                      <p className="text-[11px] text-red-500 mt-1 font-medium">{hwModalErrors.courierUrl}</p>
                    )}
                  </div>
                </div>

                <div className="border-t border-border/60 pt-3 space-y-2">
                  <span className="block font-medium text-xs text-foreground">
                    {t('hardwareModal.receiptSectionTitle', { defaultValue: 'Hardware Receipt / Purchase Invoice Attachment' })}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        {t('hardwareModal.fileNameLabel', { defaultValue: 'File Name' })}
                      </label>
                      <input
                        id="hw-receipt-name-input"
                        type="text"
                        placeholder={t('hardwareModal.fileNamePlaceholder', { defaultValue: 'e.g. invoice_macbook.pdf' })}
                        value={hwReceiptFileName}
                        onChange={(e) => setHwReceiptFileName(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        {t('hardwareModal.fileUrlLabel', { defaultValue: 'File URL / Storage Link' })}
                      </label>
                      <input
                        id="hw-receipt-url-input"
                        type="url"
                        placeholder={t('hardwareModal.fileUrlPlaceholder', { defaultValue: 'https://storage.example.com/receipts/...' })}
                        value={hwReceiptFileUrl}
                        onChange={(e) => setHwReceiptFileUrl(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                </div>
              </DialogBody>

              <DialogFooter className="p-4 sm:px-6 border-t border-border/60 bg-muted/30">
                <button
                  id="cancel-hardware-btn"
                  type="button"
                  onClick={() => setIsHardwareModalOpen(false)}
                  className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-medium cursor-pointer transition-colors"
                >
                  {t('createModal.cancel', { defaultValue: 'Cancel' })}
                </button>
                <button
                  id="save-hardware-btn"
                  type="submit"
                  disabled={isSavingHardware}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  {isSavingHardware
                    ? t('hardwareModal.saving', { defaultValue: 'Saving...' })
                    : t('hardwareModal.saveDetails', { defaultValue: 'Save Hardware Details' })}
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
