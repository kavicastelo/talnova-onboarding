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
  DialogFooter,
} from '../components/Dialog';
import { SearchableSelect } from '../components/SearchableSelect';
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
    directTasks.forEach((t) => map.set(t._id, t));
    myTasks.forEach((t) => map.set(t._id, t));
    return Array.from(map.values());
  }, [employeeTasksData, myAssignedTasksData, isOwnProfile]);

  const equipmentTasks = useMemo(() => {
    return allTasks.filter((t: any) => t.hardwareMetadata || t.category === 'equipment' || t.category === 'it_setup');
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
      toast.error('Please select a milestone template.');
      return;
    }
    assignMilestoneMutation.mutate(
      { templateId: selectedTemplateId, employeeId: employeeMongoId },
      {
        onSuccess: () => {
          toast.success('Milestone program successfully assigned to employee!');
          setAssignMilestoneOpen(false);
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to assign milestone');
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

      const matchedDept = activeDepartments.find((d) => d.name === employee.department);
      setAdminDeptId(matchedDept?._id || '');
      setAdminRole(
        (employee.role === 'owner' || employee.role === 'admin' || employee.role === 'manager' || employee.role === 'employee' || (employee.role as string) === 'hr_admin' || (employee.role as string) === 'it_admin'
          ? employee.role
          : 'employee') as any
      );
      setAdminRoles(Array.isArray(employee.roles) && employee.roles.length > 0 ? employee.roles : [employee.role]);
      setAdminStatus(
        employee.status === 'Active' ? 'active' : employee.status === 'Onboarding' ? 'onboarding' : 'inactive'
      );
      setAdminDesignation(employee.designation || '');
      setAdminPayrollCategory(employee.payrollCategory || '');

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
    const toastId = toast.loading('Uploading profile picture...');

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

      toast.success('Avatar updated successfully.', { id: toastId });
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
      toast.success('Profile details updated successfully.');
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
      toast.error('New passwords do not match.');
      return;
    }
    try {
      await changePasswordMutation.mutateAsync({
        oldPassword,
        newPassword,
      });
      toast.success('Password changed successfully.');
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
      toast.success('Employee account updated successfully.');
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
      toast.error('Audit Compliance Error: Legal hold justification must be at least 10 characters.');
      return;
    }

    setIsUpdatingHold(true);
    try {
      const targetState = !employee.legalHold;
      const res = await employeeService.setLegalHold(employee.id, {
        legalHold: targetState,
        reason: legalHoldReason.trim(),
      });
      toast.success(res.message || `Legal hold ${targetState ? 'placed' : 'released'} successfully.`);
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
      toast.success(nextStatus === 'completed' ? `Completed: "${task.title}"` : `Reopened: "${task.title}"`);
      refetchTasks();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to update task');
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
          ? 'Welcome & Encouragement'
          : noteCategory === 'guidance'
            ? 'Onboarding Guidance'
            : noteCategory === 'kudos'
              ? 'Kudos & Recognition'
              : 'Action Required Note',
      message: customNote.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }),
      badge: noteCategory.replace('_', ' ').toUpperCase(),
      badgeVariant: noteCategory === 'action_required' ? 'destructive' : 'secondary',
    };

    const updated = [newItem, ...persistedFeed];
    setPersistedFeed(updated);
    try {
      localStorage.setItem(`talnova_profile_feed_${employeeMongoId}`, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to persist note', e);
    }

    setCustomNote('');
    toast.success('Note added to employee activity feed.');
  };

  // Filter Tasks
  const filteredTasks = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return allTasks.filter((t) => {
      const isCompleted = t.status === 'completed' || t.status === 'verified';
      const isDueToday = t.dueDate && t.dueDate.startsWith(todayStr);
      const isOverdue = t.status === 'overdue' || (t.dueDate && t.dueDate < todayStr && !isCompleted);

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

    allTasks.forEach((t) => {
      const isCompleted = t.status === 'completed' || t.status === 'verified';
      const isDueToday = t.dueDate && t.dueDate.startsWith(todayStr);
      const isOverdue = t.status === 'overdue' || (t.dueDate && t.dueDate < todayStr && !isCompleted);

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
      .filter((t) => t.status === 'completed' || t.status === 'verified')
      .slice(0, 5)
      .forEach((t) => {
        items.push({
          id: `task-${t._id}`,
          type: 'task',
          author: t.assignedToUserId?.profile?.firstName || 'System',
          title: `Task Completed: ${t.title}`,
          message: `Category: ${t.category}. Priority: ${t.priority}. Stage: ${t.stage}.`,
          timestamp: t.completedAt ? new Date(t.completedAt).toLocaleDateString() : 'Recently',
          badge: t.requiresVerification ? 'VERIFIED' : 'DONE',
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
      toast.success('Profile URL copied to clipboard');
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
        <h2 className="text-xl font-bold text-foreground">Employee Profile Not Found</h2>
        <p className="text-sm text-muted-foreground">
          {(error as any)?.message || 'The requested employee profile could not be retrieved.'}
        </p>
        <Button onClick={() => refetch()} className="mx-auto">
          <RefreshCw className="mr-2 h-4 w-4" /> Retry
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
                {isOwnProfile ? 'My Unified Onboarding Hub' : `${employee.name}'s Profile`}
              </h1>
              {employee.employeeId && (
                <span className="px-2 py-0.5 rounded-md font-mono text-[10px] bg-muted text-muted-foreground border border-border/70">
                  ID: {employee.employeeId}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Single-window operational view, journey progression, checklists & peer collaboration.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={copyProfileLink} className="rounded-xl text-xs flex items-center gap-1.5">
            <Share2 className="h-3.5 w-3.5" />
            Share Profile
          </Button>
          {isOwnProfile ? (
            <Button onClick={() => setEditSelfOpen(true)} size="sm" className="rounded-xl text-xs flex items-center gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              Edit My Profile
            </Button>
          ) : isAdmin ? (
            <Button onClick={() => setEditEmployeeOpen(true)} size="sm" className="rounded-xl text-xs flex items-center gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              Manage Account
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
                title={isOwnProfile ? 'Click to change profile picture' : undefined}
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
                        <span className="text-[9px] font-semibold">Change Photo</span>
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
                      <Scale className="w-3 h-3" /> STATUTORY LEGAL HOLD
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
                      Joined {employee.hireDate}
                    </span>
                  )}
                  {employee.payrollCategory && (
                    <span className="px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground text-[10px] font-semibold border border-border/60">
                      Payroll: {employee.payrollCategory}
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
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" /> Change Password
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/employee')}
                    className="rounded-xl text-xs w-full justify-start gap-2"
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-primary" /> Employee Dashboard
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
                    <MessageSquare className="w-3.5 h-3.5" /> Send Quick Note
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
                      {employee.legalHold ? 'Manage Legal Hold' : 'Place Legal Hold'}
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
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Readiness</span>
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
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Journeys</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2 text-foreground">
            {employee.completedJourneysCount || 0}
            <span className="text-xs font-normal text-muted-foreground"> / {employee.assignedJourneys?.length || 1} Completed</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 truncate">
            {primaryJourney ? primaryJourney.title : 'Standard Track'}
          </p>
        </Card>

        {/* Operational Tasks */}
        <Card className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Checklists</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2 text-foreground">
            {taskCounts.completedCount}
            <span className="text-xs font-normal text-muted-foreground"> / {taskCounts.total} Done</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {taskCounts.dueCount > 0 ? (
              <span className="text-amber-600 font-semibold">{taskCounts.dueCount} Urgent Due</span>
            ) : (
              'All checklists on track'
            )}
          </p>
        </Card>

        {/* Next Milestone */}
        <Card className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Milestones</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2 text-foreground">
            {employeeMilestones.length > 0 ? `${employeeMilestones[0].targetDay}D` : '30D'}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 truncate">
            {employeeMilestones.length > 0 ? employeeMilestones[0].milestoneTitle : '30-Day Checkpoint'}
          </p>
        </Card>
      </div>

      {/* Main Single-Window Modular Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/60 p-1 rounded-xl border border-border/60">
          <TabsTrigger value="overview" className="rounded-lg text-xs font-medium gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Unified Hub
          </TabsTrigger>
          <TabsTrigger value="journeys" className="rounded-lg text-xs font-medium gap-1.5">
            <GraduationCap className="w-3.5 h-3.5" /> Journeys ({employee.assignedJourneys?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="tasks" className="rounded-lg text-xs font-medium gap-1.5">
            <CheckSquare className="w-3.5 h-3.5" /> Tasks & Checklists ({taskCounts.total})
          </TabsTrigger>
          <TabsTrigger value="milestones" className="rounded-lg text-xs font-medium gap-1.5">
            <Flag className="w-3.5 h-3.5" /> Milestones ({employeeMilestones.length})
          </TabsTrigger>
          <TabsTrigger value="activity" className="rounded-lg text-xs font-medium gap-1.5">
            <Activity className="w-3.5 h-3.5" /> Activity & Comms
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
                      <h3 className="text-base font-bold text-foreground">Onboarding Journey Pathway</h3>
                      <p className="text-xs text-muted-foreground">
                        Structured curriculum & autonomous progression pipeline
                      </p>
                    </div>
                  </div>
                  {primaryJourney && (
                    <Button variant="outline" size="sm" className="rounded-xl text-xs" asChild>
                      <Link to={`/course/${primaryJourney.id}`}>
                        Resume Journey <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </Link>
                    </Button>
                  )}
                </div>

                {/* Pathway Stage Bar */}
                <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-foreground">
                      {primaryJourney ? primaryJourney.title : 'General Company Onboarding'}
                    </span>
                    <span className="font-bold text-primary">{employee.progress}% Complete</span>
                  </div>
                  <Progress value={employee.progress} className="h-2 rounded-full" />

                  {/* Visual Stage Nodes */}
                  <div className="grid grid-cols-4 gap-2 pt-2">
                    {[
                      { label: 'Pre-Boarding', done: employee.progress >= 25, active: employee.progress < 25 },
                      { label: 'Day 1 Welcome', done: employee.progress >= 50, active: employee.progress >= 25 && employee.progress < 50 },
                      { label: 'Week 1 Immersion', done: employee.progress >= 75, active: employee.progress >= 50 && employee.progress < 75 },
                      { label: 'Month 1 Autonomy', done: employee.progress >= 100, active: employee.progress >= 75 },
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
                      <h3 className="text-base font-bold text-foreground">Tasks & Role Checklists Hub</h3>
                      <p className="text-xs text-muted-foreground">
                        Interactive operational checklist items with real-time sync
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
                      All ({taskCounts.total})
                    </button>
                    <button
                      onClick={() => setTaskFilter('due')}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${taskFilter === 'due' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      Urgent ({taskCounts.dueCount})
                    </button>
                    <button
                      onClick={() => setTaskFilter('upcoming')}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${taskFilter === 'upcoming' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      Upcoming ({taskCounts.upcomingCount})
                    </button>
                    <button
                      onClick={() => setTaskFilter('completed')}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${taskFilter === 'completed' ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      Done ({taskCounts.completedCount})
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
                      No tasks found for the current filter.
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
                              title={isDone ? 'Mark task pending' : 'Mark task complete'}
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
                                    Stage: {task.stage.replace('_', ' ')}
                                  </span>
                                )}
                                {task.dueDate && (
                                  <span className="flex items-center gap-1 text-muted-foreground">
                                    <Clock className="w-2.5 h-2.5" /> Due {new Date(task.dueDate).toLocaleDateString()}
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
                        View all {allTasks.length} tasks in detail tab <ChevronRight className="w-3.5 h-3.5 ml-1" />
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
                      <h3 className="text-base font-bold text-foreground">30 / 60 / 90 / 180-Day Milestones</h3>
                      <p className="text-xs text-muted-foreground">
                        Formal evaluation gates and SLA compliance reviews
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-xl text-xs" asChild>
                    <Link to="/milestones">
                      Milestones Page <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Link>
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {employeeMilestones.length === 0 ? (
                    <div className="col-span-2 py-6 text-center border border-dashed rounded-xl bg-muted/20 text-xs text-muted-foreground">
                      No active milestone evaluations assigned. Default milestones will automatically seed upon Day 30.
                    </div>
                  ) : (
                    employeeMilestones.slice(0, 4).map((m: any) => (
                      <div
                        key={m._id}
                        className="p-4 rounded-xl border border-border/70 bg-muted/30 hover:border-purple-500/40 transition-colors space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-[10px]">
                            DAY {m.targetDay} GATE
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
                          <span>Due: {new Date(m.dueDate).toLocaleDateString()}</span>
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
                    <h3 className="text-sm font-bold text-foreground">Onboarding Buddy</h3>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2" asChild>
                    <Link to="/buddy">View Program</Link>
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
                          <CheckCircle2 className="w-3 h-3" /> Algorithmic Match 94%
                        </span>
                      </div>
                    </div>

                    {/* Buddy Quick Actions */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {matchedBuddyAssignment.buddyUserId.auth?.email && (
                        <Button variant="outline" size="sm" className="rounded-xl text-xs" asChild>
                          <a href={`mailto:${matchedBuddyAssignment.buddyUserId.auth.email}?subject=Hello from ${employee.name}`}>
                            <Mail className="w-3.5 h-3.5 mr-1" /> Send Email
                          </a>
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="rounded-xl text-xs" asChild>
                        <Link to="/calendar">
                          <CalendarCheck className="w-3.5 h-3.5 mr-1" /> Book 1:1
                        </Link>
                      </Button>
                    </div>

                    {/* Mentorship Check-in Progress */}
                    {matchedBuddyAssignment.checklist && matchedBuddyAssignment.checklist.length > 0 && (
                      <div className="p-3 rounded-xl bg-muted/40 border border-border/60 text-xs space-y-1.5">
                        <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
                          <span>Buddy Checklist Progress</span>
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
                      <p className="text-xs font-semibold text-foreground">No Buddy Paired Yet</p>
                      <p className="text-[11px] text-muted-foreground">
                        Matching engine evaluates timezone, department, and role compatibility.
                      </p>
                    </div>
                    {isAdmin && (
                      <Button size="sm" className="rounded-xl text-xs" asChild>
                        <Link to="/buddy">Pair a Mentor</Link>
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
                    <h3 className="text-sm font-bold text-foreground">Activity & Direct Comms</h3>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-semibold">Live Audit</span>
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
                          ? 'Add a personal note or reflection on your onboarding progress...'
                          : `Send an encouraging note or guidance to ${employee.name}...`
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
                      <option value="encouragement">Encouragement</option>
                      <option value="guidance">Guidance Note</option>
                      <option value="kudos">Kudos / Praise</option>
                      <option value="action_required">Action Required</option>
                    </select>

                    <Button type="submit" size="sm" disabled={!customNote.trim()} className="h-8 px-3 rounded-lg text-xs gap-1">
                      <Send className="w-3 h-3" /> Post Note
                    </Button>
                  </div>
                </form>

                {/* Recent Feed Events */}
                <div className="space-y-3 pt-2 max-h-72 overflow-y-auto pr-1">
                  {combinedActivityFeed.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-4">No recent activity logged.</p>
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
                      SOC 2 CC6.1 Statutory Retention
                    </h4>
                  </div>
                  <Badge
                    variant={employee.legalHold ? 'destructive' : 'outline'}
                    className="text-[10px] font-bold"
                  >
                    {employee.legalHold ? 'LEGAL HOLD ACTIVE' : 'STANDARD 7-YR RETENTION'}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {employee.legalHold
                    ? `Indefinite retention freeze active: "${employee.legalHoldReason || 'Statutory litigation hold'}". Purge triggers suspended.`
                    : 'All signed onboarding agreements, e-signature logs, and task audit trails are preserved per statutory guidelines.'}
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
                    {employee.legalHold ? 'Manage Legal Hold Justification' : 'Place Regulatory Legal Hold'}
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
              <h3 className="text-base font-bold text-foreground">Assigned Onboarding Journeys</h3>
              <p className="text-xs text-muted-foreground">
                Formal role-based tracks and interactive modular coursework
              </p>
            </div>
            <Button size="sm" className="rounded-xl text-xs" asChild>
              <Link to="/journeys">Browse Journeys Catalog</Link>
            </Button>
          </div>

          {!employee.assignedJourneys || employee.assignedJourneys.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground border border-dashed rounded-2xl bg-card p-8 space-y-2">
              <GraduationCap className="size-10 text-muted-foreground/40 mx-auto" />
              <p className="font-semibold text-sm text-foreground">No Journeys Currently Assigned</p>
              <p className="text-xs text-muted-foreground">
                Browse the catalog to enroll or apply an automated workflow rule.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {employee.assignedJourneys.map((aj: any) => (
                <Card key={aj.id} className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-bold text-base text-foreground">{aj.title}</h4>
                      <p className="text-xs text-muted-foreground">Assigned {aj.assignedAt || 'During Onboarding'}</p>
                    </div>
                    <Badge variant={aj.status === 'Completed' ? 'default' : 'secondary'} className="capitalize text-xs">
                      {aj.status}
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-foreground">
                      <span>Curriculum Progression</span>
                      <span>{aj.progress}%</span>
                    </div>
                    <Progress value={aj.progress} className="h-2 rounded-full" />
                  </div>

                  <div className="pt-2">
                    {aj.status === 'Completed' ? (
                      <Button variant="outline" size="sm" className="w-full rounded-xl text-xs" asChild>
                        <Link to="/certificates">
                          <Award className="w-3.5 h-3.5 mr-1 text-amber-500" /> View Issued Certificate
                        </Link>
                      </Button>
                    ) : (
                      <Button size="sm" className="w-full rounded-xl text-xs" asChild>
                        <Link to={`/course/${aj.id}`}>
                          Continue Coursework <ChevronRight className="w-3.5 h-3.5 ml-1" />
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
              <h3 className="text-base font-bold text-foreground">Complete Task Roster</h3>
              <p className="text-xs text-muted-foreground">
                All pre-boarding, IT provisioning, and departmental tasks for {employee.name}
              </p>
            </div>
            <Button size="sm" className="rounded-xl text-xs" asChild>
              <Link to="/tasks">Open Full Tasks Engine</Link>
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
                    <h3 className="text-base font-bold text-foreground">Allocated Hardware & Workstation Equipment</h3>
                    <p className="text-xs text-muted-foreground">
                      Asset tracking, dispatch status, and workstation provisioning
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs font-mono">
                  {equipmentTasks.length} {equipmentTasks.length === 1 ? 'Asset' : 'Assets'}
                </Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {equipmentTasks.map((t: any) => {
                  const hw = t.hardwareMetadata || {};
                  return (
                    <div key={t._id} className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{t.title}</p>
                          <p className="text-[11px] text-muted-foreground capitalize">
                            Type: {hw.deviceType?.replace(/_/g, ' ') || 'Hardware / Equipment'}
                          </p>
                        </div>
                        <Badge
                          variant={hw.deliveryStatus === 'delivered' ? 'default' : 'secondary'}
                          className="text-[10px] capitalize shrink-0"
                        >
                          {hw.deliveryStatus || t.status}
                        </Badge>
                      </div>
                      {(hw.assetTag || hw.serialNumber) && (
                        <div className="flex flex-wrap gap-2 text-[11px] font-mono text-muted-foreground">
                          {hw.assetTag && <span className="bg-background px-1.5 py-0.5 rounded border border-border/60">Asset: {hw.assetTag}</span>}
                          {hw.serialNumber && <span className="bg-background px-1.5 py-0.5 rounded border border-border/60">S/N: {hw.serialNumber}</span>}
                        </div>
                      )}
                      {hw.trackingNumber && (
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40">
                          <span className="text-muted-foreground">
                            {hw.courierProvider ? `${hw.courierProvider}: ` : 'Tracking: '}{hw.trackingNumber}
                          </span>
                          {hw.trackingUrl && (
                            <a
                              href={hw.trackingUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline flex items-center gap-1 font-semibold"
                            >
                              Track <ExternalLink className="w-3 h-3" />
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
                No tasks currently associated with this employee.
              </div>
            ) : (
              allTasks.map((t) => {
                const isDone = t.status === 'completed' || t.status === 'verified';
                return (
                  <div
                    key={t._id}
                    className="p-4 rounded-xl border border-border/70 bg-card shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <button
                        onClick={() => handleToggleTaskStatus(t)}
                        className={`mt-0.5 size-5 rounded-md flex items-center justify-center border transition-colors cursor-pointer ${isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border bg-background'
                          }`}
                      >
                        {isDone && <Check className="w-3.5 h-3.5" />}
                      </button>
                      <div className="space-y-1 min-w-0">
                        <p className={`text-sm font-semibold ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {t.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="capitalize px-2 py-0.5 rounded bg-muted font-medium">
                            Category: {t.category?.replace('_', ' ')}
                          </span>
                          <span className="capitalize px-2 py-0.5 rounded bg-muted font-medium">
                            Stage: {t.stage?.replace('_', ' ')}
                          </span>
                          {t.dueDate && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Due {new Date(t.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Badge variant={t.priority === 'critical' ? 'destructive' : 'outline'} className="capitalize text-xs">
                        {t.priority}
                      </Badge>
                      <Badge variant={isDone ? 'default' : 'secondary'} className="capitalize text-xs">
                        {t.status}
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
              <h3 className="text-base font-bold text-foreground">Milestone Evaluation Progression</h3>
              <p className="text-xs text-muted-foreground">
                30, 60, 90, and 180-day probation and performance review records
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
                  <Plus className="w-3.5 h-3.5" /> Assign Milestone
                </Button>
              )}
              <Button size="sm" variant="outline" className="rounded-xl text-xs" asChild>
                <Link to="/milestones">Milestones Dashboard</Link>
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {employeeMilestones.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground border border-dashed rounded-2xl bg-card p-8">
                No milestone evaluations recorded.
              </div>
            ) : (
              employeeMilestones.map((m: any) => (
                <Card key={m._id} className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-sm">
                        {m.targetDay}D
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-foreground">{m.milestoneTitle}</h4>
                        <p className="text-xs text-muted-foreground">Due Date: {new Date(m.dueDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <Badge variant={m.status === 'approved' ? 'default' : 'secondary'} className="capitalize text-xs">
                      Status: {m.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>

                  {m.goalsProgress && m.goalsProgress.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Goals & Objectives Progress:
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
                      <span className="font-semibold text-foreground">Manager Feedback:</span>
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
                  Assign Milestone Check-in to {employee.name}
                </DialogTitle>
                <DialogDescription>
                  Assign a structured 30, 60, 90, or 180-day milestone program.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Milestone Template *
                  </label>
                  <select
                    id="profile-assign-milestone-select"
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Milestone Program</option>
                    {milestoneTemplates.map((t: any) => (
                      <option key={t._id} value={t._id}>
                        Day {t.targetDay} - {t.title} ({t.goals?.length || 0} goals)
                      </option>
                    ))}
                  </select>
                </div>

                {(() => {
                  const selTmpl = milestoneTemplates.find((t: any) => t._id === selectedTemplateId);
                  if (!selTmpl) return null;
                  const hireDateObj = employee.hireDate && !isNaN(new Date(employee.hireDate).getTime())
                    ? new Date(employee.hireDate)
                    : new Date();
                  const projectedDueDate = new Date(hireDateObj.getTime() + (selTmpl.targetDay || 30) * 24 * 60 * 60 * 1000);

                  return (
                    <div className="p-3 bg-muted/40 rounded-xl border border-border/60 text-xs space-y-1.5">
                      <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider block">
                        Calculated Milestone Schedule:
                      </span>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Hire Date:</span>
                        <span className="font-medium text-foreground">{hireDateObj.toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Target Interval:</span>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          +{selTmpl.targetDay} Days
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-border/50 font-semibold">
                        <span className="text-indigo-600 dark:text-indigo-400">Projected Due Date:</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold">{projectedDueDate.toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <DialogFooter className="pt-3 border-t">
                <Button variant="outline" onClick={() => setAssignMilestoneOpen(false)}>
                  Cancel
                </Button>
                <Button
                  id="confirm-assign-milestone-profile-btn"
                  disabled={assignMilestoneMutation.isPending || !selectedTemplateId}
                  onClick={handleAssignMilestoneToEmployee}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                >
                  {assignMilestoneMutation.isPending ? 'Assigning...' : 'Confirm Assignment'}
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
            <h3 className="text-base font-bold text-foreground">Audit Log & Communication Thread</h3>
            <p className="text-xs text-muted-foreground">
              Comprehensive chronological events, automated status transitions, and notes
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
                <div className="pt-1 text-[10px] text-muted-foreground/70">Source: {item.author}</div>
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
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border/60 bg-card">
            <DialogTitle className="text-lg font-bold">Edit Profile Details</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Update your personal contact details and regional preferences.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSelf} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto max-h-[calc(85vh-140px)] text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold mb-1 block">First Name</Label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="text-xs" />
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1 block">Last Name</Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required className="text-xs" />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">Phone Number</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" className="text-xs" />
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">Location</Label>
                <Input value={locationVal} onChange={(e) => setLocationVal(e.target.value)} placeholder="e.g. San Francisco, CA" className="text-xs" />
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">Timezone</Label>
                <Input value={timezoneVal} onChange={(e) => setTimezoneVal(e.target.value)} placeholder="e.g. America/Los_Angeles" className="text-xs" />
              </div>
            </div>

            <DialogFooter className="p-4 sm:px-6 border-t border-border/60 bg-muted/30">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditSelfOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={updateSelfMutation.isPending}>
                {updateSelfMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. Change Password Modal */}
      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border/60 bg-card">
            <DialogTitle className="text-lg font-bold">Change Password</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Ensure your account is protected with a strong, unique password.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleChangePassword} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-5 sm:p-6 space-y-4 text-xs">
              <div>
                <Label className="text-xs font-semibold mb-1 block">Current Password</Label>
                <Input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required className="text-xs" />
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">New Password</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} className="text-xs" />
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">Confirm New Password</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} className="text-xs" />
              </div>
            </div>

            <DialogFooter className="p-4 sm:px-6 border-t border-border/60 bg-muted/30">
              <Button type="button" variant="outline" size="sm" onClick={() => setChangePasswordOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={changePasswordMutation.isPending}>
                {changePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 3. Admin Manage Account Modal */}
      <Dialog open={editEmployeeOpen} onOpenChange={setEditEmployeeOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border/60 bg-card">
            <DialogTitle className="text-lg font-bold">Manage Employee Account</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Administrative configuration of roles, departmental hierarchy, and employment status.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEmployee} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto max-h-[calc(85vh-140px)] text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold mb-1 block">First Name</Label>
                  <Input value={adminFirstName} onChange={(e) => setAdminFirstName(e.target.value)} required className="text-xs" />
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1 block">Last Name</Label>
                  <Input value={adminLastName} onChange={(e) => setAdminLastName(e.target.value)} required className="text-xs" />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">Designation / Title</Label>
                <Input value={adminDesignation} onChange={(e) => setAdminDesignation(e.target.value)} placeholder="e.g. Senior Frontend Engineer" className="text-xs" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold mb-1 block">Department</Label>
                  <SearchableSelect
                    value={adminDeptId}
                    onChange={setAdminDeptId}
                    placeholder="Select department..."
                    searchPlaceholder="Search department..."
                    options={activeDepartments.map((d) => ({
                      value: d._id,
                      label: d.name,
                    }))}
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold mb-1 block">System Role</Label>
                  <select
                    value={adminRole}
                    onChange={(e: any) => setAdminRole(e.target.value)}
                    className="w-full h-9 px-2.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
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

              {/* Multi-Role Privilege Checkboxes */}
              <div className="space-y-2 p-3 rounded-xl border bg-muted/20">
                <Label className="text-xs font-semibold block">Additional Functional Roles</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={adminRoles.includes('it_admin') || adminRole === 'it_admin'}
                      disabled={adminRole === 'it_admin'}
                      onChange={() =>
                        setAdminRoles((prev) =>
                          prev.includes('it_admin') ? prev.filter((r) => r !== 'it_admin') : [...prev, 'it_admin']
                        )
                      }
                      className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    <span>IT Admin</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={adminRoles.includes('hr_admin') || adminRole === 'hr_admin'}
                      disabled={adminRole === 'hr_admin'}
                      onChange={() =>
                        setAdminRoles((prev) =>
                          prev.includes('hr_admin') ? prev.filter((r) => r !== 'hr_admin') : [...prev, 'hr_admin']
                        )
                      }
                      className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    <span>HR Admin</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={adminRoles.includes('manager') || adminRole === 'manager'}
                      disabled={adminRole === 'manager'}
                      onChange={() =>
                        setAdminRoles((prev) =>
                          prev.includes('manager') ? prev.filter((r) => r !== 'manager') : [...prev, 'manager']
                        )
                      }
                      className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    <span>Manager</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold mb-1 block">Lifecycle Status</Label>
                  <select
                    value={adminStatus}
                    onChange={(e: any) => setAdminStatus(e.target.value)}
                    className="w-full h-9 px-2.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="onboarding">Onboarding</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-semibold mb-1 block">Payroll Category</Label>
                  <Input value={adminPayrollCategory} onChange={(e) => setAdminPayrollCategory(e.target.value)} placeholder="Standard / Executive" className="text-xs" />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">Hire / Effective Date</Label>
                <Input type="date" value={adminHireDate} onChange={(e) => setAdminHireDate(e.target.value)} className="text-xs" />
              </div>
            </div>

            <DialogFooter className="p-4 sm:px-6 border-t border-border/60 bg-muted/30">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditEmployeeOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={updateEmployeeMutation.isPending}>
                {updateEmployeeMutation.isPending ? 'Saving...' : 'Save Account Settings'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 4. Statutory Legal Hold (SOC-2 CC6.1) Modal */}
      <Dialog open={legalHoldModalOpen} onOpenChange={setLegalHoldModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border/60 bg-card">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  {employee.legalHold ? 'Manage Statutory Legal Hold' : 'Place Statutory Legal Hold'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  SOC 2 CC6.1 / FINRA document preservation and audit freeze
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-5 sm:p-6 space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1">
              <p className="font-semibold text-foreground">Target Employee: {employee.name}</p>
              <p className="text-muted-foreground">
                Current Status:{' '}
                <span className={employee.legalHold ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
                  {employee.legalHold ? 'Active Hold' : 'Standard Retention'}
                </span>
              </p>
            </div>

            <div>
              <Label className="text-xs font-semibold mb-1 block">
                Statutory Justification & Matter Reference *
              </Label>
              <textarea
                value={legalHoldReason}
                onChange={(e) => setLegalHoldReason(e.target.value)}
                placeholder="e.g. Audit preservation for Q3 SEC compliance review or ongoing litigation hold..."
                rows={3}
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Must be at least 10 characters for audit logs.</p>
            </div>
          </div>

          <DialogFooter className="p-4 sm:px-6 border-t border-border/60 bg-muted/30">
            <Button type="button" variant="outline" size="sm" onClick={() => setLegalHoldModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant={employee.legalHold ? 'outline' : 'destructive'}
              onClick={handleToggleLegalHold}
              disabled={isUpdatingHold}
            >
              {isUpdatingHold ? 'Processing...' : employee.legalHold ? 'Release Legal Hold' : 'Confirm Legal Hold'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
