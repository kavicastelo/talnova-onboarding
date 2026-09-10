import { useState } from 'react';
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
  CheckCircle2,
  BarChart3,
  LineChart as LineChartIcon
} from 'lucide-react';
import {
  useAnalyticsOverview,
  useTimeToCompletion,
  useAnalyticsBottlenecks,
  useScheduledReports,
  useCreateScheduledReport,
  useDeleteScheduledReport
} from '../hooks/useAnalytics';
import { useDepartments } from '../hooks/useSettings';
import { analyticsService } from '../services/analytics.service';
import { Skeleton } from '../components/Skeleton';
import { toast } from 'sonner';
import { SimplePagination } from '../components/SimplePagination';
import { usePagination } from '../hooks/usePagination';

export function Analytics() {
  const [department, setDepartment] = useState('All');
  const [range, setRange] = useState('30d');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Scheduled Report Form State
  const [reportTitle, setReportTitle] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [recipientsInput, setRecipientsInput] = useState('');

  const { data: overview, isLoading } = useAnalyticsOverview({ department, range });
  const { data: timeStats } = useTimeToCompletion();
  const { data: bottlenecks } = useAnalyticsBottlenecks();
  const { data: scheduledReports, refetch: refetchReports } = useScheduledReports();
  const { data: departments = [] } = useDepartments();

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
      toast.success('Compliance CSV report exported successfully!');
    } catch {
      toast.error('Failed to export CSV report');
    }
  };

  const handleCreateReport = () => {
    if (!reportTitle.trim() || !recipientsInput.trim()) {
      toast.error('Please fill in report title and recipient emails.');
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
          toast.success('Scheduled report created!');
          setIsReportModalOpen(false);
          setReportTitle('');
          setRecipientsInput('');
          refetchReports();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to create scheduled report');
        },
      }
    );
  };

  const handleDeleteReport = (id: string) => {
    deleteReportMutation.mutate(id, {
      onSuccess: () => {
        toast.success('Scheduled report deleted.');
        refetchReports();
      },
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
            Company Analytics & Onboarding Telemetry
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time cohort velocity, onboarding funnel drop-off stages, and departmental productivity ramp-up.
          </p>
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Department Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-background border rounded-md px-2.5 py-1.5 shadow-sm">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs font-semibold text-muted-foreground">Dept:</span>
            <select
              data-testid="analytics-department-select"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="text-xs bg-transparent border-0 focus:outline-none font-medium cursor-pointer"
            >
              {departmentOptions.map((dept) => (
                <option key={dept} value={dept}>
                  {dept === 'All' ? 'All Departments' : dept}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Selector */}
          <div className="flex items-center gap-1.5 bg-background border rounded-md px-2.5 py-1.5 shadow-sm">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs font-semibold text-muted-foreground">Range:</span>
            <select
              data-testid="analytics-range-select"
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="text-xs bg-transparent border-0 focus:outline-none font-medium cursor-pointer"
            >
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>

          <Button variant="outline" size="sm" onClick={() => setIsReportModalOpen(true)}>
            <Calendar className="h-4 w-4 mr-1.5" /> Reports
          </Button>

          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-1.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Onboarding */}
        <Card data-testid="metric-active-onboarding" className="p-4 bg-card border shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">Active Onboarding</span>
            <Users className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold mt-2 text-foreground">{overview?.activeOnboarding ?? 0}</div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {department !== 'All' ? `Filtered by ${department}` : 'Across all departments'}
          </p>
        </Card>

        {/* Avg Completion Days */}
        <Card data-testid="metric-avg-completion" className="p-4 bg-card border shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">Avg Completion Time</span>
            <Clock className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold mt-2 text-foreground">
            {overview?.avgCompletionDays ?? timeStats?.averageCompletionDays ?? 14} Days
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Fastest: 6d • Industry benchmark: 21d</p>
        </Card>

        {/* Retention Rate */}
        <Card data-testid="metric-retention-rate" className="p-4 bg-card border shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">Retention Rate</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold mt-2 text-foreground">{overview?.retentionRate ?? 96}%</div>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">+2.4% vs previous cohort</p>
        </Card>

        {/* Overall Completion Rate */}
        <Card data-testid="metric-completion-rate" className="p-4 bg-card border shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">Funnel Conversion</span>
            <Award className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold mt-2 text-foreground">{overview?.completionRate ?? 78}%</div>
          <p className="text-[11px] text-muted-foreground mt-1">Day 90 Full Productivity</p>
        </Card>
      </div>

      {/* Main Charts Row: Funnel & Productivity Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Drop-off Funnel Chart */}
        <Card data-testid="funnel-chart" className="border shadow-sm">
          <CardHeader className="pb-3 border-b">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-indigo-600" />
                  Onboarding Funnel & Drop-off Telemetry
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Attrition drop-off percentage through Day 1 to Day 90 milestone stages.
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
                  formatter={(val: any, name: any, item: any) => [
                    `${val}% active (${item.payload.count} learners, drop-off: ${item.payload.dropOff}%)`,
                    'Completion'
                  ]}
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    border: '1px solid #e2e8f0'
                  }}
                />
                <Bar dataKey="percentage" radius={[0, 4, 4, 0]}>
                  {funnelData.map((entry, index) => (
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
                  Productivity Ramp-up Curve
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Measured velocity from day 1 onboarding to full workplace autonomy.
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                Target: 95%
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
                  formatter={(val: any) => [`${val}% Productive`, 'Autonomy']}
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
              Module & Quiz Bottleneck Analysis
            </CardTitle>
            <CardDescription className="text-xs">Modules with lowest quiz pass rates and student drop-offs.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {(bottlenecks?.moduleBottlenecks || []).length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs">No quiz bottleneck data recorded yet.</div>
            ) : (
              <div>
                <div className="divide-y text-xs">
                  {bottlenecksPagination.paginatedData.map((m) => (
                    <div key={m.moduleId} className="p-3.5 flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-foreground">{m.title}</div>
                        <div className="text-muted-foreground">{m.attempts} total quiz attempt(s)</div>
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
                          {m.passRate}% Pass Rate
                        </Badge>
                        <div className="text-muted-foreground mt-0.5">Avg Score: {m.averageScore}%</div>
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
                    itemLabel="modules"
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
              Difficult Quiz Questions Item Analysis
            </CardTitle>
            <CardDescription className="text-xs">Questions with highest incorrect answer rates.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {(bottlenecks?.difficultQuestions || []).length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs">No difficult question items recorded yet.</div>
            ) : (
              <div>
                <div className="divide-y text-xs">
                  {questionsPagination.paginatedData.map((q) => (
                    <div key={q.questionId} className="p-3.5 flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-foreground">{q.questionText}</div>
                        <div className="text-muted-foreground">{q.attempts} total attempt(s)</div>
                      </div>
                      <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                        {q.incorrectRate}% Incorrect
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
                    itemLabel="questions"
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
            <DialogTitle>Scheduled Compliance Reports</DialogTitle>
            <DialogDescription>Automate recurring CSV analytics reports delivered via email.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Report Schedule Title</label>
              <Input
                placeholder="e.g. Weekly Executive Compliance Digest"
                value={reportTitle}
                onChange={(e: any) => setReportTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Frequency</label>
                <select
                  className="w-full text-sm p-2 border rounded-md bg-background focus:outline-none"
                  value={frequency}
                  onChange={(e: any) => setFrequency(e.target.value)}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Recipients (Comma separated)</label>
                <Input
                  placeholder="hr@company.com, exec@company.com"
                  value={recipientsInput}
                  onChange={(e: any) => setRecipientsInput(e.target.value)}
                />
              </div>
            </div>

            <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleCreateReport}>
              <Plus className="h-4 w-4 mr-2" /> Add Scheduled Report Schedule
            </Button>

            {/* List Existing Schedules */}
            <div className="space-y-2 pt-2 border-t">
              <h4 className="text-xs font-semibold text-muted-foreground">Active Schedules</h4>
              {(scheduledReports || []).length === 0 ? (
                <div className="text-xs text-muted-foreground">No active scheduled reports.</div>
              ) : (
                <div className="space-y-2">
                  {reportsPagination.paginatedData.map((r) => (
                    <div key={r._id} className="p-2.5 bg-muted/20 border rounded-md flex justify-between items-center text-xs">
                      <div>
                        <div className="font-semibold">{r.title}</div>
                        <div className="text-muted-foreground">{r.frequency.toUpperCase()} • Recipients: {r.recipients.join(', ')}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDeleteReport(r._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
                    itemLabel="reports"
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReportModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Analytics;