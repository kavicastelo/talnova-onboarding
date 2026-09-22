import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Input } from '../components/Input';
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
  Bar,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
  ResponsiveContainer,
  Cell
} from 'recharts';
import {
  Download,
  TrendingUp,
  Users,
  Clock,
  Award,
  Zap,
  HelpCircle,
  Calendar,
  Plus,
  Trash2,
  Filter,
  BarChart3,
  LineChart as LineChartIcon,
  Flag,
  Activity,
  Send,
  CheckCircle2
} from 'lucide-react';
import {
  useAnalyticsOverview,
  useTimeToCompletion,
  useAnalyticsBottlenecks,
  useScheduledReports,
  useCreateScheduledReport,
  useDeleteScheduledReport,
  useCohortHealth,
  useNudgeEmployee,
  useRunScheduledReport
} from '../hooks/useAnalytics';
import { useTeamMilestones } from '../hooks/useMilestones';
import { useDepartments } from '../hooks/useSettings';
import { analyticsService } from '../services/analytics.service';
import { Skeleton } from '../components/Skeleton';
import { toast } from 'sonner';
import { SimplePagination } from '../components/SimplePagination';
import { usePagination } from '../hooks/usePagination';

export function Analytics() {
  const { t } = useTranslation('analytics');
  const [department, setDepartment] = useState('All');
  const [range, setRange] = useState('30d');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Scheduled Report Form State
  const [reportTitle, setReportTitle] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [recipientsInput, setRecipientsInput] = useState('');

  const { data: overview, isLoading } = useAnalyticsOverview({ department, range });
  const { data: timeStats } = useTimeToCompletion({ department });
  const { data: bottlenecks } = useAnalyticsBottlenecks({ department });
  const { data: cohortHealth, refetch: refetchCohort } = useCohortHealth({ department });
  const { data: scheduledReports, refetch: refetchReports } = useScheduledReports();
  const { data: departments = [] } = useDepartments();
  const { data: teamMilestones = [] } = useTeamMilestones();

  const nudgeMutation = useNudgeEmployee();
  const runReportMutation = useRunScheduledReport();

  const totalMilestones = teamMilestones.length;
  const completedMilestones = teamMilestones.filter((m: any) => m.status === 'completed' || m.status === 'approved').length;
  const pendingReviewMilestones = teamMilestones.filter((m: any) => m.status === 'in_review' || m.status === 'pending_manager_review').length;
  const overdueMilestones = teamMilestones.filter((m: any) => (m.dueDate && new Date(m.dueDate).getTime() < Date.now() && m.status !== 'completed' && m.status !== 'approved') || m.sla?.status === 'breached').length;
  const milestoneCompletionRate = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 100;
  const onTimeSlaRate = totalMilestones > 0 ? Math.round(((totalMilestones - overdueMilestones) / totalMilestones) * 100) : 100;

  const bottlenecksPagination = usePagination({ data: bottlenecks?.moduleBottlenecks || [], initialPageSize: 5 });
  const questionsPagination = usePagination({ data: bottlenecks?.difficultQuestions || [], initialPageSize: 5 });
  const reportsPagination = usePagination({ data: scheduledReports || [], initialPageSize: 5 });

  const createReportMutation = useCreateScheduledReport();
  const deleteReportMutation = useDeleteScheduledReport();

  const handleExportCSV = async () => {
    try {
      const csvData = await analyticsService.exportCSV();
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `onboarding_compliance_report_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(t('toasts.exportSuccess', { defaultValue: 'Compliance CSV report exported successfully!' }));
    } catch {
      toast.error(t('toasts.exportError', { defaultValue: 'Failed to export CSV report' }));
    }
  };

  const handleCreateReport = () => {
    if (!reportTitle.trim() || !recipientsInput.trim()) {
      toast.error(t('toasts.validationError', { defaultValue: 'Please fill in report title and recipient emails.' }));
      return;
    }

    const recipients = recipientsInput
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    createReportMutation.mutate(
      {
        title: reportTitle,
        frequency,
        recipients,
        format: 'csv',
      },
      {
        onSuccess: () => {
          toast.success(t('toasts.reportCreated', { defaultValue: 'Scheduled report created!' }));
          setIsReportModalOpen(false);
          setReportTitle('');
          setRecipientsInput('');
          refetchReports();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || t('toasts.createReportError', { defaultValue: 'Failed to create scheduled report' }));
        },
      }
    );
  };

  const handleDeleteReport = (id: string) => {
    deleteReportMutation.mutate(id, {
      onSuccess: () => {
        toast.success(t('toasts.reportDeleted', { defaultValue: 'Scheduled report deleted.' }));
        refetchReports();
      },
    });
  };

  const handleNudge = (employeeId: string) => {
    nudgeMutation.mutate(employeeId, {
      onSuccess: (res) => {
        toast.success(res?.message || t('cohortHealth.nudgeSuccess', { defaultValue: 'Intervention nudge dispatched successfully!' }));
        refetchCohort();
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.message || err?.message || t('cohortHealth.nudgeFailed', { defaultValue: 'Failed to send nudge' }));
      }
    });
  };

  const handleRunReport = (id: string) => {
    runReportMutation.mutate(id, {
      onSuccess: (res) => {
        toast.success(res?.message || t('scheduledReports.runSuccess', { defaultValue: 'Scheduled report triggered and dispatched!' }));
        refetchReports();
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.message || err?.message || t('scheduledReports.runFailed', { defaultValue: 'Failed to execute report' }));
      }
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  // Combined department list (from backend + defaults)
  const defaultDepts = ['Sales', 'Engineering', 'Marketing', 'Customer Success'];
  const departmentOptions = Array.from(
    new Set(['All', ...departments.map((d: any) => d.name), ...defaultDepts])
  );

  const funnelData = overview?.funnelStages || [];
  const productivityData = overview?.productivityCurve || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-indigo-600" />
            {t('title', { defaultValue: 'Company Analytics & Onboarding Telemetry' })}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('subtitle', { defaultValue: 'Real-time cohort velocity, onboarding funnel drop-off stages, and departmental productivity ramp-up.' })}
          </p>
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Department Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-background border rounded-md px-2.5 py-1.5 shadow-sm">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs font-semibold text-muted-foreground">
              {t('filters.deptLabel', { defaultValue: 'Dept:' })}
            </span>
            <select
              data-testid="analytics-department-select"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="text-xs bg-transparent border-0 focus:outline-none font-medium cursor-pointer"
            >
              {departmentOptions.map((dept) => (
                <option key={dept} value={dept}>
                  {dept === 'All' ? t('filterDept', { defaultValue: 'All Departments' }) : dept}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Selector */}
          <div className="flex items-center gap-1.5 bg-background border rounded-md px-2.5 py-1.5 shadow-sm">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs font-semibold text-muted-foreground">
              {t('filters.rangeLabel', { defaultValue: 'Range:' })}
            </span>
            <select
              data-testid="analytics-range-select"
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="text-xs bg-transparent border-0 focus:outline-none font-medium cursor-pointer"
            >
              <option value="30d">{t('filterRange.30d', { defaultValue: 'Last 30 Days' })}</option>
              <option value="90d">{t('filterRange.90d', { defaultValue: 'Last 90 Days' })}</option>
              <option value="all">{t('filterRange.all', { defaultValue: 'All Time' })}</option>
            </select>
          </div>

          <Button variant="outline" size="sm" onClick={() => setIsReportModalOpen(true)}>
            <Calendar className="h-4 w-4 mr-1.5" /> {t('reportsBtn', { defaultValue: 'Reports' })}
          </Button>

          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-1.5" /> {t('exportCSV', { defaultValue: 'Export CSV' })}
          </Button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Onboarding */}
        <Card data-testid="metric-active-onboarding" className="p-4 bg-card border shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">
              {t('kpis.activeCohort', { defaultValue: 'Active Onboarding' })}
            </span>
            <Users className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold mt-2 text-foreground">{overview?.activeOnboarding ?? 0}</div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {department !== 'All'
              ? t('kpis.filteredBy', { department, defaultValue: `Filtered by ${department}` })
              : t('kpis.acrossAll', { defaultValue: 'Across all departments' })}
          </p>
        </Card>

        {/* Avg Completion Days */}
        <Card data-testid="metric-avg-completion" className="p-4 bg-card border shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">
              {t('kpis.avgDays', { defaultValue: 'Avg Completion Time' })}
            </span>
            <Clock className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold mt-2 text-foreground">
            {t('kpis.daysUnit', {
              count: overview?.avgCompletionDays ?? timeStats?.averageCompletionDays ?? 14,
              defaultValue: `${overview?.avgCompletionDays ?? timeStats?.averageCompletionDays ?? 14} Days`
            })}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {t('benchmarkDynamic', {
              fastest: timeStats?.fastestCompletionDays ?? 6,
              benchmark: 21,
              defaultValue: `Fastest: ${timeStats?.fastestCompletionDays ?? 6}d • Industry benchmark: 21d`
            })}
          </p>
        </Card>

        {/* Retention Rate */}
        <Card data-testid="metric-retention-rate" className="p-4 bg-card border shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">
              {t('kpis.retention', { defaultValue: 'Retention Rate' })}
            </span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold mt-2 text-foreground">{overview?.retentionRate ?? 96}%</div>
          <p
            className={`text-[11px] font-medium mt-1 ${
              parseFloat(overview?.retentionDelta || '0') >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {overview?.retentionDelta
              ? overview.retentionDelta.startsWith('+') || overview.retentionDelta.startsWith('-')
                ? `${overview.retentionDelta}%`
                : `+${overview.retentionDelta}%`
              : '+0.0%'}{' '}
            {t('kpis.retentionSub', { defaultValue: 'vs previous period' })}
          </p>
        </Card>

        {/* Overall Completion Rate */}
        <Card data-testid="metric-completion-rate" className="p-4 bg-card border shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">
              {t('kpis.milestoneCompletion', { defaultValue: 'Funnel Conversion' })}
            </span>
            <Award className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold mt-2 text-foreground">{overview?.completionRate ?? 78}%</div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {t('kpis.productivitySub', { defaultValue: 'Day 90 Full Productivity' })}
          </p>
        </Card>
      </div>

      {/* Milestone Check-ins & SLA Adherence Card */}
      <Card className="border-indigo-500/30 bg-gradient-to-r from-indigo-900/10 via-background to-background dark:from-indigo-950/20 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Flag className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  {t('milestonesCard.title', { defaultValue: 'Milestones & Probation SLA Performance (30/60/90/180D)' })}
                  <Badge variant="outline" className="text-[10px] border-indigo-300 text-indigo-700 dark:text-indigo-300">
                    {t('milestonesCard.badge', { defaultValue: 'Live Operational SLA' })}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('milestonesCard.desc', { defaultValue: 'Evaluation completion rates, direct report review queues, and escalation health metrics.' })}
                </CardDescription>
              </div>
            </div>
            <Button size="sm" variant="outline" asChild className="text-xs h-8">
              <a href="/milestones">
                {t('milestonesCard.openConsole', { defaultValue: 'Open Milestones Console →' })}
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
            <div className="p-3 rounded-xl bg-card border border-border/70 shadow-2xs">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                {t('milestonesCard.totalMilestones', { defaultValue: 'Total Milestones' })}
              </span>
              <div className="text-xl font-bold text-foreground mt-1">{totalMilestones}</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {t('milestonesCard.assignedCheckins', { defaultValue: 'Assigned check-ins' })}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-card border border-border/70 shadow-2xs">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                {t('milestonesCard.signOffRate', { defaultValue: 'Sign-off Rate' })}
              </span>
              <div className="text-xl font-bold text-emerald-600 mt-1">{milestoneCompletionRate}%</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {t('milestonesCard.approvedOfTotal', {
                  completed: completedMilestones,
                  total: totalMilestones,
                  defaultValue: `${completedMilestones} of ${totalMilestones} approved`
                })}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-card border border-border/70 shadow-2xs">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                {t('milestonesCard.onTimeSla', { defaultValue: 'On-Time SLA' })}
              </span>
              <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{onTimeSlaRate}%</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {t('milestonesCard.escalatedBreached', {
                  count: overdueMilestones,
                  defaultValue: `${overdueMilestones} escalated/breached`
                })}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-card border border-border/70 shadow-2xs">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                {t('milestonesCard.pendingReviews', { defaultValue: 'Pending Reviews' })}
              </span>
              <div className="text-xl font-bold text-amber-600 mt-1">{pendingReviewMilestones}</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {t('milestonesCard.awaitingSignoff', { defaultValue: 'Awaiting manager sign-off' })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* At-Risk Cohort & Velocity Radar Card */}
      <Card data-testid="cohort-health-card" className="border-rose-500/30 bg-gradient-to-r from-rose-900/10 via-background to-background dark:from-rose-950/20 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  {t('cohortHealth.title', { defaultValue: 'At-Risk Cohort & Velocity Radar' })}
                  {cohortHealth && (
                    <div className="flex items-center gap-1.5 ml-2">
                      {cohortHealth.criticalCount > 0 && (
                        <Badge variant="outline" className="text-[10px] border-red-300 text-red-700 dark:text-red-400 bg-red-500/10">
                          {cohortHealth.criticalCount} {t('cohortHealth.critical', { defaultValue: 'Critical' })}
                        </Badge>
                      )}
                      {cohortHealth.atRiskCount > 0 && (
                        <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 dark:text-amber-400 bg-amber-500/10">
                          {cohortHealth.atRiskCount} {t('cohortHealth.atRisk', { defaultValue: 'At Risk' })}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10">
                        {cohortHealth.onTrackCount} {t('cohortHealth.onTrack', { defaultValue: 'On Track' })}
                      </Badge>
                    </div>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('cohortHealth.desc', { defaultValue: 'Real-time velocity tracking, stall detection, and omnichannel intervention triggers.' })}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div>
                <span className="font-semibold text-foreground">{cohortHealth?.totalEvaluated ?? 0}</span> {t('cohortHealth.evaluatedCount', { defaultValue: 'evaluated' })}
              </div>
              <div>
                <span className="font-semibold text-foreground">{cohortHealth?.avgVelocity ?? 0}%</span> {t('cohortHealth.avgVelocity', { defaultValue: 'avg velocity' })}
              </div>
              <div>
                <span className="font-semibold text-foreground">{cohortHealth?.avgDropOffRisk ?? 0}%</span> {t('cohortHealth.avgRiskScore', { defaultValue: 'avg risk score' })}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {(!cohortHealth?.atRiskEmployees || cohortHealth.atRiskEmployees.length === 0) ? (
            <div className="p-4 rounded-xl bg-card border border-emerald-500/20 flex items-center gap-3 text-xs text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              <span>{t('cohortHealth.noAtRisk', { defaultValue: 'All cohort learners are progressing smoothly within expected velocity thresholds.' })}</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[11px] text-muted-foreground uppercase border-b bg-muted/20">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">{t('cohortHealth.learner', { defaultValue: 'Learner' })}</th>
                    <th className="py-2.5 px-3 font-semibold">{t('cohortHealth.status', { defaultValue: 'Risk Status' })}</th>
                    <th className="py-2.5 px-3 font-semibold">{t('cohortHealth.daysInactive', { defaultValue: 'Inactivity' })}</th>
                    <th className="py-2.5 px-3 font-semibold">{t('cohortHealth.overdueItems', { defaultValue: 'Overdue Items' })}</th>
                    <th className="py-2.5 px-3 font-semibold text-right">{t('cohortHealth.action', { defaultValue: 'Action' })}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {cohortHealth.atRiskEmployees.map((emp) => (
                    <tr key={emp.employeeId} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-foreground">
                        <div>{emp.name || emp.email}</div>
                        <div className="text-[10px] text-muted-foreground">{emp.department || 'General'}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant="outline"
                          className={
                            emp.riskLevel === 'critical'
                              ? 'bg-rose-500/10 text-rose-700 border-rose-300 dark:text-rose-400'
                              : 'bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400'
                          }
                        >
                          {emp.riskLevel.toUpperCase()} ({emp.dropOffRiskScore}% risk)
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {emp.daysInactive} {t('cohortHealth.daysInactive', { defaultValue: 'days inactive' })}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {emp.itemsOverdue} {t('cohortHealth.overdueItems', { defaultValue: 'overdue items' })}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40"
                          disabled={nudgeMutation.isPending && nudgeMutation.variables === emp.employeeId}
                          onClick={() => handleNudge(emp.employeeId)}
                        >
                          <Send className="h-3 w-3 mr-1.5" />
                          {nudgeMutation.isPending && nudgeMutation.variables === emp.employeeId
                            ? t('cohortHealth.nudging', { defaultValue: 'Sending Nudge...' })
                            : t('cohortHealth.sendNudge', { defaultValue: 'Send Nudge' })}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Charts Row: Funnel & Productivity Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Drop-off Funnel Chart */}
        <Card data-testid="funnel-chart" className="border shadow-sm">
          <CardHeader className="pb-3 border-b">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-indigo-600" />
                  {t('charts.funnelTitle', { defaultValue: 'Onboarding Funnel & Drop-off Telemetry' })}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {t('charts.funnelDesc', { defaultValue: 'Attrition drop-off percentage through Day 1 to Day 90 milestone stages.' })}
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">
                {department}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={funnelData}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                <XAxis type="number" domain={[0, 100]} unit="%" fontSize={11} />
                <YAxis
                  dataKey="stage"
                  type="category"
                  width={140}
                  fontSize={11}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(val: any, _name: any, item: any) => [
                    t('charts.funnelTooltip', {
                      val,
                      count: item.payload.count,
                      dropOff: item.payload.dropOff,
                      defaultValue: `${val}% active (${item.payload.count} learners, drop-off: ${item.payload.dropOff}%)`
                    }),
                    t('charts.completion', { defaultValue: 'Completion' })
                  ]}
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    border: '1px solid #e2e8f0'
                  }}
                />
                <Bar dataKey="percentage" radius={[0, 4, 4, 0]}>
                  {funnelData.map((_entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        index === 0
                          ? '#4f46e5'
                          : index === 1
                          ? '#6366f1'
                          : index === 2
                          ? '#818cf8'
                          : index === 3
                          ? '#10b981'
                          : '#059669'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Productivity Ramp-up Curve Chart */}
        <Card data-testid="productivity-chart" className="border shadow-sm">
          <CardHeader className="pb-3 border-b">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <LineChartIcon className="h-5 w-5 text-emerald-600" />
                  {t('charts.productivityTitle', { defaultValue: 'Productivity Ramp-up Curve' })}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {t('charts.productivityDesc', { defaultValue: 'Measured velocity from day 1 onboarding to full workplace autonomy.' })}
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                {t('charts.targetBadge', { defaultValue: 'Target: 95%' })}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={productivityData} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="day" fontSize={11} />
                <YAxis domain={[0, 100]} unit="%" fontSize={11} />
                <Tooltip
                  formatter={(val: any) => [
                    t('charts.productiveTooltip', { val, defaultValue: `${val}% Productive` }),
                    t('charts.autonomy', { defaultValue: 'Autonomy' })
                  ]}
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    border: '1px solid #e2e8f0'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="productivity"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#10b981' }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Module & Quiz Bottleneck Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Module Failure Rates */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              {t('bottlenecks.title', { defaultValue: 'Module & Quiz Bottleneck Analysis' })}
            </CardTitle>
            <CardDescription className="text-xs">
              {t('bottlenecks.desc', { defaultValue: 'Modules with lowest quiz pass rates and student drop-offs.' })}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {(bottlenecks?.moduleBottlenecks || []).length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs">
                {t('bottlenecks.noData', { defaultValue: 'No quiz bottleneck data recorded yet.' })}
              </div>
            ) : (
              <div>
                <div className="divide-y text-xs">
                  {bottlenecksPagination.paginatedData.map((m) => (
                    <div key={m.moduleId} className="p-3.5 flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-foreground">{m.title}</div>
                        <div className="text-muted-foreground">
                          {t('bottlenecks.totalQuizAttempts', {
                            count: m.attempts,
                            defaultValue: `${m.attempts} total quiz attempt(s)`
                          })}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant="outline"
                          className={
                            m.passRate < 70
                              ? 'bg-red-500/10 text-red-600 border-red-500/20'
                              : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                          }
                        >
                          {t('bottlenecks.passRate', {
                            rate: m.passRate,
                            defaultValue: `${m.passRate}% Pass Rate`
                          })}
                        </Badge>
                        <div className="text-muted-foreground mt-0.5">
                          {t('bottlenecks.avgScore', {
                            score: m.averageScore,
                            defaultValue: `Avg Score: ${m.averageScore}%`
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-2 border-t">
                  <SimplePagination
                    currentPage={bottlenecksPagination.page}
                    totalPages={bottlenecksPagination.totalPages}
                    totalItems={bottlenecksPagination.totalItems}
                    startIndex={bottlenecksPagination.startIndex}
                    endIndex={bottlenecksPagination.endIndex}
                    pageSize={bottlenecksPagination.pageSize}
                    onPageChange={bottlenecksPagination.setPage}
                    onPageSizeChange={bottlenecksPagination.setPageSize}
                    itemLabel={t('bottlenecks.modulesLabel', { defaultValue: 'modules' })}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Difficult Questions Analysis */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-indigo-600" />
              {t('bottlenecks.difficultQuestions', { defaultValue: 'Difficult Quiz Questions Item Analysis' })}
            </CardTitle>
            <CardDescription className="text-xs">
              {t('bottlenecks.difficultQuestionsDesc', { defaultValue: 'Questions with highest incorrect answer rates.' })}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {(bottlenecks?.difficultQuestions || []).length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs">
                {t('bottlenecks.noQuestions', { defaultValue: 'No difficult question items recorded yet.' })}
              </div>
            ) : (
              <div>
                <div className="divide-y text-xs">
                  {questionsPagination.paginatedData.map((q) => (
                    <div key={q.questionId} className="p-3.5 flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-foreground">{q.questionText}</div>
                        <div className="text-muted-foreground">
                          {t('bottlenecks.totalAttempts', {
                            count: q.attempts,
                            defaultValue: `${q.attempts} total attempt(s)`
                          })}
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                        {t('bottlenecks.incorrectRate', {
                          rate: q.incorrectRate,
                          defaultValue: `${q.incorrectRate}% Incorrect`
                        })}
                      </Badge>
                    </div>
                  ))}
                </div>
                <div className="p-2 border-t">
                  <SimplePagination
                    currentPage={questionsPagination.page}
                    totalPages={questionsPagination.totalPages}
                    totalItems={questionsPagination.totalItems}
                    startIndex={questionsPagination.startIndex}
                    endIndex={questionsPagination.endIndex}
                    pageSize={questionsPagination.pageSize}
                    onPageChange={questionsPagination.setPage}
                    onPageSizeChange={questionsPagination.setPageSize}
                    itemLabel={t('bottlenecks.questionsLabel', { defaultValue: 'questions' })}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal: Scheduled Reports Drawer */}
      <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t('scheduledReports.modalTitle', { defaultValue: 'Scheduled Compliance Reports' })}
            </DialogTitle>
            <DialogDescription>
              {t('scheduledReports.modalDesc', { defaultValue: 'Automate recurring CSV analytics reports delivered via email.' })}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('scheduledReports.titleLabel', { defaultValue: 'Report Schedule Title' })}
              </label>
              <Input
                placeholder={t('scheduledReports.titlePlaceholder', { defaultValue: 'e.g. Weekly Executive Compliance Digest' })}
                value={reportTitle}
                onChange={(e: any) => setReportTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  {t('scheduledReports.frequency', { defaultValue: 'Frequency' })}
                </label>
                <select
                  className="w-full text-sm p-2 border rounded-md bg-background focus:outline-none"
                  value={frequency}
                  onChange={(e: any) => setFrequency(e.target.value)}
                >
                  <option value="daily">{t('scheduledReports.frequencies.daily', { defaultValue: 'Daily' })}</option>
                  <option value="weekly">{t('scheduledReports.frequencies.weekly', { defaultValue: 'Weekly' })}</option>
                  <option value="monthly">{t('scheduledReports.frequencies.monthly', { defaultValue: 'Monthly' })}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  {t('scheduledReports.recipientsLabel', { defaultValue: 'Recipients (Comma separated)' })}
                </label>
                <Input
                  placeholder={t('scheduledReports.recipientsPlaceholder', { defaultValue: 'hr@company.com, exec@company.com' })}
                  value={recipientsInput}
                  onChange={(e: any) => setRecipientsInput(e.target.value)}
                />
              </div>
            </div>

            <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleCreateReport}>
              <Plus className="h-4 w-4 mr-2" />
              {t('scheduledReports.addBtn', { defaultValue: 'Add Scheduled Report Schedule' })}
            </Button>

            {/* List Existing Schedules */}
            <div className="space-y-2 pt-2 border-t">
              <h4 className="text-xs font-semibold text-muted-foreground">
                {t('scheduledReports.activeSchedules', { defaultValue: 'Active Schedules' })}
              </h4>
              {(scheduledReports || []).length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  {t('scheduledReports.noSchedules', { defaultValue: 'No active scheduled reports.' })}
                </div>
              ) : (
                <div className="space-y-2">
                  {reportsPagination.paginatedData.map((r) => (
                    <div key={r._id} className="p-2.5 bg-muted/20 border rounded-md flex justify-between items-center text-xs">
                      <div>
                        <div className="font-semibold">{r.title}</div>
                        <div className="text-muted-foreground">
                          {t('scheduledReports.recipientsList', {
                            frequency: r.frequency.toUpperCase(),
                            recipients: r.recipients.join(', '),
                            defaultValue: `${r.frequency.toUpperCase()} • Recipients: ${r.recipients.join(', ')}`
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title={t('scheduledReports.runNow', { defaultValue: 'Send Now' })}
                          disabled={runReportMutation.isPending && runReportMutation.variables === r._id}
                          className="text-indigo-600 hover:text-indigo-700"
                          onClick={() => handleRunReport(r._id)}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDeleteReport(r._id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <SimplePagination
                    currentPage={reportsPagination.page}
                    totalPages={reportsPagination.totalPages}
                    totalItems={reportsPagination.totalItems}
                    startIndex={reportsPagination.startIndex}
                    endIndex={reportsPagination.endIndex}
                    pageSize={reportsPagination.pageSize}
                    onPageChange={reportsPagination.setPage}
                    onPageSizeChange={reportsPagination.setPageSize}
                    itemLabel={t('scheduledReports.reportsLabel', { defaultValue: 'reports' })}
                  />
                </div>
              )}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReportModalOpen(false)}>
              {t('scheduledReports.close', { defaultValue: 'Close' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Analytics;