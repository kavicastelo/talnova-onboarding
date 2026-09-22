import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from
  '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Progress } from '../components/Progress';
import { Skeleton } from '../components/Skeleton';
import { PlayCircle, Clock, Award, AlertCircle, RefreshCw, CheckSquare, FileText, Users, Flag, BookOpen, CheckCircle2, Check, Bot, Trophy, Package, Truck, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useAuth';
import { useEmployee } from '../hooks/useEmployees';
import { useJourneys, useAssignJourney } from '../hooks/useJourneys';
import { useTasks, useUpdateTaskStatus, useConfirmHardwareReceipt } from '../hooks/useTasks';
import { useEmployeeDocumentInbox } from '../hooks/useDocuments';
import { useMyBuddy } from '../hooks/useBuddy';
import { useMyMilestones } from '../hooks/useMilestones';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { SimplePagination } from '../components/SimplePagination';
import { usePagination } from '../hooks/usePagination';
import { useRole } from '../context/RoleContext';

export function EmployeeDashboard() {
  const { hasFeature } = useRole();
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { t } = useTranslation('dashboard');
  // Fetch current logged in employee's profile
  const { data: employee, isLoading: employeeLoading, isError, error, refetch } = useEmployee('me');

  const { data: publicJourneys = [] } = useJourneys();
  const { data: tasksData } = useTasks({ assignedToMe: true });
  const { data: employeeHardwareTasksData } = useTasks(employee?.id ? { employeeId: employee.id } : undefined);
  const { data: docInbox = [] } = useEmployeeDocumentInbox();
  const { data: buddyAssignment } = useMyBuddy();
  const { data: milestones = [] } = useMyMilestones();
  const assignJourneyMut = useAssignJourney();
  const updateTaskMutation = useUpdateTaskStatus();
  const confirmReceiptMut = useConfirmHardwareReceipt();

  const availablePublicJourneys = (publicJourneys || []).filter((pj: any) => {
    return !employee?.assignedJourneys?.some((aj: any) => aj.journeyId === pj.id);
  });

  const assignedPagination = usePagination({ data: employee?.assignedJourneys || [], initialPageSize: 6 });
  const publicPagination = usePagination({ data: availablePublicJourneys, initialPageSize: 6 });

  // Persistence key for employee onboarding handover confirmation
  const handoverStorageKey = `talnova_handover_completed_${employee?.id || user?.id || user?._id || 'default'}`;
  const [isHandoverAcknowledged, setIsHandoverAcknowledged] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(handoverStorageKey) === 'true' || employee?.status === 'Active';
    }
    return employee?.status === 'Active';
  });

  const openTasksCount = (tasksData?.tasks || []).filter((tk: any) => tk.status !== 'completed' && tk.status !== 'cancelled').length;
  const pendingDocs = (docInbox || []).filter((d: any) => d.status === 'pending');
  const pendingDocsCount = pendingDocs.length;

  const handleEnroll = (journeyId: string) => {
    if (!employee) return;
    assignJourneyMut.mutate(
      { journeyId, employeeId: employee.id },
      {
        onSuccess: () => {
          toast.success(t('employee.toasts.enrollSuccess', 'Successfully enrolled in the journey!'));
          refetch();
        },
        onError: (err: any) => {
          toast.error(err?.message || t('employee.toasts.enrollFailed', 'Failed to enroll.'));
        }
      }
    );
  };

  const handleToggleTask = (task: any) => {
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    updateTaskMutation.mutate(
      { id: task._id, status: nextStatus },
      {
        onSuccess: () => {
          toast.success(nextStatus === 'completed' ? t('employee.toasts.taskCompleted', 'Task marked as completed!') : t('employee.toasts.taskReverted', 'Task status reverted to pending'));
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || t('employee.toasts.taskFailed', 'Failed to update task'));
        }
      }
    );
  };

  const isLoading = userLoading || employeeLoading;

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-10 w-32" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isError || !employee) {
    return (
      <div className="max-w-md mx-auto text-center p-8 border rounded-lg space-y-4 my-12">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold">{t('employee.error.title', 'Failed to Load Dashboard')}</h2>
        <p className="text-muted-foreground">{(error as any)?.message || t('employee.error.desc', 'Your employee record could not be loaded.')}</p>
        <Button onClick={() => refetch()} className="mx-auto">
          <RefreshCw className="mr-2 h-4 w-4" /> {t('employee.error.retry', 'Retry')}
        </Button>
      </div>
    );
  }

  // Active journey details
  const assignedJourneys = employee.assignedJourneys || [];
  const activeJourney = assignedJourneys.find(j => j.status === 'In Progress') || assignedJourneys[0];
  const hasAssignedJourneys = assignedJourneys.length > 0;
  const allJourneysCompleted = hasAssignedJourneys && assignedJourneys.every(j => j.status === 'Completed');

  // State flags
  const isUnassignedNewUser = assignedJourneys.length === 0 && docInbox.length === 0 && (tasksData?.tasks || []).length === 0;
  const isCoreRequirementsMet = (!hasFeature('digital_signatures') || pendingDocsCount === 0) && openTasksCount === 0 && (hasAssignedJourneys ? allJourneysCompleted : false);
  const isOnboardingFullyCompleted = !isUnassignedNewUser && isCoreRequirementsMet && (isHandoverAcknowledged || employee.status === 'Active');

  // Lifecycle Stage Resolution:
  // Stage 0: Unassigned New Hire (Onboarding setup by HR/Admin in progress)
  // Stage 1: Compliance E-Signatures (Blocking prerequisite for LMS progression)
  // Stage 2: Operational / IT Checklists (Hardware & Workspace tasks)
  // Stage 3: LMS Learning Modules (Assigned role & compliance courses)
  // Stage 4: Peer Mentorship & 30-Day Check-in Handover
  // Stage 5: Active Employee Workspace (Unlocked post-handover portal)
  let currentStageIndex = 1;
  let activeStageTitle = t('employee.stages.stage1.title', 'Stage 1: Compliance E-Signatures (Prerequisite)');
  let activeStageDescription = t('employee.stages.stage1.desc', 'Review and sign required legal & policy documents before proceeding with your training modules.');
  let activeStageActionPath = pendingDocs.length > 0 ? `/documents/${pendingDocs[0]._id}/sign` : '/documents';
  let activeStageActionText = t('employee.stages.stage1.action', 'Sign Pending Documents');

  if (isUnassignedNewUser) {
    currentStageIndex = 0;
    activeStageTitle = t('employee.stages.stage0.title', 'Onboarding Package Setup in Progress');
    activeStageDescription = t('employee.stages.stage0.desc', 'Your customized onboarding curriculum, compliance paperwork, and IT checklists are being assembled by HR & IT.');
    activeStageActionPath = '/directory';
    activeStageActionText = t('employee.stages.stage0.action', 'Explore Team Directory');
  } else if (hasFeature('digital_signatures') && pendingDocsCount > 0) {
    currentStageIndex = 1;
    activeStageTitle = t('employee.stages.stage1.title', 'Stage 1: Compliance E-Signatures (Prerequisite)');
    activeStageDescription = t('employee.stages.stage1.desc', 'Review and sign required legal & policy documents before proceeding with your training modules.');
    activeStageActionPath = pendingDocs.length > 0 ? `/documents/${pendingDocs[0]._id}/sign` : '/documents';
    activeStageActionText = t('employee.stages.stage1.action', 'Sign Pending Documents');
  } else if (openTasksCount > 0) {
    currentStageIndex = 2;
    activeStageTitle = t('employee.stages.stage2.title', 'Stage 2: Operational & IT Setup Checklists');
    activeStageDescription = t('employee.stages.stage2.desc', 'Complete your assigned IT provisioning and workplace checklist tasks.');
    activeStageActionPath = '/tasks';
    activeStageActionText = t('employee.stages.stage2.action', 'View Operational Tasks');
  } else if (hasAssignedJourneys && !allJourneysCompleted) {
    currentStageIndex = 3;
    const fallbackCurriculum = t('employee.stages.stage3.fallbackTitle', 'Learning Curriculum');
    activeStageTitle = t('employee.stages.stage3.title', { title: activeJourney?.title || fallbackCurriculum, defaultValue: `Stage 3: LMS Module: ${activeJourney?.title || fallbackCurriculum}` });
    activeStageDescription = t('employee.stages.stage3.desc', { progress: activeJourney?.progress || 0, defaultValue: `Complete learning modules and knowledge checks (${activeJourney?.progress || 0}% completed).` });
    activeStageActionPath = activeJourney ? `/course/${activeJourney.id}` : '/journeys';
    activeStageActionText = t('employee.stages.stage3.action', 'Continue LMS Module');
  } else {
    currentStageIndex = 4;
    activeStageTitle = t('employee.stages.stage4.title', 'Stage 4: Peer Mentorship & 30-Day Check-in Handover');
    activeStageDescription = t('employee.stages.stage4.desc', 'All training and operational setup tasks are complete! Review your 30-day goals with your buddy to finalize onboarding handover.');
    activeStageActionPath = '/milestones';
    activeStageActionText = t('employee.stages.stage4.action', 'Review Milestones & Buddy');
  }

  // Calculate Overall Progress Score (0 to 100)
  let overallProgressPercent = 0;
  if (isUnassignedNewUser) {
    overallProgressPercent = 0;
  } else if (isOnboardingFullyCompleted) {
    overallProgressPercent = 100;
  } else if (isCoreRequirementsMet && !isOnboardingFullyCompleted) {
    overallProgressPercent = 90; // Stage 4: awaiting final handover acknowledgment
  } else {
    const docProgress = docInbox.length > 0 ? ((docInbox.length - pendingDocsCount) / docInbox.length) * 100 : 100;
    const totalTasks = (tasksData?.tasks || []).length;
    const taskProgress = totalTasks > 0 ? (((totalTasks - openTasksCount) / totalTasks) * 100) : 100;
    const courseProgress = hasAssignedJourneys
      ? Math.round(assignedJourneys.reduce((sum, j) => sum + (j.progress || 0), 0) / assignedJourneys.length)
      : 0;
    overallProgressPercent = Math.min(85, Math.round((docProgress * 0.30) + (taskProgress * 0.30) + (courseProgress * 0.40)));
  }

  // --- RENDERING OPTION 1: COMPLETED EMPLOYEE ACTIVE WORKSPACE ---
  if (isOnboardingFullyCompleted) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Celebratory Banner */}
        <div className="p-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Award className="h-6 w-6 text-yellow-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">{t('employee.workspace.celebrationTitle', 'Onboarding Completed! Welcome to Talnova.')}</h2>
              <p className="text-xs text-emerald-100 mt-0.5">
                {t('employee.workspace.celebrationDesc', 'All legal compliance, operational checklists, courses, and milestones are signed off.')}
              </p>
            </div>
          </div>
          <Button asChild variant="secondary" id="view-certificate-btn" className="font-semibold text-emerald-900 bg-white hover:bg-emerald-50 shrink-0 shadow-sm">
            <Link to="/certificates">
              {t('employee.workspace.viewCertBtn', 'View Certificate')}
            </Link>
          </Button>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                {t('employee.workspace.phaseBadge', 'Phase 5: Active Employee Workspace • Onboarding Completed')}
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              {t('employee.workspace.welcomeBack', { name: user?.name || employee?.fullName || employee?.name || 'Team Member', defaultValue: `Welcome Back, ${user?.name || employee?.fullName || employee?.name || 'Team Member'}!` })}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('employee.workspace.welcomeBackDesc', 'Your onboarding journey is 100% complete. Access your active workspace, knowledge base, and team tools below.')}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasFeature('onboarding_copilot') && (
              <Button
                id="btn-copilot-drawer-completed"
                data-testid="btn-copilot-drawer"
                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-2"
                onClick={() => toast.info(t('employee.toasts.copilotActivated', 'Onboarding Copilot drawer activated'))}
              >
                <Bot className="h-4 w-4" />
                <span>{t('employee.workspace.askCopilot', 'Ask Copilot')}</span>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link to="/certificates">
                <Award className="mr-2 h-4 w-4 text-emerald-600" />
                {t('employee.workspace.viewCerts', { count: employee.certificatesCount || 1, defaultValue: `View Certificates (${employee.certificatesCount || 1})` })}
              </Link>
            </Button>
          </div>
        </div>

        {/* Certificate Preview Card */}
        <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-background to-background">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="h-4 w-4" /> {t('employee.workspace.certPreview.badge', 'Completion Credential')}
              </span>
              <span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded font-medium">
                {t('employee.workspace.certPreview.verified', 'Verified Authentic')}
              </span>
            </div>
            <CardTitle className="text-lg">{t('employee.workspace.certPreview.title', 'Certificate of Onboarding Completion')}</CardTitle>
            <CardDescription>
              {t('employee.workspace.certPreview.desc', { name: user?.name || employee?.fullName || employee?.name || 'Team Member', defaultValue: `Issued to ${user?.name || employee?.fullName || employee?.name || 'Team Member'} for completing all onboarding curriculum requirements.` })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-muted/40 rounded-lg text-xs font-mono">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase">{t('employee.workspace.certPreview.certId', 'Certificate ID')}</span>
                <span className="font-semibold text-foreground">{assignedJourneys[0]?.certificate?.certificateId || 'CERT-ONB-COMPLETED'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase">{t('employee.workspace.certPreview.issueDate', 'Issue Date')}</span>
                <span className="font-semibold text-foreground">{assignedJourneys[0]?.certificate?.issuedAt ? new Date(assignedJourneys[0].certificate.issuedAt).toLocaleDateString() : new Date().toLocaleDateString()}</span>
              </div>
              <div className="col-span-2 sm:col-span-1 flex sm:justify-end items-center">
                <Button asChild size="sm" variant="outline" className="w-full sm:w-auto text-xs">
                  <Link to="/certificates">
                    {t('employee.workspace.certPreview.openViewer', 'Open Certificate Viewer')}
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Employee Quick Stats & Operational Hub */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-indigo-500/10 via-background to-background border-indigo-500/20">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase font-semibold">{t('employee.workspace.stats.learningModules', 'Learning Modules')}</CardDescription>
              <CardTitle className="text-2xl font-bold text-indigo-600">{t('employee.workspace.stats.completed', { count: assignedJourneys.length, defaultValue: `${assignedJourneys.length} Completed` })}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{t('employee.workspace.stats.fulfillment', '100% course fulfillment')}</p>
            </CardContent>
          </Card>

          {hasFeature('digital_signatures') && (
            <Card data-testid="card-required-documents-active" className="bg-gradient-to-br from-emerald-500/10 via-background to-background border-emerald-500/20">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase font-semibold">{t('employee.workspace.stats.requiredDocs', 'Required Documents')}</CardDescription>
                <CardTitle className="text-2xl font-bold text-emerald-600">{t('employee.workspace.stats.verified', 'Verified')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{t('employee.workspace.stats.signedPolicies', 'All NDAs & policies signed')}</p>
              </CardContent>
            </Card>
          )}

          {hasFeature('buddy_connection') && (
            <Card data-testid="card-my-buddy-active" className="bg-gradient-to-br from-blue-500/10 via-background to-background border-blue-500/20">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase font-semibold">{t('employee.workspace.stats.myBuddy', 'My Buddy')}</CardDescription>
                <CardTitle className="text-2xl font-bold text-blue-600">
                  {buddyAssignment?.buddyUserId ? t('employee.workspace.stats.connected', 'Connected') : t('employee.workspace.stats.assigned', 'Assigned')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{t('employee.workspace.stats.peerMentorship', 'Peer mentorship active')}</p>
              </CardContent>
            </Card>
          )}

          {hasFeature('milestone_ratings') && (
            <Card className="bg-gradient-to-br from-amber-500/10 via-background to-background border-amber-500/20">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase font-semibold">{t('employee.workspace.stats.milestones', 'Performance Milestones')}</CardDescription>
                <CardTitle className="text-2xl font-bold text-amber-600">
                  {milestones.length > 0 ? t('employee.workspace.stats.activeCount', { count: milestones.length, defaultValue: `${milestones.length} Active` }) : t('employee.workspace.stats.day30Plus', 'Day 30+')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{t('employee.workspace.stats.checkinReviews', 'Ongoing check-in reviews')}</p>
              </CardContent>
            </Card>
          )}

          {hasFeature('gamified_milestones') && (
            <Card data-testid="widget-points-leaderboard-active" className="bg-gradient-to-br from-purple-500/10 via-background to-background border-purple-500/20">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase font-semibold">{t('employee.workspace.stats.leaderboard', 'Points & Leaderboard')}</CardDescription>
                <CardTitle className="text-2xl font-bold text-purple-600">{t('employee.workspace.stats.xpValue', '350 XP')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{t('employee.workspace.stats.rankCohort', 'Rank #3 in cohort')}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Operational Portals Quick Access Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:border-indigo-500 transition-all cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-indigo-600" />
                {t('employee.workspace.portals.kbTitle', 'Knowledge Base & RAG AI')}
              </CardTitle>
              <CardDescription>
                {t('employee.workspace.portals.kbDesc', 'Search company SOPs, policy articles, and ask AI questions in real-time.')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="secondary" className="w-full" asChild>
                <Link to="/kb">{t('employee.workspace.portals.kbBtn', 'Open Knowledge Base')}</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:border-indigo-500 transition-all cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-600" />
                {t('employee.workspace.portals.dirTitle', 'Team Directory & Office Map')}
              </CardTitle>
              <CardDescription>
                {t('employee.workspace.portals.dirDesc', 'Find colleagues, view department structures, and navigate office seating.')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="secondary" className="w-full" asChild>
                <Link to="/directory">{t('employee.workspace.portals.dirBtn', 'View Team Directory')}</Link>
              </Button>
            </CardContent>
          </Card>

          {hasFeature('milestone_ratings') && (
            <Card className="hover:border-indigo-500 transition-all cursor-pointer">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Flag className="h-5 w-5 text-indigo-600" />
                  {t('employee.workspace.portals.milestonesTitle', '30/60/90 Day Milestones')}
                </CardTitle>
                <CardDescription>
                  {t('employee.workspace.portals.milestonesDesc', 'Review your active 30-day, 60-day, and 90-day progress check-ins with your manager.')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="secondary" className="w-full" asChild>
                  <Link to="/milestones">{t('employee.workspace.portals.milestonesBtn', 'Open Milestones')}</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // --- RENDERING OPTION 2: GUIDED ONBOARDING JOURNEY ROADMAP (NEW HIRE & IN-PROGRESS) ---
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-indigo-500/20">
              {t('employee.roadmap.badge', {
                status: isUnassignedNewUser
                  ? t('employee.roadmap.awaitingAssignments', 'Awaiting Assignments')
                  : t('employee.roadmap.stageActive', { stage: currentStageIndex, defaultValue: `Stage ${currentStageIndex} of 4 Active` }),
                defaultValue: `Guided Onboarding Roadmap • ${isUnassignedNewUser ? 'Awaiting Assignments' : `Stage ${currentStageIndex} of 4 Active`}`
              })}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('employee.roadmap.welcome', { name: user?.name || 'Jane', defaultValue: `Welcome to Northwind, ${user?.name || 'Jane'}!` })}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('employee.roadmap.welcomeDesc', 'Follow your step-by-step onboarding roadmap below to complete your setup, compliance, learning modules, and team integration.')}
          </p>
        </div>
        {hasFeature('onboarding_copilot') && (
          <Button
            id="btn-copilot-drawer"
            data-testid="btn-copilot-drawer"
            className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 shadow-sm flex items-center gap-2"
            onClick={() => toast.info(t('employee.toasts.copilotActivated', 'Onboarding Copilot drawer activated'))}
          >
            <Bot className="h-4 w-4" />
            <span>{t('employee.workspace.askCopilot', 'Ask Copilot')}</span>
          </Button>
        )}
      </div>

      {/* Hero Lifecycle Orchestrator Card */}
      <Card className="border-indigo-500/30 bg-gradient-to-r from-indigo-900/10 via-background to-background dark:from-indigo-950/40">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <BookOpen className="h-5 w-5" />
              {t('employee.roadmap.hero.activeStage', {
                stage: isUnassignedNewUser
                  ? t('employee.roadmap.hero.curriculumSetup', 'Curriculum Setup')
                  : t('employee.roadmap.hero.stepNum', { step: currentStageIndex, defaultValue: `Step ${currentStageIndex}` }),
                defaultValue: `Active Onboarding Stage: ${isUnassignedNewUser ? 'Curriculum Setup' : `Step ${currentStageIndex}`}`
              })}
            </CardTitle>
            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
              {t('employee.roadmap.hero.totalComplete', { percent: overallProgressPercent, defaultValue: `${overallProgressPercent}% Total Roadmap Complete` })}
            </span>
          </div>
          <Progress value={overallProgressPercent} className="h-2 mt-2 bg-indigo-500/10" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-white dark:bg-slate-900 border rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold">{activeStageTitle}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{activeStageDescription}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0">
                  <Link to={activeStageActionPath}>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    {activeStageActionText}
                  </Link>
                </Button>
                {currentStageIndex === 4 && (
                  <Button
                    onClick={() => {
                      localStorage.setItem(handoverStorageKey, 'true');
                      setIsHandoverAcknowledged(true);
                      toast.success(t('employee.toasts.handoverSuccess', 'Congratulations! You have completed all onboarding stages and transitioned to the Active Employee Workspace.'));
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {t('employee.roadmap.hero.handoverBtn', 'Complete Handover & Unlock Workspace')}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Visual Stepper Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2">
            {hasFeature('digital_signatures') && (
              <div className={`p-3 rounded-lg border text-xs font-medium ${currentStageIndex === 1 ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-800' : 'bg-muted/40 opacity-70'}`}>
                <div className="flex items-center gap-1.5 mb-1 font-bold">
                  <FileText className="h-4 w-4 text-indigo-600" />
                  <span>{t('employee.roadmap.stepper.step1', '1. E-Signatures')}</span>
                </div>
                <p className="text-muted-foreground">{!isUnassignedNewUser && pendingDocsCount === 0 ? t('employee.roadmap.stepper.completed', '✓ Completed') : t('employee.roadmap.stepper.unsigned', { count: pendingDocsCount, defaultValue: `${pendingDocsCount} Unsigned` })}</p>
              </div>
            )}

            <div className={`p-3 rounded-lg border text-xs font-medium ${currentStageIndex === 2 ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-800' : 'bg-muted/40 opacity-70'}`}>
              <div className="flex items-center gap-1.5 mb-1 font-bold">
                <CheckSquare className="h-4 w-4 text-indigo-600" />
                <span>{t('employee.roadmap.stepper.step2', '2. IT & Setup Tasks')}</span>
              </div>
              <p className="text-muted-foreground">{!isUnassignedNewUser && pendingDocsCount === 0 && openTasksCount === 0 ? t('employee.roadmap.stepper.completed', '✓ Completed') : t('employee.roadmap.stepper.pending', { count: openTasksCount, defaultValue: `${openTasksCount} Pending` })}</p>
            </div>

            <div className={`p-3 rounded-lg border text-xs font-medium ${currentStageIndex === 3 ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-800' : 'bg-muted/40 opacity-70'}`}>
              <div className="flex items-center gap-1.5 mb-1 font-bold">
                <PlayCircle className="h-4 w-4 text-indigo-600" />
                <span>{t('employee.roadmap.stepper.step3', '3. LMS Modules')}</span>
              </div>
              <p className="text-muted-foreground">{hasAssignedJourneys ? (allJourneysCompleted ? t('employee.roadmap.stepper.completed', '✓ Completed') : t('employee.roadmap.stepper.done', { percent: activeJourney?.progress || 0, defaultValue: `${activeJourney?.progress || 0}% Done` })) : t('employee.roadmap.stepper.zeroAssigned', '0 Assigned')}</p>
            </div>

            {(hasFeature('buddy_connection') || hasFeature('milestone_ratings')) && (
              <div className={`p-3 rounded-lg border text-xs font-medium ${currentStageIndex === 4 ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-800' : 'bg-muted/40 opacity-70'}`}>
                <div className="flex items-center gap-1.5 mb-1 font-bold">
                  <Users className="h-4 w-4 text-indigo-600" />
                  <span>{t('employee.roadmap.stepper.step4', '4. Buddy & Milestones')}</span>
                </div>
                <p className="text-muted-foreground">{isOnboardingFullyCompleted ? t('employee.roadmap.stepper.handoverDone', '✓ Handover Done') : (currentStageIndex === 4 ? t('employee.roadmap.stepper.readyHandover', 'Ready for Handover') : t('employee.roadmap.stepper.upcoming', 'Upcoming'))}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Active Milestone Check-in Progress Card */}
      {(() => {
        const activeMilestone = (milestones || []).find(
          (m: any) => m.status !== 'completed' && m.status !== 'approved'
        ) || (milestones || [])[0];

        if (!activeMilestone) return null;

        const goalsCompletedCount = (activeMilestone.goalsProgress || []).filter((g: any) => g.completed).length;
        const totalGoalsCount = (activeMilestone.goalsProgress || []).length;
        const goalsPercent = totalGoalsCount > 0 ? Math.round((goalsCompletedCount / totalGoalsCount) * 100) : 0;
        const isSelfCheckinDone = activeMilestone.status === 'in_review' || activeMilestone.status === 'pending_manager_review' || activeMilestone.status === 'approved' || activeMilestone.status === 'completed';

        return (
          <Card className="border-purple-500/30 bg-gradient-to-r from-purple-900/10 via-background to-background dark:from-purple-950/30 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Flag className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      {activeMilestone.milestoneTitle || t('employee.roadmap.milestone.trackTitle', { day: activeMilestone.targetDay, defaultValue: `Day ${activeMilestone.targetDay} Milestone Track` })}
                      <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 text-[10px]">
                        {t('employee.roadmap.milestone.dayBadge', { day: activeMilestone.targetDay, defaultValue: `Day ${activeMilestone.targetDay}` })}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {t('employee.roadmap.milestone.targetDueDate', { date: new Date(activeMilestone.dueDate).toLocaleDateString(), defaultValue: `Target Due Date: ${new Date(activeMilestone.dueDate).toLocaleDateString()}` })}
                    </CardDescription>
                  </div>
                </div>

                <Badge
                  variant={isSelfCheckinDone ? 'default' : 'outline'}
                  className={`text-xs capitalize ${activeMilestone.status === 'approved' || activeMilestone.status === 'completed'
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                    : activeMilestone.status === 'in_review' || activeMilestone.status === 'pending_manager_review'
                      ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                      : 'border-purple-500/30 text-purple-600'
                    }`}
                >
                  {activeMilestone.status ? activeMilestone.status.replace(/_/g, ' ') : t('employee.roadmap.milestone.selfCheckinPending', 'Self Check-in Pending')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {totalGoalsCount > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-foreground">
                    <span className="text-muted-foreground">{t('employee.roadmap.milestone.goalsCompletedLabel', 'Milestone Goals Completed:')}</span>
                    <span>{t('employee.roadmap.milestone.goalsCount', { completed: goalsCompletedCount, total: totalGoalsCount, percent: goalsPercent, defaultValue: `${goalsCompletedCount} of ${totalGoalsCount} (${goalsPercent}%)` })}</span>
                  </div>
                  <Progress value={goalsPercent} className="h-2 bg-purple-500/10" />
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-border/50">
                <p className="text-xs text-muted-foreground">
                  {isSelfCheckinDone
                    ? t('employee.roadmap.milestone.submittedDesc', 'Self check-in submitted! Awaiting manager review and sign-off.')
                    : t('employee.roadmap.milestone.pendingDesc', 'Complete your goals and submit your self-reflection check-in before the target due date.')}
                </p>
                <Button size="sm" asChild className="bg-purple-600 hover:bg-purple-700 text-white shrink-0 text-xs">
                  <Link to="/milestones">
                    {isSelfCheckinDone ? t('employee.roadmap.milestone.viewStatus', 'View Milestone Status') : t('employee.roadmap.milestone.completeCheckin', 'Complete Self Check-in')}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Assigned Equipment & Hardware Tracking Card */}
      {(() => {
        const allRelevantTasks = [
          ...(employeeHardwareTasksData?.tasks || []),
          ...(tasksData?.tasks || []),
        ];
        // Deduplicate by _id
        const seenIds = new Set<string>();
        const hardwareList = allRelevantTasks.filter((hwTask: any) => {
          if (!hwTask || seenIds.has(hwTask._id)) return false;
          seenIds.add(hwTask._id);
          return hwTask.hardwareMetadata || hwTask.category === 'it_setup' || hwTask.category === 'equipment';
        });

        if (hardwareList.length === 0) return null;

        return (
          <Card data-testid="widget-equipment-tracking" className="border-cyan-500/30 bg-gradient-to-r from-cyan-500/5 via-background to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600">
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {t('employee.roadmap.equipment.title', 'Assigned Equipment & Workstation Setup')}
                      <Badge variant="outline" className="text-xs bg-cyan-500/10 text-cyan-600 border-cyan-500/20">
                        {t('employee.roadmap.equipment.items', { count: hardwareList.length, defaultValue: `${hardwareList.length} ${hardwareList.length === 1 ? 'Item' : 'Items'}` })}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {t('employee.roadmap.equipment.desc', 'Track shipment, delivery, and confirm physical receipt of your work equipment.')}
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {hardwareList.map((hwItem: any) => {
                  const meta = hwItem.hardwareMetadata || {};
                  const isDelivered = meta.mdmStatus === 'delivered' || !!meta.receivedConfirmedAt;
                  const isDispatched = meta.mdmStatus === 'dispatched';
                  const deviceLabel = meta.deviceType ? meta.deviceType.replace(/_/g, ' ') : hwItem.title;

                  return (
                    <div
                      key={hwItem._id}
                      className={`p-3.5 rounded-xl border space-y-2.5 transition-all ${
                        isDelivered
                          ? 'border-emerald-500/30 bg-emerald-500/5'
                          : 'border-border/70 bg-card hover:border-cyan-500/40 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-xs font-bold text-foreground capitalize flex items-center gap-1.5 truncate">
                            {deviceLabel}
                            {meta.assetTag && (
                              <span className="text-[10px] font-mono text-muted-foreground">({meta.assetTag})</span>
                            )}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">{hwItem.title}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize shrink-0 ${
                            isDelivered
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                              : isDispatched
                              ? 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30 animate-pulse'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {meta.mdmStatus ? meta.mdmStatus.replace(/_/g, ' ') : t('employee.roadmap.equipment.preparing', 'Preparing')}
                        </Badge>
                      </div>

                      {meta.serialNumber && (
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {t('employee.roadmap.equipment.serial', 'Serial:')} <span className="text-foreground">{meta.serialNumber}</span>
                        </p>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50 text-xs">
                        {meta.courierTrackingUrl ? (
                          <a
                            href={meta.courierTrackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-600 hover:text-cyan-700 underline"
                          >
                            <Truck className="h-3.5 w-3.5" /> {t('employee.roadmap.equipment.trackPackage', { courier: meta.courierProvider || t('employee.roadmap.equipment.trackCourier', 'Courier'), defaultValue: `Track Package (${meta.courierProvider || 'Courier'})` })} <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {t('employee.roadmap.equipment.trackingUponDispatch', 'Tracking available upon dispatch')}
                          </span>
                        )}

                        {isDelivered ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> {t('employee.roadmap.equipment.received', 'Received')}
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => {
                              confirmReceiptMut.mutate(
                                { id: hwItem._id },
                                {
                                  onSuccess: () => toast.success(t('employee.toasts.equipmentConfirmed', 'Equipment receipt confirmed! Status updated to Delivered.')),
                                }
                              );
                            }}
                            disabled={confirmReceiptMut.isPending}
                            className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                          >
                            <Check className="h-3 w-3" /> {t('employee.roadmap.equipment.confirmReceipt', 'Confirm Receipt')}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Points & Leaderboard Widget */}
      {hasFeature('gamified_milestones') && (
        <Card data-testid="widget-points-leaderboard" className="border-amber-500/30 bg-gradient-to-r from-amber-500/5 via-background to-background">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                {t('employee.roadmap.gamification.title', 'Points & Leaderboard')}
              </CardTitle>
              <CardDescription>
                {t('employee.roadmap.gamification.desc', 'Earn points for completing compliance milestones and climb the onboarding leaderboard.')}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/leaderboard">{t('employee.roadmap.gamification.viewLeaderboard', 'View Leaderboard')}</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-amber-600">350</span>
                <span className="text-xs text-muted-foreground uppercase font-semibold">{t('employee.roadmap.gamification.xpPoints', 'XP Points')}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {t('employee.roadmap.gamification.rank', 'Rank #3 in current onboarding cohort')}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Operational Onboarding Container Overview Cards */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('employee.roadmap.overview.title', 'Onboarding Sub-Systems Overview')}</CardTitle>
          <CardDescription>
            {t('employee.roadmap.overview.desc', 'Quick status breakdown across your compliance, operational task queue, buddy pairing, and milestones.')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {hasFeature('digital_signatures') && (
              <Link to="/documents" data-testid="card-required-documents" className="p-3 bg-white dark:bg-slate-900 border rounded-xl hover:border-indigo-500 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">{t('employee.roadmap.overview.reqDocs', 'Required Documents')}</span>
                  <FileText className="h-4 w-4 text-indigo-600" />
                </div>
                <p className="text-xl font-bold">{t('employee.roadmap.overview.unsigned', { count: pendingDocsCount, defaultValue: `${pendingDocsCount} Unsigned` })}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('employee.roadmap.overview.eSigReqs', 'E-signature requirements')}</p>
              </Link>
            )}

            <Link to="/tasks" className="p-3 bg-white dark:bg-slate-900 border rounded-xl hover:border-indigo-500 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase">{t('employee.roadmap.overview.tasksSetup', 'Tasks & IT Setup')}</span>
                <CheckSquare className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="text-xl font-bold">{t('employee.roadmap.overview.openTasks', { count: openTasksCount, defaultValue: `${openTasksCount} Open` })}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('employee.roadmap.overview.opChecklists', 'Operational checklists')}</p>
            </Link>

            {hasFeature('buddy_connection') && (
              <Link to="/buddy" data-testid="card-my-buddy" className="p-3 bg-white dark:bg-slate-900 border rounded-xl hover:border-indigo-500 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">{t('employee.roadmap.overview.myBuddy', 'My Buddy')}</span>
                  <Users className="h-4 w-4 text-indigo-600" />
                </div>
                <p className="text-xl font-bold">{buddyAssignment?.buddyUserId ? t('employee.roadmap.overview.paired', 'Paired') : t('employee.roadmap.overview.autoAssign', 'Auto-Assign')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('employee.roadmap.overview.peerSupport', 'Peer mentor support')}</p>
              </Link>
            )}

            {hasFeature('milestone_ratings') && (
              <Link to="/milestones" data-testid="card-milestones" className="p-3 bg-white dark:bg-slate-900 border rounded-xl hover:border-indigo-500 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">{t('employee.roadmap.overview.milestonesTitle', '30/60/90 Milestones')}</span>
                  <Flag className="h-4 w-4 text-indigo-600" />
                </div>
                <p className="text-xl font-bold">{milestones.length > 0 ? t('employee.roadmap.overview.activeCount', { count: milestones.length, defaultValue: `${milestones.length} Active` }) : t('employee.roadmap.overview.schedule', 'Schedule')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('employee.roadmap.overview.checkpoints', 'Performance checkpoints')}</p>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Personal Operational Checklist */}
      {(tasksData?.tasks || []).length > 0 && (
        <Card className="border border-indigo-500/20 bg-gradient-to-r from-indigo-500/[0.03] to-purple-500/[0.03]">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-indigo-500" />
                {t('employee.roadmap.checklist.title', 'Personal Onboarding Checklist')}
              </CardTitle>
              <CardDescription>
                {t('employee.roadmap.checklist.desc', 'Track and complete your personal operational setup tasks.')}
              </CardDescription>
            </div>
            <Link to="/tasks" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300">
              {t('employee.roadmap.checklist.viewAll', 'View All Tasks →')}
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {(tasksData?.tasks || []).map((taskItem: any) => {
                const isDone = taskItem.status === 'completed';
                return (
                  <div
                    key={taskItem._id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isDone
                      ? 'border-emerald-500/30 bg-emerald-500/5 opacity-80'
                      : 'border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 hover:border-indigo-500/50'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleTask(taskItem)}
                        className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${isDone
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-slate-300 dark:border-slate-600 hover:border-indigo-500'
                          }`}
                      >
                        {isDone && <Check className="w-4 h-4 stroke-[3]" />}
                      </button>
                      <div>
                        <p className={`text-sm font-medium ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {taskItem.title}
                        </p>
                        {taskItem.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{taskItem.description}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold border border-white/10 text-muted-foreground">
                      {taskItem.priority || t('employee.roadmap.checklist.normal', 'normal')}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assigned Journeys & Modules */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight mb-4">
          {t('employee.assignedJourneys', 'Assigned Journeys')}
        </h2>
        {!assignedJourneys || assignedJourneys.length === 0 ? (
          <div className="col-span-full py-8 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
            {t('employee.noJourneys', 'No journeys assigned yet.')}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {assignedPagination.paginatedData.map((j) => (
                <Card key={j.id}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {j.title}
                    </CardTitle>
                    <CardDescription>
                      {j.status === 'Completed' ? t('employee.completedJourneys', 'Completed') : t('employee.inProgress', 'In Progress')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                      <Clock className="h-4 w-4" />
                      <span>{t('employee.roadmap.assigned.assignedDate', { date: j.assignedAt, defaultValue: `Assigned ${j.assignedAt}` })}</span>
                    </div>
                    <Button variant={j.status === 'Completed' ? 'outline' : 'default'} className="w-full" asChild>
                      <Link to={`/course/${j.id}`}>
                        {j.status === 'Completed' ? t('employee.roadmap.assigned.reviewCourse', 'Review Course') : t('employee.roadmap.assigned.startCourse', 'Start Course')}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <SimplePagination
              currentPage={assignedPagination.page}
              totalPages={assignedPagination.totalPages}
              totalItems={assignedPagination.totalItems}
              startIndex={assignedPagination.startIndex}
              endIndex={assignedPagination.endIndex}
              pageSize={assignedPagination.pageSize}
              onPageChange={assignedPagination.setPage}
              onPageSizeChange={assignedPagination.setPageSize}
              itemLabel={t('employee.roadmap.assigned.itemLabel', 'journeys')}
            />
          </div>
        )}
      </div>

      {availablePublicJourneys.length > 0 && (
        <div className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold tracking-tight mb-4 flex items-center gap-2">
            {t('employee.roadmap.public.title', 'Explore Public Journeys')}
            <span className="text-xs font-normal text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/10">{t('employee.roadmap.public.selfEnroll', 'Self-Enroll')}</span>
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {publicPagination.paginatedData.map((j: any) => (
              <Card key={j.id} className="hover:shadow-md transition-all flex flex-col justify-between">
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    {j.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {j.description || t('employee.roadmap.public.noDesc', 'No description provided.')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                    <span>{j.category || t('employee.roadmap.public.general', 'General')}</span>
                    <span>•</span>
                    <span>{t('employee.roadmap.public.modules', { count: j.modules?.length || 0, defaultValue: `${j.modules?.length || 0} modules` })}</span>
                  </div>
                  <Button
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={() => handleEnroll(j.id)}
                    disabled={assignJourneyMut.isPending}
                  >
                    {assignJourneyMut.isPending ? t('employee.roadmap.public.enrolling', 'Enrolling...') : t('employee.roadmap.public.enrollStart', 'Enroll & Start')}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <SimplePagination
            currentPage={publicPagination.page}
            totalPages={publicPagination.totalPages}
            totalItems={publicPagination.totalItems}
            startIndex={publicPagination.startIndex}
            endIndex={publicPagination.endIndex}
            pageSize={publicPagination.pageSize}
            onPageChange={publicPagination.setPage}
            onPageSizeChange={publicPagination.setPageSize}
            itemLabel={t('employee.roadmap.public.itemLabel', 'journeys')}
          />
        </div>
      )}
    </div>
  );
}
