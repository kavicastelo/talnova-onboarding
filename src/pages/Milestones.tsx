import React, { useState } from 'react';
import {
  CalendarCheck,
  Calendar,
  CheckCircle2,
  Clock,
  Award,
  UserCheck,
  Star,
  Plus,
  Building2,
  Pencil,
  Trash2,
  ListChecks,
  FileQuestion,
  Sparkles,
  Search,
  UserPlus,
  HelpCircle,
  Eye,
  SlidersHorizontal,
  CheckSquare,
  Square
} from 'lucide-react';
import {
  useMyMilestones,
  useTeamMilestones,
  useMilestoneTemplates,
  useCreateMilestoneTemplate,
  useUpdateMilestoneTemplate,
  useDeleteMilestoneTemplate,
  useAssignMilestone,
  useSubmitSelfCheckin,
  useSubmitManagerReview,
  useUpdateMilestoneStatus,
  useUpdateMilestoneGoals
} from '../hooks/useMilestones';
import { useScheduleMilestoneReview } from '../hooks/useCalendar';
import { useEmployees } from '../hooks/useEmployees';
import { MilestoneTemplate } from '../services/milestone.service';
import { useRole } from '../context/RoleContext';
import { Button } from '../components/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/Card';
import { Badge } from '../components/Badge';
import { Progress } from '../components/Progress';
import { SearchableSelect } from '../components/SearchableSelect';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter
} from '../components/Dialog';
import { toast } from 'sonner';
import { SimplePagination } from '../components/SimplePagination';
import { usePagination } from '../hooks/usePagination';
import { MilestoneEscalationLadder } from '../components/milestones/MilestoneEscalationLadder';
import { AIReflectionSummaryCard } from '../components/milestones/AIReflectionSummaryCard';
import { useTranslation } from 'react-i18next';

