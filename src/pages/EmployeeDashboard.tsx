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
import { Progress } from '../components/Progress';
import { Skeleton } from '../components/Skeleton';
import { PlayCircle, Clock, Award, AlertCircle, RefreshCw, CheckSquare, FileText, Users, Flag, BookOpen, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useAuth';
import { useEmployee } from '../hooks/useEmployees';
import { useJourneys, useAssignJourney } from '../hooks/useJourneys';
import { useTasks } from '../hooks/useTasks';
import { useEmployeeDocumentInbox } from '../hooks/useDocuments';
import { useMyBuddy } from '../hooks/useBuddy';
import { useMyMilestones } from '../hooks/useMilestones';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { SimplePagination } from '../components/SimplePagination';
import { usePagination } from '../hooks/usePagination';

export function EmployeeDashboard() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { t } = useTranslation('dashboard');
  // Fetch current logged in employee's profile
  const { data: employee, isLoading: employeeLoading, isError, error, refetch } = useEmployee('me');

  const { data: publicJourneys = [] } = useJourneys();
  const { data: tasksData } = useTasks({ assignedToMe: true });
  const { data: docInbox = [] } = useEmployeeDocumentInbox();
  const { data: buddyAssignment } = useMyBuddy();
  const { data: milestones = [] } = useMyMilestones();
  const assignJourneyMut = useAssignJourney();

  const openTasksCount = (tasksData?.tasks || []).filter((t: any) => t.status !== 'completed' && t.status !== 'cancelled').length;
  const pendingDocs = docInbox.filter((d: any) => d.status === 'pending');
  const pendingDocsCount = pendingDocs.length;

  const handleEnroll = (journeyId: string) => {
    if (!employee) return;
    assignJourneyMut.mutate(
      { journeyId, employeeId: employee.id },
      {
        onSuccess: () => {
          toast.success('Successfully enrolled in the journey!');
          refetch();
        },
        onError: (err: any) => {
          toast.error(err?.message || 'Failed to enroll.');
        }
      }
    );
  };

  const availablePublicJourneys = publicJourneys.filter((pj: any) => {
    return !employee?.assignedJourneys?.some((aj: any) => aj.journeyId === pj.id);
  });

  const assignedPagination = usePagination({ data: employee?.assignedJourneys || [], initialPageSize: 6 });
  const publicPagination = usePagination({ data: availablePublicJourneys, initialPageSize: 6 });

  // Persistence key for employee onboarding handover confirmation
  const handoverStorageKey = `talnova_handover_completed_${employee?.id || user?._id || 'default'}`;
  const [isHandoverAcknowledged, setIsHandoverAcknowledged] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(handoverStorageKey) === 'true' || employee?.status === 'Active';
    }
    return employee?.status === 'Active';
  });

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
        <h2 className="text-xl font-bold">Failed to Load Dashboard</h2>
        <p className="text-muted-foreground">{(error as any)?.message || 'Your employee record could not be loaded.'}</p>
        <Button onClick={() => refetch()} className="mx-auto">
          <RefreshCw className="mr-2 h-4 w-4" /> Retry
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
  const isCoreRequirementsMet = pendingDocsCount === 0 && openTasksCount === 0 && (hasAssignedJourneys ? allJourneysCompleted : false);
  const isOnboardingFullyCompleted = !isUnassignedNewUser && isCoreRequirementsMet && (isHandoverAcknowledged || employee.status === 'Active');

  // Lifecycle Stage Resolution:
  // Stage 0: Unassigned New Hire (Onboarding setup by HR/Admin in progress)
  // Stage 1: Compliance E-Signatures (Blocking prerequisite for LMS progression)
  // Stage 2: Operational / IT Checklists (Hardware & Workspace tasks)
  // Stage 3: LMS Learning Modules (Assigned role & compliance courses)
  // Stage 4: Peer Mentorship & 30-Day Check-in Handover
  // Stage 5: Active Employee Workspace (Unlocked post-handover portal)
  let currentStageIndex = 1;
  let activeStageTitle = 'Compliance & E-Signatures';
  let activeStageDescription = 'Review and sign required legal & policy documents before proceeding.';
  let activeStageActionPath = pendingDocs.length > 0 ? `/documents/${pendingDocs[0].id || pendingDocs[0]._id}/sign` : '/documents';
  let activeStageActionText = 'Sign Pending Documents';

  if (isUnassignedNewUser) {
    currentStageIndex = 0;
    activeStageTitle = 'Onboarding Package Setup in Progress';
    activeStageDescription = 'Your customized onboarding curriculum, compliance paperwork, and IT checklists are being assembled by HR & IT.';
    activeStageActionPath = '/directory';
    activeStageActionText = 'Explore Team Directory';
  } else if (pendingDocsCount > 0) {
    currentStageIndex = 1;
    activeStageTitle = 'Stage 1: Compliance E-Signatures (Prerequisite)';
    activeStageDescription = 'Review and sign required legal & policy documents before proceeding with your training modules.';
    activeStageActionPath = pendingDocs.length > 0 ? `/documents/${pendingDocs[0].id || pendingDocs[0]._id}/sign` : '/documents';
    activeStageActionText = 'Sign Pending Documents';
  } else if (openTasksCount > 0) {
    currentStageIndex = 2;
    activeStageTitle = 'Stage 2: Operational & IT Setup Checklists';
    activeStageDescription = 'Complete your assigned IT provisioning and workplace checklist tasks.';
    activeStageActionPath = '/tasks';
    activeStageActionText = 'View Operational Tasks';
  } else if (hasAssignedJourneys && !allJourneysCompleted) {
    currentStageIndex = 3;
    activeStageTitle = `Stage 3: LMS Module: ${activeJourney?.title || 'Learning Curriculum'}`;
    activeStageDescription = `Complete learning modules and knowledge checks (${activeJourney?.progress || 0}% completed).`;
    activeStageActionPath = activeJourney ? `/course/${activeJourney.id}` : '/journeys';
    activeStageActionText = 'Continue LMS Module';
  } else {
    currentStageIndex = 4;
    activeStageTitle = 'Stage 4: Peer Mentorship & 30-Day Check-in Handover';
    activeStageDescription = 'All training and operational setup tasks are complete! Review your 30-day goals with your buddy to finalize onboarding handover.';
    activeStageActionPath = '/milestones';
    activeStageActionText = 'Review Milestones & Buddy';
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                Active Employee • Onboarding Completed
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome Back, {user?.name || employee.fullName}!
            </h1>
            <p className="text-muted-foreground mt-1">
              Your onboarding journey is 100% complete. Access your active workspace, knowledge base, and team tools below.
            </p>
          </div>
          <Button variant="outline" asChild className="shrink-0">
            <Link to="/certificates">
              <Award className="mr-2 h-4 w-4 text-emerald-600" />
              View Certificates ({employee.certificatesCount || 1})
            </Link>
          </Button>
        </div>

        {/* Active Employee Quick Stats & Operational Hub */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-indigo-500/10 via-background to-background border-indigo-500/20">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase font-semibold">Learning Modules</CardDescription>
              <CardTitle className="text-2xl font-bold text-indigo-600">{assignedJourneys.length} Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">100% course fulfillment</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 via-background to-background border-emerald-500/20">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase font-semibold">Compliance State</CardDescription>
              <CardTitle className="text-2xl font-bold text-emerald-600">Verified</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">All NDAs & policies signed</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 via-background to-background border-blue-500/20">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase font-semibold">Onboarding Buddy</CardDescription>
              <CardTitle className="text-2xl font-bold text-blue-600">
                {buddyAssignment?.buddyUserId ? 'Connected' : 'Assigned'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Peer mentorship active</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 via-background to-background border-amber-500/20">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase font-semibold">Performance Milestones</CardDescription>
              <CardTitle className="text-2xl font-bold text-amber-600">
                {milestones.length > 0 ? `${milestones.length} Active` : 'Day 30+'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Ongoing check-in reviews</p>
            </CardContent>
          </Card>
        </div>

        {/* Operational Portals Quick Access Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:border-indigo-500 transition-all cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-indigo-600" />
                Knowledge Base & RAG AI
              </CardTitle>
              <CardDescription>
                Search company SOPs, policy articles, and ask AI questions in real-time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="secondary" className="w-full" asChild>
                <Link to="/kb">Open Knowledge Base</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:border-indigo-500 transition-all cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-600" />
                Team Directory & Office Map
              </CardTitle>
              <CardDescription>
                Find colleagues, view department structures, and navigate office seating.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="secondary" className="w-full" asChild>
                <Link to="/directory">View Team Directory</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:border-indigo-500 transition-all cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Flag className="h-5 w-5 text-indigo-600" />
                30/60/90 Day Milestones
              </CardTitle>
              <CardDescription>
                Review your active 30-day, 60-day, and 90-day progress check-ins with your manager.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="secondary" className="w-full" asChild>
                <Link to="/milestones">Open Milestones</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // --- RENDERING OPTION 2: GUIDED ONBOARDING JOURNEY ROADMAP (NEW HIRE & IN-PROGRESS) ---
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-indigo-500/20">
            Guided Onboarding Roadmap • {isUnassignedNewUser ? 'Awaiting Assignments' : `Stage ${currentStageIndex} of 4 Active`}
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome to Northwind, {user?.name || 'Jane'}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Follow your step-by-step onboarding roadmap below to complete your setup, compliance, learning modules, and team integration.
        </p>
      </div>

      {/* Hero Lifecycle Orchestrator Card */}
      <Card className="border-indigo-500/30 bg-gradient-to-r from-indigo-900/10 via-background to-background dark:from-indigo-950/40">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <BookOpen className="h-5 w-5" />
              Active Onboarding Stage: {isUnassignedNewUser ? 'Curriculum Setup' : `Step ${currentStageIndex}`}
            </CardTitle>
            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
              {overallProgressPercent}% Total Roadmap Complete
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
                      toast.success('Congratulations! You have completed all onboarding stages and transitioned to the Active Employee Workspace.');
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Complete Handover & Unlock Workspace
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* 4-Step Visual Stepper Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2">
            <div className={`p-3 rounded-lg border text-xs font-medium ${currentStageIndex === 1 ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-800' : 'bg-muted/40 opacity-70'}`}>
              <div className="flex items-center gap-1.5 mb-1 font-bold">
                <FileText className="h-4 w-4 text-indigo-600" />
                <span>1. E-Signatures</span>
              </div>
              <p className="text-muted-foreground">{!isUnassignedNewUser && pendingDocsCount === 0 ? '✓ Completed' : `${pendingDocsCount} Unsigned`}</p>
            </div>

            <div className={`p-3 rounded-lg border text-xs font-medium ${currentStageIndex === 2 ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-800' : 'bg-muted/40 opacity-70'}`}>
              <div className="flex items-center gap-1.5 mb-1 font-bold">
                <CheckSquare className="h-4 w-4 text-indigo-600" />
                <span>2. IT & Setup Tasks</span>
              </div>
              <p className="text-muted-foreground">{!isUnassignedNewUser && pendingDocsCount === 0 && openTasksCount === 0 ? '✓ Completed' : `${openTasksCount} Pending`}</p>
            </div>

            <div className={`p-3 rounded-lg border text-xs font-medium ${currentStageIndex === 3 ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-800' : 'bg-muted/40 opacity-70'}`}>
              <div className="flex items-center gap-1.5 mb-1 font-bold">
                <PlayCircle className="h-4 w-4 text-indigo-600" />
                <span>3. LMS Modules</span>
              </div>
              <p className="text-muted-foreground">{hasAssignedJourneys ? (allJourneysCompleted ? '✓ Completed' : `${activeJourney?.progress || 0}% Done`) : '0 Assigned'}</p>
            </div>

            <div className={`p-3 rounded-lg border text-xs font-medium ${currentStageIndex === 4 ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-800' : 'bg-muted/40 opacity-70'}`}>
              <div className="flex items-center gap-1.5 mb-1 font-bold">
                <Users className="h-4 w-4 text-indigo-600" />
                <span>4. Buddy & Milestones</span>
              </div>
              <p className="text-muted-foreground">{isOnboardingFullyCompleted ? '✓ Handover Done' : (currentStageIndex === 4 ? 'Ready for Handover' : 'Upcoming')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Operational Onboarding Container Overview Cards */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Onboarding Sub-Systems Overview</CardTitle>
          <CardDescription>
            Quick status breakdown across your compliance, operational task queue, buddy pairing, and milestones.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <Link to="/documents" className="p-3 bg-white dark:bg-slate-900 border rounded-xl hover:border-indigo-500 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Compliance Docs</span>
                <FileText className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="text-xl font-bold">{pendingDocsCount} Unsigned</p>
              <p className="text-xs text-muted-foreground mt-1">E-signature requirements</p>
            </Link>

            <Link to="/tasks" className="p-3 bg-white dark:bg-slate-900 border rounded-xl hover:border-indigo-500 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Tasks & IT Setup</span>
                <CheckSquare className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="text-xl font-bold">{openTasksCount} Open</p>
              <p className="text-xs text-muted-foreground mt-1">Operational checklists</p>
            </Link>

            <Link to="/buddy" className="p-3 bg-white dark:bg-slate-900 border rounded-xl hover:border-indigo-500 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Onboarding Buddy</span>
                <Users className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="text-xl font-bold">{buddyAssignment?.buddyUserId ? 'Paired' : 'Auto-Assign'}</p>
              <p className="text-xs text-muted-foreground mt-1">Peer mentor support</p>
            </Link>

            <Link to="/milestones" className="p-3 bg-white dark:bg-slate-900 border rounded-xl hover:border-indigo-500 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase">30/60/90 Milestones</span>
                <Flag className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="text-xl font-bold">{milestones.length > 0 ? `${milestones.length} Active` : 'Schedule'}</p>
              <p className="text-xs text-muted-foreground mt-1">Performance checkpoints</p>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Assigned Journeys & Modules */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight mb-4">
          {t('employee.assignedJourneys')}
        </h2>
        {!assignedJourneys || assignedJourneys.length === 0 ? (
          <div className="col-span-full py-8 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
            {t('employee.noJourneys')}
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
                      {j.status === 'Completed' ? t('employee.completedJourneys') : t('employee.inProgress')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                      <Clock className="h-4 w-4" />
                      <span>Assigned {j.assignedAt}</span>
                    </div>
                    <Button variant={j.status === 'Completed' ? 'outline' : 'default'} className="w-full" asChild>
                      <Link to={`/course/${j.id}`}>
                        {j.status === 'Completed' ? 'Review Course' : 'Start Course'}
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
              itemLabel="journeys"
            />
          </div>
        )}
      </div>

      {availablePublicJourneys.length > 0 && (
        <div className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold tracking-tight mb-4 flex items-center gap-2">
            Explore Public Journeys
            <span className="text-xs font-normal text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/10">Self-Enroll</span>
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {publicPagination.paginatedData.map((j: any) => (
              <Card key={j.id} className="hover:shadow-md transition-all flex flex-col justify-between">
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    {j.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {j.description || 'No description provided.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                    <span>{j.category || 'General'}</span>
                    <span>•</span>
                    <span>{j.modules?.length || 0} modules</span>
                  </div>
                  <Button 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" 
                    onClick={() => handleEnroll(j.id)}
                    disabled={assignJourneyMut.isPending}
                  >
                    {assignJourneyMut.isPending ? 'Enrolling...' : 'Enroll & Start'}
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
            itemLabel="journeys"
          />
        </div>
      )}
    </div>
  );
}