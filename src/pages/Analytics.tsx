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
  CartesianGrid
} from 'recharts';
import { ChartContainer, ChartTooltipContent } from '../components/Chart';
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
  Trash2
} from 'lucide-react';
import {
  useAnalytics,
  useTimeToCompletion,
  useAnalyticsBottlenecks,
  useScheduledReports,
  useCreateScheduledReport,
  useDeleteScheduledReport
} from '../hooks/useAnalytics';
import { analyticsService } from '../services/analytics.service';
import { Skeleton } from '../components/Skeleton';
import { toast } from 'sonner';

export function Analytics() {
  const [range] = useState('30d');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Scheduled Report Form State
  const [reportTitle, setReportTitle] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [recipientsInput, setRecipientsInput] = useState('');

  const { data: analytics, isLoading } = useAnalytics(range);
  const { data: timeStats } = useTimeToCompletion();
  const { data: bottlenecks } = useAnalyticsBottlenecks();
  const { data: scheduledReports, refetch: refetchReports } = useScheduledReports();

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
    } catch (err: any) {
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-indigo-600" />
            Analytics & Operational Reporting
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Operational telemetry across employee onboarding velocity, quiz bottlenecks, and compliance export.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsReportModalOpen(true)}>
            <Calendar className="h-4 w-4 mr-2" /> Scheduled Reports
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-card border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">Avg Completion Time</span>
            <Clock className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold mt-2">{timeStats?.averageCompletionDays ?? 0} Days</div>
          <p className="text-[11px] text-muted-foreground mt-1">Fastest: {timeStats?.fastestCompletionDays ?? 0}d • Slowest: {timeStats?.slowestCompletionDays ?? 0}d</p>
        </Card>

        <Card className="p-4 bg-card border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">Overall Completion</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold mt-2">{analytics?.avgCompletionRate ?? 0}%</div>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">{analytics?.avgCompletionRateDelta ?? '+0%'} vs last month</p>
        </Card>

        <Card className="p-4 bg-card border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">Active Learners</span>
            <Users className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold mt-2">{analytics?.activeLearners ?? 0}</div>
          <p className="text-[11px] text-muted-foreground mt-1">{analytics?.activeLearnersPercent ?? 0}% of active headcount</p>
        </Card>

        <Card className="p-4 bg-card border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">Certificates Issued</span>
            <Award className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold mt-2">{analytics?.certificatesIssued ?? 0}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Issued certificates</p>
        </Card>
      </div>

      {/* Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Completion Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Onboarding Completion Trend</CardTitle>
            <CardDescription>Monthly cohort journey completion velocity.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ChartContainer config={{ rate: { label: 'Completion %', color: '#6366f1' } }}>
              <LineChart data={analytics?.completionTrend || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis domain={[0, 100]} fontSize={11} />
                <Tooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="rate" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Department Completion Rates */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Department Completion Rates</CardTitle>
            <CardDescription>Journey completion breakdown by department.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ChartContainer config={{ rate: { label: 'Completion %', color: '#10b981' } }}>
              <BarChart data={analytics?.departmentCompletions || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis domain={[0, 100]} fontSize={11} />
                <Tooltip content={<ChartTooltipContent />} />
                <Bar dataKey="rate" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
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
            <CardDescription>Modules with lowest quiz pass rates and student drop-offs.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {(bottlenecks?.moduleBottlenecks || []).length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs">No quiz bottleneck data recorded yet.</div>
            ) : (
              <div className="divide-y text-xs">
                {bottlenecks?.moduleBottlenecks.map((m) => (
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
            <CardDescription>Questions with highest incorrect answer rates.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {(bottlenecks?.difficultQuestions || []).length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs">No difficult question items recorded yet.</div>
            ) : (
              <div className="divide-y text-xs">
                {bottlenecks?.difficultQuestions.map((q) => (
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
                  {scheduledReports?.map((r) => (
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