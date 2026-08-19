import React, { useState } from 'react';
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
  UserCheck
} from 'lucide-react';
import {
  useManagerDashboard,
  useTeamDirectReports,
  useDirectReportDetails,
  useNudgeDirectReport,
  useSignOffDirectReport
} from '../hooks/useManager';
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
  DialogFooter
} from '../components/Dialog';
import { toast } from 'sonner';

export const ManagerDashboard: React.FC = () => {
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useManagerDashboard();
  const { data: team, isLoading: teamLoading, refetch: refetchTeam } = useTeamDirectReports();

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

  const handleNudgeSubmit = () => {
    if (!selectedEmpId) return;
    nudgeMutation.mutate(
      { employeeId: selectedEmpId, message: nudgeMsg },
      {
        onSuccess: (res) => {
          toast.success(res.message || 'Nudge sent successfully!');
          setIsNudgeModalOpen(false);
          setNudgeMsg('');
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to send nudge');
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
          toast.success(res.message || 'Sign-off recorded successfully!');
          setIsSignOffModalOpen(false);
          setSignOffNotes('');
          refetchTeam();
          refetchMetrics();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to sign off');
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
            Manager Operations & Team Oversight
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor direct reports, track onboarding progress, resolve overdue items, and sign off on completed programs.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refetchMetrics();
            refetchTeam();
            toast.success('Manager dashboard refreshed');
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh Data
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-indigo-600">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Direct Reports
            </CardTitle>
            <Users className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metricsLoading ? '...' : metrics?.totalDirectReports || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active team members under your supervision
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Active Onboardings
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metricsLoading ? '...' : metrics?.activeOnboardingCount || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Employees currently completing onboarding
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Team Completion Rate
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

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Overdue Items
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {metricsLoading ? '...' : metrics?.overdueItemsCount || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pending journeys or tasks past due date
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Direct Report Roster Table */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold">Direct Reports Roster</CardTitle>
              <CardDescription>
                Track individual progress, send reminders, and manage onboarding milestones.
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search direct reports..."
                value={search}
                onChange={(e: any) => setSearch(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {teamLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading direct reports...</div>
          ) : filteredTeam.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No direct reports found. Assign employees to your manager account in HR Settings.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/30 text-xs uppercase font-medium text-muted-foreground border-b">
                  <tr>
                    <th className="px-6 py-3">Employee</th>
                    <th className="px-6 py-3">Department & Role</th>
                    <th className="px-6 py-3">Journey Progress</th>
                    <th className="px-6 py-3">Checklist Tasks</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Manager Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredTeam.map((emp) => (
                    <tr key={emp._id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 font-medium">
                        <div>{emp.fullName}</div>
                        <div className="text-xs text-muted-foreground font-normal">{emp.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-medium">{emp.jobTitle || 'Team Member'}</div>
                        <div className="text-xs text-muted-foreground">{emp.department || 'General'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3 w-40">
                          <Progress value={emp.journeyStats.completionPercentage} className="h-2 flex-1" />
                          <span className="text-xs font-semibold w-10 text-right">
                            {emp.journeyStats.completionPercentage}%
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {emp.journeyStats.completed} / {emp.journeyStats.totalAssigned} Journeys Done
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-medium">
                          {emp.taskStats.completed} / {emp.taskStats.totalAssigned} Tasks Completed
                        </div>
                        {emp.taskStats.overdue > 0 && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] mt-1">
                            {emp.taskStats.overdue} Overdue
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {emp.hasOverdueItems ? (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                            Overdue Items
                          </Badge>
                        ) : emp.journeyStats.completionPercentage === 100 ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                            Completed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                            Onboarding
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          title="View Details"
                          onClick={() => {
                            setSelectedEmpId(emp._id);
                            setIsDetailsDrawerOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          title="Send Nudge"
                          className="text-amber-600 border-amber-200 hover:bg-amber-50"
                          onClick={() => {
                            setSelectedEmpId(emp._id);
                            setIsNudgeModalOpen(true);
                          }}
                        >
                          <BellRing className="h-4 w-4 mr-1" /> Nudge
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          title="Sign Off Program"
                          className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                          onClick={() => {
                            setSelectedEmpId(emp._id);
                            setIsSignOffModalOpen(true);
                          }}
                        >
                          <Award className="h-4 w-4 mr-1" /> Sign Off
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

      {/* Send Nudge Modal */}
      <Dialog open={isNudgeModalOpen} onOpenChange={setIsNudgeModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <BellRing className="h-5 w-5" /> Send Manager Nudge
            </DialogTitle>
            <DialogDescription>
              Send an instant in-app alert to encourage your direct report to complete their pending onboarding tasks.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Custom Message (Optional)
              </label>
              <textarea
                className="w-full min-h-[100px] text-sm p-3 border rounded-md focus:ring-2 focus:ring-amber-500 focus:outline-none"
                placeholder="e.g. Hi! Just a quick reminder to complete your Compliance & Security training by Friday."
                value={nudgeMsg}
                onChange={(e) => setNudgeMsg(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNudgeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleNudgeSubmit}
              disabled={nudgeMutation.isPending}
            >
              {nudgeMutation.isPending ? 'Sending...' : 'Send Nudge Alert'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manager Sign-Off Modal */}
      <Dialog open={isSignOffModalOpen} onOpenChange={setIsSignOffModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <Award className="h-5 w-5" /> Manager Onboarding Sign-Off
            </DialogTitle>
            <DialogDescription>
              Formally approve and sign off on this employee's onboarding program.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Sign-Off Notes / Feedback
              </label>
              <textarea
                className="w-full min-h-[100px] text-sm p-3 border rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder="e.g. Employee completed all mandatory journeys and team orientation tasks with excellent performance."
                value={signOffNotes}
                onChange={(e) => setSignOffNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSignOffModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleSignOffSubmit}
              disabled={signOffMutation.isPending}
            >
              {signOffMutation.isPending ? 'Processing...' : 'Approve & Sign Off'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deep-Dive Employee Details Drawer / Modal */}
      <Dialog open={isDetailsDrawerOpen} onOpenChange={setIsDetailsDrawerOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-indigo-600" />
              Direct Report Onboarding Details
            </DialogTitle>
            <DialogDescription>
              {empDetails?.employee.fullName} ({empDetails?.employee.jobTitle || 'Team Member'} - {empDetails?.employee.department || 'General'})
            </DialogDescription>
          </DialogHeader>

          {detailsLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading employee deep-dive data...</div>
          ) : (
            <div className="space-y-6 py-2">
              {/* Journeys Section */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-indigo-600">
                  <BookOpen className="h-4 w-4" /> Assigned Journeys ({empDetails?.assignments.length || 0})
                </h4>
                {empDetails?.assignments.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No journeys assigned yet.</p>
                ) : (
                  <div className="space-y-3">
                    {empDetails?.assignments.map((a) => (
                      <div key={a._id} className="p-3 border rounded-lg bg-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div>
                          <div className="font-medium text-sm">{a.journeyTitle} (v{a.journeyVersion})</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Assigned on {new Date(a.assignedAt).toLocaleDateString()} {a.dueDate ? `| Due ${new Date(a.dueDate).toLocaleDateString()}` : ''}
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
                  <CheckSquare className="h-4 w-4" /> Checklist Tasks ({empDetails?.tasks.length || 0})
                </h4>
                {empDetails?.tasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No standalone checklist tasks assigned yet.</p>
                ) : (
                  <div className="space-y-2">
                    {empDetails?.tasks.map((t) => (
                      <div key={t._id} className="p-3 border rounded-lg bg-card flex justify-between items-center text-xs">
                        <div>
                          <span className="font-medium text-foreground">{t.title}</span>
                          {t.category && <span className="ml-2 text-muted-foreground">({t.category})</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {t.dueDate && (
                            <span className="text-muted-foreground">Due: {new Date(t.dueDate).toLocaleDateString()}</span>
                          )}
                          <Badge
                            variant="outline"
                            className={
                              t.status === 'completed'
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                            }
                          >
                            {t.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailsDrawerOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagerDashboard;
