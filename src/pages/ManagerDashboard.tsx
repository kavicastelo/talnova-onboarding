import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  BellRing,
  Award,
  Eye,
  RefreshCw,
  Search,
  BookOpen,
  CheckSquare,
  UserCheck,
  Flag,
  Calendar
} from 'lucide-react';
import {
  useManagerDashboard,
  useTeamDirectReports,
  useTeamOverview,
  useDirectReportDetails,
  useNudgeDirectReport,
  useSignOffDirectReport
} from '../hooks/useManager';
import { useTeamMilestones } from '../hooks/useMilestones';
import { Button } from '../components/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/Card';
import { Badge } from '../components/Badge';
import { Input } from '../components/Input';
import { Progress } from '../components/Progress';
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
import { useRole } from '../context/RoleContext';
import { useTranslation } from 'react-i18next';

export const ManagerDashboard: React.FC = () => {
  const { t } = useTranslation(['manager', 'common']);
  const { hasFeature } = useRole();
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useManagerDashboard();
  const { data: team, isLoading: teamLoading, refetch: refetchTeam } = useTeamDirectReports();
  const { refetch: refetchOverview } = useTeamOverview();
  const { data: teamMilestones = [] } = useTeamMilestones();

  const pendingMilestones = (teamMilestones || []).filter(
    (m: any) => m.status === 'in_review' || m.status === 'pending_manager_review'
  );

  const [search, setSearch] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [nudgeMsg, setNudgeMsg] = useState('');
  const [signOffNotes, setSignOffNotes] = useState('');
  const [isNudgeModalOpen, setIsNudgeModalOpen] = useState(false);
  const [isSignOffModalOpen, setIsSignOffModalOpen] = useState(false);
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false);

  const { data: empDetails, isLoading: detailsLoading } = useDirectReportDetails(selectedEmpId);
  const nudgeMutation = useNudgeDirectReport();
  const signOffMutation = useSignOffDirectReport();

  const filteredTeam = (team || []).filter((emp) => {
    const nameMatch = emp.fullName.toLowerCase().includes(search.toLowerCase());
    const emailMatch = emp.email.toLowerCase().includes(search.toLowerCase());
    const deptMatch = (emp.department || '').toLowerCase().includes(search.toLowerCase());
    const titleMatch = (emp.jobTitle || '').toLowerCase().includes(search.toLowerCase());
    return nameMatch || emailMatch || deptMatch || titleMatch;
  });

  const teamPagination = usePagination({ data: filteredTeam, initialPageSize: 10 });

  const handleNudgeSubmit = () => {
    if (!selectedEmpId) return;
    nudgeMutation.mutate(
      { employeeId: selectedEmpId, message: nudgeMsg },
      {
        onSuccess: (res) => {
          toast.success(res.message || t('nudgeModal.success', { defaultValue: 'Nudge sent successfully!' }));
          setIsNudgeModalOpen(false);
          setNudgeMsg('');
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || t('nudgeModal.failed', { defaultValue: 'Failed to send nudge' }));
        }
      }
    );
  };

  const handleSignOffSubmit = () => {
    if (!selectedEmpId) return;
    signOffMutation.mutate(
      { employeeId: selectedEmpId, notes: signOffNotes },
      {
        onSuccess: (res) => {
          toast.success(res.message || t('signOffModal.success', { defaultValue: 'Sign-off recorded successfully!' }));
          setIsSignOffModalOpen(false);
          setSignOffNotes('');
          refetchTeam();
          refetchMetrics();
          refetchOverview();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || t('signOffModal.failed', { defaultValue: 'Failed to sign off' }));
        }
      }
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-7 w-7 text-indigo-600" />
            {t('title', { defaultValue: 'Manager Operations & Team Oversight' })}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('subtitle', { defaultValue: 'Monitor direct reports, track onboarding progress, resolve overdue items, and sign off on completed programs.' })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refetchMetrics();
            refetchTeam();
            toast.success(t('refreshedToast', { defaultValue: 'Manager dashboard refreshed' }));
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" /> {t('refresh', { defaultValue: 'Refresh Data' })}
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card id="card-total-direct-reports" className="border-l-4 border-l-indigo-600">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('metrics.directReports', { defaultValue: 'Direct Reports' })}
            </CardTitle>
            <Users className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metricsLoading ? '...' : metrics?.totalDirectReports || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('metrics.directReportsDesc', { defaultValue: 'Active team members under your supervision' })}
            </p>
          </CardContent>
        </Card>

        <Card id="card-active-onboardings" className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('metrics.activeOnboardings', { defaultValue: 'Active Onboardings' })}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metricsLoading ? '...' : metrics?.activeOnboardingCount || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('metrics.activeOnboardingsDesc', { defaultValue: 'Employees currently completing onboarding' })}
            </p>
          </CardContent>
        </Card>

        <Card id="card-completion-rate" className="border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('metrics.teamCompletionRate', { defaultValue: 'Team Completion Rate' })}
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {metricsLoading ? '...' : `${metrics?.overallCompletionRate || 0}%`}
            </div>
            <Progress value={metrics?.overallCompletionRate || 0} className="h-1.5 mt-2 bg-emerald-100" />
          </CardContent>
        </Card>

        <Card id="card-overdue-items" className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('metrics.overdueItems', { defaultValue: 'Overdue Items' })}
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {metricsLoading ? '...' : metrics?.overdueItemsCount || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('metrics.overdueItemsDesc', { defaultValue: 'Pending journeys or tasks past due date' })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Manager Feature Quick Actions & Integrations */}
      {(hasFeature('milestone_approval') || hasFeature('buddy_assignment') || hasFeature('calendar_integration')) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {hasFeature('milestone_approval') && (
            <Card data-testid="card-milestone-approvals" className="border-l-4 border-l-purple-500 hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Flag className="h-4 w-4 text-purple-600" />
                  {t('quickActions.milestoneApprovals', { defaultValue: 'Milestone Approvals' })}
                </CardTitle>
                {pendingMilestones.length > 0 && (
                  <Badge className="bg-amber-500 text-white font-bold text-xs px-2 py-0.5">
                    {t('quickActions.pendingCount', { count: pendingMilestones.length, defaultValue: `${pendingMilestones.length} Pending` })}
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  {pendingMilestones.length > 0
                    ? t('quickActions.milestoneSubmitted', { count: pendingMilestones.length, defaultValue: `${pendingMilestones.length} direct reports have submitted self check-ins awaiting your sign-off.` })
                    : t('quickActions.milestoneDesc', { defaultValue: 'Review 30-60-90 day check-ins, assess goal completion, and sign off ratings.' })}
                </p>
                <Button size="sm" variant={pendingMilestones.length > 0 ? "default" : "outline"} className={`w-full ${pendingMilestones.length > 0 ? 'bg-purple-600 hover:bg-purple-700 text-white font-semibold' : ''}`} asChild>
                  <Link to="/milestones">{t('quickActions.reviewMilestonesBtn', { defaultValue: 'Review Milestone Approvals' })}</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {hasFeature('buddy_assignment') && (
            <Card data-testid="card-buddy-matching" className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  {t('quickActions.buddyMatching', { defaultValue: 'Buddy Matching' })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  {t('quickActions.buddyDesc', { defaultValue: 'Assign and pair senior team mentors to new hires for peer guidance.' })}
                </p>
                <Button size="sm" variant="outline" className="w-full" asChild>
                  <Link to="/buddy">{t('quickActions.manageBuddyBtn', { defaultValue: 'Manage Buddy Matching' })}</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {hasFeature('calendar_integration') && (
            <Card data-testid="card-calendar-schedule" className="border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-600" />
                  {t('quickActions.calendarSchedule', { defaultValue: 'Calendar 1-on-1 Schedule' })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  {t('quickActions.calendarDesc', { defaultValue: 'Schedule recurring onboarding 1-on-1s and sync calendar milestones.' })}
                </p>
                <Button size="sm" variant="outline" className="w-full" asChild>
                  <Link to="/calendar">{t('quickActions.viewCalendarBtn', { defaultValue: 'View 1-on-1 Schedule' })}</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Pending Milestone Reviews Queue Card */}
      {pendingMilestones.length > 0 && (
        <Card className="border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-background to-background dark:from-amber-950/20 shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  <Flag className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                    {t('pendingAlert.actionRequired', {
                      count: pendingMilestones.length,
                      defaultValue: `Action Required: ${pendingMilestones.length} Pending Milestone ${pendingMilestones.length === 1 ? 'Evaluation' : 'Evaluations'}`
                    })}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {t('pendingAlert.desc', { defaultValue: 'Direct reports have submitted self check-in reflections and are awaiting manager review and sign-off.' })}
                  </CardDescription>
                </div>
              </div>
              <Button size="sm" asChild className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 shrink-0">
                <Link to="/milestones">{t('pendingAlert.reviewAll', { defaultValue: 'Review All Milestones' })}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="divide-y divide-border/60">
              {pendingMilestones.slice(0, 3).map((pm: any) => {
                const empName = pm.employeeId?.profile
                  ? `${pm.employeeId.profile.firstName || ''} ${pm.employeeId.profile.lastName || ''}`.trim()
                  : (pm.employeeId?.name || t('pendingAlert.directReportFallback', { defaultValue: 'Direct Report' }));
                return (
                  <div key={pm._id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{empName}</span>
                      <Badge className="bg-indigo-100 text-indigo-800 text-[10px]">
                        {t('pendingAlert.day', { day: pm.targetDay, defaultValue: `Day ${pm.targetDay}` })}
                      </Badge>
                      <span className="text-muted-foreground truncate max-w-xs">{pm.milestoneTitle}</span>
                    </div>
                    <Button size="sm" variant="ghost" asChild className="h-7 text-xs text-indigo-600 hover:text-indigo-700">
                      <Link to="/milestones">{t('pendingAlert.review', { defaultValue: 'Review' })} &rarr;</Link>
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Direct Report Roster Table */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold">{t('roster.title', { defaultValue: 'Direct Reports Roster' })}</CardTitle>
              <CardDescription>
                {t('roster.subtitle', { defaultValue: 'Track individual progress, send reminders, and manage onboarding milestones.' })}
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('roster.searchPlaceholder', { defaultValue: 'Search direct reports...' })}
                value={search}
                onChange={(e: any) => setSearch(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {teamLoading ? (
            <div className="p-8 text-center text-muted-foreground">{t('roster.loading', { defaultValue: 'Loading direct reports...' })}</div>
          ) : filteredTeam.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {t('roster.empty', { defaultValue: 'No direct reports found. Assign employees to your manager account in HR Settings.' })}
            </div>
          ) : (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/30 text-xs uppercase font-medium text-muted-foreground border-b">
                    <tr>
                      <th className="px-6 py-3">{t('roster.columns.employee', { defaultValue: 'Employee' })}</th>
                      <th className="px-6 py-3">{t('roster.columns.deptRole', { defaultValue: 'Department & Role' })}</th>
                      <th className="px-6 py-3">{t('roster.columns.journeyProgress', { defaultValue: 'Journey Progress' })}</th>
                      <th className="px-6 py-3">{t('roster.columns.checklistTasks', { defaultValue: 'Checklist Tasks' })}</th>
                      <th className="px-6 py-3">{t('roster.columns.status', { defaultValue: 'Status' })}</th>
                      <th className="px-6 py-3 text-right">{t('roster.columns.actions', { defaultValue: 'Manager Actions' })}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {teamPagination.paginatedData.map((emp) => (
                      <tr
                        key={emp._id}
                        id={`direct-report-row-${emp._id}`}
                        className="hover:bg-muted/20 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedEmpId(emp._id);
                          setIsDetailsDrawerOpen(true);
                        }}
                      >
                        <td className="px-6 py-4 font-medium">
                          <div>{emp.fullName}</div>
                          <div className="text-xs text-muted-foreground font-normal">{emp.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs font-medium">{emp.jobTitle || t('roster.defaultJobTitle', { defaultValue: 'Team Member' })}</div>
                          <div className="text-xs text-muted-foreground">{emp.department || t('roster.defaultDepartment', { defaultValue: 'General' })}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3 w-40">
                            <Progress value={emp.journeyStats.completionPercentage} className="h-2 flex-1" />
                            <span className="text-xs font-semibold w-10 text-right">
                              {emp.journeyStats.completionPercentage}%
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-1">
                            {t('roster.journeysDone', { completed: emp.journeyStats.completed, total: emp.journeyStats.totalAssigned, defaultValue: `${emp.journeyStats.completed} / ${emp.journeyStats.totalAssigned} Journeys Done` })}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs font-medium">
                            {t('roster.tasksCompleted', { completed: emp.taskStats.completed, total: emp.taskStats.totalAssigned, defaultValue: `${emp.taskStats.completed} / ${emp.taskStats.totalAssigned} Tasks Completed` })}
                          </div>
                          {emp.taskStats.overdue > 0 && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] mt-1">
                              {t('roster.overdueCount', { count: emp.taskStats.overdue, defaultValue: `${emp.taskStats.overdue} Overdue` })}
                            </Badge>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {emp.hasOverdueItems ? (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                              {t('roster.status.overdue', { defaultValue: 'Overdue Items' })}
                            </Badge>
                          ) : emp.journeyStats.completionPercentage === 100 ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                              {t('roster.status.completed', { defaultValue: 'Completed' })}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                              {t('roster.status.onboarding', { defaultValue: 'Onboarding' })}
                            </Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <Button
                            id={`view-details-btn-${emp._id}`}
                            size="sm"
                            variant="ghost"
                            title={t('roster.actions.viewDetails', { defaultValue: 'View Details' })}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEmpId(emp._id);
                              setIsDetailsDrawerOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            id={`send-nudge-btn-${emp._id}`}
                            size="sm"
                            variant="outline"
                            title={t('roster.actions.sendNudge', { defaultValue: 'Send Nudge' })}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEmpId(emp._id);
                              setIsNudgeModalOpen(true);
                            }}
                          >
                            <BellRing className="h-4 w-4 text-amber-600" />
                          </Button>
                          <Button
                            id={`sign-off-btn-${emp._id}`}
                            size="sm"
                            variant="outline"
                            title={t('roster.actions.signOff', { defaultValue: 'Sign Off Onboarding' })}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEmpId(emp._id);
                              setIsSignOffModalOpen(true);
                            }}
                          >
                            <UserCheck className="h-4 w-4 text-emerald-600" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                  itemLabel={t('roster.reportsLabel', { defaultValue: 'reports' })}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send Nudge Modal */}
      <Dialog open={isNudgeModalOpen} onOpenChange={setIsNudgeModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <BellRing className="h-5 w-5" /> {t('nudgeModal.title', { defaultValue: 'Send Manager Nudge' })}
            </DialogTitle>
            <DialogDescription>
              {t('nudgeModal.desc', { defaultValue: 'Send an instant in-app alert to encourage your direct report to complete their pending onboarding tasks.' })}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('nudgeModal.customMessage', { defaultValue: 'Custom Message (Optional)' })}
              </label>
              <textarea
                className="w-full min-h-[100px] text-sm p-3 border rounded-md focus:ring-2 focus:ring-amber-500 focus:outline-none"
                placeholder={t('nudgeModal.placeholder', { defaultValue: 'e.g. Hi! Just a quick reminder to complete your Compliance & Security training by Friday.' })}
                value={nudgeMsg}
                onChange={(e) => setNudgeMsg(e.target.value)}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNudgeModalOpen(false)}>
              {t('common:cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleNudgeSubmit}
              disabled={nudgeMutation.isPending}
            >
              {nudgeMutation.isPending ? t('nudgeModal.sending', { defaultValue: 'Sending...' }) : t('nudgeModal.send', { defaultValue: 'Send Nudge Alert' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manager Sign-Off Modal */}
      <Dialog open={isSignOffModalOpen} onOpenChange={setIsSignOffModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <Award className="h-5 w-5" /> {t('signOffModal.title', { defaultValue: 'Manager Onboarding Sign-Off' })}
            </DialogTitle>
            <DialogDescription>
              {t('signOffModal.desc', { defaultValue: "Formally approve and sign off on this employee's onboarding program." })}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('signOffModal.notes', { defaultValue: 'Sign-Off Notes / Feedback' })}
              </label>
              <textarea
                className="w-full min-h-[100px] text-sm p-3 border rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder={t('signOffModal.placeholder', { defaultValue: 'e.g. Employee completed all mandatory journeys and team orientation tasks with excellent performance.' })}
                value={signOffNotes}
                onChange={(e) => setSignOffNotes(e.target.value)}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSignOffModalOpen(false)}>
              {t('common:cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleSignOffSubmit}
              disabled={signOffMutation.isPending}
            >
              {signOffMutation.isPending ? t('signOffModal.processing', { defaultValue: 'Processing...' }) : t('signOffModal.approve', { defaultValue: 'Approve & Sign Off' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deep-Dive Employee Details Drawer / Modal */}
      <Dialog open={isDetailsDrawerOpen} onOpenChange={setIsDetailsDrawerOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-indigo-600" />
              {t('detailsDrawer.title', { defaultValue: 'Direct Report Onboarding Details' })}
            </DialogTitle>
            <DialogDescription>
              {empDetails?.employee.fullName} ({empDetails?.employee.jobTitle || t('roster.defaultJobTitle', { defaultValue: 'Team Member' })} - {empDetails?.employee.department || t('roster.defaultDepartment', { defaultValue: 'General' })})
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-6">
            {detailsLoading ? (
              <div className="p-8 text-center text-muted-foreground">{t('detailsDrawer.loading', { defaultValue: 'Loading employee deep-dive data...' })}</div>
            ) : (
              <>
                {/* Journeys Section */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-indigo-600">
                    <BookOpen className="h-4 w-4" /> {t('detailsDrawer.assignedJourneys', { count: empDetails?.assignments.length || 0, defaultValue: `Assigned Journeys (${empDetails?.assignments.length || 0})` })}
                  </h4>
                  {empDetails?.assignments.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">{t('detailsDrawer.noJourneys', { defaultValue: 'No journeys assigned yet.' })}</p>
                  ) : (
                    <div className="space-y-3">
                      {empDetails?.assignments.map((a) => (
                        <div key={a._id} className="p-3 border rounded-lg bg-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div>
                            <div className="font-medium text-sm">{a.journeyTitle} (v{a.journeyVersion})</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {t('detailsDrawer.assignedOn', { date: new Date(a.assignedAt).toLocaleDateString(), defaultValue: `Assigned on ${new Date(a.assignedAt).toLocaleDateString()}` })} {a.dueDate ? `| ${t('detailsDrawer.dueOn', { date: new Date(a.dueDate).toLocaleDateString(), defaultValue: `Due ${new Date(a.dueDate).toLocaleDateString()}` })}` : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 w-full sm:w-auto">
                            <Progress value={a.progress?.completionPercentage || 0} className="h-2 w-28" />
                            <span className="text-xs font-semibold w-10 text-right">
                              {a.progress?.completionPercentage || 0}%
                            </span>
                            <Badge variant="outline" className="capitalize text-[10px]">
                              {a.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tasks Section */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-indigo-600">
                    <CheckSquare className="h-4 w-4" /> {t('detailsDrawer.checklistTasks', { count: empDetails?.tasks.length || 0, defaultValue: `Checklist Tasks (${empDetails?.tasks.length || 0})` })}
                  </h4>
                  {empDetails?.tasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">{t('detailsDrawer.noTasks', { defaultValue: 'No standalone checklist tasks assigned yet.' })}</p>
                  ) : (
                    <div className="space-y-2">
                      {empDetails?.tasks.map((tItem) => (
                        <div key={tItem._id} className="p-3 border rounded-lg bg-card flex justify-between items-center text-xs">
                          <div>
                            <span className="font-medium text-foreground">{tItem.title}</span>
                            {tItem.category && <span className="ml-2 text-muted-foreground">({tItem.category})</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            {tItem.dueDate && (
                              <span className="text-muted-foreground">{t('detailsDrawer.due', { date: new Date(tItem.dueDate).toLocaleDateString(), defaultValue: `Due: ${new Date(tItem.dueDate).toLocaleDateString()}` })}</span>
                            )}
                            <Badge
                              variant="outline"
                              className={
                                tItem.status === 'completed'
                                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                              }
                            >
                              {tItem.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailsDrawerOpen(false)}>
              {t('detailsDrawer.close', { defaultValue: 'Close' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagerDashboard;