export const Milestones: React.FC = () => {
  const { t } = useTranslation(['milestones', 'common', 'integrations']);
  const { role, can } = useRole();
  const isAdmin = role === 'admin' || role === 'owner' || role === 'super_admin' || role === 'hr_admin';
  const isManager = can('create_milestone') || can('assign_milestone');
  const canManageTemplates = isAdmin || isManager;

  const [activeTab, setActiveTab] = useState<'my' | 'team' | 'templates'>(isManager ? 'team' : 'my');

  // Modals state
  const [selectedMilestone, setSelectedMilestone] = useState<any>(null);
  const [isSelfCheckinOpen, setIsSelfCheckinOpen] = useState(false);
  const [isManagerReviewOpen, setIsManagerReviewOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusToSet, setStatusToSet] = useState<'pending' | 'in_review' | 'pending_manager_review' | 'completed' | 'approved' | 'revision_requested' | 'overdue'>('pending');
  const [statusFeedback, setStatusFeedback] = useState('');
  const [statusRating, setStatusRating] = useState<number>(5);

  // Milestone Template Create / Edit Modal State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MilestoneTemplate | null>(null);
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateTargetDay, setTemplateTargetDay] = useState<number>(30);
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateGoals, setTemplateGoals] = useState<Array<{ title: string; description: string }>>([
    { title: '', description: '' },
  ]);
  const [templateQuestions, setTemplateQuestions] = useState<
    Array<{ question: string; type: 'text' | 'rating' | 'boolean'; required: boolean }>
  >([{ question: '', type: 'text', required: true }]);
  const [templateAutoAssign, setTemplateAutoAssign] = useState(true);

  // Self Check-in Form
  const [confidenceRating, setConfidenceRating] = useState(5);
  const [selfComments, setSelfComments] = useState('');
  const [completedGoals, setCompletedGoals] = useState<string[]>([]);

  // Manager Review Form
  const [managerRating, setManagerRating] = useState(5);
  const [managerFeedback, setManagerFeedback] = useState('');
  const [approvalStatus, setApprovalStatus] = useState<'approved' | 'needs_action'>('approved');

  // Assign Milestone Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignTemplateId, setAssignTemplateId] = useState('');
  const [assignEmployeeId, setAssignEmployeeId] = useState('');

  // Team Reviews Search & Status Filters
  const [teamFilterStatus, setTeamFilterStatus] = useState<string>('all');
  const [teamSearchQuery, setTeamSearchQuery] = useState<string>('');

  const { data: myMilestones, isLoading: myLoading, refetch: refetchMy } = useMyMilestones();
  const { data: teamMilestones, isLoading: teamLoading, refetch: refetchTeam } = useTeamMilestones();
  const { data: templates, isLoading: templatesLoading, refetch: refetchTemplates } = useMilestoneTemplates();
  const { data: employeesData } = useEmployees({ limit: 1000 });
  const employees = employeesData?.employees || [];

  const createTemplateMutation = useCreateMilestoneTemplate();
  const updateTemplateMutation = useUpdateMilestoneTemplate();
  const deleteTemplateMutation = useDeleteMilestoneTemplate();
  const assignMilestoneMutation = useAssignMilestone();
  const updateStatusMutation = useUpdateMilestoneStatus();
  const updateGoalsMutation = useUpdateMilestoneGoals();
  const scheduleReviewMutation = useScheduleMilestoneReview();

  const handleScheduleReview = (milestone: any) => {
    scheduleReviewMutation.mutate(
      { milestoneId: milestone._id },
      {
        onSuccess: () => {
          toast.success(t('integrations.reviewScheduled', { defaultValue: 'Milestone 1-on-1 review meeting scheduled successfully!' }));
          refetchTeam();
          refetchMy();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || t('integrations.reviewFailed', { defaultValue: 'Failed to schedule milestone review meeting' }));
        }
      }
    );
  };

  const handleOpenAssignModal = (preselectedTemplateId?: string, preselectedEmployeeId?: string) => {
    const tmplId = preselectedTemplateId || (templates && templates.length > 0 ? templates[0]._id : '');
    const empId = preselectedEmployeeId || (employees.length > 0 ? employees[0].id : '');
    setAssignTemplateId(tmplId);
    setAssignEmployeeId(empId);
    setIsAssignModalOpen(true);
  };

  const handleConfirmAssign = () => {
    if (!assignTemplateId || !assignEmployeeId) {
      toast.error(t('toasts.selectEmployeeAndTemplate', { defaultValue: 'Please select both an employee and milestone template.' }));
      return;
    }
    assignMilestoneMutation.mutate(
      { templateId: assignTemplateId, employeeId: assignEmployeeId },
      {
        onSuccess: () => {
          toast.success(t('toasts.assignedSuccess', { defaultValue: 'Milestone program successfully assigned to employee!' }));
          setIsAssignModalOpen(false);
          refetchTeam();
          refetchMy();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || t('toasts.failedAssign', { defaultValue: 'Failed to assign milestone' }));
        }
      }
    );
  };

  const filteredTeamMilestones = (teamMilestones || []).filter((m) => {
    const empName = m.employeeId?.profile
      ? `${m.employeeId.profile.firstName || ''} ${m.employeeId.profile.lastName || ''}`.toLowerCase()
      : (m.employeeId?.name || '').toLowerCase();
    const title = (m.milestoneTitle || '').toLowerCase();
    const q = teamSearchQuery.toLowerCase().trim();
    const matchesSearch = !q || empName.includes(q) || title.includes(q);

    if (!matchesSearch) return false;

    if (teamFilterStatus === 'all') return true;
    if (teamFilterStatus === 'pending_checkin') return m.status === 'pending' || !m.status;
    if (teamFilterStatus === 'awaiting_review') return m.status === 'in_review' || m.status === 'pending_manager_review';
    if (teamFilterStatus === 'approved') return m.status === 'completed' || m.status === 'approved';
    if (teamFilterStatus === 'overdue') {
      const isOverdue = m.dueDate && new Date(m.dueDate).getTime() < Date.now() && m.status !== 'completed' && m.status !== 'approved';
      return isOverdue || m.sla?.escalationState === 'escalated';
    }
    return true;
  });

  const myPagination = usePagination({ data: myMilestones || [], initialPageSize: 6 });
  const teamPagination = usePagination({ data: filteredTeamMilestones, initialPageSize: 6 });
  const templatesPagination = usePagination({ data: templates || [], initialPageSize: 6 });

  const submitSelfCheckinMutation = useSubmitSelfCheckin();
  const submitManagerReviewMutation = useSubmitManagerReview();
  const handleSelfCheckinSubmit = () => {
    if (!selectedMilestone) return;

    const responses = (selectedMilestone.templateId?.checkinQuestions || []).map((q: any) => ({
      questionId: q._id,
      question: q.question,
      answer: 'Completed check-in objectives.',
    }));

    submitSelfCheckinMutation.mutate(
      {
        id: selectedMilestone._id,
        payload: {
          responses,
          confidenceRating,
          employeeRating: confidenceRating,
          comments: selfComments,
          reflectionNotes: selfComments,
          goalsCompletedTitles: completedGoals,
        },
      },
      {
        onSuccess: () => {
          toast.success(t('toasts.selfCheckinSuccess', { defaultValue: 'Self-evaluation submitted successfully!' }));
          setIsSelfCheckinOpen(false);
          setSelectedMilestone(null);
          refetchMy();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || t('toasts.failedSelfCheckin', { defaultValue: 'Failed to submit check-in' }));
        }
      }
    );
  };

  const handleManagerReviewSubmit = () => {
    if (!selectedMilestone) return;

    submitManagerReviewMutation.mutate(
      {
        id: selectedMilestone._id,
        payload: {
          approvalStatus,
          performanceRating: managerRating,
          feedback: managerFeedback,
        },
      },
      {
        onSuccess: () => {
          toast.success(t('toasts.managerReviewSuccess', { defaultValue: 'Manager review & rating submitted successfully!' }));
          setIsManagerReviewOpen(false);
          setSelectedMilestone(null);
          refetchTeam();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || t('toasts.failedManagerReview', { defaultValue: 'Failed to submit review' }));
        }
      }
    );
  };

  const handleStatusChangeSubmit = () => {
    if (!selectedMilestone) return;

    updateStatusMutation.mutate(
      {
        id: selectedMilestone._id,
        payload: {
          status: statusToSet,
          managerRating: statusRating,
          managerFeedback: statusFeedback,
          notes: statusFeedback,
        },
      },
      {
        onSuccess: () => {
          toast.success(t('toasts.statusUpdated', { status: statusToSet.replace(/_/g, ' '), defaultValue: `Milestone status updated to ${statusToSet.replace(/_/g, ' ')}!` }));
          setIsStatusModalOpen(false);
          setIsDetailsModalOpen(false);
          setSelectedMilestone(null);
          refetchTeam();
          refetchMy();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || t('toasts.failedUpdateStatus', { defaultValue: 'Failed to update milestone status' }));
        }
      }
    );
  };

  const handleToggleGoal = (milestone: any, goalTitle: string, currentCompleted: boolean) => {
    const updatedGoals = (milestone.goalsProgress || []).map((g: any) =>
      g.goalTitle === goalTitle ? { ...g, completed: !currentCompleted } : g
    );

    updateGoalsMutation.mutate(
      {
        id: milestone._id,
        goalsProgress: updatedGoals,
      },
      {
        onSuccess: () => {
          toast.success(currentCompleted ? t('toasts.goalIncomplete', { defaultValue: 'Goal marked incomplete' }) : t('toasts.goalCompleted', { defaultValue: 'Goal completed!' }));
          if (selectedMilestone && selectedMilestone._id === milestone._id) {
            setSelectedMilestone({
              ...selectedMilestone,
              goalsProgress: updatedGoals,
            });
          }
          refetchMy();
          refetchTeam();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || t('toasts.failedUpdateGoal', { defaultValue: 'Failed to update goal' }));
        },
      }
    );
  };

  const handleOpenCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateTitle('');
    setTemplateTargetDay(30);
    setTemplateDescription('');
    setTemplateGoals([{ title: '', description: '' }]);
    setTemplateQuestions([{ question: '', type: 'text', required: true }]);
    setTemplateAutoAssign(true);
    setIsTemplateModalOpen(true);
  };

  const handleOpenEditTemplate = (tmpl: MilestoneTemplate) => {
    setEditingTemplate(tmpl);
    setTemplateTitle(tmpl.title || '');
    setTemplateTargetDay(tmpl.targetDay || 30);
    setTemplateDescription(tmpl.description || '');
    setTemplateGoals(
      tmpl.goals && tmpl.goals.length > 0
        ? tmpl.goals.map((g) => ({ title: g.title || '', description: g.description || '' }))
        : [{ title: '', description: '' }]
    );
    setTemplateQuestions(
      tmpl.checkinQuestions && tmpl.checkinQuestions.length > 0
        ? tmpl.checkinQuestions.map((q) => ({ question: q.question || '', type: q.type || 'text', required: q.required ?? true }))
        : [{ question: '', type: 'text', required: true }]
    );
    setTemplateAutoAssign(tmpl.audience?.autoAssignNewHires ?? true);
    setIsTemplateModalOpen(true);
  };

  const handleTemplateFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateTitle.trim()) {
      toast.error(t('toasts.titleRequired', { defaultValue: 'Template title cannot be empty.' }));
      return;
    }

    const validGoals = templateGoals
      .map((g) => ({ title: g.title.trim(), description: g.description?.trim() || '' }))
      .filter((g) => g.title.length > 0);

    const validQuestions = templateQuestions
      .map((q) => ({ question: q.question.trim(), type: q.type, required: q.required }))
      .filter((q) => q.question.length > 0);

    const payload: Partial<MilestoneTemplate> = {
      title: templateTitle.trim(),
      targetDay: Number(templateTargetDay) as 30 | 60 | 90 | 180,
      description: templateDescription.trim(),
      goals: validGoals,
      checkinQuestions: validQuestions,
      audience: {
        autoAssignNewHires: templateAutoAssign,
      },
    };

    if (editingTemplate) {
      updateTemplateMutation.mutate(
        { id: editingTemplate._id, data: payload },
        {
          onSuccess: () => {
            toast.success(t('toasts.templateUpdated', { defaultValue: 'Milestone template updated successfully!' }));
            setIsTemplateModalOpen(false);
            setEditingTemplate(null);
            refetchTemplates();
          },
          onError: (err: any) => {
            toast.error(err?.response?.data?.message || err?.message || t('toasts.failedUpdateTemplate', { defaultValue: 'Failed to update template' }));
          },
        }
      );
    } else {
      createTemplateMutation.mutate(payload, {
        onSuccess: () => {
          toast.success(t('toasts.templateCreated', { defaultValue: 'Milestone template created successfully!' }));
          setIsTemplateModalOpen(false);
          refetchTemplates();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || t('toasts.failedCreateTemplate', { defaultValue: 'Failed to create template' }));
        },
      });
    }
  };

  const handleDeleteTemplate = (id: string, title: string) => {
    if (window.confirm(t('toasts.confirmDelete', { title, defaultValue: `Are you sure you want to delete the template "${title}"?` }))) {
      deleteTemplateMutation.mutate(id, {
        onSuccess: () => {
          toast.success(t('toasts.templateDeleted', { defaultValue: 'Milestone template deleted successfully!' }));
          refetchTemplates();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || t('toasts.failedDeleteTemplate', { defaultValue: 'Failed to delete template' }));
        },
      });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarCheck className="h-7 w-7 text-indigo-600" />
            {t('title', { defaultValue: '30 / 60 / 90-Day Milestones & Check-Ins' })}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('subtitle', { defaultValue: 'Track early onboarding progression, conduct structured self-evaluations, and receive manager performance reviews.' })}
          </p>
        </div>
        {canManageTemplates && (
          <Button
            id="create-milestone-template-header-btn"
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={() => {
              setActiveTab('templates');
              handleOpenCreateTemplate();
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> {t('createTemplate', { defaultValue: 'Create Milestone Template' })}
          </Button>
        )}
      </div>

      {/* Program Summary Banner Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-sky-500 bg-sky-50/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-sky-700">
              <Clock className="h-4 w-4" /> {t('programBanners.day30Title', { defaultValue: 'Day 30 — Fast-Start & Orientation' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {t('programBanners.day30Desc', { defaultValue: 'Complete team introductions, initial IT setup, security training, and first learning journey.' })}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500 bg-indigo-50/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-indigo-700">
              <Award className="h-4 w-4" /> {t('programBanners.day60Title', { defaultValue: 'Day 60 — Execution & Autonomy' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {t('programBanners.day60Desc', { defaultValue: 'Deliver independent project contributions, shadow senior mentors, and master core workflow tools.' })}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> {t('programBanners.day90Title', { defaultValue: 'Day 90 — Full Integration & Graduation' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {t('programBanners.day90Desc', { defaultValue: 'Achieve full operational productivity, conduct comprehensive probation review, and set quarterly goals.' })}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex border-b text-sm font-medium">
        <button
          className={`py-3 px-6 border-b-2 font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'my'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('my')}
        >
          <CalendarCheck className="h-4 w-4" /> {t('tabs.my', { defaultValue: 'My Milestones' })} ({myMilestones?.length || 0})
        </button>
        {isManager && (
          <button
            id="tab-team-milestones"
            className={`py-3 px-6 border-b-2 font-semibold flex items-center gap-2 transition-colors ${
              activeTab === 'team'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('team')}
          >
            <UserCheck className="h-4 w-4" /> {t('tabs.team', { defaultValue: 'Team Check-In Reviews' })} ({teamMilestones?.length || 0})
          </button>
        )}
        {canManageTemplates && (
          <button
            id="tab-milestone-templates"
            className={`py-3 px-6 border-b-2 font-semibold flex items-center gap-2 transition-colors ${
              activeTab === 'templates'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('templates')}
          >
            <Building2 className="h-4 w-4" /> {t('tabs.templates', { defaultValue: 'Milestone Templates' })} ({templates?.length || 0})
          </button>
        )}
      </div>

      {/* Tab 1: My Milestones Timeline */}
      {activeTab === 'my' && (
        <div className="space-y-6">
          {myLoading ? (
            <div className="p-8 text-center text-muted-foreground">{t('myMilestones.loading', { defaultValue: 'Loading your milestones...' })}</div>
          ) : (myMilestones || []).length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border-2 border-dashed rounded-lg">
              {t('myMilestones.empty', { defaultValue: 'No 30/60/90-day milestones assigned yet. Automatic schedule will calculate upon onboarding initiation.' })}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-6">
                {myPagination.paginatedData.map((m) => {
                  const completedGoalsCount = m.goalsProgress?.filter((g) => g.completed).length || 0;
                  const totalGoalsCount = m.goalsProgress?.length || 1;
                  const progressPct = Math.round((completedGoalsCount / totalGoalsCount) * 100);

                  return (
                    <Card key={m._id} className="hover:border-indigo-500/40 transition-all">
                      <CardHeader className="pb-3 border-b">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div className="flex items-center gap-3">
                            <Badge className="bg-indigo-600 text-white font-bold px-3 py-1 text-sm">
                              {t('myMilestones.dayBadge', { day: m.targetDay, defaultValue: `Day ${m.targetDay}` })}
                            </Badge>
                            <div>
                              <CardTitle className="text-base font-semibold">{m.milestoneTitle}</CardTitle>
                              <CardDescription className="text-xs">
                                {t('myMilestones.targetDueDate', { date: new Date(m.dueDate).toLocaleDateString(), defaultValue: `Target Due Date: ${new Date(m.dueDate).toLocaleDateString()}` })}
                              </CardDescription>
                            </div>
                          </div>

                          <div>
                            {(m.status === 'completed' || m.status === 'approved') && (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {t('myMilestones.completedApproved', { defaultValue: 'Milestone Completed & Approved' })}
                              </Badge>
                            )}
                            {(m.status === 'in_review' || m.status === 'pending_manager_review') && (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                                <Clock className="h-3.5 w-3.5 mr-1" /> {t('myMilestones.submittedAwaiting', { defaultValue: 'Submitted — Awaiting Manager Sign-off' })}
                              </Badge>
                            )}
                            {m.status === 'revision_requested' && (
                              <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                                {t('myMilestones.revisionRequested', { defaultValue: 'Revision Requested' })}
                              </Badge>
                            )}
                            {m.status === 'pending' && (
                              <Badge variant="outline" className="bg-slate-500/10 text-slate-600 border-slate-500/20">
                                {t('myMilestones.inProgress', { defaultValue: 'In Progress' })}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="p-6 space-y-6">
                        {/* Progress Bar */}
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs font-semibold">
                            <span>{t('myMilestones.goalsProgress', { defaultValue: 'Milestone Goals Progress' })}</span>
                            <span>
                              {t('myMilestones.goalsProgressCount', { completed: completedGoalsCount, total: totalGoalsCount, pct: progressPct, defaultValue: `${completedGoalsCount} of ${totalGoalsCount} Goals (${progressPct}%)` })}
                            </span>
                          </div>
                          <Progress value={progressPct} className="h-2" />
                        </div>

                        {/* Goals List */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase">{t('myMilestones.keyObjectives', { defaultValue: 'Key Objectives & Goals' })}</h4>
                            <span className="text-[11px] text-muted-foreground italic">{t('myMilestones.clickCheckboxHint', { defaultValue: 'Click checkbox to check-off completed items' })}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {m.goalsProgress?.map((g: any, idx: number) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleToggleGoal(m, g.goalTitle, g.completed)}
                                className={`p-2.5 border rounded-md text-xs flex items-center justify-between text-left transition-all ${
                                  g.completed
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-300 font-medium'
                                    : 'bg-card hover:bg-muted/40 border-border text-foreground'
                                }`}
                              >
                                <span className={g.completed ? 'line-through opacity-80' : ''}>{g.goalTitle}</span>
                                {g.completed ? (
                                  <CheckSquare className="h-4 w-4 text-emerald-600 shrink-0 ml-2" />
                                ) : (
                                  <Square className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Manager Feedback section if completed */}
                        {(m.managerFeedback || m.managerReview?.feedback) && (
                          <div className="p-4 border rounded-lg bg-indigo-50/20 text-xs space-y-1">
                            <span className="font-semibold text-indigo-700 flex items-center gap-1">
                              <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /> {t('myMilestones.managerFeedbackRating', { rating: m.managerRating || m.managerReview?.performanceRating || 5, defaultValue: `Manager Feedback (Rating: ${m.managerRating || m.managerReview?.performanceRating || 5}/5):` })}
                            </span>
                            <p className="text-slate-700 dark:text-slate-300 italic">"{m.managerFeedback || m.managerReview?.feedback}"</p>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="pt-2 flex flex-wrap items-center justify-end gap-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => {
                              setSelectedMilestone(m);
                              setIsDetailsModalOpen(true);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1.5" /> {t('common.viewDetails', { defaultValue: 'View Details' })}
                          </Button>

                          {(m.status === 'pending' || m.status === 'revision_requested') && (
                            <Button
                              id="open-self-evaluation-btn"
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                              onClick={() => {
                                setSelectedMilestone(m);
                                setCompletedGoals(m.goalsProgress?.filter((g: any) => g.completed).map((g: any) => g.goalTitle) || []);
                                setIsSelfCheckinOpen(true);
                              }}
                            >
                              {m.status === 'revision_requested'
                                ? t('myMilestones.resubmitSelfEvaluation', { defaultValue: 'Re-Submit Self-Evaluation' })
                                : t('myMilestones.submitSelfEvaluation', { defaultValue: 'Submit Self-Evaluation' })}
                            </Button>
                          )}

                          {(m.status === 'in_review' || m.status === 'pending_manager_review') && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-amber-300 text-amber-700 hover:bg-amber-50 text-xs"
                              onClick={() => {
                                setSelectedMilestone(m);
                                setSelfComments(m.comments || m.employeeSelfCheck?.comments || '');
                                setConfidenceRating(m.employeeRating || m.employeeSelfCheck?.confidenceRating || 5);
                                setCompletedGoals(m.goalsProgress?.filter((g: any) => g.completed).map((g: any) => g.goalTitle) || []);
                                setIsSelfCheckinOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5 mr-1" /> {t('myMilestones.updateReflection', { defaultValue: 'Update Reflection' })}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <SimplePagination
                currentPage={myPagination.page}
                totalPages={myPagination.totalPages}
                totalItems={myPagination.totalItems}
                startIndex={myPagination.startIndex}
                endIndex={myPagination.endIndex}
                pageSize={myPagination.pageSize}
                onPageChange={myPagination.setPage}
                onPageSizeChange={myPagination.setPageSize}
                itemLabel={t('myMilestones.paginationLabel', { defaultValue: 'milestones' })}
              />
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Team Milestones (Manager View) */}
      {activeTab === 'team' && isManager && (
        <Card>
          <CardHeader className="pb-3 border-b space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold">
                  {t('teamMilestones.cardTitle', { defaultValue: 'Direct Report 30/60/90 Check-Ins' })}
                </CardTitle>
                <CardDescription>
                  {t('teamMilestones.cardDesc', { defaultValue: 'Review self-assessments, track SLAs, and approve onboarding milestones for team members.' })}
                </CardDescription>
              </div>
              <Button
                id="assign-milestone-team-btn"
                className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 text-xs h-9 gap-1.5"
                onClick={() => handleOpenAssignModal()}
              >
                <UserPlus className="h-4 w-4" /> {t('teamMilestones.assignProgramBtn', { defaultValue: 'Assign Milestone Program' })}
              </Button>
            </div>

            {/* Filter Chips and Search Bar */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: t('teamMilestones.filterAll', { defaultValue: 'All Reviews' }), count: (teamMilestones || []).length },
                  { id: 'awaiting_review', label: t('teamMilestones.filterAwaiting', { defaultValue: 'Awaiting Sign-off' }), count: (teamMilestones || []).filter((m) => m.status === 'in_review' || m.status === 'pending_manager_review').length },
                  { id: 'pending_checkin', label: t('teamMilestones.filterPending', { defaultValue: 'Pending Check-in' }), count: (teamMilestones || []).filter((m) => m.status === 'pending' || !m.status).length },
                  { id: 'approved', label: t('teamMilestones.filterApproved', { defaultValue: 'Approved' }), count: (teamMilestones || []).filter((m) => m.status === 'completed' || m.status === 'approved').length },
                  { id: 'overdue', label: t('teamMilestones.filterOverdue', { defaultValue: 'Overdue / Escalated' }), count: (teamMilestones || []).filter((m) => (m.dueDate && new Date(m.dueDate).getTime() < Date.now() && m.status !== 'completed' && m.status !== 'approved') || m.sla?.escalationState === 'escalated').length },
                ].map((chip) => (
                  <button
                    key={chip.id}
                    onClick={() => setTeamFilterStatus(chip.id)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                      teamFilterStatus === chip.id
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span>{chip.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      teamFilterStatus === chip.id ? 'bg-white/20 text-white' : 'bg-background text-muted-foreground'
                    }`}>
                      {chip.count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={t('teamMilestones.searchPlaceholder', { defaultValue: 'Search team member or title...' })}
                  value={teamSearchQuery}
                  onChange={(e) => setTeamSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border/80 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {teamLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                {t('teamMilestones.loading', { defaultValue: 'Loading team milestones...' })}
              </div>
            ) : (teamMilestones || []).length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {t('teamMilestones.empty', { defaultValue: 'No direct report milestones requiring review.' })}
              </div>
            ) : (
              <div>
                <div className="divide-y">
                  {teamPagination.paginatedData.map((m) => {
                    const empName = m.employeeId?.profile
                      ? `${m.employeeId.profile.firstName || ''} ${m.employeeId.profile.lastName || ''}`
                      : t('teamMilestones.directReportFallback', { defaultValue: 'Direct Report' });
                    const mid = m.milestoneCode || m._id;

                    return (
                      <div
                        key={m._id}
                        id={`milestone-card-${mid}`}
                        className="p-5 flex flex-col gap-4 hover:bg-muted/10 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-sm">{empName}</h4>
                              <Badge className="bg-indigo-100 text-indigo-800 text-[10px]">
                                {t('myMilestones.dayBadge', { day: m.targetDay, defaultValue: 'Day {{day}}' })}
                              </Badge>
                              {m.sla?.autoApprovalEligible && (
                                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                                  {t('teamMilestones.autoApprovalEligible', { defaultValue: 'Auto-Approval Eligible' })}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {m.milestoneTitle} | {t('teamMilestones.targetDue', { date: new Date(m.dueDate).toLocaleDateString(), defaultValue: 'Target Due: {{date}}' })}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {m.status === 'completed' || m.status === 'approved' ? (
                              <Badge
                                id={`badge-approved-${mid}`}
                                variant="outline"
                                className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium flex items-center gap-1"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> {t('teamMilestones.approvedWithRating', { rating: m.managerRating || m.managerReview?.performanceRating || 5, defaultValue: 'Approved (Rating: {{rating}}/5)' })}
                              </Badge>
                            ) : m.status === 'revision_requested' ? (
                              <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                                {t('teamMilestones.revisionRequested', { defaultValue: 'Revision Requested' })}
                              </Badge>
                            ) : m.status === 'in_review' || m.status === 'pending_manager_review' ? (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                                <Clock className="h-3.5 w-3.5 mr-1" /> {t('teamMilestones.awaitingSignoff', { defaultValue: 'Awaiting Sign-off' })}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                {t('teamMilestones.selfCheckinPending', { defaultValue: 'Self Check-in Pending' })}
                              </Badge>
                            )}

                            {/* View Details Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => {
                                setSelectedMilestone(m);
                                setIsDetailsModalOpen(true);
                              }}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" /> {t('common.viewDetails', { defaultValue: 'View Details' })}
                            </Button>

                            {/* Review Milestone / Sign-Off Button */}
                            <Button
                              id={`review-milestone-btn-${mid}`}
                              size="sm"
                              className={`${
                                m.status === 'in_review' || m.status === 'pending_manager_review'
                                  ? 'bg-amber-600 hover:bg-amber-700 text-white font-semibold'
                                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                              } text-xs flex items-center gap-1.5`}
                              onClick={() => {
                                setSelectedMilestone(m);
                                setManagerRating(m.managerRating || 5);
                                setApprovalStatus(m.status === 'revision_requested' ? 'needs_action' : 'approved');
                                const feedbackText = typeof m.aiSummary === 'string'
                                  ? m.aiSummary
                                  : m.aiSummary?.summary || m.managerFeedback || 'Ramping up well on team workflows. Performance meets expectations.';
                                setManagerFeedback(feedbackText);
                                setIsManagerReviewOpen(true);
                              }}
                            >
                              <UserCheck className="h-3.5 w-3.5" /> {m.status === 'in_review' || m.status === 'pending_manager_review' ? t('teamMilestones.reviewMilestoneBtn', { defaultValue: 'Review Milestone' }) : t('teamMilestones.reviewAndSignoff', { defaultValue: 'Review / Sign-Off' })}
                            </Button>

                            {/* Change Status Button */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-border text-foreground hover:bg-muted text-xs flex items-center gap-1"
                              onClick={() => {
                                setSelectedMilestone(m);
                                setStatusToSet(m.status || 'pending');
                                setStatusRating(m.managerRating || 5);
                                setStatusFeedback(m.managerFeedback || '');
                                setIsStatusModalOpen(true);
                              }}
                            >
                              <SlidersHorizontal className="h-3 w-3" /> {t('teamMilestones.changeStatus', { defaultValue: 'Change Status' })}
                            </Button>

                            {/* Schedule 1-on-1 Review Sync */}
                            <Button
                              id={`schedule-milestone-review-btn-${mid}`}
                              size="sm"
                              variant="outline"
                              disabled={scheduleReviewMutation.isPending}
                              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/40 text-xs flex items-center gap-1.5"
                              onClick={() => handleScheduleReview(m)}
                            >
                              <Calendar className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                              {t('teamMilestones.scheduleReviewSync', { defaultValue: 'Schedule 1-on-1 Review' })}
                            </Button>
                          </div>
                        </div>

                        {/* Event-Driven Escalation Ladder & AI Briefing (Prompts 06) */}
                        {(m.status === 'in_review' || m.status === 'pending_manager_review') && (
                          <div className="space-y-3 pt-2 border-t border-border/50">
                            <MilestoneEscalationLadder sla={m.sla} status={m.status} submittedAt={m.submittedAt} />
                            {m.aiSummary && (
                              <AIReflectionSummaryCard
                                aiSummary={typeof m.aiSummary === 'string' ? { summary: m.aiSummary } : m.aiSummary}
                                employeeName={empName}
                                onQuickApprove={() => {
                                  setSelectedMilestone(m);
                                  setManagerRating(5);
                                  setApprovalStatus('approved');
                                  const feedbackText = typeof m.aiSummary === 'string'
                                    ? m.aiSummary
                                    : m.aiSummary?.summary || t('aiReflection.quickApproveFeedback', { defaultValue: 'Approved via 1-click evaluation' });
                                  setManagerFeedback(feedbackText);
                                  setIsManagerReviewOpen(true);
                                }}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="p-3 border-t">
                  <SimplePagination
                    currentPage={teamPagination.page}
                    totalPages={teamPagination.totalPages}
                    totalItems={teamPagination.totalItems}
                    startIndex={teamPagination.startIndex}
                    endIndex={teamPagination.endIndex}
                    pageSize={teamPagination.pageSize}
                    onPageChange={teamPagination.setPage}
                    onPageSizeChange={teamPagination.setPageSize}
                    itemLabel={t('teamMilestones.paginationLabel', { defaultValue: 'milestones' })}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Milestone Templates Management */}
      {activeTab === 'templates' && canManageTemplates && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/30 p-4 rounded-xl border">
            <div>
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600" />
                {t('templatesTab.bannerTitle', { defaultValue: 'Company Milestone Programs & Check-in Templates' })}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('templatesTab.bannerDesc', { defaultValue: 'Define standard 30, 60, 90, or 180-day expectations, objectives, and reflection questionnaires for new hires.' })}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                id="assign-milestone-template-header-btn"
                variant="outline"
                className="text-xs h-9 gap-1.5"
                onClick={() => handleOpenAssignModal()}
              >
                <UserPlus className="h-4 w-4" /> {t('templatesTab.assignToEmployee', { defaultValue: 'Assign to Employee' })}
              </Button>
              <Button
                id="create-milestone-template-btn"
                className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 text-xs h-9"
                onClick={handleOpenCreateTemplate}
              >
                <Plus className="h-4 w-4 mr-1.5" /> {t('templatesTab.createTemplate', { defaultValue: 'Create Template' })}
              </Button>
            </div>
          </div>

          {templatesLoading ? (
            <div className="p-12 text-center text-muted-foreground">
              {t('templatesTab.loading', { defaultValue: 'Loading templates...' })}
            </div>
          ) : (templates || []).length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed rounded-xl space-y-3">
              <Building2 className="h-10 w-10 text-muted-foreground mx-auto" />
              <h4 className="font-semibold">
                {t('templatesTab.emptyTitle', { defaultValue: 'No milestone templates defined yet' })}
              </h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {t('templatesTab.emptyDesc', { defaultValue: 'Set up 30-day, 60-day, or 90-day milestone templates with goals and reflection questions to automate new hire onboarding reviews.' })}
              </p>
              <Button
                id="create-first-milestone-template-btn"
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={handleOpenCreateTemplate}
              >
                <Plus className="h-4 w-4 mr-2" /> {t('templatesTab.createFirst', { defaultValue: 'Create First Template' })}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {templatesPagination.paginatedData.map((tmpl) => (
                  <Card key={tmpl._id} className="hover:border-indigo-500/50 transition-all flex flex-col justify-between">
                    <div>
                      <CardHeader className="pb-3 border-b">
                        <div className="flex items-center justify-between gap-2">
                          <Badge className="bg-indigo-600 text-white font-bold px-2.5 py-0.5 text-xs">
                            {t('myMilestones.dayBadge', { day: tmpl.targetDay, defaultValue: 'Day {{day}}' })}
                          </Badge>
                          <div className="flex items-center gap-1.5">
                            <Button
                              id={`assign-template-btn-${tmpl._id}`}
                              size="sm"
                              className="h-8 px-2.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
                              onClick={() => handleOpenAssignModal(tmpl._id)}
                            >
                              <UserPlus className="h-3.5 w-3.5 mr-1" /> {t('templatesTab.assignBtn', { defaultValue: 'Assign' })}
                            </Button>
                            <Button
                              id={`edit-template-btn-${tmpl._id}`}
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 text-xs font-medium"
                              onClick={() => handleOpenEditTemplate(tmpl)}
                            >
                              <Pencil className="h-3.5 w-3.5 mr-1" /> {t('templatesTab.editBtn', { defaultValue: 'Edit' })}
                            </Button>
                            <Button
                              id={`delete-template-btn-${tmpl._id}`}
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteTemplate(tmpl._id, tmpl.title)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <CardTitle className="text-base font-semibold mt-2 line-clamp-1">{tmpl.title}</CardTitle>
                        {tmpl.description && (
                          <CardDescription className="text-xs line-clamp-2 mt-1">
                            {tmpl.description}
                          </CardDescription>
                        )}
                      </CardHeader>

                      <CardContent className="p-4 space-y-4 text-xs">
                        {/* Goals summary */}
                        <div>
                          <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1 mb-1.5">
                            <ListChecks className="h-3.5 w-3.5 text-indigo-600" />
                            {t('templatesTab.goalsTitle', { count: tmpl.goals?.length || 0, defaultValue: 'Milestone Goals ({{count}})' })}
                          </span>
                          {tmpl.goals && tmpl.goals.length > 0 ? (
                            <ul className="space-y-1">
                              {tmpl.goals.slice(0, 3).map((g: any, idx: number) => (
                                <li key={idx} className="flex items-start gap-1.5 text-foreground/90">
                                  <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                                  <span className="line-clamp-1">{g.title}</span>
                                </li>
                              ))}
                              {tmpl.goals.length > 3 && (
                                <li className="text-[11px] text-muted-foreground italic pl-4.5">
                                  {t('templatesTab.moreGoals', { count: tmpl.goals.length - 3, defaultValue: '+{{count}} more goals' })}
                                </li>
                              )}
                            </ul>
                          ) : (
                            <p className="text-muted-foreground italic">
                              {t('templatesTab.noGoals', { defaultValue: 'No goals defined' })}
                            </p>
                          )}
                        </div>

                        {/* Check-in Questions summary */}
                        <div>
                          <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1 mb-1.5">
                            <FileQuestion className="h-3.5 w-3.5 text-indigo-600" />
                            {t('templatesTab.questionsTitle', { count: tmpl.checkinQuestions?.length || 0, defaultValue: 'Check-In Questions ({{count}})' })}
                          </span>
                          {tmpl.checkinQuestions && tmpl.checkinQuestions.length > 0 ? (
                            <ul className="space-y-1">
                              {tmpl.checkinQuestions.slice(0, 2).map((q: any, idx: number) => (
                                <li key={idx} className="flex items-start justify-between gap-2 text-foreground/90">
                                  <span className="line-clamp-1">{q.question}</span>
                                  <span className="text-[10px] bg-muted px-1.5 py-0.2 rounded shrink-0 uppercase">
                                    {q.type}
                                  </span>
                                </li>
                              ))}
                              {tmpl.checkinQuestions.length > 2 && (
                                <li className="text-[11px] text-muted-foreground italic">
                                  {t('templatesTab.moreQuestions', { count: tmpl.checkinQuestions.length - 2, defaultValue: '+{{count}} more questions' })}
                                </li>
                              )}
                            </ul>
                          ) : (
                            <p className="text-muted-foreground italic">
                              {t('templatesTab.noQuestions', { defaultValue: 'No questions defined' })}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </div>

                    <div className="p-3 border-t bg-muted/10 rounded-b-xl flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        {tmpl.audience?.autoAssignNewHires !== false ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                            <Sparkles className="h-3 w-3" /> {t('templatesTab.autoAssigned', { defaultValue: 'Auto-assigned to new hires' })}
                          </span>
                        ) : (
                          <span>{t('templatesTab.manualAssignment', { defaultValue: 'Manual assignment' })}</span>
                        )}
                      </span>
                      <span>{t('templatesTab.targetDay', { day: tmpl.targetDay, defaultValue: 'Target: Day {{day}}' })}</span>
                    </div>
                  </Card>
                ))}
              </div>

              <SimplePagination
                currentPage={templatesPagination.page}
                totalPages={templatesPagination.totalPages}
                totalItems={templatesPagination.totalItems}
                startIndex={templatesPagination.startIndex}
                endIndex={templatesPagination.endIndex}
                pageSize={templatesPagination.pageSize}
                onPageChange={templatesPagination.setPage}
                onPageSizeChange={templatesPagination.setPageSize}
                itemLabel={t('templatesTab.paginationLabel', { defaultValue: 'templates' })}
              />
            </div>
          )}
        </div>
      )}

      {/* Modal: Employee Self-Evaluation */}
      <Dialog open={isSelfCheckinOpen} onOpenChange={setIsSelfCheckinOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {t('selfEvaluationModal.title', { day: selectedMilestone?.targetDay, defaultValue: 'Day {{day}} Milestone Evaluation' })}
            </DialogTitle>
            <DialogDescription>
              {t('selfEvaluationModal.desc', { defaultValue: 'Evaluate your progress, select your confidence rating, and submit reflections for your manager.' })}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-2">
                {t('selfEvaluationModal.checkGoals', { defaultValue: 'Check-off Completed Goals:' })}
              </label>
              <div className="space-y-2">
                {selectedMilestone?.goalsProgress?.map((g: any, idx: number) => (
                  <label key={idx} className="flex items-center gap-2 text-xs cursor-pointer p-2 border rounded hover:bg-muted/20">
                    <input
                      type="checkbox"
                      checked={completedGoals.includes(g.goalTitle)}
                      onChange={(e) => {
                        if (e.target.checked) setCompletedGoals([...completedGoals, g.goalTitle]);
                        else setCompletedGoals(completedGoals.filter((title) => title !== g.goalTitle));
                      }}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>{g.goalTitle}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('selfEvaluationModal.confidenceRole', { defaultValue: 'Confidence in Role (1 to 5 Stars):' })}
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    id={`star-rating-${star}`}
                    aria-label={t('selfEvaluationModal.rateStar', { star, defaultValue: `Rate ${star} star` })}
                    onClick={() => setConfidenceRating(star)}
                    className={`p-2 rounded border flex items-center justify-center transition-colors ${
                      confidenceRating >= star ? 'bg-amber-100 border-amber-400 text-amber-600' : 'bg-background'
                    }`}
                  >
                    <Star className="h-4 w-4 fill-current" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('selfEvaluationModal.reflectionNotes', { defaultValue: 'Reflection Notes & Accomplishments:' })}
              </label>
              <textarea
                id="reflection-notes-textarea"
                className="w-full min-h-[90px] text-sm p-2.5 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder={t('selfEvaluationModal.reflectionPlaceholder', { defaultValue: 'Ramping up well on team workflows. Ready for independent tickets.' })}
                value={selfComments}
                onChange={(e) => setSelfComments(e.target.value)}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSelfCheckinOpen(false)}>
              {t('selfEvaluationModal.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              id="submit-self-evaluation-btn"
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleSelfCheckinSubmit}
            >
              {t('selfEvaluationModal.submit', { defaultValue: 'Submit Self-Evaluation' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Manager Review & Approval */}
      <Dialog open={isManagerReviewOpen} onOpenChange={setIsManagerReviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t('managerReviewModal.title', { day: selectedMilestone?.targetDay, defaultValue: 'Review Day {{day}} Milestone Check-In' })}
            </DialogTitle>
            <DialogDescription>
              {t('managerReviewModal.desc', { defaultValue: 'Review direct report\'s self-assessment and record manager sign-off.' })}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            {/* Direct Report Submission Inspection Card */}
            <div id="employee-submitted-section" className="p-3.5 border rounded-lg bg-muted/20 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-indigo-600" /> {t('managerReviewModal.selfReflection', { defaultValue: 'Employee Self-Reflection:' })}
                </span>
                <span id="employee-submitted-rating" className="inline-flex items-center gap-1 font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200">
                  {t('managerReviewModal.starsRating', { rating: selectedMilestone?.employeeRating || selectedMilestone?.employeeSelfCheck?.employeeRating || selectedMilestone?.employeeSelfCheck?.confidenceRating || 4, defaultValue: '★ {{rating}} / 5 Stars' })}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium mb-1">
                  {t('managerReviewModal.submittedNotes', { defaultValue: 'Submitted Reflection & Notes:' })}
                </span>
                <p id="employee-submitted-notes" className="italic text-foreground/90 bg-card p-2 rounded border leading-relaxed">
                  "{selectedMilestone?.comments || selectedMilestone?.employeeSelfCheck?.comments || selectedMilestone?.employeeSelfCheck?.reflectionNotes || t('managerReviewModal.defaultNotes', { defaultValue: 'Ramping up well on team workflows. Ready for independent tickets.' })}"
                </p>
              </div>
              {selectedMilestone?.goalsProgress && selectedMilestone.goalsProgress.length > 0 && (
                <div>
                  <span className="text-muted-foreground block text-[11px] font-medium mb-1">
                    {t('managerReviewModal.objectivesProgress', { defaultValue: 'Milestone Objectives Progress:' })}
                  </span>
                  <div className="grid grid-cols-1 gap-1">
                    {selectedMilestone.goalsProgress.map((g: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-1.5 text-[11px]">
                        {g.completed ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className={g.completed ? 'text-foreground' : 'text-muted-foreground'}>{g.goalTitle}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {selectedMilestone?.aiSummary && (
              <AIReflectionSummaryCard
                aiSummary={selectedMilestone.aiSummary}
                employeeName={selectedMilestone.employeeId?.profile?.firstName || t('assignModal.defaultEmployeeDept', { defaultValue: 'Employee' })}
                onQuickApprove={() => {
                  setApprovalStatus('approved');
                  setManagerRating(5);
                  setManagerFeedback(selectedMilestone.aiSummary?.summary || 'Approved with excellent feedback.');
                  toast.success(t('toasts.quickApprovePopulated', { defaultValue: '1-click feedback populated from AI synthesis' }));
                }}
              />
            )}

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('managerReviewModal.approvalStatus', { defaultValue: 'Approval Status:' })}
              </label>
              <select
                id="approval-status-select"
                className="w-full text-sm p-2.5 border rounded-md bg-background focus:outline-none"
                value={approvalStatus}
                onChange={(e: any) => setApprovalStatus(e.target.value)}
              >
                <option value="approved">{t('managerReviewModal.approveOption', { defaultValue: 'Approve Milestone' })}</option>
                <option value="revision_requested">{t('managerReviewModal.revisionOption', { defaultValue: 'Request Revision' })}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('managerReviewModal.ratingLabel', { defaultValue: 'Manager Rating (1 to 5 Stars):' })}
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    id={`manager-star-${star}`}
                    aria-label={t('selfEvaluationModal.rateStar', { star, defaultValue: `Rate ${star} star` })}
                    onClick={() => setManagerRating(star)}
                    className={`p-2 rounded border flex items-center justify-center transition-colors ${
                      managerRating >= star ? 'bg-amber-100 border-amber-400 text-amber-600' : 'bg-background'
                    }`}
                  >
                    <Star className="h-4 w-4 fill-current" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('managerReviewModal.feedbackLabel', { defaultValue: 'Manager Feedback & Sign-Off Notes:' })}
              </label>
              <textarea
                id="manager-feedback-textarea"
                className="w-full min-h-[90px] text-sm p-2.5 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder={t('managerReviewModal.feedbackPlaceholder', { defaultValue: 'Exceeded expectations on ramp-up. Completed initial project ahead of schedule.' })}
                value={managerFeedback}
                onChange={(e) => setManagerFeedback(e.target.value)}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManagerReviewOpen(false)}>
              {t('managerReviewModal.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              id="approve-signoff-btn"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              onClick={handleManagerReviewSubmit}
            >
              {t('managerReviewModal.approveAndSignOff', { defaultValue: 'Approve & Sign Off' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Create / Edit Milestone Template */}
      <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? t('templateModal.editTitle', { defaultValue: 'Edit Milestone Template' }) : t('templateModal.createTitle', { defaultValue: 'Create Milestone Template' })}
            </DialogTitle>
            <DialogDescription>
              {t('templateModal.desc', { defaultValue: 'Define onboarding milestone expectations, goals, and self-reflection questionnaires.' })}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTemplateFormSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <DialogBody className="space-y-5">
              {/* Title & Target Day */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    {t('templateModal.titleLabel', { defaultValue: 'Template Title *' })}
                  </label>
                  <input
                    id="template-title-input"
                    required
                    type="text"
                    className="w-full text-sm p-2.5 border rounded-md bg-background focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder={t('templateModal.titlePlaceholder', { defaultValue: 'e.g. Day 30 Fast-Start & Orientation' })}
                    value={templateTitle}
                    onChange={(e) => setTemplateTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    {t('templateModal.targetDayLabel', { defaultValue: 'Target Day *' })}
                  </label>
                  <select
                    id="template-target-day-select"
                    className="w-full text-sm p-2.5 border rounded-md bg-background focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    value={templateTargetDay}
                    onChange={(e) => setTemplateTargetDay(Number(e.target.value))}
                  >
                    <option value={30}>{t('templateModal.dayOption', { day: 30, defaultValue: 'Day 30' })}</option>
                    <option value={60}>{t('templateModal.dayOption', { day: 60, defaultValue: 'Day 60' })}</option>
                    <option value={90}>{t('templateModal.dayOption', { day: 90, defaultValue: 'Day 90' })}</option>
                    <option value={180}>{t('templateModal.dayOption', { day: 180, defaultValue: 'Day 180' })}</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  {t('templateModal.descLabel', { defaultValue: 'Description / Summary' })}
                </label>
                <textarea
                  id="template-description-input"
                  className="w-full min-h-[70px] text-sm p-2.5 border rounded-md bg-background focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder={t('templateModal.descPlaceholder', { defaultValue: 'Overview of expectations and requirements for this onboarding phase...' })}
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                />
              </div>

              {/* Auto-assign toggle */}
              <div className="flex items-center gap-2.5 p-3 border rounded-lg bg-muted/20">
                <input
                  id="template-auto-assign-checkbox"
                  type="checkbox"
                  checked={templateAutoAssign}
                  onChange={(e) => setTemplateAutoAssign(e.target.checked)}
                  className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="template-auto-assign-checkbox" className="text-xs font-medium cursor-pointer">
                  {t('templateModal.autoAssignCheckbox', { defaultValue: 'Automatically schedule and assign this milestone to all newly hired employees' })}
                </label>
              </div>

              {/* Key Goals / Objectives List */}
              <div className="space-y-2.5 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <ListChecks className="h-4 w-4 text-indigo-600" />
                      {t('templateModal.keyGoals', { count: templateGoals.length, defaultValue: 'Key Goals & Objectives ({{count}})' })}
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      {t('templateModal.keyGoalsDesc', { defaultValue: 'Deliverables and achievements expected by this milestone.' })}
                    </p>
                  </div>
                  <Button
                    id="add-template-goal-btn"
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => setTemplateGoals([...templateGoals, { title: '', description: '' }])}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> {t('templateModal.addGoal', { defaultValue: 'Add Goal' })}
                  </Button>
                </div>

                <div className="space-y-2">
                  {templateGoals.map((goal, idx) => (
                    <div key={idx} className="p-2.5 border rounded-lg bg-background space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground w-6">#{idx + 1}</span>
                        <input
                          type="text"
                          className="flex-1 text-xs p-2 border rounded bg-background focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder={t('templateModal.goalPlaceholder', { defaultValue: 'Goal title (e.g. Complete architecture onboarding deep-dive)' })}
                          value={goal.title}
                          onChange={(e) => {
                            const updated = [...templateGoals];
                            updated[idx].title = e.target.value;
                            setTemplateGoals(updated);
                          }}
                        />
                        {templateGoals.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-destructive hover:bg-destructive/10"
                            onClick={() => setTemplateGoals(templateGoals.filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      <input
                        type="text"
                        className="w-full text-xs p-1.5 text-muted-foreground border-dashed border rounded bg-muted/10 focus:outline-none"
                        placeholder={t('templateModal.goalDescPlaceholder', { defaultValue: 'Optional description / acceptance criteria...' })}
                        value={goal.description}
                        onChange={(e) => {
                          const updated = [...templateGoals];
                          updated[idx].description = e.target.value;
                          setTemplateGoals(updated);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Self-Reflection Questionnaire Builder */}
              <div className="space-y-2.5 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <HelpCircle className="h-4 w-4 text-indigo-600" />
                      {t('templateModal.questionnaireTitle', { count: templateQuestions.length, defaultValue: 'Employee Check-In Questionnaire ({{count}})' })}
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      {t('templateModal.questionnaireDesc', { defaultValue: 'Self-reflection questions the employee answers before manager review.' })}
                    </p>
                  </div>
                  <Button
                    id="add-template-question-btn"
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => setTemplateQuestions([...templateQuestions, { question: '', type: 'text', required: true }])}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> {t('templateModal.addQuestion', { defaultValue: 'Add Question' })}
                  </Button>
                </div>

                <div className="space-y-2">
                  {templateQuestions.map((q, idx) => (
                    <div key={idx} className="p-2.5 border rounded-lg bg-background flex items-start gap-2">
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <input
                          type="text"
                          className="sm:col-span-3 text-xs p-2 border rounded bg-background focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder={t('templateModal.questionPlaceholder', { index: idx + 1, defaultValue: `Question #${idx + 1} (e.g. What challenges did you encounter?)` })}
                          value={q.question}
                          onChange={(e) => {
                            const updated = [...templateQuestions];
                            updated[idx].question = e.target.value;
                            setTemplateQuestions(updated);
                          }}
                        />
                        <select
                          className="text-xs p-2 border rounded bg-background focus:outline-none"
                          value={q.type}
                          onChange={(e) => {
                            const updated = [...templateQuestions];
                            updated[idx].type = e.target.value as any;
                            setTemplateQuestions(updated);
                          }}
                        >
                          <option value="text">{t('templateModal.typeText', { defaultValue: 'Text Response' })}</option>
                          <option value="rating">{t('templateModal.typeRating', { defaultValue: 'Rating (1-5)' })}</option>
                          <option value="boolean">{t('templateModal.typeBoolean', { defaultValue: 'Yes / No' })}</option>
                        </select>
                      </div>
                      {templateQuestions.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-destructive hover:bg-destructive/10"
                          onClick={() => setTemplateQuestions(templateQuestions.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </DialogBody>

            <DialogFooter className="pt-3 border-t">
              <Button type="button" variant="outline" onClick={() => setIsTemplateModalOpen(false)}>
                {t('templateModal.cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button
                id="save-milestone-template-btn"
                type="submit"
                disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              >
                {createTemplateMutation.isPending || updateTemplateMutation.isPending ? (
                  t('templateModal.saving', { defaultValue: 'Saving...' })
                ) : editingTemplate ? (
                  t('templateModal.saveChanges', { defaultValue: 'Save Changes' })
                ) : (
                  t('templateModal.createTemplate', { defaultValue: 'Create Template' })
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Manual Milestone Assignment */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-indigo-600" />
              {t('assignModal.title', { defaultValue: 'Assign Milestone Check-in Program' })}
            </DialogTitle>
            <DialogDescription>
              {t('assignModal.desc', { defaultValue: 'Assign a Day 30, 60, 90, or 180 evaluation checkpoint to an employee.' })}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {t('assignModal.targetEmployee', { defaultValue: 'Target Employee *' })}
              </label>
              <SearchableSelect
                value={assignEmployeeId}
                onChange={(val) => setAssignEmployeeId(val)}
                placeholder={t('assignModal.searchEmployeePlaceholder', { defaultValue: 'Search employee by name, email, department...' })}
                options={employees.map((emp) => ({
                  value: emp.id,
                  label: emp.name,
                  sublabel: `${emp.department || t('assignModal.defaultEmployeeDept', { defaultValue: 'Employee' })} • ${emp.email}`,
                  badge: emp.hireDate ? t('assignModal.hiredBadge', { date: emp.hireDate, defaultValue: 'Hired {{date}}' }) : undefined,
                }))}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {t('assignModal.templateLabel', { defaultValue: 'Milestone Template *' })}
              </label>
              <select
                id="assign-milestone-template-select"
                value={assignTemplateId}
                onChange={(e) => setAssignTemplateId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">{t('assignModal.selectProgramPlaceholder', { defaultValue: 'Select Milestone Program' })}</option>
                {(templates || []).map((tmpl) => (
                  <option key={tmpl._id} value={tmpl._id}>
                    {t('assignModal.templateOption', { day: tmpl.targetDay, title: tmpl.title, count: tmpl.goals?.length || 0, defaultValue: 'Day {{day}} - {{title}} ({{count}} goals)' })}
                  </option>
                ))}
              </select>
            </div>

            {/* Projected Due Date Preview */}
            {(() => {
              const selEmp = employees.find((e) => e.id === assignEmployeeId);
              const selTmpl = (templates || []).find((tmpl) => tmpl._id === assignTemplateId);
              if (!selEmp || !selTmpl) return null;

              const hireDateObj = selEmp.hireDate && !isNaN(new Date(selEmp.hireDate).getTime())
                ? new Date(selEmp.hireDate)
                : new Date();
              const projectedDueDate = new Date(hireDateObj.getTime() + (selTmpl.targetDay || 30) * 24 * 60 * 60 * 1000);

              return (
                <div className="p-3 bg-muted/40 rounded-xl border border-border/60 text-xs space-y-1.5">
                  <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider block">
                    {t('assignModal.scheduleTitle', { defaultValue: 'Calculated Milestone Schedule:' })}
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('assignModal.hireDate', { defaultValue: 'Employee Hire Date:' })}</span>
                    <span className="font-medium text-foreground">{hireDateObj.toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('assignModal.targetInterval', { defaultValue: 'Target Interval:' })}</span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {t('assignModal.daysInterval', { days: selTmpl.targetDay, defaultValue: '+{{days}} Days' })}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-border/50 font-semibold">
                    <span className="text-indigo-600 dark:text-indigo-400">{t('assignModal.projectedDueDate', { defaultValue: 'Projected Due Date:' })}</span>
                    <span className="font-mono text-foreground">{projectedDueDate.toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })()}
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>
              {t('assignModal.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              id="confirm-assign-milestone-btn"
              disabled={assignMilestoneMutation.isPending || !assignTemplateId || !assignEmployeeId}
              onClick={handleConfirmAssign}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
            >
              {assignMilestoneMutation.isPending ? t('assignModal.assigning', { defaultValue: 'Assigning...' }) : t('assignModal.confirmAssign', { defaultValue: 'Confirm Assignment' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Detailed Milestone Inspection */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedMilestone && (() => {
            const m = selectedMilestone;
            const empName = m.employeeId?.profile
              ? `${m.employeeId.profile.firstName || ''} ${m.employeeId.profile.lastName || ''}`.trim()
              : (m.employeeId?.name || 'Employee');
            const empDept = m.employeeId?.employment?.department || 'General';
            const empTitle = m.employeeId?.employment?.jobTitle || m.employeeId?.employment?.designation || '';
            const completedCount = m.goalsProgress?.filter((g: any) => g.completed).length || 0;
            const totalCount = m.goalsProgress?.length || 1;
            const pct = Math.round((completedCount / totalCount) * 100);

            return (
              <>
                <DialogHeader>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge className="bg-indigo-600 text-white font-bold text-xs">
                      {t('myMilestones.dayBadge', { day: m.targetDay, defaultValue: `Day ${m.targetDay}` })}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        m.status === 'completed' || m.status === 'approved'
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                          : m.status === 'in_review' || m.status === 'pending_manager_review'
                          ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                          : m.status === 'revision_requested'
                          ? 'bg-red-500/10 text-red-600 border-red-500/20'
                          : 'bg-slate-500/10 text-slate-600 border-slate-500/20'
                      }`}
                    >
                      {m.status ? m.status.replace(/_/g, ' ') : t('teamMilestones.selfCheckinPending', { defaultValue: 'Self Check-in Pending' })}
                    </Badge>
                    {m.sla?.autoApprovalEligible && (
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                        {t('teamMilestones.autoApprovalEligible', { defaultValue: 'Auto-Approval Eligible' })}
                      </Badge>
                    )}
                  </div>
                  <DialogTitle className="text-lg font-bold">{m.milestoneTitle}</DialogTitle>
                  <DialogDescription className="text-xs">
                    {t('detailsModal.targetDueDate', { date: new Date(m.dueDate).toLocaleDateString(), defaultValue: `Target Due Date: ${new Date(m.dueDate).toLocaleDateString()}` })}
                    {empName && ` • ${t('detailsModal.directReport', { defaultValue: 'Direct Report' })}: ${empName} (${empDept}${empTitle ? ` • ${empTitle}` : ''})`}
                  </DialogDescription>
                </DialogHeader>

                <DialogBody className="space-y-5">
                  {/* Goals & Progress Section */}
                  <div className="space-y-3 p-4 border rounded-xl bg-card">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="flex items-center gap-1.5 text-foreground">
                        <ListChecks className="h-4 w-4 text-indigo-600" />
                        {t('detailsModal.keyObjectives', { defaultValue: 'Milestone Key Objectives & Goals' })}
                      </span>
                      <span className="text-muted-foreground font-mono">
                        {completedCount} / {totalCount} ({pct}%)
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />

                    <div className="space-y-2 pt-1">
                      {m.goalsProgress?.map((g: any, idx: number) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleToggleGoal(m, g.goalTitle, g.completed)}
                          className={`w-full p-2.5 border rounded-lg text-xs flex items-center justify-between text-left transition-colors cursor-pointer ${
                            g.completed
                              ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                              : 'bg-muted/20 hover:bg-muted/40 border-border'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {g.completed ? (
                              <CheckSquare className="h-4 w-4 text-emerald-600 shrink-0" />
                            ) : (
                              <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <span className={g.completed ? 'line-through text-muted-foreground' : 'font-medium'}>
                              {g.goalTitle}
                            </span>
                          </div>
                          {g.completedAt && (
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(g.completedAt).toLocaleDateString()}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Employee Self Check-In Reflections Section */}
                  <div className="p-4 border rounded-xl bg-muted/20 space-y-3 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <UserCheck className="h-4 w-4 text-indigo-600" />
                        {t('detailsModal.selfEvaluation', { defaultValue: 'Employee Self-Evaluation' })}
                      </span>
                      {m.employeeRating || m.employeeSelfCheck?.confidenceRating ? (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200">
                          {t('detailsModal.starsRating', { rating: m.employeeRating || m.employeeSelfCheck?.confidenceRating, defaultValue: `★ ${m.employeeRating || m.employeeSelfCheck?.confidenceRating} / 5 Stars` })}
                        </span>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">{t('detailsModal.notSubmitted', { defaultValue: 'Not submitted' })}</Badge>
                      )}
                    </div>

                    {m.comments || m.employeeSelfCheck?.comments || m.employeeSelfCheck?.reflectionNotes ? (
                      <div>
                        <span className="text-muted-foreground text-[11px] font-medium block mb-1">{t('detailsModal.reflectionAccomplishments', { defaultValue: 'Reflection Notes & Accomplishments:' })}</span>
                        <p className="italic text-foreground bg-card p-3 rounded-lg border leading-relaxed">
                          "{m.comments || m.employeeSelfCheck?.comments || m.employeeSelfCheck?.reflectionNotes}"
                        </p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground italic">
                        {t('detailsModal.reflectionNotSubmitted', { defaultValue: 'Self check-in reflection has not been submitted yet. The employee can submit once key objectives are complete.' })}
                      </p>
                    )}

                    {m.employeeSelfCheck?.responses && m.employeeSelfCheck.responses.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-border/50">
                        <span className="text-muted-foreground text-[11px] font-medium block">{t('detailsModal.checkinPrompts', { defaultValue: 'Responses to Check-In Prompts:' })}</span>
                        {m.employeeSelfCheck.responses.map((resp: any, rIdx: number) => (
                          <div key={rIdx} className="bg-card p-2.5 rounded border text-xs">
                            <span className="font-semibold block text-foreground mb-1">{resp.question}</span>
                            <span className="text-muted-foreground">{resp.answer}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Manager Review & Evaluation Section */}
                  <div className="p-4 border rounded-xl bg-indigo-50/20 dark:bg-indigo-950/20 space-y-2.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                        <Award className="h-4 w-4 text-indigo-600" />
                        {t('detailsModal.managerSignoff', { defaultValue: 'Manager Sign-Off & Performance Feedback' })}
                      </span>
                      {m.managerRating || m.managerReview?.performanceRating ? (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200">
                          {t('detailsModal.managerRatingStars', { rating: m.managerRating || m.managerReview?.performanceRating, defaultValue: `★ ${m.managerRating || m.managerReview?.performanceRating} / 5 Rating` })}
                        </span>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">{t('detailsModal.pendingReview', { defaultValue: 'Pending Review' })}</Badge>
                      )}
                    </div>

                    {m.managerFeedback || m.managerReview?.feedback ? (
                      <div className="space-y-1">
                        <p className="text-slate-700 dark:text-slate-300 italic bg-card p-3 rounded-lg border">
                          "{m.managerFeedback || m.managerReview?.feedback}"
                        </p>
                        {m.evaluatedAt && (
                          <span className="text-[10px] text-muted-foreground block text-right">
                            {t('detailsModal.evaluatedOn', { date: new Date(m.evaluatedAt).toLocaleDateString(), defaultValue: `Evaluated on ${new Date(m.evaluatedAt).toLocaleDateString()}` })}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground italic">
                        {t('detailsModal.noManagerEvaluation', { defaultValue: 'No manager evaluation recorded yet.' })}
                      </p>
                    )}
                  </div>

                  {/* Escalation & SLA ladder preview */}
                  {m.sla && (
                    <MilestoneEscalationLadder sla={m.sla} status={m.status} submittedAt={m.submittedAt} />
                  )}
                </DialogBody>

                <DialogFooter className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <div className="flex gap-2">
                    {canManageTemplates && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => {
                          setStatusToSet(m.status || 'pending');
                          setStatusRating(m.managerRating || 5);
                          setStatusFeedback(m.managerFeedback || '');
                          setIsStatusModalOpen(true);
                        }}
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
                        {t('detailsModal.changeStatus', { defaultValue: 'Change Status' })}
                      </Button>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={scheduleReviewMutation.isPending}
                      className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/40 text-xs flex items-center gap-1.5"
                      onClick={() => handleScheduleReview(m)}
                    >
                      <Calendar className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      {t('teamMilestones.scheduleReviewSync', { defaultValue: 'Schedule 1-on-1 Review' })}
                    </Button>

                    {canManageTemplates && (
                      <Button
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                        onClick={() => {
                          setManagerRating(m.managerRating || 5);
                          setApprovalStatus(m.status === 'revision_requested' ? 'needs_action' : 'approved');
                          setManagerFeedback(m.managerFeedback || 'Performance meets ramp-up expectations.');
                          setIsManagerReviewOpen(true);
                        }}
                      >
                        <UserCheck className="h-3.5 w-3.5 mr-1" />
                        {t('detailsModal.reviewSignoff', { defaultValue: 'Review / Sign-Off' })}
                      </Button>
                    )}

                    {(!canManageTemplates || activeTab === 'my') && (m.status === 'pending' || m.status === 'revision_requested') && (
                      <Button
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                        onClick={() => {
                          setCompletedGoals(m.goalsProgress?.filter((g: any) => g.completed).map((g: any) => g.goalTitle) || []);
                          setIsSelfCheckinOpen(true);
                        }}
                      >
                        {t('detailsModal.submitSelfEvaluation', { defaultValue: 'Submit Self-Evaluation' })}
                      </Button>
                    )}

                    <Button variant="outline" size="sm" onClick={() => setIsDetailsModalOpen(false)}>
                      {t('detailsModal.close', { defaultValue: 'Close' })}
                    </Button>
                  </div>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Modal: Direct Status Change for Managers & Admins */}
      <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-indigo-600" />
              {t('statusModal.title', { defaultValue: 'Change Milestone Status' })}
            </DialogTitle>
            <DialogDescription>
              {t('statusModal.desc', { defaultValue: 'Directly override or update milestone status, rating, and audit notes.' })}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {t('statusModal.targetStatusLabel', { defaultValue: 'Target Status *' })}
              </label>
              <select
                id="milestone-status-select"
                value={statusToSet}
                onChange={(e) => setStatusToSet(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="pending">{t('statusModal.options.pending', { defaultValue: 'Pending (Self Check-in Pending)' })}</option>
                <option value="in_review">{t('statusModal.options.inReview', { defaultValue: 'In Review (Awaiting Manager Review)' })}</option>
                <option value="approved">{t('statusModal.options.approved', { defaultValue: 'Approved (Sign-Off Complete)' })}</option>
                <option value="completed">{t('statusModal.options.completed', { defaultValue: 'Completed & Verified' })}</option>
                <option value="revision_requested">{t('statusModal.options.revisionRequested', { defaultValue: 'Revision Requested' })}</option>
                <option value="overdue">{t('statusModal.options.overdue', { defaultValue: 'Overdue' })}</option>
              </select>
            </div>

            {(statusToSet === 'approved' || statusToSet === 'completed') && (
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  {t('statusModal.ratingLabel', { defaultValue: 'Performance Rating (1 to 5 Stars):' })}
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setStatusRating(star)}
                      className={`p-2 rounded border flex items-center justify-center transition-colors ${
                        statusRating >= star ? 'bg-amber-100 border-amber-400 text-amber-600' : 'bg-background'
                      }`}
                    >
                      <Star className="h-4 w-4 fill-current" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                {t('statusModal.notesLabel', { defaultValue: 'Status Note / Feedback:' })}
              </label>
              <textarea
                className="w-full min-h-[85px] text-xs p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-background"
                placeholder={t('statusModal.notesPlaceholder', { defaultValue: 'Enter audit note, sign-off approval feedback, or revision details...' })}
                value={statusFeedback}
                onChange={(e) => setStatusFeedback(e.target.value)}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStatusModalOpen(false)}>
              {t('statusModal.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              id="submit-status-change-btn"
              disabled={updateStatusMutation.isPending}
              onClick={handleStatusChangeSubmit}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs"
            >
              {updateStatusMutation.isPending ? t('statusModal.saving', { defaultValue: 'Updating...' }) : t('statusModal.save', { defaultValue: 'Save Status Change' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Milestones;
