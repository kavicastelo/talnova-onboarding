import React, { useState } from 'react';
import {
  ShieldAlert,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Pause,
  Play,
  Calendar,
  Send,
  FileSpreadsheet,
  Plus,
  Search,
  ChevronRight,
  UserX,
  FileText
} from 'lucide-react';
import {
  useHRDashboard,
  useHRExceptions,
  useHRComplianceReport,
  useUpdateLifecycleState,
  useExecuteHRBulkAction
} from '../hooks/useHROperations';
import { useEmployees } from '../hooks/useEmployees';
import { useJourneys } from '../hooks/useJourneys';
import { Button } from '../components/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/Card';
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
import { toast } from 'sonner';

export const HROperations: React.FC = () => {
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  // Modals State
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const [activeEmpUser, setActiveEmpUser] = useState<any>(null);
  const [pauseReason, setPauseReason] = useState('');
  const [extensionDays, setExtensionDays] = useState(7);

  // Bulk Action State
  const [bulkAction, setBulkAction] = useState<'assign_journey' | 'request_document' | 'send_reminder'>('send_reminder');
  const [selectedJourneyId, setSelectedJourneyId] = useState('');
  const [bulkMessage, setBulkMessage] = useState('Please complete your pending onboarding tasks.');

  const { data: metrics, isLoading: metricsLoading } = useHRDashboard();
  const { data: exceptions, isLoading: exceptionsLoading, refetch: refetchExceptions } = useHRExceptions();
  const { data: complianceReport } = useHRComplianceReport();
  const { data: employeesData, isLoading: employeesLoading, refetch: refetchEmployees } = useEmployees({ page: 1, limit: 100 });
  const { data: journeys } = useJourneys();

  const updateLifecycleMutation = useUpdateLifecycleState();
  const executeBulkMutation = useExecuteHRBulkAction();

  const employees = employeesData?.employees || [];
  const filteredEmployees = employees.filter(
    (e: any) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase()) ||
      (e.department || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmpIds(filteredEmployees.map((e: any) => e.id));
    } else {
      setSelectedEmpIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedEmpIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handlePauseOnboarding = () => {
    if (!activeEmpUser) return;
    updateLifecycleMutation.mutate(
      {
        userId: activeEmpUser.id,
        state: 'paused',
        reason: pauseReason,
      },
      {
        onSuccess: () => {
          toast.success(`Onboarding paused for ${activeEmpUser.name}`);
          setIsPauseModalOpen(false);
          setPauseReason('');
          refetchEmployees();
          refetchExceptions();
        },
      }
    );
  };

  const handleResumeOnboarding = (emp: any) => {
    updateLifecycleMutation.mutate(
      {
        userId: emp.id,
        state: 'active',
      },
      {
        onSuccess: () => {
          toast.success(`Onboarding resumed for ${emp.name}`);
          refetchEmployees();
          refetchExceptions();
        },
      }
    );
  };

  const handleExtendDueDate = () => {
    if (!activeEmpUser) return;
    updateLifecycleMutation.mutate(
      {
        userId: activeEmpUser.id,
        state: 'active',
        extensionDays: Number(extensionDays),
      },
      {
        onSuccess: () => {
          toast.success(`Onboarding due dates extended by ${extensionDays} days for ${activeEmpUser.name}`);
          setIsExtendModalOpen(false);
          refetchEmployees();
          refetchExceptions();
        },
      }
    );
  };

  const handleExecuteBulkAction = () => {
    if (selectedEmpIds.length === 0) {
      toast.error('Please select at least one employee.');
      return;
    }

    executeBulkMutation.mutate(
      {
        action: bulkAction,
        employeeIds: selectedEmpIds,
        payload: {
          journeyId: selectedJourneyId,
          message: bulkMessage,
        },
      },
      {
        onSuccess: (data) => {
          toast.success(`Bulk action completed for ${data.processedCount} employees!`);
          setIsBulkModalOpen(false);
          setSelectedEmpIds([]);
          refetchEmployees();
          refetchExceptions();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to execute bulk action');
        },
      }
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-indigo-600" />
            HR Operations & Administration
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Central operational control panel for employee lifecycle monitoring, exception escalation, and bulk actions.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsReportModalOpen(true)}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Compliance Audit Report
          </Button>
          {selectedEmpIds.length > 0 && (
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => setIsBulkModalOpen(true)}
            >
              <Send className="h-4 w-4 mr-2" /> Bulk Action ({selectedEmpIds.length})
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4 bg-card border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">Active Onboardees</span>
            <Users className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold mt-2">{metrics?.activeOnboardees ?? '-'}</div>
          <p className="text-[11px] text-muted-foreground mt-1">In active onboarding</p>
        </Card>

        <Card className="p-4 bg-card border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">Compliance Rate</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold mt-2">{metrics?.journeyComplianceRate ?? '-'}%</div>
          <p className="text-[11px] text-muted-foreground mt-1">Learning completion rate</p>
        </Card>

        <Card className="p-4 bg-card border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">Pending Documents</span>
            <FileText className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold mt-2">{metrics?.pendingDocuments ?? '-'}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Awaiting signature</p>
        </Card>

        <Card className="p-4 bg-card border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">Overdue Milestones</span>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </div>
          <div className="text-2xl font-bold mt-2">{metrics?.overdueMilestones ?? '-'}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Needs HR intervention</p>
        </Card>

        <Card className="p-4 bg-card border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">Unassigned Buddies</span>
            <UserX className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold mt-2">{metrics?.unassignedBuddiesCount ?? '-'}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Missing peer buddy</p>
        </Card>
      </div>

      {/* Exception & Escalation Queue */}
      <Card className="border-red-500/20">
        <CardHeader className="pb-3 border-b bg-red-500/5">
          <CardTitle className="text-base font-semibold text-red-700 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Onboarding Exception & Risk Escalation Queue
          </CardTitle>
          <CardDescription>Employees requiring immediate HR intervention due to compliance bottlenecks.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {exceptionsLoading ? (
            <div className="p-8 text-center text-muted-foreground">Scanning compliance risks...</div>
          ) : (exceptions || []).length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">✅ No onboarding exceptions flagged. All compliance tasks are on track!</div>
          ) : (
            <div className="divide-y">
              {exceptions?.map((exc) => (
                <div
                  key={exc.employee._id}
                  className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-muted/10 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm">{exc.employee.name}</h4>
                      <span className="text-xs text-muted-foreground">({exc.employee.department} • {exc.employee.email})</span>
                      <Badge
                        variant="outline"
                        className={
                          exc.riskLevel === 'critical'
                            ? 'bg-red-500/10 text-red-600 border-red-500/20 text-[10px]'
                            : exc.riskLevel === 'high'
                            ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]'
                            : 'bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px]'
                        }
                      >
                        {exc.riskLevel.toUpperCase()} RISK
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {exc.issues.map((issue, idx) => (
                        <span key={idx} className="text-xs text-red-600 font-medium bg-red-500/10 px-2 py-0.5 rounded">
                          ⚠️ {issue}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setActiveEmpUser({ id: exc.employee._id, name: exc.employee.name });
                        setIsExtendModalOpen(true);
                      }}
                    >
                      <Calendar className="h-3.5 w-3.5 mr-1" /> Extend Due Date
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs text-amber-600 hover:text-amber-700"
                      onClick={() => {
                        setActiveEmpUser({ id: exc.employee._id, name: exc.employee.name });
                        setIsPauseModalOpen(true);
                      }}
                    >
                      <Pause className="h-3.5 w-3.5 mr-1" /> Pause
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employee Lifecycle Operations Roster */}
      <Card>
        <CardHeader className="pb-3 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-base font-semibold">Employee Lifecycle Operations Roster</CardTitle>
            <CardDescription>Manage active, paused, or completed employee onboarding states.</CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employee..."
              className="pl-8 text-xs"
              value={search}
              onChange={(e: any) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {employeesLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading employee roster...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/40 text-xs text-muted-foreground border-b uppercase">
                  <tr>
                    <th className="p-3 w-10">
                      <input
                        type="checkbox"
                        className="rounded"
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        checked={selectedEmpIds.length === filteredEmployees.length && filteredEmployees.length > 0}
                      />
                    </th>
                    <th className="p-3 font-semibold">Employee</th>
                    <th className="p-3 font-semibold">Department</th>
                    <th className="p-3 font-semibold">Onboarding State</th>
                    <th className="p-3 font-semibold text-right">Lifecycle Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredEmployees.map((emp: any) => (
                    <tr key={emp.id} className="hover:bg-muted/10 transition-colors">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedEmpIds.includes(emp.id)}
                          onChange={() => handleToggleSelect(emp.id)}
                        />
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-foreground">{emp.name}</div>
                        <div className="text-xs text-muted-foreground">{emp.email}</div>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{emp.department || 'General'}</td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={
                            emp.onboardingState === 'paused'
                              ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs'
                              : emp.onboardingState === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs'
                              : 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 text-xs'
                          }
                        >
                          {(emp.onboardingState || 'active').toUpperCase()}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-2">
                          {emp.onboardingState === 'paused' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs text-emerald-600"
                              onClick={() => handleResumeOnboarding(emp)}
                            >
                              <Play className="h-3 w-3 mr-1" /> Resume
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs text-amber-600"
                              onClick={() => {
                                setActiveEmpUser(emp);
                                setIsPauseModalOpen(true);
                              }}
                            >
                              <Pause className="h-3 w-3 mr-1" /> Pause
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => {
                              setActiveEmpUser(emp);
                              setIsExtendModalOpen(true);
                            }}
                          >
                            <Calendar className="h-3 w-3 mr-1" /> Extend
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Pause Onboarding */}
      <Dialog open={isPauseModalOpen} onOpenChange={setIsPauseModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pause Employee Onboarding</DialogTitle>
            <DialogDescription>
              Temporarily hold onboarding requirements for {activeEmpUser?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Reason for Pause</label>
              <Input
                placeholder="e.g. Medical leave, delayed equipment, extended PTO"
                value={pauseReason}
                onChange={(e: any) => setPauseReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPauseModalOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handlePauseOnboarding}>
              Pause Onboarding
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Extend Due Date */}
      <Dialog open={isExtendModalOpen} onOpenChange={setIsExtendModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Extend Onboarding Due Dates</DialogTitle>
            <DialogDescription>
              Grant additional time for {activeEmpUser?.name} across active assignments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Extension Days</label>
              <Input
                type="number"
                min="1"
                max="90"
                value={extensionDays}
                onChange={(e: any) => setExtensionDays(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExtendModalOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleExtendDueDate}>
              Extend Due Dates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Bulk Actions */}
      <Dialog open={isBulkModalOpen} onOpenChange={setIsBulkModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Execute HR Bulk Action ({selectedEmpIds.length} Selected)</DialogTitle>
            <DialogDescription>Perform batch operations across selected employee cohorts.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Action Type</label>
              <select
                className="w-full text-sm p-2 border rounded-md bg-background focus:outline-none"
                value={bulkAction}
                onChange={(e: any) => setBulkAction(e.target.value)}
              >
                <option value="send_reminder">Send Progress Reminder Nudge</option>
                <option value="assign_journey">Assign Learning Journey</option>
              </select>
            </div>

            {bulkAction === 'assign_journey' && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Select Learning Journey</label>
                <select
                  className="w-full text-sm p-2 border rounded-md bg-background focus:outline-none"
                  value={selectedJourneyId}
                  onChange={(e: any) => setSelectedJourneyId(e.target.value)}
                >
                  <option value="">-- Select Journey --</option>
                  {(journeys || []).map((j: any) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {bulkAction === 'send_reminder' && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Custom Nudge Message</label>
                <Input
                  value={bulkMessage}
                  onChange={(e: any) => setBulkMessage(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkModalOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleExecuteBulkAction}>
              Execute Bulk Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Compliance Audit Report */}
      <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>HR Compliance Audit Report Summary</DialogTitle>
            <DialogDescription>Exportable audit summary of onboarding compliance status across all employees.</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto py-2">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 font-semibold border-b">
                <tr>
                  <th className="p-2">Employee</th>
                  <th className="p-2">Department</th>
                  <th className="p-2">State</th>
                  <th className="p-2 text-right">Completion Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(complianceReport || []).map((row) => (
                  <tr key={row.employeeId}>
                    <td className="p-2 font-medium">{row.name} ({row.email})</td>
                    <td className="p-2 text-muted-foreground">{row.department}</td>
                    <td className="p-2">{row.onboardingState}</td>
                    <td className="p-2 text-right font-bold">{row.completionRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
};

export default HROperations;
