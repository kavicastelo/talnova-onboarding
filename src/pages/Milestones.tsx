import React, { useState } from 'react';
import {
  CalendarCheck,
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
  HelpCircle
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
  useSubmitManagerReview
} from '../hooks/useMilestones';
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

export const Milestones: React.FC = () => {
  const { role, can } = useRole();
  const isAdmin = role === 'admin' || role === 'owner' || role === 'super_admin' || role === 'hr_admin';
  const isManager = can('create_milestone') || can('assign_milestone');
  const canManageTemplates = isAdmin || isManager;

  const [activeTab, setActiveTab] = useState<'my' | 'team' | 'templates'>(isManager ? 'team' : 'my');

  // Modals state
  const [selectedMilestone, setSelectedMilestone] = useState<any>(null);
  const [isSelfCheckinOpen, setIsSelfCheckinOpen] = useState(false);
  const [isManagerReviewOpen, setIsManagerReviewOpen] = useState(false);

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

  const handleOpenAssignModal = (preselectedTemplateId?: string, preselectedEmployeeId?: string) => {
    const tmplId = preselectedTemplateId || (templates && templates.length > 0 ? templates[0]._id : '');
    const empId = preselectedEmployeeId || (employees.length > 0 ? employees[0].id : '');
    setAssignTemplateId(tmplId);
    setAssignEmployeeId(empId);
    setIsAssignModalOpen(true);
  };

  const handleConfirmAssign = () => {
    if (!assignTemplateId || !assignEmployeeId) {
      toast.error('Please select both an employee and milestone template.');
      return;
    }
    assignMilestoneMutation.mutate(
      { templateId: assignTemplateId, employeeId: assignEmployeeId },
      {
        onSuccess: () => {
          toast.success('Milestone program successfully assigned to employee!');
          setIsAssignModalOpen(false);
          refetchTeam();
          refetchMy();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to assign milestone');
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
          toast.success('Self-evaluation submitted successfully!');
          setIsSelfCheckinOpen(false);
          setSelectedMilestone(null);
          refetchMy();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to submit check-in');
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
          toast.success('Manager review & rating submitted successfully!');
          setIsManagerReviewOpen(false);
          setSelectedMilestone(null);
          refetchTeam();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to submit review');
        }
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

  const handleOpenEditTemplate = (t: MilestoneTemplate) => {
    setEditingTemplate(t);
    setTemplateTitle(t.title || '');
    setTemplateTargetDay(t.targetDay || 30);
    setTemplateDescription(t.description || '');
    setTemplateGoals(
      t.goals && t.goals.length > 0
        ? t.goals.map((g) => ({ title: g.title || '', description: g.description || '' }))
        : [{ title: '', description: '' }]
    );
    setTemplateQuestions(
      t.checkinQuestions && t.checkinQuestions.length > 0
        ? t.checkinQuestions.map((q) => ({ question: q.question || '', type: q.type || 'text', required: q.required ?? true }))
        : [{ question: '', type: 'text', required: true }]
    );
    setTemplateAutoAssign(t.audience?.autoAssignNewHires ?? true);
    setIsTemplateModalOpen(true);
  };

  const handleTemplateFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateTitle.trim()) {
      toast.error('Template title cannot be empty.');
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
            toast.success('Milestone template updated successfully!');
            setIsTemplateModalOpen(false);
            setEditingTemplate(null);
            refetchTemplates();
          },
          onError: (err: any) => {
            toast.error(err?.response?.data?.message || err?.message || 'Failed to update template');
          },
        }
      );
    } else {
      createTemplateMutation.mutate(payload, {
        onSuccess: () => {
          toast.success('Milestone template created successfully!');
          setIsTemplateModalOpen(false);
          refetchTemplates();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to create template');
        },
      });
    }
  };

  const handleDeleteTemplate = (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete the template "${title}"?`)) {
      deleteTemplateMutation.mutate(id, {
        onSuccess: () => {
          toast.success('Milestone template deleted successfully!');
          refetchTemplates();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to delete template');
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
            30 / 60 / 90-Day Milestones & Check-Ins
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track early onboarding progression, conduct structured self-evaluations, and receive manager performance reviews.
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
            <Plus className="h-4 w-4 mr-2" /> Create Milestone Template
          </Button>
        )}
      </div>

      {/* Program Summary Banner Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-sky-500 bg-sky-50/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-sky-700">
              <Clock className="h-4 w-4" /> Day 30 — Fast-Start & Orientation
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Complete team introductions, initial IT setup, security training, and first learning journey.
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500 bg-indigo-50/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-indigo-700">
              <Award className="h-4 w-4" /> Day 60 — Execution & Autonomy
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Deliver independent project contributions, shadow senior mentors, and master core workflow tools.
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> Day 90 — Full Integration & Graduation
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Achieve full operational productivity, conduct comprehensive probation review, and set quarterly goals.
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
          <CalendarCheck className="h-4 w-4" /> My Milestones ({myMilestones?.length || 0})
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
            <UserCheck className="h-4 w-4" /> Team Milestone Reviews ({teamMilestones?.length || 0})
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
            <Building2 className="h-4 w-4" /> Milestone Templates ({templates?.length || 0})
          </button>
        )}
      </div>

      {/* Tab 1: My Milestones Timeline */}
      {activeTab === 'my' && (
        <div className="space-y-6">
          {myLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading your milestones...</div>
          ) : (myMilestones || []).length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border-2 border-dashed rounded-lg">
              No 30/60/90-day milestones assigned yet. Automatic schedule will calculate upon onboarding initiation.
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
                              Day {m.targetDay}
                            </Badge>
                            <div>
                              <CardTitle className="text-base font-semibold">{m.milestoneTitle}</CardTitle>
                              <CardDescription className="text-xs">
                                Target Due Date: {new Date(m.dueDate).toLocaleDateString()}
                              </CardDescription>
                            </div>
                          </div>

                          <div>
                            {(m.status === 'completed' || m.status === 'approved') && (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Milestone Completed & Approved
                              </Badge>
                            )}
                            {(m.status === 'in_review' || m.status === 'pending_manager_review') && (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                                <Clock className="h-3.5 w-3.5 mr-1" /> Submitted — Awaiting Manager Sign-off
                              </Badge>
                            )}
                            {m.status === 'revision_requested' && (
                              <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                                Revision Requested
                              </Badge>
                            )}
                            {m.status === 'pending' && (
                              <Badge variant="outline" className="bg-slate-500/10 text-slate-600 border-slate-500/20">
                                In Progress
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="p-6 space-y-6">
                        {/* Progress Bar */}
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs font-semibold">
                            <span>Milestone Goals Progress</span>
                            <span>
                              {completedGoalsCount} of {totalGoalsCount} Goals ({progressPct}%)
                            </span>
                          </div>
                          <Progress value={progressPct} className="h-2" />
                        </div>

                        {/* Goals List */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase">Key Objectives & Goals</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {m.goalsProgress?.map((g, idx) => (
                              <div key={idx} className="p-2.5 border rounded-md text-xs flex items-center justify-between bg-card">
                                <span>{g.goalTitle}</span>
                                {g.completed ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                ) : (
                                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Manager Feedback section if completed */}
                        {(m.managerFeedback || m.managerReview?.feedback) && (
                          <div className="p-4 border rounded-lg bg-indigo-50/20 text-xs space-y-1">
                            <span className="font-semibold text-indigo-700 flex items-center gap-1">
                              <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /> Manager Feedback (Rating: {m.managerRating || m.managerReview?.performanceRating || 5}/5):
                            </span>
                            <p className="text-slate-700 italic">"{m.managerFeedback || m.managerReview?.feedback}"</p>
                          </div>
                        )}

                        {/* Action Button */}
                        {m.status === 'pending' && (
                          <div className="pt-2 flex justify-end">
                            <Button
                              id="open-self-evaluation-btn"
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                              onClick={() => {
                                setSelectedMilestone(m);
                                setCompletedGoals(m.goalsProgress?.filter((g) => g.completed).map((g) => g.goalTitle) || []);
                                setIsSelfCheckinOpen(true);
                              }}
                            >
                              Submit Self-Evaluation
                            </Button>
                          </div>
                        )}
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
                itemLabel="milestones"
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
                <CardTitle className="text-base font-semibold">Direct Report 30/60/90 Check-Ins</CardTitle>
                <CardDescription>Review self-assessments, track SLAs, and approve onboarding milestones for team members.</CardDescription>
              </div>
              <Button
                id="assign-milestone-team-btn"
                className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 text-xs h-9 gap-1.5"
                onClick={() => handleOpenAssignModal()}
              >
                <UserPlus className="h-4 w-4" /> Assign Milestone Program
              </Button>
            </div>

            {/* Filter Chips and Search Bar */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: 'All Reviews', count: (teamMilestones || []).length },
                  { id: 'awaiting_review', label: 'Awaiting Sign-off', count: (teamMilestones || []).filter((m) => m.status === 'in_review' || m.status === 'pending_manager_review').length },
                  { id: 'pending_checkin', label: 'Pending Check-in', count: (teamMilestones || []).filter((m) => m.status === 'pending' || !m.status).length },
                  { id: 'approved', label: 'Approved', count: (teamMilestones || []).filter((m) => m.status === 'completed' || m.status === 'approved').length },
                  { id: 'overdue', label: 'Overdue / Escalated', count: (teamMilestones || []).filter((m) => (m.dueDate && new Date(m.dueDate).getTime() < Date.now() && m.status !== 'completed' && m.status !== 'approved') || m.sla?.escalationState === 'escalated').length },
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
                  placeholder="Search team member or title..."
                  value={teamSearchQuery}
                  onChange={(e) => setTeamSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border/80 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {teamLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading team milestones...</div>
            ) : (teamMilestones || []).length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No direct report milestones requiring review.</div>
            ) : (
              <div>
                <div className="divide-y">
                  {teamPagination.paginatedData.map((m) => {
                    const empName = m.employeeId?.profile
                      ? `${m.employeeId.profile.firstName || ''} ${m.employeeId.profile.lastName || ''}`
                      : 'Direct Report';
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
                                Day {m.targetDay}
                              </Badge>
                              {m.sla?.autoApprovalEligible && (
                                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                                  Auto-Approval Eligible
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {m.milestoneTitle} | Target Due: {new Date(m.dueDate).toLocaleDateString()}
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            {m.status === 'completed' || m.status === 'approved' ? (
                              <Badge
                                id={`badge-approved-${mid}`}
                                variant="outline"
                                className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium flex items-center gap-1"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Approved (Rating: {m.managerRating || m.managerReview?.performanceRating || 5}/5)
                              </Badge>
                            ) : m.status === 'revision_requested' ? (
                              <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                                Revision Requested
                              </Badge>
                            ) : m.status === 'in_review' || m.status === 'pending_manager_review' ? (
                              <Button
                                id={`review-milestone-btn-${mid}`}
                                size="sm"
                                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5"
                                onClick={() => {
                                  setSelectedMilestone(m);
                                  setManagerRating(5);
                                  setApprovalStatus('approved');
                                  const feedbackText = typeof m.aiSummary === 'string'
                                    ? m.aiSummary
                                    : m.aiSummary?.summary || 'Exceeded expectations on ramp-up. Completed initial project ahead of schedule.';
                                  setManagerFeedback(feedbackText);
                                  setIsManagerReviewOpen(true);
                                }}
                              >
                                <UserCheck className="h-3.5 w-3.5" /> Review Milestone
                              </Button>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                Self Check-in Pending
                              </Badge>
                            )}
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
                                    : m.aiSummary?.summary || 'Approved via 1-click evaluation';
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
                    itemLabel="milestones"
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
                Company Milestone Programs & Check-in Templates
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Define standard 30, 60, 90, or 180-day expectations, objectives, and reflection questionnaires for new hires.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                id="assign-milestone-template-header-btn"
                variant="outline"
                className="text-xs h-9 gap-1.5"
                onClick={() => handleOpenAssignModal()}
              >
                <UserPlus className="h-4 w-4" /> Assign to Employee
              </Button>
              <Button
                id="create-milestone-template-btn"
                className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 text-xs h-9"
                onClick={handleOpenCreateTemplate}
              >
                <Plus className="h-4 w-4 mr-1.5" /> Create Template
              </Button>
            </div>
          </div>

          {templatesLoading ? (
            <div className="p-12 text-center text-muted-foreground">Loading templates...</div>
          ) : (templates || []).length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed rounded-xl space-y-3">
              <Building2 className="h-10 w-10 text-muted-foreground mx-auto" />
              <h4 className="font-semibold">No milestone templates defined yet</h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Set up 30-day, 60-day, or 90-day milestone templates with goals and reflection questions to automate new hire onboarding reviews.
              </p>
              <Button
                id="create-first-milestone-template-btn"
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={handleOpenCreateTemplate}
              >
                <Plus className="h-4 w-4 mr-2" /> Create First Template
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {templatesPagination.paginatedData.map((t) => (
                  <Card key={t._id} className="hover:border-indigo-500/50 transition-all flex flex-col justify-between">
                    <div>
                      <CardHeader className="pb-3 border-b">
                        <div className="flex items-center justify-between gap-2">
                          <Badge className="bg-indigo-600 text-white font-bold px-2.5 py-0.5 text-xs">
                            Day {t.targetDay}
                          </Badge>
                          <div className="flex items-center gap-1.5">
                            <Button
                              id={`assign-template-btn-${t._id}`}
                              size="sm"
                              className="h-8 px-2.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
                              onClick={() => handleOpenAssignModal(t._id)}
                            >
                              <UserPlus className="h-3.5 w-3.5 mr-1" /> Assign
                            </Button>
                            <Button
                              id={`edit-template-btn-${t._id}`}
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 text-xs font-medium"
                              onClick={() => handleOpenEditTemplate(t)}
                            >
                              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                            </Button>
                            <Button
                              id={`delete-template-btn-${t._id}`}
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteTemplate(t._id, t.title)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <CardTitle className="text-base font-semibold mt-2 line-clamp-1">{t.title}</CardTitle>
                        {t.description && (
                          <CardDescription className="text-xs line-clamp-2 mt-1">
                            {t.description}
                          </CardDescription>
                        )}
                      </CardHeader>

                      <CardContent className="p-4 space-y-4 text-xs">
                        {/* Goals summary */}
                        <div>
                          <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1 mb-1.5">
                            <ListChecks className="h-3.5 w-3.5 text-indigo-600" />
                            Milestone Goals ({t.goals?.length || 0})
                          </span>
                          {t.goals && t.goals.length > 0 ? (
                            <ul className="space-y-1">
                              {t.goals.slice(0, 3).map((g: any, idx: number) => (
                                <li key={idx} className="flex items-start gap-1.5 text-foreground/90">
                                  <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                                  <span className="line-clamp-1">{g.title}</span>
                                </li>
                              ))}
                              {t.goals.length > 3 && (
                                <li className="text-[11px] text-muted-foreground italic pl-4.5">
                                  +{t.goals.length - 3} more goals
                                </li>
                              )}
                            </ul>
                          ) : (
                            <p className="text-muted-foreground italic">No goals defined</p>
                          )}
                        </div>

                        {/* Check-in Questions summary */}
                        <div>
                          <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1 mb-1.5">
                            <FileQuestion className="h-3.5 w-3.5 text-indigo-600" />
                            Check-In Questions ({t.checkinQuestions?.length || 0})
                          </span>
                          {t.checkinQuestions && t.checkinQuestions.length > 0 ? (
                            <ul className="space-y-1">
                              {t.checkinQuestions.slice(0, 2).map((q: any, idx: number) => (
                                <li key={idx} className="flex items-start justify-between gap-2 text-foreground/90">
                                  <span className="line-clamp-1">{q.question}</span>
                                  <span className="text-[10px] bg-muted px-1.5 py-0.2 rounded shrink-0 uppercase">
                                    {q.type}
                                  </span>
                                </li>
                              ))}
                              {t.checkinQuestions.length > 2 && (
                                <li className="text-[11px] text-muted-foreground italic">
                                  +{t.checkinQuestions.length - 2} more questions
                                </li>
                              )}
                            </ul>
                          ) : (
                            <p className="text-muted-foreground italic">No questions defined</p>
                          )}
                        </div>
                      </CardContent>
                    </div>

                    <div className="p-3 border-t bg-muted/10 rounded-b-xl flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        {t.audience?.autoAssignNewHires !== false ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                            <Sparkles className="h-3 w-3" /> Auto-assigned to new hires
                          </span>
                        ) : (
                          <span>Manual assignment</span>
                        )}
                      </span>
                      <span>Target: Day {t.targetDay}</span>
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
                itemLabel="templates"
              />
            </div>
          )}
        </div>
      )}

      {/* Modal: Employee Self-Evaluation */}
      <Dialog open={isSelfCheckinOpen} onOpenChange={setIsSelfCheckinOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Day {selectedMilestone?.targetDay} Milestone Evaluation</DialogTitle>
            <DialogDescription>Evaluate your progress, select your confidence rating, and submit reflections for your manager.</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-2">Check-off Completed Goals:</label>
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
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Confidence in Role (1 to 5 Stars):</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    id={`star-rating-${star}`}
                    aria-label={`Rate ${star} star`}
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
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Reflection Notes & Accomplishments:</label>
              <textarea
                id="reflection-notes-textarea"
                className="w-full min-h-[90px] text-sm p-2.5 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="Ramping up well on team workflows. Ready for independent tickets."
                value={selfComments}
                onChange={(e) => setSelfComments(e.target.value)}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSelfCheckinOpen(false)}>
              Cancel
            </Button>
            <Button
              id="submit-self-evaluation-btn"
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleSelfCheckinSubmit}
            >
              Submit Self-Evaluation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Manager Review & Approval */}
      <Dialog open={isManagerReviewOpen} onOpenChange={setIsManagerReviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Day {selectedMilestone?.targetDay} Milestone Check-In</DialogTitle>
            <DialogDescription>
              Review direct report's self-assessment and record manager sign-off.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            {/* Direct Report Submission Inspection Card */}
            <div id="employee-submitted-section" className="p-3.5 border rounded-lg bg-muted/20 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-indigo-600" /> Employee Self-Reflection:
                </span>
                <span id="employee-submitted-rating" className="inline-flex items-center gap-1 font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200">
                  ★ {selectedMilestone?.employeeRating || selectedMilestone?.employeeSelfCheck?.employeeRating || selectedMilestone?.employeeSelfCheck?.confidenceRating || 4} / 5 Stars
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium mb-1">Submitted Reflection & Notes:</span>
                <p id="employee-submitted-notes" className="italic text-foreground/90 bg-card p-2 rounded border leading-relaxed">
                  "{selectedMilestone?.comments || selectedMilestone?.employeeSelfCheck?.comments || selectedMilestone?.employeeSelfCheck?.reflectionNotes || 'Ramping up well on team workflows. Ready for independent tickets.'}"
                </p>
              </div>
              {selectedMilestone?.goalsProgress && selectedMilestone.goalsProgress.length > 0 && (
                <div>
                  <span className="text-muted-foreground block text-[11px] font-medium mb-1">Milestone Objectives Progress:</span>
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
                employeeName={selectedMilestone.employeeId?.profile?.firstName || 'Employee'}
                onQuickApprove={() => {
                  setApprovalStatus('approved');
                  setManagerRating(5);
                  setManagerFeedback(selectedMilestone.aiSummary?.summary || 'Approved with excellent feedback.');
                  toast.success('1-click feedback populated from AI synthesis');
                }}
              />
            )}

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Approval Status:</label>
              <select
                id="approval-status-select"
                className="w-full text-sm p-2.5 border rounded-md bg-background focus:outline-none"
                value={approvalStatus}
                onChange={(e: any) => setApprovalStatus(e.target.value)}
              >
                <option value="approved">Approve Milestone</option>
                <option value="revision_requested">Request Revision</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Manager Rating (1 to 5 Stars):</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    id={`manager-star-${star}`}
                    aria-label={`Rate ${star} star`}
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
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Manager Feedback & Sign-Off Notes:</label>
              <textarea
                id="manager-feedback-textarea"
                className="w-full min-h-[90px] text-sm p-2.5 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="Exceeded expectations on ramp-up. Completed initial project ahead of schedule."
                value={managerFeedback}
                onChange={(e) => setManagerFeedback(e.target.value)}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManagerReviewOpen(false)}>
              Cancel
            </Button>
            <Button
              id="approve-signoff-btn"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              onClick={handleManagerReviewSubmit}
            >
              Approve & Sign Off
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Create / Edit Milestone Template */}
      <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Milestone Template' : 'Create Milestone Template'}</DialogTitle>
            <DialogDescription>
              Define onboarding milestone expectations, goals, and self-reflection questionnaires.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTemplateFormSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <DialogBody className="space-y-5">
              {/* Title & Target Day */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Template Title *</label>
                  <input
                    id="template-title-input"
                    required
                    type="text"
                    className="w-full text-sm p-2.5 border rounded-md bg-background focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="e.g. Day 30 Fast-Start & Orientation"
                    value={templateTitle}
                    onChange={(e) => setTemplateTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Target Day *</label>
                  <select
                    id="template-target-day-select"
                    className="w-full text-sm p-2.5 border rounded-md bg-background focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    value={templateTargetDay}
                    onChange={(e) => setTemplateTargetDay(Number(e.target.value))}
                  >
                    <option value={30}>Day 30</option>
                    <option value={60}>Day 60</option>
                    <option value={90}>Day 90</option>
                    <option value={180}>Day 180</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Description / Summary</label>
                <textarea
                  id="template-description-input"
                  className="w-full min-h-[70px] text-sm p-2.5 border rounded-md bg-background focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Overview of expectations and requirements for this onboarding phase..."
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
                  Automatically schedule and assign this milestone to all newly hired employees
                </label>
              </div>

              {/* Key Goals / Objectives List */}
              <div className="space-y-2.5 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <ListChecks className="h-4 w-4 text-indigo-600" />
                      Key Goals & Objectives ({templateGoals.length})
                    </h4>
                    <p className="text-[11px] text-muted-foreground">Deliverables and achievements expected by this milestone.</p>
                  </div>
                  <Button
                    id="add-template-goal-btn"
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => setTemplateGoals([...templateGoals, { title: '', description: '' }])}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Goal
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
                          placeholder="Goal title (e.g. Complete architecture onboarding deep-dive)"
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
                        placeholder="Optional description / acceptance criteria..."
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
                      Employee Check-In Questionnaire ({templateQuestions.length})
                    </h4>
                    <p className="text-[11px] text-muted-foreground">Self-reflection questions the employee answers before manager review.</p>
                  </div>
                  <Button
                    id="add-template-question-btn"
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => setTemplateQuestions([...templateQuestions, { question: '', type: 'text', required: true }])}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Question
                  </Button>
                </div>

                <div className="space-y-2">
                  {templateQuestions.map((q, idx) => (
                    <div key={idx} className="p-2.5 border rounded-lg bg-background flex items-start gap-2">
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <input
                          type="text"
                          className="sm:col-span-3 text-xs p-2 border rounded bg-background focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder={`Question #${idx + 1} (e.g. What challenges did you encounter?)`}
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
                          <option value="text">Text Response</option>
                          <option value="rating">Rating (1-5)</option>
                          <option value="boolean">Yes / No</option>
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
                Cancel
              </Button>
              <Button
                id="save-milestone-template-btn"
                type="submit"
                disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              >
                {createTemplateMutation.isPending || updateTemplateMutation.isPending ? (
                  'Saving...'
                ) : editingTemplate ? (
                  'Save Changes'
                ) : (
                  'Create Template'
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
              Assign Milestone Check-in Program
            </DialogTitle>
            <DialogDescription>
              Assign a Day 30, 60, 90, or 180 evaluation checkpoint to an employee.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Target Employee *
              </label>
              <SearchableSelect
                value={assignEmployeeId}
                onChange={(val) => setAssignEmployeeId(val)}
                placeholder="Search employee by name, email, department..."
                options={employees.map((emp) => ({
                  value: emp.id,
                  label: emp.name,
                  sublabel: `${emp.department || 'Employee'} • ${emp.email}`,
                  badge: emp.hireDate ? `Hired ${emp.hireDate}` : undefined,
                }))}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Milestone Template *
              </label>
              <select
                id="assign-milestone-template-select"
                value={assignTemplateId}
                onChange={(e) => setAssignTemplateId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select Milestone Program</option>
                {(templates || []).map((t) => (
                  <option key={t._id} value={t._id}>
                    Day {t.targetDay} - {t.title} ({t.goals?.length || 0} goals)
                  </option>
                ))}
              </select>
            </div>

            {/* Projected Due Date Preview */}
            {(() => {
              const selEmp = employees.find((e) => e.id === assignEmployeeId);
              const selTmpl = (templates || []).find((t) => t._id === assignTemplateId);
              if (!selEmp || !selTmpl) return null;

              const hireDateObj = selEmp.hireDate && !isNaN(new Date(selEmp.hireDate).getTime())
                ? new Date(selEmp.hireDate)
                : new Date();
              const projectedDueDate = new Date(hireDateObj.getTime() + (selTmpl.targetDay || 30) * 24 * 60 * 60 * 1000);

              return (
                <div className="p-3 bg-muted/40 rounded-xl border border-border/60 text-xs space-y-1.5">
                  <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider block">
                    Calculated Milestone Schedule:
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Employee Hire Date:</span>
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
                    <span className="font-mono text-foreground">{projectedDueDate.toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })()}
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button
              id="confirm-assign-milestone-btn"
              disabled={assignMilestoneMutation.isPending || !assignTemplateId || !assignEmployeeId}
              onClick={handleConfirmAssign}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
            >
              {assignMilestoneMutation.isPending ? 'Assigning...' : 'Confirm Assignment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Milestones;
