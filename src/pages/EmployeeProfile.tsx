import { useParams, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '../components/Button';
import {
  Card,
  CardContent,
} from '../components/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/Tabs';
import { EmployeeAvatar } from '../components/EmployeeAvatar';
import { Badge } from '../components/Badge';
import { Progress } from '../components/Progress';
import { Skeleton } from '../components/Skeleton';
import { Input } from '../components/Input';
import { Label } from '../components/Label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '../components/Dialog';
import {
  ChevronLeft,
  Plus,
  Mail,
  MapPin,
  Calendar,
  Award,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Camera,
  Lock,
  Settings,
  Phone,
  Globe,
  Scale,
  CheckSquare,
  Users,
  Flag,
  Sparkles,
  Send,
  MessageSquare,
  Check,
  ChevronRight,
  TrendingUp,
  Share2,
  CalendarCheck,
  GraduationCap,
  ShieldCheck,
  Star,
  Activity,
  HeartHandshake,
  Laptop,
  ExternalLink,
} from 'lucide-react';
import {
  useEmployee,
  useUpdateMyProfile,
  useChangeMyPassword,
  useUpdateEmployee,
} from '../hooks/useEmployees';
import { useTasks, useUpdateTaskStatus } from '../hooks/useTasks';
import { useBuddyAssignments, useMyBuddy } from '../hooks/useBuddy';
import { useTeamMilestones, useMyMilestones, useMilestoneTemplates, useAssignMilestone } from '../hooks/useMilestones';
import { useCurrentUser } from '../hooks/useAuth';
import { useDepartments } from '../hooks/useSettings';
import { uploadService } from '../services/upload.service';
import { employeeService } from '../services/employee.service';
import { toast } from 'sonner';
import { getErrorMessage } from '../api/client';
import { useTranslation } from 'react-i18next';

interface ProfileActivityItem {
  id: string;
  type: 'system' | 'message' | 'task' | 'journey' | 'milestone' | 'compliance';
  author: string;
  authorRole?: string;
  title: string;
  message: string;
  timestamp: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'outline' | 'destructive';
}

export function EmployeeProfile() {
  const { t } = useTranslation('directory');
  const { id } = useParams();
  const navigate = useNavigate();
  const targetId = id || 'me';

  // Primary Employee Profile Data
  const { data: employee, isLoading, isError, error, refetch } = useEmployee(targetId);
  const { data: currentUser } = useCurrentUser();
  const { data: activeDepartments = [] } = useDepartments();

  const isOwnProfile = targetId === 'me' || (currentUser && employee && currentUser.id === employee.id);
  const isAdmin = currentUser?.role === 'admin' || (currentUser?.role as any) === 'super_admin' || (currentUser?.role as any) === 'hr_admin';

  // Cross-System Data Queries
  const employeeMongoId = employee?.id || (isOwnProfile ? currentUser?.id : undefined);

  // 1. Tasks & Checklists Hub
  const { data: employeeTasksData, isLoading: tasksLoading, refetch: refetchTasks } = useTasks(
    employeeMongoId ? { employeeId: employeeMongoId } : undefined
  );
  const { data: myAssignedTasksData } = useTasks(isOwnProfile ? { assignedToMe: true } : undefined);
  const updateTaskMutation = useUpdateTaskStatus();

  // Combine tasks: prioritizes employee-specific tasks, merges with own assigned tasks if on personal profile
  const allTasks = useMemo(() => {
    const directTasks = employeeTasksData?.tasks || [];
    if (!isOwnProfile) return directTasks;

    const myTasks = myAssignedTasksData?.tasks || [];
    const map = new Map<string, any>();
    directTasks.forEach((taskEntry) => map.set(taskEntry._id, taskEntry));
    myTasks.forEach((taskEntry) => map.set(taskEntry._id, taskEntry));
    return Array.from(map.values());
  }, [employeeTasksData, myAssignedTasksData, isOwnProfile]);

  const equipmentTasks = useMemo(() => {
    return allTasks.filter((taskEntry: any) => taskEntry.hardwareMetadata || taskEntry.category === 'equipment' || taskEntry.category === 'it_setup');
  }, [allTasks]);

  // 2. Buddy / Mentor Pairing
  const { data: buddyAssignments = [] } = useBuddyAssignments();
  const { data: myBuddyData } = useMyBuddy();

  const matchedBuddyAssignment = useMemo(() => {
    if (isOwnProfile && myBuddyData) return myBuddyData;
    if (!employeeMongoId) return null;
    return (
      buddyAssignments.find((b: any) => {
        const hireId = b.newHireUserId?._id || b.newHireUserId?.id || b.newHireUserId;
        return hireId === employeeMongoId;
      }) || null
    );
  }, [isOwnProfile, myBuddyData, buddyAssignments, employeeMongoId]);

  // 3. Milestone Reviews (30/60/90/180-Day Track)
  const { data: myMilestones = [] } = useMyMilestones();
  const { data: teamMilestones = [] } = useTeamMilestones();
  const { data: milestoneTemplates = [] } = useMilestoneTemplates();
  const assignMilestoneMutation = useAssignMilestone();
  const [assignMilestoneOpen, setAssignMilestoneOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const employeeMilestones = useMemo(() => {
    if (isOwnProfile && myMilestones.length > 0) return myMilestones;
    if (!employeeMongoId) return [];
    return teamMilestones.filter((m: any) => {
      const eId = m.employeeId?._id || m.employeeId?.id || m.employeeId;
      return eId === employeeMongoId;
    });
  }, [isOwnProfile, myMilestones, teamMilestones, employeeMongoId]);

  const handleAssignMilestoneToEmployee = () => {
    if (!selectedTemplateId || !employeeMongoId) {
      toast.error(t('profile.milestonesTab.assignModal.pleaseSelect', 'Please select a milestone template.'));
      return;
    }
    assignMilestoneMutation.mutate(
      { templateId: selectedTemplateId, employeeId: employeeMongoId },
      {
        onSuccess: () => {
          toast.success(t('profile.milestonesTab.assignModal.assignedSuccess', 'Milestone program successfully assigned to employee!'));
          setAssignMilestoneOpen(false);
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || t('profile.milestonesTab.assignModal.assignedFailed', 'Failed to assign milestone'));
        }
      }
    );
  };

  // File Upload Reference
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dialog State Triggers
  const [editSelfOpen, setEditSelfOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [editEmployeeOpen, setEditEmployeeOpen] = useState(false);
  const [legalHoldModalOpen, setLegalHoldModalOpen] = useState(false);
  const [legalHoldReason, setLegalHoldReason] = useState('');
  const [isUpdatingHold, setIsUpdatingHold] = useState(false);

  // Tasks Filter View ('all' | 'due' | 'upcoming' | 'completed')
  const [taskFilter, setTaskFilter] = useState<'all' | 'due' | 'upcoming' | 'completed'>('all');

  // Direct Communication / Feed State
  const [customNote, setCustomNote] = useState('');
  const [noteCategory, setNoteCategory] = useState<'encouragement' | 'guidance' | 'kudos' | 'action_required'>('encouragement');
  const [persistedFeed, setPersistedFeed] = useState<ProfileActivityItem[]>([]);

  // Self Edit Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [locationVal, setLocationVal] = useState('');
  const [timezoneVal, setTimezoneVal] = useState('');

  // Password Form State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Admin Edit Form State
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [adminDeptId, setAdminDeptId] = useState('');
  const [adminRole, setAdminRole] = useState<'owner' | 'admin' | 'manager' | 'employee' | 'hr_admin' | 'it_admin'>('employee');
  const [adminRoles, setAdminRoles] = useState<string[]>([]);
  const [adminStatus, setAdminStatus] = useState<'active' | 'onboarding' | 'inactive'>('active');
  const [adminDesignation, setAdminDesignation] = useState('');
  const [adminPayrollCategory, setAdminPayrollCategory] = useState('');
  const [adminHireDate, setAdminHireDate] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const updateSelfMutation = useUpdateMyProfile();
  const changePasswordMutation = useChangeMyPassword();
  const updateEmployeeMutation = useUpdateEmployee();

  // Load custom notes from localStorage for this employee
  useEffect(() => {
    if (!employeeMongoId) return;
    const storageKey = `talnova_profile_feed_${employeeMongoId}`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setPersistedFeed(JSON.parse(stored));
      } else {
        setPersistedFeed([]);
      }
    } catch {
      setPersistedFeed([]);
    }
  }, [employeeMongoId]);

  // Sync state when employee data arrives
  useEffect(() => {
    if (employee) {
      setFirstName(employee.firstName || '');
      setLastName(employee.lastName || '');
      setPhone(employee.phone || '');
      setLocationVal(employee.location || '');
      setTimezoneVal(employee.timezone || '');

      setAdminFirstName(employee.firstName || '');
      setAdminLastName(employee.lastName || '');
      setAdminDesignation(employee.designation || '');
      setAdminPayrollCategory(employee.payrollCategory || '');
      setAdminRole((employee.role as any) || 'employee');
      setAdminRoles(employee.roles || []);
      setAdminStatus(
        employee.status === 'Active'
          ? 'active'
          : employee.status === 'Onboarding'
            ? 'onboarding'
            : 'inactive'
      );

      // Match Department
      if (employee.department && activeDepartments.length > 0) {
        const found = activeDepartments.find(
          (d) => d.name.toLowerCase() === employee.department?.toLowerCase() || d._id === (employee as any).departmentId
        );
        if (found) setAdminDeptId(found._id);
      }

      // Format Hire Date for input[type="date"]
      let parsedDate = '';
      if (employee.hireDate) {
        const d = new Date(employee.hireDate);
        if (!isNaN(d.getTime())) {
          parsedDate = d.toISOString().split('T')[0];
        }
      }
      setAdminHireDate(parsedDate);
    }
  }, [employee, activeDepartments]);

  // Handle Photo Upload
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const toastId = toast.loading(t('profile.toasts.avatarUploading', 'Uploading profile picture...'));

    try {
      const { uploadId, url } = await uploadService.uploadFile(file, 'public');

      await updateSelfMutation.mutateAsync({
        firstName: firstName || employee?.firstName || '',
        lastName: lastName || employee?.lastName || '',
        phone: phone || employee?.phone || '',
        location: locationVal || employee?.location || '',
        timezone: timezoneVal || employee?.timezone || '',
        avatar: {
          uploadId,
          fileName: file.name,
          publicUrl: url,
        },
      });

      toast.success(t('profile.toasts.avatarSuccess', 'Avatar updated successfully.'), { id: toastId });
      refetch();
    } catch (err: any) {
      toast.error(getErrorMessage(err), { id: toastId });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Self Edit Save
  const handleSaveSelf = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSelfMutation.mutateAsync({
        firstName,
        lastName,
        phone,
        location: locationVal,
        timezone: timezoneVal,
      });
      toast.success(t('profile.toasts.selfUpdated', 'Profile details updated successfully.'));
      setEditSelfOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    }
  };

  // Handle Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t('profile.toasts.passwordMismatch', 'New passwords do not match.'));
      return;
    }
    try {
      await changePasswordMutation.mutateAsync({
        oldPassword,
        newPassword,
      });
      toast.success(t('profile.toasts.passwordChanged', 'Password changed successfully.'));
      setChangePasswordOpen(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    }
  };

  // Handle Admin Employee Account Save
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    try {
      const combinedRoles = Array.from(new Set([adminRole, ...adminRoles])).filter(Boolean);
      await updateEmployeeMutation.mutateAsync({
        id: employee.id,
        employee: {
          firstName: adminFirstName,
          lastName: adminLastName,
          departmentId: adminDeptId || null,
          role: adminRole,
          roles: combinedRoles,
          status: adminStatus === 'active' ? 'Active' : adminStatus === 'onboarding' ? 'Onboarding' : 'Inactive',
          designation: adminDesignation,
          payrollCategory: adminPayrollCategory,
          hireDate: adminHireDate || null,
        } as any,
      });
      toast.success(t('profile.toasts.accountUpdated', 'Employee account updated successfully.'));
      setEditEmployeeOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    }
  };

  // Handle Statutory Legal Hold (SOC-2 CC6.1)
  const handleToggleLegalHold = async () => {
    if (!employee) return;
    if (!legalHoldReason || legalHoldReason.trim().length < 10) {
      toast.error(t('profile.toasts.legalHoldMinChars', 'Audit Compliance Error: Legal hold justification must be at least 10 characters.'));
      return;
    }

    setIsUpdatingHold(true);
    try {
      const targetState = !employee.legalHold;
      const res = await employeeService.setLegalHold(employee.id, {
        legalHold: targetState,
        reason: legalHoldReason.trim(),
      });
      toast.success(res.message || (targetState ? t('profile.toasts.legalHoldPlaced', 'Legal hold placed successfully.') : t('profile.toasts.legalHoldReleased', 'Legal hold released successfully.')));
      setLegalHoldModalOpen(false);
      setLegalHoldReason('');
      refetch();
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsUpdatingHold(false);
    }
  };

  // Quick Task Toggle (Check / Reopen)
  const handleToggleTaskStatus = async (task: any) => {
    const isDone = task.status === 'completed' || task.status === 'verified';
    const nextStatus = isDone ? 'pending' : 'completed';

    try {
      await updateTaskMutation.mutateAsync({
        id: task._id,
        status: nextStatus,
        note: `Status toggled via Profile Hub by ${currentUser?.name || 'User'}`,
      });
      toast.success(nextStatus === 'completed' ? t('profile.toasts.taskCompleted', { title: task.title, defaultValue: `Completed: "${task.title}"` }) : t('profile.toasts.taskReopened', { title: task.title, defaultValue: `Reopened: "${task.title}"` }));
      refetchTasks();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || t('profile.toasts.taskUpdateFailed', 'Failed to update task'));
    }
  };

  // Post Direct Note / Message
  const handlePostNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customNote.trim() || !employeeMongoId) return;

    const newItem: ProfileActivityItem = {
      id: `msg-${Date.now()}`,
      type: 'message',
      author: currentUser?.name || 'Teammate',
      authorRole: currentUser?.role || 'Member',
      title:
        noteCategory === 'encouragement'
          ? t('profile.toasts.noteCategories.encouragement', 'Welcome & Encouragement')
          : noteCategory === 'guidance'
            ? t('profile.toasts.noteCategories.guidance', 'Onboarding Guidance')
            : noteCategory === 'kudos'
              ? t('profile.toasts.noteCategories.kudos', 'Kudos & Recognition')
              : t('profile.toasts.noteCategories.actionRequired', 'Action Required Note'),
      message: customNote.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }),
      badge: noteCategory.replace('_', ' ').toUpperCase(),
      badgeVariant: noteCategory === 'action_required' ? 'destructive' : 'secondary',
    };

    const updated = [newItem, ...persistedFeed];
    setPersistedFeed(updated);

    // Save to localStorage
    const storageKey = `talnova_profile_feed_${employeeMongoId}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      // Ignored
    }

    setCustomNote('');
  };

  // Filter Tasks
  const filteredTasks = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return allTasks.filter((taskItem) => {
      const isCompleted = taskItem.status === 'completed' || taskItem.status === 'verified';
      const isDueToday = taskItem.dueDate && taskItem.dueDate.startsWith(todayStr);
      const isOverdue = taskItem.status === 'overdue' || (taskItem.dueDate && taskItem.dueDate < todayStr && !isCompleted);

      if (taskFilter === 'due') return isDueToday || isOverdue;
      if (taskFilter === 'upcoming') return !isCompleted && !isDueToday && !isOverdue;
      if (taskFilter === 'completed') return isCompleted;
      return true;
    });
  }, [allTasks, taskFilter]);

  // Aggregated Task Counts
  const taskCounts = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    let dueCount = 0;
    let upcomingCount = 0;
    let completedCount = 0;

    allTasks.forEach((taskItem) => {
      const isCompleted = taskItem.status === 'completed' || taskItem.status === 'verified';
      const isDueToday = taskItem.dueDate && taskItem.dueDate.startsWith(todayStr);
      const isOverdue = taskItem.status === 'overdue' || (taskItem.dueDate && taskItem.dueDate < todayStr && !isCompleted);

      if (isCompleted) completedCount++;
      else if (isDueToday || isOverdue) dueCount++;
      else upcomingCount++;
    });

    return { total: allTasks.length, dueCount, upcomingCount, completedCount };
  }, [allTasks]);

  // Synthesized Activity Stream (combining journeys, milestones, tasks, and posted notes)
  const combinedActivityFeed = useMemo(() => {
    const items: ProfileActivityItem[] = [...persistedFeed];

    // System Milestone Events
    employeeMilestones.forEach((m: any) => {
      items.push({
        id: `milestone-${m._id}`,
        type: 'milestone',
        author: 'Milestone Automation Engine',
        title: `${m.targetDay}-Day Milestone: ${m.milestoneTitle}`,
        message: `Status: ${m.status.replace(/_/g, ' ')}. Due on ${new Date(m.dueDate).toLocaleDateString()}.`,
        timestamp: new Date(m.dueDate).toLocaleDateString(),
        badge: `${m.targetDay}D CHECKPOINT`,
        badgeVariant: m.status === 'approved' || m.status === 'completed' ? 'default' : 'secondary',
      });
    });

    // Completed Tasks
    allTasks
      .filter((taskEntry) => taskEntry.status === 'completed' || taskEntry.status === 'verified')
      .slice(0, 5)
      .forEach((taskEntry) => {
        items.push({
          id: `task-${taskEntry._id}`,
          type: 'task',
          author: taskEntry.assignedToUserId?.profile?.firstName || 'System',
          title: `Task Completed: ${taskEntry.title}`,
          message: `Category: ${taskEntry.category}. Priority: ${taskEntry.priority}. Stage: ${taskEntry.stage}.`,
          timestamp: taskEntry.completedAt ? new Date(taskEntry.completedAt).toLocaleDateString() : 'Recently',
          badge: taskEntry.requiresVerification ? 'VERIFIED' : 'DONE',
          badgeVariant: 'default',
        });
      });

    // Assigned Journeys
    (employee?.assignedJourneys || []).forEach((j: any) => {
      items.push({
        id: `journey-${j.id}`,
        type: 'journey',
        author: 'Workflow Engine',
        title: `Journey Assigned: ${j.title}`,
        message: `Current progress: ${j.progress}%. Assigned: ${j.assignedAt || 'During onboarding'}.`,
        timestamp: j.assignedAt || 'Active',
        badge: j.status.toUpperCase(),
        badgeVariant: j.status === 'Completed' ? 'default' : 'secondary',
      });
    });

    return items;
  }, [persistedFeed, employeeMilestones, allTasks, employee]);

  const copyProfileLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      toast.success(t('profile.toasts.linkCopied', 'Profile URL copied to clipboard'));
    }
  };

  // Loading Skeleton State
  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 animate-pulse">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Card className="rounded-2xl overflow-hidden p-6 space-y-6">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <Skeleton className="size-24 rounded-full" />
            <div className="space-y-3 flex-1">
              <Skeleton className="h-7 w-64" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-96" />
            </div>
          </div>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      </div>
    );
  }

  // Error State
  if (isError || !employee) {
    return (
      <div className="max-w-md mx-auto text-center p-8 border rounded-2xl space-y-4 my-12 bg-card shadow-sm">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold text-foreground">{t('profile.error.title', 'Employee Profile Not Found')}</h2>
        <p className="text-sm text-muted-foreground">
          {(error as any)?.message || t('profile.error.desc', 'The requested employee profile could not be retrieved.')}
        </p>
        <Button onClick={() => refetch()} className="mx-auto">
          <RefreshCw className="mr-2 h-4 w-4" /> {t('profile.error.retry', 'Retry')}
        </Button>
      </div>
    );
  }

  const primaryJourney = employee.assignedJourneys?.[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 pb-20">
      {/* Top Breadcrumb Navigation & Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-xl hover:bg-muted" asChild>
            <Link to={isOwnProfile ? (currentUser?.role === 'employee' ? '/employee' : '/') : '/directory'}>
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {isOwnProfile ? t('profile.header.myHubTitle', 'My Unified Onboarding Hub') : t('profile.header.userProfileTitle', { name: employee.name, defaultValue: `${employee.name}'s Profile` })}
              </h1>
              {employee.employeeId && (
                <span className="px-2 py-0.5 rounded-md font-mono text-[10px] bg-muted text-muted-foreground border border-border/70">
                  {t('profile.header.idLabel', { id: employee.employeeId, defaultValue: `ID: ${employee.employeeId}` })}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('profile.header.subtitle', 'Single-window operational view, journey progression, checklists & peer collaboration.')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={copyProfileLink} className="rounded-xl text-xs flex items-center gap-1.5">
            <Share2 className="h-3.5 w-3.5" />
            {t('profile.header.shareProfile', 'Share Profile')}
          </Button>
          {isOwnProfile ? (
            <Button onClick={() => setEditSelfOpen(true)} size="sm" className="rounded-xl text-xs flex items-center gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              {t('profile.header.editMyProfile', 'Edit My Profile')}
            </Button>
          ) : isAdmin ? (
            <Button onClick={() => setEditEmployeeOpen(true)} size="sm" className="rounded-xl text-xs flex items-center gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              {t('profile.header.manageAccount', 'Manage Account')}
            </Button>
          ) : null}
        </div>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />

      {/* Hero Panoramic Profile Card */}
      <Card className="rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm overflow-hidden relative">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
            {/* Left: Avatar + Identification Details */}
            <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
              <div
                className="relative group cursor-pointer shrink-0 rounded-full"
                onClick={() => isOwnProfile && !isUploading && fileInputRef.current?.click()}
                title={isOwnProfile ? t('profile.hero.clickToChange', 'Click to change profile picture') : undefined}
              >
                <EmployeeAvatar
                  src={employee.avatar}
                  name={employee.name}
                  email={employee.email}
                  userId={employee.id}
                  size="2xl"
                  status={
                    employee.legalHold
                      ? 'legal_hold'
                      : employee.status === 'Active'
                        ? 'online'
                        : employee.status === 'Onboarding'
                          ? 'onboarding'
                          : undefined
                  }
                  borderClass="ring-4 ring-background shadow-md"
                />
                {isOwnProfile && (
                  <div className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {isUploading ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Camera className="w-5 h-5 mb-0.5" />
                        <span className="text-[9px] font-semibold">{t('profile.hero.changePhoto', 'Change Photo')}</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-bold text-foreground">{employee.name}</h2>
                  <Badge
                    variant={
                      employee.status === 'Active'
                        ? 'default'
                        : employee.status === 'Onboarding'
                          ? 'secondary'
                          : 'destructive'
                    }
                    className="capitalize text-xs font-semibold px-2.5 py-0.5 rounded-full"
                  >
                    {employee.status}
                  </Badge>

                  {employee.legalHold && (
                    <Badge className="bg-rose-600 text-white font-bold text-xs flex items-center gap-1 shadow-sm px-2.5 py-0.5 rounded-full">
                      <Scale className="w-3 h-3" /> {t('profile.hero.statutoryHold', 'STATUTORY LEGAL HOLD')}
                    </Badge>
                  )}
                </div>

                <p className="text-sm font-medium text-foreground/80">
                  <span className="font-semibold text-primary">{employee.designation || employee.role}</span>
                  <span className="text-muted-foreground"> • {employee.department}</span>
                </p>

                {/* Assigned Multi-Roles Badges */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {Array.from(new Set([employee.role, ...(employee.roles || [])])).filter(Boolean).map((r) => (
                    <Badge key={r} variant="outline" className="text-[10px] uppercase font-mono px-2 py-0.5 bg-background/50">
                      {r.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>

                {/* Metadata Pills */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground pt-1">
                  {employee.email && (
                    <a
                      href={`mailto:${employee.email}`}
                      className="flex items-center gap-1.5 hover:text-primary transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                      {employee.email}
                    </a>
                  )}
                  {employee.phone && (
                    <a href={`tel:${employee.phone}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                      {employee.phone}
                    </a>
                  )}
                  {employee.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                      {employee.location}
                    </span>
                  )}
                  {employee.timezone && (
                    <span className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                      {employee.timezone}
                    </span>
                  )}
                  {employee.hireDate && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      {t('profile.hero.joined', { date: employee.hireDate, defaultValue: `Joined ${employee.hireDate}` })}
                    </span>
                  )}
                  {employee.payrollCategory && (
                    <span className="px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground text-[10px] font-semibold border border-border/60">
                      {t('profile.hero.payroll', { category: employee.payrollCategory, defaultValue: `Payroll: ${employee.payrollCategory}` })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Quick Action Controls */}
            <div className="flex flex-wrap md:flex-col gap-2 w-full md:w-48 shrink-0">
              {isOwnProfile ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setChangePasswordOpen(true)}
                    className="rounded-xl text-xs w-full justify-start gap-2"
                  >
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" /> {t('profile.hero.changePassword', 'Change Password')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/employee')}
                    className="rounded-xl text-xs w-full justify-start gap-2"
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-primary" /> {t('profile.hero.employeeDashboard', 'Employee Dashboard')}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    className="rounded-xl text-xs w-full justify-start gap-2 bg-primary text-primary-foreground"
                    onClick={() => {
                      const el = document.getElementById('quick-note-input');
                      if (el) el.focus();
                    }}
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> {t('profile.hero.sendQuickNote', 'Send Quick Note')}
                  </Button>
                  {isAdmin && (
                    <Button
                      variant={employee.legalHold ? 'destructive' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setLegalHoldReason(employee.legalHoldReason || '');
                        setLegalHoldModalOpen(true);
                      }}
                      className="rounded-xl text-xs w-full justify-start gap-2"
                    >
                      <Scale className="w-3.5 h-3.5" />
                      {employee.legalHold ? t('profile.hero.manageLegalHold', 'Manage Legal Hold') : t('profile.hero.placeLegalHold', 'Place Legal Hold')}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Onboarding Readiness */}
        <Card className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('profile.kpi.readiness', 'Readiness')}</span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2 text-foreground">{employee.progress}%</div>
          <Progress value={employee.progress} className="h-1.5 mt-2" />
        </Card>

        {/* Assigned Journeys */}
        <Card className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('profile.kpi.journeys', 'Journeys')}</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2 text-foreground">
            {employee.completedJourneysCount || 0}
            <span className="text-xs font-normal text-muted-foreground"> {t('profile.kpi.completedCount', { completed: employee.completedJourneysCount || 0, total: employee.assignedJourneys?.length || 1, defaultValue: `/ ${employee.assignedJourneys?.length || 1} Completed` })}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 truncate">
            {primaryJourney ? primaryJourney.title : t('profile.kpi.standardTrack', 'Standard Track')}
          </p>
        </Card>

        {/* Operational Tasks */}
        <Card className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('profile.kpi.checklists', 'Checklists')}</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2 text-foreground">
            {taskCounts.completedCount}
            <span className="text-xs font-normal text-muted-foreground"> {t('profile.kpi.doneCount', { completed: taskCounts.completedCount, total: taskCounts.total, defaultValue: `/ ${taskCounts.total} Done` })}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {taskCounts.dueCount > 0 ? (
              <span className="text-amber-600 font-semibold">{t('profile.kpi.urgentDue', { count: taskCounts.dueCount, defaultValue: `${taskCounts.dueCount} Urgent Due` })}</span>
            ) : (
              t('profile.kpi.allOnTrack', 'All checklists on track')
            )}
          </p>
        </Card>

        {/* Next Milestone */}
        <Card className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('profile.kpi.milestones', 'Milestones')}</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2 text-foreground">
            {employeeMilestones.length > 0 ? `${employeeMilestones[0].targetDay}D` : '30D'}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 truncate">
            {employeeMilestones.length > 0 ? employeeMilestones[0].milestoneTitle : t('profile.kpi.default30Checkpoint', '30-Day Checkpoint')}
          </p>
        </Card>
      </div>

      {/* Main Single-Window Modular Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/60 p-1 rounded-xl border border-border/60">
          <TabsTrigger value="overview" className="rounded-lg text-xs font-medium gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> {t('profile.tabTriggers.unifiedHub', 'Unified Hub')}
          </TabsTrigger>
          <TabsTrigger value="journeys" className="rounded-lg text-xs font-medium gap-1.5">
            <GraduationCap className="w-3.5 h-3.5" /> {t('profile.tabTriggers.journeys', { count: employee.assignedJourneys?.length || 0, defaultValue: `Journeys (${employee.assignedJourneys?.length || 0})` })}
          </TabsTrigger>
          <TabsTrigger value="tasks" className="rounded-lg text-xs font-medium gap-1.5">
            <CheckSquare className="w-3.5 h-3.5" /> {t('profile.tabTriggers.tasks', { count: taskCounts.total, defaultValue: `Tasks & Checklists (${taskCounts.total})` })}
          </TabsTrigger>
          <TabsTrigger value="milestones" className="rounded-lg text-xs font-medium gap-1.5">
            <Flag className="w-3.5 h-3.5" /> {t('profile.tabTriggers.milestones', { count: employeeMilestones.length, defaultValue: `Milestones (${employeeMilestones.length})` })}
          </TabsTrigger>
          <TabsTrigger value="activity" className="rounded-lg text-xs font-medium gap-1.5">
            <Activity className="w-3.5 h-3.5" /> {t('profile.tabTriggers.activity', 'Activity & Comms')}
          </TabsTrigger>
        </TabsList>

        {/* ============================================================ */}
        {/* TAB 1: UNIFIED SINGLE-WINDOW PANORAMIC HUB                   */}
        {/* ============================================================ */}
        <TabsContent value="overview" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Columns: Journey Track, Tasks Hub & Milestones */}
            <div className="lg:col-span-2 space-y-6">
              {/* 1. Journey Path Timeline */}
              <Card className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground">{t('profile.overview.journeyPathway', 'Onboarding Journey Pathway')}</h3>
                      <p className="text-xs text-muted-foreground">
                        {t('profile.overview.journeyPathwayDesc', 'Structured curriculum & autonomous progression pipeline')}
                      </p>
                    </div>
                  </div>
                  {primaryJourney && (
                    <Button variant="outline" size="sm" className="rounded-xl text-xs" asChild>
                      <Link to={`/course/${primaryJourney.id}`}>
                        {t('profile.overview.resumeJourney', 'Resume Journey')} <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </Link>
                    </Button>
                  )}
                </div>

                {/* Pathway Stage Bar */}
                <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-foreground">
                      {primaryJourney ? primaryJourney.title : t('profile.overview.generalOnboarding', 'General Company Onboarding')}
                    </span>
                    <span className="font-bold text-primary">{t('profile.overview.percentComplete', { percent: employee.progress, defaultValue: `${employee.progress}% Complete` })}</span>
                  </div>
                  <Progress value={employee.progress} className="h-2 rounded-full" />

                  {/* Visual Stage Nodes */}
                  <div className="grid grid-cols-4 gap-2 pt-2">
                    {[
                      { label: t('profile.overview.stages.preboarding', 'Pre-Boarding'), done: employee.progress >= 25, active: employee.progress < 25 },
                      { label: t('profile.overview.stages.day1Welcome', 'Day 1 Welcome'), done: employee.progress >= 50, active: employee.progress >= 25 && employee.progress < 50 },
                      { label: t('profile.overview.stages.week1Immersion', 'Week 1 Immersion'), done: employee.progress >= 75, active: employee.progress >= 50 && employee.progress < 75 },
                      { label: t('profile.overview.stages.month1Autonomy', 'Month 1 Autonomy'), done: employee.progress >= 100, active: employee.progress >= 75 },
                    ].map((stage, idx) => (
                      <div key={idx} className="flex flex-col items-center text-center space-y-1">
                        <div
                          className={`size-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${stage.done
                              ? 'bg-emerald-500 text-white shadow-sm'
                              : stage.active
                                ? 'bg-primary text-primary-foreground ring-2 ring-primary/30 animate-pulse'
                                : 'bg-muted text-muted-foreground border border-border'
                            }`}
                        >
                          {stage.done ? <Check className="w-3 h-3" /> : idx + 1}
                        </div>
                        <span
                          className={`text-[10px] leading-tight font-medium ${stage.done || stage.active ? 'text-foreground' : 'text-muted-foreground'
                            }`}
                        >
                          {stage.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* 2. Tasks & Checklists Hub */}
              <Card className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <CheckSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground">{t('profile.overview.tasksHub', 'Tasks & Role Checklists Hub')}</h3>
                      <p className="text-xs text-muted-foreground">
                        {t('profile.overview.tasksHubDesc', 'Interactive operational checklist items with real-time sync')}
                      </p>
                    </div>
                  </div>

                  {/* Filter Badges */}
                  <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/60">
                    <button
                      onClick={() => setTaskFilter('all')}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${taskFilter === 'all' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      {t('profile.overview.filters.all', { count: taskCounts.total, defaultValue: `All (${taskCounts.total})` })}
                    </button>
                    <button
                      onClick={() => setTaskFilter('due')}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${taskFilter === 'due' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      {t('profile.overview.filters.urgent', { count: taskCounts.dueCount, defaultValue: `Urgent (${taskCounts.dueCount})` })}
                    </button>
                    <button
                      onClick={() => setTaskFilter('upcoming')}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${taskFilter === 'upcoming' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      {t('profile.overview.filters.upcoming', { count: taskCounts.upcomingCount, defaultValue: `Upcoming (${taskCounts.upcomingCount})` })}
                    </button>
                    <button
                      onClick={() => setTaskFilter('completed')}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${taskFilter === 'completed' ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      {t('profile.overview.filters.done', { count: taskCounts.completedCount, defaultValue: `Done (${taskCounts.completedCount})` })}
                    </button>
                  </div>
                </div>

                {/* Tasks List */}
                <div className="space-y-2.5">
                  {tasksLoading ? (
                    <div className="space-y-2 py-4">
                      <Skeleton className="h-14 w-full rounded-xl" />
                      <Skeleton className="h-14 w-full rounded-xl" />
                    </div>
                  ) : filteredTasks.length === 0 ? (
                    <div className="py-8 text-center border border-dashed rounded-xl bg-muted/20 text-xs text-muted-foreground">
                      {t('profile.overview.emptyTasks', 'No tasks found for the current filter.')}
                    </div>
                  ) : (
                    filteredTasks.slice(0, 5).map((task) => {
                      const isDone = task.status === 'completed' || task.status === 'verified';
                      return (
                        <div
                          key={task._id}
                          className={`flex items-start justify-between gap-3 p-3.5 rounded-xl border transition-all ${isDone
                              ? 'bg-muted/30 border-border/40 opacity-75'
                              : 'bg-card border-border/80 hover:border-primary/40 shadow-xs'
                            }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <button
                              onClick={() => handleToggleTaskStatus(task)}
                              className={`mt-0.5 size-4.5 rounded-md flex items-center justify-center border transition-colors cursor-pointer ${isDone
                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                  : 'border-border hover:border-primary bg-background'
                                }`}
                              title={isDone ? t('profile.overview.markPending', 'Mark task pending') : t('profile.overview.markComplete', 'Mark task complete')}
                            >
                              {isDone && <Check className="w-3 h-3" />}
                            </button>

                            <div className="space-y-0.5 min-w-0">
                              <p
                                className={`text-xs font-semibold truncate ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'
                                  }`}
                              >
                                {task.title}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                                <span className="capitalize px-1.5 py-0.2 rounded bg-muted border border-border/60">
                                  {task.category?.replace('_', ' ')}
                                </span>
                                {task.stage && (
                                  <span className="capitalize text-muted-foreground font-medium">
                                    {t('profile.overview.stageLabel', { stage: task.stage.replace(/_/g, ' '), defaultValue: `Stage: ${task.stage.replace(/_/g, ' ')}` })}
                                  </span>
                                )}
                                {task.dueDate && (
                                  <span className="flex items-center gap-1 text-muted-foreground">
                                    <Clock className="w-2.5 h-2.5" /> {t('profile.overview.dueLabel', { date: new Date(task.dueDate).toLocaleDateString(), defaultValue: `Due ${new Date(task.dueDate).toLocaleDateString()}` })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              variant={task.priority === 'critical' ? 'destructive' : 'outline'}
                              className="text-[10px] uppercase font-bold px-1.5 py-0"
                            >
                              {task.priority}
                            </Badge>
                            {task.requiresVerification && (
                              <Badge className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[10px] font-semibold border-cyan-500/20">
                                <ShieldCheck className="w-2.5 h-2.5 mr-0.5" /> HITL
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {filteredTasks.length > 5 && (
                    <div className="pt-2 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const tabBtn = document.querySelector('[value="tasks"]') as HTMLElement;
                          if (tabBtn) tabBtn.click();
                        }}
                        className="text-xs text-primary font-semibold"
                      >
                        {t('profile.overview.viewAllTasks', { count: allTasks.length, defaultValue: `View all ${allTasks.length} tasks in detail tab` })} <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>

              {/* 3. Milestone Checkpoints Progress */}
              <Card className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      <Flag className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground">{t('profile.overview.milestonesTitle', '30 / 60 / 90 / 180-Day Milestones')}</h3>
                      <p className="text-xs text-muted-foreground">
                        {t('profile.overview.milestonesDesc', 'Formal evaluation gates and SLA compliance reviews')}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-xl text-xs" asChild>
                    <Link to="/milestones">
                      {t('profile.overview.milestonesPage', 'Milestones Page')} <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Link>
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {employeeMilestones.length === 0 ? (
                    <div className="col-span-2 py-6 text-center border border-dashed rounded-xl bg-muted/20 text-xs text-muted-foreground">
                      {t('profile.overview.emptyMilestones', 'No active milestone evaluations assigned. Default milestones will automatically seed upon Day 30.')}
                    </div>
                  ) : (
                    employeeMilestones.slice(0, 4).map((m: any) => (
                      <div
                        key={m._id}
                        className="p-4 rounded-xl border border-border/70 bg-muted/30 hover:border-purple-500/40 transition-colors space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-[10px]">
                            {t('profile.overview.dayGate', { day: m.targetDay, defaultValue: `DAY ${m.targetDay} GATE` })}
                          </span>
                          <Badge
                            variant={m.status === 'approved' || m.status === 'completed' ? 'default' : 'outline'}
                            className="text-[10px] capitalize font-medium"
                          >
                            {m.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <h4 className="text-xs font-bold text-foreground line-clamp-1">{m.milestoneTitle}</h4>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                          <span>{t('profile.overview.due', { date: new Date(m.dueDate).toLocaleDateString(), defaultValue: `Due: ${new Date(m.dueDate).toLocaleDateString()}` })}</span>
                          {m.managerRating && (
                            <span className="flex items-center text-amber-500 font-bold">
                              <Star className="w-3 h-3 fill-amber-500 mr-0.5" />
                              {m.managerRating}/5
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            {/* Right Column: Buddy Card, Activity Composer & Regulatory Hold */}
            <div className="space-y-6">
              {/* Paired Buddy / Mentor Widget */}
              <Card className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400">
                      <HeartHandshake className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground">{t('profile.overview.buddyTitle', 'Onboarding Buddy')}</h3>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2" asChild>
                    <Link to="/buddy">{t('profile.overview.viewProgram', 'View Program')}</Link>
                  </Button>
                </div>

                {matchedBuddyAssignment?.buddyUserId ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3.5">
                      <EmployeeAvatar
                        src={matchedBuddyAssignment.buddyUserId.profile?.avatarUrl}
                        name={`${matchedBuddyAssignment.buddyUserId.profile?.firstName || ''} ${matchedBuddyAssignment.buddyUserId.profile?.lastName || ''
                          }`.trim()}
                        email={matchedBuddyAssignment.buddyUserId.auth?.email}
                        userId={matchedBuddyAssignment.buddyUserId._id}
                        size="xl"
                        status="online"
                      />
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-foreground truncate">
                          {matchedBuddyAssignment.buddyUserId.profile?.firstName}{' '}
                          {matchedBuddyAssignment.buddyUserId.profile?.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {matchedBuddyAssignment.buddyUserId.employment?.jobTitle || 'Senior Mentor'} •{' '}
                          {matchedBuddyAssignment.buddyUserId.employment?.department || employee.department}
                        </p>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                          <CheckCircle2 className="w-3 h-3" /> {t('profile.overview.algorithmicMatch', { percent: 94, defaultValue: 'Algorithmic Match 94%' })}
                        </span>
                      </div>
                    </div>

                    {/* Buddy Quick Actions */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {matchedBuddyAssignment.buddyUserId.auth?.email && (
                        <Button variant="outline" size="sm" className="rounded-xl text-xs" asChild>
                          <a href={`mailto:${matchedBuddyAssignment.buddyUserId.auth.email}?subject=Hello from ${employee.name}`}>
                            <Mail className="w-3.5 h-3.5 mr-1" /> {t('profile.overview.sendEmail', 'Send Email')}
                          </a>
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="rounded-xl text-xs" asChild>
                        <Link to="/calendar">
                          <CalendarCheck className="w-3.5 h-3.5 mr-1" /> {t('profile.overview.book1on1', 'Book 1:1')}
                        </Link>
                      </Button>
                    </div>

                    {/* Mentorship Check-in Progress */}
                    {matchedBuddyAssignment.checklist && matchedBuddyAssignment.checklist.length > 0 && (
                      <div className="p-3 rounded-xl bg-muted/40 border border-border/60 text-xs space-y-1.5">
                        <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
                          <span>{t('profile.overview.checklistProgress', 'Buddy Checklist Progress')}</span>
                          <span>
                            {matchedBuddyAssignment.checklist.filter((c: any) => c.completed).length} /{' '}
                            {matchedBuddyAssignment.checklist.length}
                          </span>
                        </div>
                        <Progress
                          value={
                            (matchedBuddyAssignment.checklist.filter((c: any) => c.completed).length /
                              matchedBuddyAssignment.checklist.length) *
                            100
                          }
                          className="h-1"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center space-y-3 bg-muted/20 border border-dashed rounded-xl p-4">
                    <Users className="size-8 text-muted-foreground/50 mx-auto" />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-foreground">{t('profile.overview.noBuddyPaired', 'No Buddy Paired Yet')}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {t('profile.overview.noBuddyDesc', 'Matching engine evaluates timezone, department, and role compatibility.')}
                      </p>
                    </div>
                    {isAdmin && (
                      <Button size="sm" className="rounded-xl text-xs" asChild>
                        <Link to="/buddy">{t('profile.overview.pairMentor', 'Pair a Mentor')}</Link>
                      </Button>
                    )}
                  </div>
                )}
              </Card>

              {/* Activity Feed & Direct Message Composer */}
              <Card className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      <Activity className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground">{t('profile.overview.activityTitle', 'Activity & Direct Comms')}</h3>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-semibold">{t('profile.overview.liveAudit', 'Live Audit')}</span>
                </div>

                {/* Quick Note Composer */}
                <form onSubmit={handlePostNote} className="space-y-2">
                  <div className="relative">
                    <textarea
                      id="quick-note-input"
                      value={customNote}
                      onChange={(e) => setCustomNote(e.target.value)}
                      placeholder={
                        isOwnProfile
                          ? t('profile.overview.notePlaceholderSelf', 'Add a personal note or reflection on your onboarding progress...')
                          : t('profile.overview.notePlaceholderOther', { name: employee.name, defaultValue: `Send an encouraging note or guidance to ${employee.name}...` })
                      }
                      rows={3}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none placeholder:text-muted-foreground"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <select
                      value={noteCategory}
                      onChange={(e: any) => setNoteCategory(e.target.value)}
                      className="h-8 px-2 text-[11px] bg-background border border-border rounded-lg text-foreground focus:outline-none cursor-pointer"
                    >
                      <option value="encouragement">{t('profile.overview.noteCategories.encouragement', 'Encouragement')}</option>
                      <option value="guidance">{t('profile.overview.noteCategories.guidance', 'Guidance Note')}</option>
                      <option value="kudos">{t('profile.overview.noteCategories.kudos', 'Kudos / Praise')}</option>
                      <option value="action_required">{t('profile.overview.noteCategories.actionRequired', 'Action Required')}</option>
                    </select>

                    <Button type="submit" size="sm" disabled={!customNote.trim()} className="h-8 px-3 rounded-lg text-xs gap-1">
                      <Send className="w-3 h-3" /> {t('profile.overview.postNote', 'Post Note')}
                    </Button>
                  </div>
                </form>

                {/* Recent Feed Events */}
                <div className="space-y-3 pt-2 max-h-72 overflow-y-auto pr-1">
                  {combinedActivityFeed.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-4">{t('profile.overview.noRecentActivity', 'No recent activity logged.')}</p>
                  ) : (
                    combinedActivityFeed.slice(0, 6).map((item) => (
                      <div key={item.id} className="flex gap-2.5 text-xs p-2.5 rounded-xl bg-muted/30 border border-border/50">
                        <div className="shrink-0 mt-0.5">
                          <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
                            {item.author[0]}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-foreground truncate">{item.author}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0">{item.timestamp}</span>
                          </div>
                          <p className="font-medium text-[11px] text-foreground/90">{item.title}</p>
                          <p className="text-[11px] text-muted-foreground break-words">{item.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              {/* Regulatory Compliance & Retention Policy Card (SOC-2 CC6.1) */}
              <Card
                className={`rounded-2xl border p-5 shadow-sm space-y-3 transition-colors ${employee.legalHold
                    ? 'border-rose-500/50 bg-rose-500/5'
                    : 'border-border/70 bg-card'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scale className={`size-4 ${employee.legalHold ? 'text-rose-600' : 'text-primary'}`} />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      {t('profile.overview.socTitle', 'SOC 2 CC6.1 Statutory Retention')}
                    </h4>
                  </div>
                  <Badge
                    variant={employee.legalHold ? 'destructive' : 'outline'}
                    className="text-[10px] font-bold"
                  >
                    {employee.legalHold ? t('profile.overview.holdActiveBadge', 'LEGAL HOLD ACTIVE') : t('profile.overview.standardRetentionBadge', 'STANDARD 7-YR RETENTION')}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {employee.legalHold
                    ? t('profile.overview.holdActiveDesc', { reason: employee.legalHoldReason || 'Statutory litigation hold', defaultValue: `Indefinite retention freeze active: "${employee.legalHoldReason || 'Statutory litigation hold'}". Purge triggers suspended.` })
                    : t('profile.overview.standardRetentionDesc', 'All signed onboarding agreements, e-signature logs, and task audit trails are preserved per statutory guidelines.')}
                </p>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setLegalHoldReason(employee.legalHoldReason || '');
                      setLegalHoldModalOpen(true);
                    }}
                    className="w-full text-xs rounded-xl h-8"
                  >
                    {employee.legalHold ? t('profile.overview.manageJustification', 'Manage Legal Hold Justification') : t('profile.overview.placeRegulatoryHold', 'Place Regulatory Legal Hold')}
                  </Button>
                )}
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 2: JOURNEYS & CURRICULUM DEEP DIVE                       */}
        {/* ============================================================ */}
        <TabsContent value="journeys" className="space-y-6 mt-0">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-foreground">{t('profile.journeysTab.title', 'Assigned Onboarding Journeys')}</h3>
              <p className="text-xs text-muted-foreground">
                {t('profile.journeysTab.desc', 'Formal role-based tracks and interactive modular coursework')}
              </p>
            </div>
            <Button size="sm" className="rounded-xl text-xs" asChild>
              <Link to="/journeys">{t('profile.journeysTab.browseCatalog', 'Browse Journeys Catalog')}</Link>
            </Button>
          </div>

          {!employee.assignedJourneys || employee.assignedJourneys.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground border border-dashed rounded-2xl bg-card p-8 space-y-2">
              <GraduationCap className="size-10 text-muted-foreground/40 mx-auto" />
              <p className="font-semibold text-sm text-foreground">{t('profile.journeysTab.emptyTitle', 'No Journeys Currently Assigned')}</p>
              <p className="text-xs text-muted-foreground">
                {t('profile.journeysTab.emptyDesc', 'Browse the catalog to enroll or apply an automated workflow rule.')}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {employee.assignedJourneys.map((aj: any) => (
                <Card key={aj.id} className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-bold text-base text-foreground">{aj.title}</h4>
                      <p className="text-xs text-muted-foreground">{t('profile.journeysTab.assignedDate', { date: aj.assignedAt || 'During Onboarding', defaultValue: `Assigned ${aj.assignedAt || 'During Onboarding'}` })}</p>
                    </div>
                    <Badge variant={aj.status === 'Completed' ? 'default' : 'secondary'} className="capitalize text-xs">
                      {aj.status}
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-foreground">
                      <span>{t('profile.journeysTab.curriculumProgression', 'Curriculum Progression')}</span>
                      <span>{aj.progress}%</span>
                    </div>
                    <Progress value={aj.progress} className="h-2 rounded-full" />
                  </div>

                  <div className="pt-2">
                    {aj.status === 'Completed' ? (
                      <Button variant="outline" size="sm" className="w-full rounded-xl text-xs" asChild>
                        <Link to="/certificates">
                          <Award className="w-3.5 h-3.5 mr-1 text-amber-500" /> {t('profile.journeysTab.viewCertificate', 'View Issued Certificate')}
                        </Link>
                      </Button>
                    ) : (
                      <Button size="sm" className="w-full rounded-xl text-xs" asChild>
                        <Link to={`/course/${aj.id}`}>
                          {t('profile.journeysTab.continueCoursework', 'Continue Coursework')} <ChevronRight className="w-3.5 h-3.5 ml-1" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 3: TASKS & CHECKLISTS DEEP DIVE                          */}
        {/* ============================================================ */}
        <TabsContent value="tasks" className="space-y-6 mt-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-foreground">{t('profile.tasksTab.title', 'Complete Task Roster')}</h3>
              <p className="text-xs text-muted-foreground">
                {t('profile.tasksTab.desc', { name: employee.name, defaultValue: `All pre-boarding, IT provisioning, and departmental tasks for ${employee.name}` })}
              </p>
            </div>
            <Button size="sm" className="rounded-xl text-xs" asChild>
              <Link to="/tasks">{t('profile.tasksTab.openEngine', 'Open Full Tasks Engine')}</Link>
            </Button>
          </div>

          {equipmentTasks.length > 0 && (
            <Card className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">{t('profile.tasksTab.equipmentTitle', 'Allocated Hardware & Workstation Equipment')}</h3>
                    <p className="text-xs text-muted-foreground">
                      {t('profile.tasksTab.equipmentDesc', 'Asset tracking, dispatch status, and workstation provisioning')}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs font-mono">
                  {t('profile.tasksTab.assetCount', { count: equipmentTasks.length, defaultValue: `${equipmentTasks.length} ${equipmentTasks.length === 1 ? 'Asset' : 'Assets'}` })}
                </Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {equipmentTasks.map((eqItem: any) => {
                  const hw = eqItem.hardwareMetadata || {};
                  return (
                    <div key={eqItem._id} className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{eqItem.title}</p>
                          <p className="text-[11px] text-muted-foreground capitalize">
                            {t('profile.tasksTab.deviceType', { type: hw.deviceType?.replace(/_/g, ' ') || t('profile.tasksTab.hardwareFallback', 'Hardware / Equipment'), defaultValue: `Type: ${hw.deviceType?.replace(/_/g, ' ') || 'Hardware / Equipment'}` })}
                          </p>
                        </div>
                        <Badge
                          variant={hw.deliveryStatus === 'delivered' ? 'default' : 'secondary'}
                          className="text-[10px] capitalize shrink-0"
                        >
                          {hw.deliveryStatus || eqItem.status}
                        </Badge>
                      </div>
                      {(hw.assetTag || hw.serialNumber) && (
                        <div className="flex flex-wrap gap-2 text-[11px] font-mono text-muted-foreground">
                          {hw.assetTag && <span className="bg-background px-1.5 py-0.5 rounded border border-border/60">{t('profile.tasksTab.assetTag', { tag: hw.assetTag, defaultValue: `Asset: ${hw.assetTag}` })}</span>}
                          {hw.serialNumber && <span className="bg-background px-1.5 py-0.5 rounded border border-border/60">{t('profile.tasksTab.serialNumber', { serial: hw.serialNumber, defaultValue: `S/N: ${hw.serialNumber}` })}</span>}
                        </div>
                      )}
                      {hw.trackingNumber && (
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40">
                          <span className="text-muted-foreground">
                            {t('profile.tasksTab.trackingLabel', { number: hw.trackingNumber, defaultValue: `${hw.courierProvider ? `${hw.courierProvider}: ` : 'Tracking: '}${hw.trackingNumber}` })}
                          </span>
                          {hw.trackingUrl && (
                            <a
                              href={hw.trackingUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline flex items-center gap-1 font-semibold"
                            >
                              {t('profile.tasksTab.trackLink', 'Track')} <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <div className="space-y-3">
            {allTasks.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground border border-dashed rounded-2xl bg-card p-8">
                {t('profile.tasksTab.emptyTasks', 'No tasks currently associated with this employee.')}
              </div>
            ) : (
              allTasks.map((taskItem) => {
                const isDone = taskItem.status === 'completed' || taskItem.status === 'verified';
                return (
                  <div
                    key={taskItem._id}
                    className="p-4 rounded-xl border border-border/70 bg-card shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <button
                        onClick={() => handleToggleTaskStatus(taskItem)}
                        className={`mt-0.5 size-5 rounded-md flex items-center justify-center border transition-colors cursor-pointer ${isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border bg-background'
                          }`}
                      >
                        {isDone && <Check className="w-3.5 h-3.5" />}
                      </button>
                      <div className="space-y-1 min-w-0">
                        <p className={`text-sm font-semibold ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {taskItem.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="capitalize px-2 py-0.5 rounded bg-muted font-medium">
                            {t('profile.tasksTab.categoryLabel', { category: taskItem.category?.replace('_', ' '), defaultValue: `Category: ${taskItem.category?.replace('_', ' ')}` })}
                          </span>
                          <span className="capitalize px-2 py-0.5 rounded bg-muted font-medium">
                            {t('profile.tasksTab.stageLabel', { stage: taskItem.stage?.replace('_', ' '), defaultValue: `Stage: ${taskItem.stage?.replace('_', ' ')}` })}
                          </span>
                          {taskItem.dueDate && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {t('profile.tasksTab.dueLabel', { date: new Date(taskItem.dueDate).toLocaleDateString(), defaultValue: `Due ${new Date(taskItem.dueDate).toLocaleDateString()}` })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Badge variant={taskItem.priority === 'critical' ? 'destructive' : 'outline'} className="capitalize text-xs">
                        {taskItem.priority}
                      </Badge>
                      <Badge variant={isDone ? 'default' : 'secondary'} className="capitalize text-xs">
                        {taskItem.status}
                      </Badge>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 4: MILESTONES & EVALUATION DEEP DIVE                     */}
        {/* ============================================================ */}
        <TabsContent value="milestones" className="space-y-6 mt-0">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-foreground">{t('profile.milestonesTab.title', 'Milestone Evaluation Progression')}</h3>
              <p className="text-xs text-muted-foreground">
                {t('profile.milestonesTab.desc', '30, 60, 90, and 180-day probation and performance review records')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(isAdmin || !isOwnProfile) && (
                <Button
                  id="assign-milestone-profile-btn"
                  size="sm"
                  className="rounded-xl text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={() => {
                    if (milestoneTemplates.length > 0 && !selectedTemplateId) {
                      setSelectedTemplateId(milestoneTemplates[0]._id);
                    }
                    setAssignMilestoneOpen(true);
                  }}
                >
                  <Plus className="w-3.5 h-3.5" /> {t('profile.milestonesTab.assignMilestone', 'Assign Milestone')}
                </Button>
              )}
              <Button size="sm" variant="outline" className="rounded-xl text-xs" asChild>
                <Link to="/milestones">{t('profile.milestonesTab.dashboard', 'Milestones Dashboard')}</Link>
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {employeeMilestones.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground border border-dashed rounded-2xl bg-card p-8">
                {t('profile.milestonesTab.empty', 'No milestone evaluations recorded.')}
              </div>
            ) : (
              employeeMilestones.map((m: any) => (
                <Card key={m._id} className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-sm">
                        {t('profile.milestonesTab.dayBadge', { day: m.targetDay, defaultValue: `${m.targetDay}D` })}
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-foreground">{m.milestoneTitle}</h4>
                        <p className="text-xs text-muted-foreground">{t('profile.milestonesTab.dueDate', { date: new Date(m.dueDate).toLocaleDateString(), defaultValue: `Due Date: ${new Date(m.dueDate).toLocaleDateString()}` })}</p>
                      </div>
                    </div>
                    <Badge variant={m.status === 'approved' ? 'default' : 'secondary'} className="capitalize text-xs">
                      {t('profile.milestonesTab.statusLabel', { status: m.status.replace(/_/g, ' '), defaultValue: `Status: ${m.status.replace(/_/g, ' ')}` })}
                    </Badge>
                  </div>

                  {m.goalsProgress && m.goalsProgress.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {t('profile.milestonesTab.goalsProgress', 'Goals & Objectives Progress:')}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {m.goalsProgress.map((g: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-muted/30 border border-border/50">
                            <CheckCircle2 className={`w-4 h-4 shrink-0 ${g.completed ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                            <span className={g.completed ? 'line-through text-muted-foreground' : 'text-foreground'}>
                              {g.goalTitle}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {m.managerFeedback && (
                    <div className="p-3 rounded-xl bg-muted/40 border border-border/60 text-xs space-y-1">
                      <span className="font-semibold text-foreground">{t('profile.milestonesTab.managerFeedback', 'Manager Feedback:')}</span>
                      <p className="text-muted-foreground">{m.managerFeedback}</p>
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>

          {/* Assign Milestone Dialog for this Employee */}
          <Dialog open={assignMilestoneOpen} onOpenChange={setAssignMilestoneOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-indigo-600" />
                  {t('profile.milestonesTab.assignModal.title', { name: employee.name, defaultValue: `Assign Milestone Check-in to ${employee.name}` })}
                </DialogTitle>
                <DialogDescription>
                  {t('profile.milestonesTab.assignModal.desc', 'Assign a structured 30, 60, 90, or 180-day milestone program.')}
                </DialogDescription>
              </DialogHeader>

              <DialogBody className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    {t('profile.milestonesTab.assignModal.templateLabel', 'Milestone Template *')}
                  </label>
                  <select
                    id="profile-assign-milestone-select"
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">{t('profile.milestonesTab.assignModal.selectTemplate', 'Select Milestone Program')}</option>
                    {milestoneTemplates.map((tmpl: any) => (
                      <option key={tmpl._id} value={tmpl._id}>
                        {t('profile.milestonesTab.assignModal.templateOption', { day: tmpl.targetDay, title: tmpl.title, count: tmpl.goals?.length || 0, defaultValue: `Day ${tmpl.targetDay} - ${tmpl.title} (${tmpl.goals?.length || 0} goals)` })}
                      </option>
                    ))}
                  </select>
                </div>

                {(() => {
                  const selTmpl = milestoneTemplates.find((tmpl: any) => tmpl._id === selectedTemplateId);
                  if (!selTmpl) return null;
                  const hireDateObj = employee.hireDate && !isNaN(new Date(employee.hireDate).getTime())
                    ? new Date(employee.hireDate)
                    : new Date();
                  const projectedDueDate = new Date(hireDateObj.getTime() + (selTmpl.targetDay || 30) * 24 * 60 * 60 * 1000);

                  return (
                    <div className="p-3 bg-muted/40 rounded-xl border border-border/60 text-xs space-y-1.5">
                      <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider block">
                        {t('profile.milestonesTab.assignModal.scheduleTitle', 'Calculated Milestone Schedule:')}
                      </span>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{t('profile.milestonesTab.assignModal.hireDate', 'Hire Date:')}</span>
                        <span className="font-medium text-foreground">{hireDateObj.toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{t('profile.milestonesTab.assignModal.targetInterval', 'Target Interval:')}</span>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {t('profile.milestonesTab.assignModal.intervalDays', { days: selTmpl.targetDay, defaultValue: `+${selTmpl.targetDay} Days` })}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-border/50 font-semibold">
                        <span className="text-indigo-600 dark:text-indigo-400">{t('profile.milestonesTab.assignModal.projectedDueDate', 'Projected Due Date:')}</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold">{projectedDueDate.toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })()}
              </DialogBody>

              <DialogFooter>
                <Button variant="outline" onClick={() => setAssignMilestoneOpen(false)}>
                  {t('profile.milestonesTab.assignModal.cancel', 'Cancel')}
                </Button>
                <Button
                  id="confirm-assign-milestone-profile-btn"
                  disabled={assignMilestoneMutation.isPending || !selectedTemplateId}
                  onClick={handleAssignMilestoneToEmployee}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                >
                  {assignMilestoneMutation.isPending ? t('profile.milestonesTab.assignModal.assigning', 'Assigning...') : t('profile.milestonesTab.assignModal.confirm', 'Confirm Assignment')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 5: AUDIT ACTIVITY & MESSAGES LOG                         */}
        {/* ============================================================ */}
        <TabsContent value="activity" className="space-y-6 mt-0">
          <div>
            <h3 className="text-base font-bold text-foreground">{t('profile.activityTab.title', 'Audit Log & Communication Thread')}</h3>
            <p className="text-xs text-muted-foreground">
              {t('profile.activityTab.desc', 'Comprehensive chronological events, automated status transitions, and notes')}
            </p>
          </div>

          <div className="space-y-3">
            {combinedActivityFeed.map((item) => (
              <div key={item.id} className="p-4 rounded-xl border border-border/70 bg-card shadow-sm space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">{item.title}</span>
                    {item.badge && (
                      <Badge variant={item.badgeVariant || 'outline'} className="text-[10px] font-bold">
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{item.timestamp}</span>
                </div>
                <p className="text-xs text-muted-foreground">{item.message}</p>
                <div className="pt-1 text-[10px] text-muted-foreground/70">{t('profile.activityTab.source', { author: item.author, defaultValue: `Source: ${item.author}` })}</div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* ============================================================ */}
      {/* MODALS & DIALOGS                                            */}
      {/* ============================================================ */}

      {/* 1. Self Edit Profile Modal */}
      <Dialog open={editSelfOpen} onOpenChange={setEditSelfOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{t('profile.modals.editSelf.title', 'Edit Profile Details')}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {t('profile.modals.editSelf.desc', 'Update your personal contact details and regional preferences.')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSelf} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <DialogBody className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold mb-1 block">{t('profile.modals.editSelf.firstName', 'First Name')}</Label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="text-xs" />
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1 block">{t('profile.modals.editSelf.lastName', 'Last Name')}</Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required className="text-xs" />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">{t('profile.modals.editSelf.phone', 'Phone Number')}</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" className="text-xs" />
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">{t('profile.modals.editSelf.location', 'Location')}</Label>
                <Input value={locationVal} onChange={(e) => setLocationVal(e.target.value)} placeholder={t('profile.modals.editSelf.locationPlaceholder', 'e.g. San Francisco, CA')} className="text-xs" />
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">{t('profile.modals.editSelf.timezone', 'Timezone')}</Label>
                <Input value={timezoneVal} onChange={(e) => setTimezoneVal(e.target.value)} placeholder={t('profile.modals.editSelf.timezonePlaceholder', 'e.g. America/Los_Angeles')} className="text-xs" />
              </div>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditSelfOpen(false)}>
                {t('profile.modals.editSelf.cancel', 'Cancel')}
              </Button>
              <Button type="submit" size="sm" disabled={updateSelfMutation.isPending}>
                {updateSelfMutation.isPending ? t('profile.modals.editSelf.saving', 'Saving...') : t('profile.modals.editSelf.save', 'Save Changes')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. Change Password Modal */}
      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{t('profile.modals.changePassword.title', 'Change Password')}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {t('profile.modals.changePassword.desc', 'Ensure your account is protected with a strong, unique password.')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleChangePassword} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <DialogBody className="space-y-4 text-xs">
              <div>
                <Label className="text-xs font-semibold mb-1 block">{t('profile.modals.changePassword.currentPassword', 'Current Password')}</Label>
                <Input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required className="text-xs" />
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">{t('profile.modals.changePassword.newPassword', 'New Password')}</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} className="text-xs" />
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">{t('profile.modals.changePassword.confirmPassword', 'Confirm New Password')}</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} className="text-xs" />
              </div>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setChangePasswordOpen(false)}>
                {t('profile.modals.changePassword.cancel', 'Cancel')}
              </Button>
              <Button type="submit" size="sm" disabled={changePasswordMutation.isPending}>
                {changePasswordMutation.isPending ? t('profile.modals.changePassword.updating', 'Updating...') : t('profile.modals.changePassword.update', 'Update Password')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 3. Admin Manage Account Modal */}
      <Dialog open={editEmployeeOpen} onOpenChange={setEditEmployeeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{t('profile.modals.manageEmployee.title', 'Manage Employee Account')}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {t('profile.modals.manageEmployee.desc', 'Administrative configuration of roles, departmental hierarchy, and employment status.')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEmployee} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <DialogBody className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold mb-1 block">{t('profile.modals.manageEmployee.firstName', 'First Name')}</Label>
                  <Input value={adminFirstName} onChange={(e) => setAdminFirstName(e.target.value)} required className="text-xs" />
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1 block">{t('profile.modals.manageEmployee.lastName', 'Last Name')}</Label>
                  <Input value={adminLastName} onChange={(e) => setAdminLastName(e.target.value)} required className="text-xs" />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">{t('profile.modals.manageEmployee.designation', 'Designation / Title')}</Label>
                <Input value={adminDesignation} onChange={(e) => setAdminDesignation(e.target.value)} placeholder={t('profile.modals.manageEmployee.designationPlaceholder', 'e.g. Senior Frontend Engineer')} className="text-xs" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold mb-1 block">{t('profile.modals.manageEmployee.department', 'Department')}</Label>
                  <select
                    value={adminDeptId}
                    onChange={(e) => setAdminDeptId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">{t('profile.modals.manageEmployee.selectDept', 'Select Department')}</option>
                    {activeDepartments.map((dept) => (
                      <option key={dept._id} value={dept._id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1 block">{t('profile.modals.manageEmployee.primaryRole', 'Primary System Role')}</Label>
                  <select
                    value={adminRole}
                    onChange={(e) => setAdminRole(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="hr_admin">HR Administrator</option>
                    <option value="it_admin">IT Administrator</option>
                    <option value="admin">Administrator</option>
                    <option value="owner">Organization Owner</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold mb-1 block">{t('profile.modals.manageEmployee.employmentStatus', 'Employment Status')}</Label>
                  <select
                    value={adminStatus}
                    onChange={(e) => setAdminStatus(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="active">Active</option>
                    <option value="onboarding">Onboarding</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1 block">{t('profile.modals.manageEmployee.payrollCategory', 'Payroll Category')}</Label>
                  <Input value={adminPayrollCategory} onChange={(e) => setAdminPayrollCategory(e.target.value)} placeholder={t('profile.modals.manageEmployee.payrollPlaceholder', 'e.g. Salaried W2, Exempt')} className="text-xs" />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">{t('profile.modals.manageEmployee.hireDate', 'Hire / Effective Date')}</Label>
                <Input type="date" value={adminHireDate} onChange={(e) => setAdminHireDate(e.target.value)} className="text-xs" />
              </div>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditEmployeeOpen(false)}>
                {t('profile.modals.manageEmployee.cancel', 'Cancel')}
              </Button>
              <Button type="submit" size="sm" disabled={updateEmployeeMutation.isPending}>
                {updateEmployeeMutation.isPending ? t('profile.modals.manageEmployee.saving', 'Saving...') : t('profile.modals.manageEmployee.save', 'Save Account Settings')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 4. Statutory Legal Hold (SOC-2 CC6.1) Modal */}
      <Dialog open={legalHoldModalOpen} onOpenChange={setLegalHoldModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  {employee.legalHold ? t('profile.modals.legalHold.titleManage', 'Manage Statutory Legal Hold') : t('profile.modals.legalHold.titlePlace', 'Place Statutory Legal Hold')}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {t('profile.modals.legalHold.desc', 'SOC 2 CC6.1 / FINRA document preservation and audit freeze')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <DialogBody className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1">
              <p className="font-semibold text-foreground">{t('profile.modals.legalHold.targetEmployee', { name: employee.name, defaultValue: `Target Employee: ${employee.name}` })}</p>
              <p className="text-muted-foreground">
                {t('profile.modals.legalHold.currentStatus', 'Current Status:')}{' '}
                <span className={employee.legalHold ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
                  {employee.legalHold ? t('profile.modals.legalHold.activeHold', 'Active Hold') : t('profile.modals.legalHold.standardRetention', 'Standard Retention')}
                </span>
              </p>
            </div>

            <div>
              <Label className="text-xs font-semibold mb-1 block">
                {t('profile.modals.legalHold.justificationLabel', 'Statutory Justification & Matter Reference *')}
              </Label>
              <textarea
                value={legalHoldReason}
                onChange={(e) => setLegalHoldReason(e.target.value)}
                placeholder={t('profile.modals.legalHold.justificationPlaceholder', 'e.g. Audit preservation for Q3 SEC compliance review or ongoing litigation hold...')}
                rows={3}
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
              <p className="text-[10px] text-muted-foreground mt-1">{t('profile.modals.legalHold.minCharsNote', 'Must be at least 10 characters for audit logs.')}</p>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setLegalHoldModalOpen(false)}>
              {t('profile.modals.legalHold.cancel', 'Cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={employee.legalHold ? 'outline' : 'destructive'}
              onClick={handleToggleLegalHold}
              disabled={isUpdatingHold}
            >
              {isUpdatingHold ? t('profile.modals.legalHold.processing', 'Processing...') : employee.legalHold ? t('profile.modals.legalHold.release', 'Release Legal Hold') : t('profile.modals.legalHold.confirm', 'Confirm Legal Hold')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
