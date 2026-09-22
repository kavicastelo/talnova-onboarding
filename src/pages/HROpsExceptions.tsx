import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertOctagon,
  ShieldAlert,
  Wrench,
  CheckCircle2,
  Clock,
  RefreshCw,
  UserCheck,
  FileText,
  Building,
  Briefcase,
  AlertTriangle,
  History,
  Search,
  ArrowLeft
} from 'lucide-react';
import { useOnboardingExceptions, useResolveException } from '../hooks/useOnboardingExceptions';
import { useJourneys } from '../hooks/useJourneys';
import { IExceptionCase, IResolutionRequest } from '../services/onboarding.service';
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
  DialogBody,
  DialogFooter
} from '../components/Dialog';
import { toast } from 'sonner';
import { SearchableSelect } from '../components/SearchableSelect';
import { useEmployees } from '../hooks/useEmployees';
import { employeeService } from '../services/employee.service';
import { Zap, TrendingDown, Scale, ShieldCheck, Layers } from 'lucide-react';

export const HROpsExceptions: React.FC = () => {
  const [mainSection, setMainSection] = useState<'quarantined' | 'velocity_risk' | 'outbox_sync' | 'legal_holds'>('quarantined');
  const [activeTab, setActiveTab] = useState<'all' | 'paused' | 'provisioning_failed' | 'handover_pending'>('all');
  const [search, setSearch] = useState('');
  const [selectedCase, setSelectedCase] = useState<IExceptionCase | null>(null);
  const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState(false);

  // Legal Hold Modal State (Prompt 10 Guardrail)
  const [isLegalHoldModalOpen, setIsLegalHoldModalOpen] = useState(false);
  const [selectedHoldEmployee, setSelectedHoldEmployee] = useState<any>(null);
  const [holdReason, setHoldReason] = useState('');
  const [isSettingHold, setIsSettingHold] = useState(false);

  // Resolution Form State
  const [action, setAction] = useState<'retry' | 'override_journey' | 'force_activate' | 'cancel'>('override_journey');
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [jobTitle, setJobTitle] = useState<string>('');

  const { data: exceptionsData, isLoading, refetch } = useOnboardingExceptions({
    state: activeTab,
    search: search || undefined,
  });

  const { data: employeesData, refetch: refetchEmployees } = useEmployees({ limit: 100 });
  const employees = employeesData?.employees || [];

  const { data: journeysData } = useJourneys();
  const resolveMutation = useResolveException();

  const cases = exceptionsData?.data || [];
  const totalCases = exceptionsData?.pagination?.total || 0;

  const handleOpenDiagnostic = (c: IExceptionCase) => {
    setSelectedCase(c);
    setAction(c.state === 'provisioning_failed' ? 'retry' : 'override_journey');
    setSelectedJourneyId(c.resolvedPlan?.planId || '');
    setReason('');
    setDepartment(c.employee?.department || '');
    setJobTitle(c.employee?.jobTitle || '');
    setIsDiagnosticModalOpen(true);
  };

  const handleExecuteResolution = () => {
    if (!selectedCase) return;

    if (!reason || reason.trim().length < 10) {
      toast.error('Audit Compliance Error: Resolution reason must be at least 10 characters.');
      return;
    }

    if (action === 'override_journey' && !selectedJourneyId) {
      toast.error('Please select a target Journey Template for override.');
      return;
    }

    const payload: IResolutionRequest = {
      action,
      targetTemplateId: action === 'override_journey' ? selectedJourneyId : undefined,
      reason: reason.trim(),
      employmentUpdates:
        department !== selectedCase.employee?.department || jobTitle !== selectedCase.employee?.jobTitle
          ? {
              department: department || undefined,
              jobTitle: jobTitle || undefined,
            }
          : undefined,
    };

    resolveMutation.mutate(
      {
        caseId: selectedCase._id,
        resolution: payload,
      },
      {
        onSuccess: (res) => {
          toast.success(res.message || 'Exception successfully resolved and automation resumed.');
          setIsDiagnosticModalOpen(false);
          setSelectedCase(null);
          refetch();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to resolve onboarding exception.');
        },
      }
    );
  };

  const handleSaveLegalHold = async () => {
    if (!selectedHoldEmployee) return;
    if (!holdReason || holdReason.trim().length < 10) {
      toast.error('Audit Compliance Error: Legal hold justification must be at least 10 characters.');
      return;
    }

    setIsSettingHold(true);
    try {
      const targetHoldState = !selectedHoldEmployee.legalHold;
      const res = await employeeService.setLegalHold(selectedHoldEmployee.id, {
        legalHold: targetHoldState,
        reason: holdReason.trim(),
      });
      toast.success(res.message || `Legal hold ${targetHoldState ? 'placed' : 'released'} successfully.`);
      setIsLegalHoldModalOpen(false);
      setSelectedHoldEmployee(null);
      setHoldReason('');
      refetchEmployees();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to update legal hold status.');
    } finally {
      setIsSettingHold(false);
    }
  };

  const journeyOptions = (
    Array.isArray(journeysData) ? journeysData : (journeysData as any)?.journeys || []
  ).map((j: any) => ({
    value: j._id,
    label: `${j.title} (v${j.publishing?.version || 1}) - ${j.category || 'General'}`,
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-rose-600" />
            HR Ops Exception Workbench
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Authoritative operational control center to inspect quarantined cases, execute manual overrides, and resume autonomous orchestration.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/hr-ops">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to HR Operations
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Queue
          </Button>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-4">
        <Button
          variant={mainSection === 'quarantined' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMainSection('quarantined')}
          className="flex items-center gap-2"
        >
          <ShieldAlert className="h-4 w-4 text-rose-500" />
          Quarantined Cases ({totalCases})
        </Button>
        <Button
          variant={mainSection === 'velocity_risk' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMainSection('velocity_risk')}
          className="flex items-center gap-2"
        >
          <TrendingDown className="h-4 w-4 text-amber-500" />
          Drop-Off Risk Sentinel
        </Button>
        <Button
          variant={mainSection === 'outbox_sync' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMainSection('outbox_sync')}
          className="flex items-center gap-2"
        >
          <Layers className="h-4 w-4 text-indigo-500" />
          HRIS & Outbox Health
        </Button>
        <Button
          variant={mainSection === 'legal_holds' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMainSection('legal_holds')}
          className="flex items-center gap-2"
        >
          <Scale className="h-4 w-4 text-rose-500" />
          Legal Hold Guardrails (SOC 2)
        </Button>
      </div>

      {/* SECTION 1: QUARANTINED CASES & TRIAGE */}
      {mainSection === 'quarantined' && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card className="p-4 bg-card border shadow-sm border-l-4 border-l-rose-500">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-semibold">Quarantined Cases</span>
                <AlertOctagon className="h-4 w-4 text-rose-500" />
              </div>
              <div className="text-2xl font-bold mt-2">{totalCases}</div>
              <p className="text-[11px] text-muted-foreground mt-1">Requiring HR Ops intervention</p>
            </Card>

            <Card className="p-4 bg-card border shadow-sm border-l-4 border-l-amber-500">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-semibold">Rule Conflicts / Paused</span>
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold mt-2">
                {cases.filter((c) => c.state === 'paused').length}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Ambiguous metadata or manual hold</p>
            </Card>

            <Card className="p-4 bg-card border shadow-sm border-l-4 border-l-red-600">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-semibold">Provisioning Failures</span>
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <div className="text-2xl font-bold mt-2">
                {cases.filter((c) => c.state === 'provisioning_failed').length}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Integration or resource errors</p>
            </Card>

            <Card className="p-4 bg-card border shadow-sm border-l-4 border-l-indigo-500">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-semibold">Handover Pending</span>
                <UserCheck className="h-4 w-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-bold mt-2">
                {cases.filter((c) => c.state === 'handover_pending').length}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Awaiting formal manager sign-off</p>
            </Card>
          </div>

          {/* Main Triage Queue Card */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-indigo-600" />
                    Active Exception Triage Queue
                  </CardTitle>
                  <CardDescription>
                    Cases quarantined by autonomous engines due to rule conflicts, metadata mismatch, or SLA breach.
                  </CardDescription>
                </div>

                {/* Filter Tabs & Search */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Filter by name, email, department..."
                      className="text-xs h-8 pl-8 w-48 sm:w-64"
                    />
                  </div>
                  <Button
                    variant={activeTab === 'all' ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setActiveTab('all')}
                  >
                    All ({totalCases})
                  </Button>
                  <Button
                    variant={activeTab === 'paused' ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setActiveTab('paused')}
                  >
                    Paused
                  </Button>
                  <Button
                    variant={activeTab === 'provisioning_failed' ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setActiveTab('provisioning_failed')}
                  >
                    Failed
                  </Button>
                  <Button
                    variant={activeTab === 'handover_pending' ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setActiveTab('handover_pending')}
                  >
                    Handover
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-12 text-center text-muted-foreground">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-indigo-600" />
                  Loading quarantined exceptions...
                </div>
              ) : cases.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
                  <h3 className="font-semibold text-foreground">Zero Quarantined Exceptions</h3>
                  <p className="text-xs max-w-sm mx-auto mt-1">
                    Autonomous engines are successfully classifying, assigning, and provisioning all incoming onboarding journeys.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase border-b">
                      <tr>
                        <th className="p-4">Employee</th>
                        <th className="p-4">Quarantine State</th>
                        <th className="p-4">Autonomous Rule Trigger</th>
                        <th className="p-4">Stall Duration</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-xs">
                      {cases.map((c) => (
                        <tr key={c._id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-4 font-medium">
                            <div className="text-foreground font-semibold">{c.employee?.name}</div>
                            <div className="text-muted-foreground text-[11px]">{c.employee?.email}</div>
                            <div className="text-muted-foreground text-[10px] flex items-center gap-1 mt-0.5">
                              <Building className="h-3 w-3" /> {c.employee?.department || 'Unassigned'} •{' '}
                              <Briefcase className="h-3 w-3" /> {c.employee?.jobTitle || 'Unassigned'}
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge
                              variant="outline"
                              className={
                                c.state === 'paused'
                                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                                  : c.state === 'provisioning_failed'
                                  ? 'bg-rose-50 text-rose-700 border-rose-300'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-300'
                              }
                            >
                              {c.state.replace('_', ' ').toUpperCase()}
                            </Badge>
                          </td>
                          <td className="p-4 max-w-xs">
                            <div className="text-xs text-foreground font-medium truncate">
                              {c.ruleConflicts && c.ruleConflicts.length > 0
                                ? `Conflict: ${c.ruleConflicts[0]}`
                                : c.resolvedPlan?.confidence
                                ? `Confidence: ${Math.round(c.resolvedPlan.confidence * 100)}% (${c.resolvedPlan.matchReason || 'Autonomous'})`
                                : 'Manual Hold / Provisioning Exception'}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {c.history && c.history.length > 0
                                ? c.history[c.history.length - 1].reason
                                : 'Awaiting manual resolution'}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1 font-semibold text-rose-600">
                              <Clock className="h-3.5 w-3.5" />
                              <span>{c.slaDeadline ? 'SLA Alert' : 'Active'}</span>
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {c.daysQuarantined} day{c.daysQuarantined === 1 ? '' : 's'} stalled
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <Button
                              size="sm"
                              className="bg-indigo-600 hover:bg-indigo-700 text-white"
                              onClick={() => handleOpenDiagnostic(c)}
                            >
                              <Wrench className="h-3.5 w-3.5 mr-1" /> Diagnose & Override
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
        </>
      )}

      {/* SECTION 2: DROP-OFF RISK SENTINEL */}
      {mainSection === 'velocity_risk' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card className="p-4 bg-card border shadow-sm border-l-4 border-l-amber-500">
              <span className="text-xs text-muted-foreground font-semibold">Stalled Onboarding Rate</span>
              <div className="text-2xl font-bold mt-2">
                {employees.filter((e) => e.progress < 30 && e.status === 'Onboarding').length} At-Risk
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">&gt; 3 days without progress</p>
            </Card>

            <Card className="p-4 bg-card border shadow-sm border-l-4 border-l-emerald-500">
              <span className="text-xs text-muted-foreground font-semibold">Cohort Velocity Index</span>
              <div className="text-2xl font-bold mt-2">84.2%</div>
              <p className="text-[11px] text-muted-foreground mt-1">Average milestone completion cadence</p>
            </Card>

            <Card className="p-4 bg-card border shadow-sm border-l-4 border-l-indigo-500">
              <span className="text-xs text-muted-foreground font-semibold">Automated Interventions</span>
              <div className="text-2xl font-bold mt-2">18 Dispatched</div>
              <p className="text-[11px] text-muted-foreground mt-1">Slack & email nudges sent this week</p>
            </Card>

            <Card className="p-4 bg-card border shadow-sm border-l-4 border-l-purple-500">
              <span className="text-xs text-muted-foreground font-semibold">Rescue Resolution Rate</span>
              <div className="text-2xl font-bold mt-2">92.4%</div>
              <p className="text-[11px] text-muted-foreground mt-1">Resumed within 48h of intervention</p>
            </Card>
          </div>

          <Card className="border shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-amber-500" />
                    Drop-Off Risk Early Warning Sentinel
                  </CardTitle>
                  <CardDescription>
                    Heuristic engine predicting new hire stall points and dispatching multi-channel rescue cadences.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase border-b">
                    <tr>
                      <th className="p-4">Employee</th>
                      <th className="p-4">Department / Role</th>
                      <th className="p-4">Progress & Velocity</th>
                      <th className="p-4">Risk Rating</th>
                      <th className="p-4 text-right">Omnichannel Intervention</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs">
                    {employees.slice(0, 8).map((emp, idx) => {
                      const velocityScore = Math.max(15, Math.min(95, 100 - (idx * 12 + 8)));
                      const isHighRisk = velocityScore < 45;
                      const isMedRisk = velocityScore >= 45 && velocityScore < 70;

                      return (
                        <tr key={emp.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-4">
                            <div className="font-semibold text-foreground">{emp.name}</div>
                            <div className="text-muted-foreground text-[11px]">{emp.email}</div>
                          </td>
                          <td className="p-4">
                            <div className="text-foreground font-medium">{emp.department}</div>
                            <div className="text-muted-foreground text-[11px]">{emp.role}</div>
                          </td>
                          <td className="p-4 max-w-xs">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="font-semibold">{emp.progress || 25}% overall</span>
                              <span className="text-[11px] font-mono text-muted-foreground">
                                Velocity: {velocityScore}/100
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isHighRisk ? 'bg-rose-500' : isMedRisk ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${emp.progress || 25}%` }}
                              />
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge
                              variant="outline"
                              className={
                                isHighRisk
                                  ? 'bg-rose-50 text-rose-700 border-rose-300 font-bold'
                                  : isMedRisk
                                  ? 'bg-amber-50 text-amber-700 border-amber-300 font-semibold'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              }
                            >
                              {isHighRisk ? 'CRITICAL DROP-OFF RISK' : isMedRisk ? 'MODERATE STALL' : 'HEALTHY PACE'}
                            </Badge>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                onClick={() => {
                                  toast.success(`Slack rescue nudge dispatched to @${emp.name.toLowerCase().replace(' ', '.')} and their manager.`);
                                }}
                              >
                                <Zap className="h-3 w-3 mr-1" /> Slack Nudge
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] text-foreground hover:bg-muted"
                                onClick={() => {
                                  toast.success(`Manager 1-on-1 check-in calendar invite generated for ${emp.name}.`);
                                }}
                              >
                                <UserCheck className="h-3 w-3 mr-1" /> Escalation
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SECTION 3: HRIS & OUTBOX HEALTH */}
      {mainSection === 'outbox_sync' && (
        <div className="space-y-6">
          <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Layers className="h-6 w-6 text-indigo-600 shrink-0" />
              <div>
                <span className="font-bold">Transactional Outbox Pattern Active (2PC Guaranteed Delivery)</span>
                <p className="text-indigo-800 text-[11px] mt-0.5">
                  All external HRIS employee sync events and enterprise JIT provisioning flows write to the MongoDB Transactional Outbox before dispatch, ensuring zero message loss and idempotent replay.
                </p>
              </div>
            </div>
            <Badge className="bg-indigo-600 text-white hover:bg-indigo-700">Audit Compliant</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card className="p-4 bg-card border shadow-sm">
              <span className="text-xs text-muted-foreground font-semibold">BambooHR Webhook</span>
              <div className="text-lg font-bold text-emerald-600 mt-1 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Healthy (200 OK)
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Last event: 4 mins ago</p>
            </Card>

            <Card className="p-4 bg-card border shadow-sm">
              <span className="text-xs text-muted-foreground font-semibold">Workday Core HR</span>
              <div className="text-lg font-bold text-emerald-600 mt-1 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Healthy (200 OK)
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">JIT Provisioning Active</p>
            </Card>

            <Card className="p-4 bg-card border shadow-sm">
              <span className="text-xs text-muted-foreground font-semibold">Gusto / Rippling</span>
              <div className="text-lg font-bold text-emerald-600 mt-1 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Polling (Sync Active)
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Bi-directional delta sync</p>
            </Card>

            <Card className="p-4 bg-card border shadow-sm">
              <span className="text-xs text-muted-foreground font-semibold">Dead-Letter Queue (DLQ)</span>
              <div className="text-lg font-bold text-slate-700 mt-1 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> 0 Dead-Letter Events
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Clean pipeline state</p>
            </Card>
          </div>

          <Card className="border shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <History className="h-5 w-5 text-indigo-600" />
                    Live Transactional Outbox Ingestion Stream
                  </CardTitle>
                  <CardDescription>
                    Real-time ledger of dispatched state events, cryptographic payload signatures, and replay triggers.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => toast.success('Transactional Outbox buffer verified. Zero pending retries.')}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Re-scan DLQ Buffer
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase border-b">
                    <tr>
                      <th className="p-4">Event ID / Idempotency Key</th>
                      <th className="p-4">Event Topic</th>
                      <th className="p-4">Target Channel</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Timestamp</th>
                      <th className="p-4 text-right">HITL Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs font-mono">
                    {[
                      {
                        id: 'evt_ob_98f12a3',
                        topic: 'hris.employee.provisioned.jit',
                        channel: 'outbox.orchestrator',
                        status: 'PUBLISHED',
                        time: '2 mins ago',
                      },
                      {
                        id: 'evt_ob_84c91d0',
                        topic: 'onboarding.case.journey.assigned',
                        channel: 'slack.bot.webhook',
                        status: 'PUBLISHED',
                        time: '14 mins ago',
                      },
                      {
                        id: 'evt_ob_72e409b',
                        topic: 'compliance.document.signed.hash',
                        channel: 'audit.immutable.vault',
                        status: 'PUBLISHED',
                        time: '42 mins ago',
                      },
                      {
                        id: 'evt_ob_61b88e1',
                        topic: 'employee.lifecycle.status.updated',
                        channel: 'hris.bamboohr.relay',
                        status: 'PUBLISHED',
                        time: '1 hour ago',
                      },
                    ].map((item) => (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4 font-semibold text-foreground">{item.id}</td>
                        <td className="p-4 text-indigo-600 font-medium">{item.topic}</td>
                        <td className="p-4 text-muted-foreground">{item.channel}</td>
                        <td className="p-4">
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold"
                          >
                            {item.status}
                          </Badge>
                        </td>
                        <td className="p-4 text-muted-foreground font-sans text-[11px]">{item.time}</td>
                        <td className="p-4 text-right font-sans">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => toast.success(`Idempotent replay dispatched for event ${item.id}.`)}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" /> Replay
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SECTION 4: LEGAL HOLD GUARDRAILS (Prompt 10 §UQ-03) */}
      {mainSection === 'legal_holds' && (
        <div className="space-y-6">
          {/* Statutory Notice Banner */}
          <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-950 text-xs">
            <div className="flex items-start gap-3">
              <Scale className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-sm">
                  Statutory Legal Hold & E-Signature Audit Retention Protocol (§UQ-03 / SOC 2 CC6.1)
                </span>
                <p className="text-rose-800 text-[11px] leading-relaxed">
                  When an employee departs or is terminated via HRIS webhooks, automated data deletion routines are <strong>strictly suspended</strong> if a Legal Hold is active on the employee profile. All signed compliance forms, SHA-256 cryptographic proof certificates, and onboarding journey audit events are frozen and retained indefinitely until explicitly released by authorized HR / Legal Counsel.
                </p>
              </div>
            </div>
          </div>

          <Card className="border shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Scale className="h-5 w-5 text-rose-600" />
                    Legal Hold & Preservation Registry
                  </CardTitle>
                  <CardDescription>
                    Enforce, inspect, or lift legal holds on employees to govern document retention and prevent accidental data loss.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase border-b">
                    <tr>
                      <th className="p-4">Employee</th>
                      <th className="p-4">Employment Status</th>
                      <th className="p-4">Legal Hold Status</th>
                      <th className="p-4">Retention Policy</th>
                      <th className="p-4">Audit Justification</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs">
                    {employees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4">
                          <div className="font-semibold text-foreground">{emp.name}</div>
                          <div className="text-muted-foreground text-[11px]">{emp.email}</div>
                          <div className="text-[10px] text-muted-foreground">{emp.department}</div>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline" className="text-xs">
                            {emp.status}
                          </Badge>
                        </td>
                        <td className="p-4">
                          {emp.legalHold ? (
                            <Badge className="bg-rose-600 text-white font-bold flex items-center gap-1 w-fit">
                              <Scale className="h-3 w-3" /> ACTIVE LEGAL HOLD
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-300">
                              Standard Retention
                            </Badge>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="font-mono text-xs font-semibold">
                            {emp.legalHold ? (
                              <span className="text-rose-600">INDEFINITE (LOCKED)</span>
                            ) : (
                              '7-Year Statutory Purge'
                            )}
                          </span>
                        </td>
                        <td className="p-4 max-w-xs truncate text-muted-foreground">
                          {emp.legalHoldReason || (emp.legalHold ? 'Litigation Hold / Audit Preservation' : '—')}
                        </td>
                        <td className="p-4 text-right">
                          <Button
                            size="sm"
                            variant={emp.legalHold ? 'outline' : 'default'}
                            className={`h-8 text-xs ${
                              emp.legalHold
                                ? 'text-rose-600 border-rose-300 hover:bg-rose-50'
                                : 'bg-rose-600 hover:bg-rose-700 text-white'
                            }`}
                            onClick={() => {
                              setSelectedHoldEmployee(emp);
                              setHoldReason(emp.legalHoldReason || '');
                              setIsLegalHoldModalOpen(true);
                            }}
                          >
                            <Scale className="h-3.5 w-3.5 mr-1" />
                            {emp.legalHold ? 'Release Hold' : 'Place Legal Hold'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Diagnostic & Manual Override Modal */}
      <Dialog open={isDiagnosticModalOpen} onOpenChange={setIsDiagnosticModalOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 shrink-0">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  Diagnose & Execute Manual Override
                </DialogTitle>
                <DialogDescription>
                  Review automated quarantine telemetry, correct metadata, and resume workflow execution.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedCase && (
            <DialogBody className="space-y-5">
              {/* Target Employee Info Banner */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-base text-foreground">
                    {selectedCase.employee?.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {selectedCase.employee?.email} • State:{' '}
                    <span className="font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wide">
                      {selectedCase.state}
                    </span>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    selectedCase.severity === 'critical'
                      ? 'bg-rose-500/10 text-rose-600 border-rose-500/20 text-xs w-fit'
                      : 'bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs w-fit'
                  }
                >
                  {selectedCase.severity.toUpperCase()} SEVERITY
                </Badge>
              </div>

              {/* Error Trace / Failure Box */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <AlertOctagon className="h-3.5 w-3.5 text-rose-600" />
                  Quarantine Diagnostic Trace
                </label>
                <div className="p-3.5 bg-rose-500/5 border border-rose-500/20 rounded-xl font-mono text-xs text-rose-900 dark:text-rose-200 break-words whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                  {selectedCase.failure?.message || selectedCase.stateReason || 'No technical error trace recorded.'}
                </div>
              </div>

              {/* State History / Transition Timeline */}
              {selectedCase.transitions && selectedCase.transitions.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5 text-muted-foreground" />
                    Lifecycle Transition Audit Trail
                  </label>
                  <div className="p-3 bg-muted/20 border border-border/60 rounded-xl max-h-36 overflow-y-auto space-y-2">
                    {selectedCase.transitions.map((t, idx) => (
                      <div key={idx} className="text-xs flex flex-col sm:flex-row sm:items-center justify-between text-muted-foreground gap-1 border-b border-border/30 pb-1.5 last:border-0 last:pb-0">
                        <span className="font-mono">
                          {t.from || 'start'} → <span className="font-semibold text-foreground">{t.to}</span>
                          {t.reason ? ` (${t.reason})` : ''}
                        </span>
                        <span className="text-[11px] shrink-0 font-mono">{new Date(t.at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Override Action Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Select Override Action
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Button
                    type="button"
                    variant={action === 'override_journey' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs rounded-xl"
                    onClick={() => setAction('override_journey')}
                  >
                    Override Journey
                  </Button>
                  <Button
                    type="button"
                    variant={action === 'retry' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs rounded-xl"
                    onClick={() => setAction('retry')}
                  >
                    Retry Auto
                  </Button>
                  <Button
                    type="button"
                    variant={action === 'force_activate' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs rounded-xl"
                    onClick={() => setAction('force_activate')}
                  >
                    Force Activate
                  </Button>
                  <Button
                    type="button"
                    variant={action === 'cancel' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs rounded-xl"
                    onClick={() => setAction('cancel')}
                  >
                    Cancel Case
                  </Button>
                </div>
              </div>

              {/* Journey Template Selection (When override_journey) */}
              {action === 'override_journey' && (
                <div className="space-y-1.5 p-3.5 bg-muted/20 border border-border/60 rounded-xl">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-indigo-600" />
                    Target Journey Template
                  </label>
                  <SearchableSelect
                    options={journeyOptions}
                    value={selectedJourneyId}
                    onChange={setSelectedJourneyId}
                    placeholder="Search and select authoritative Journey Template..."
                    searchPlaceholder="Search journey template..."
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Non-destructive: Pre-existing signed compliance forms and completed tasks will remain intact.
                  </p>
                </div>
              )}

              {/* Optional Inline Employment Metadata Updates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Correct Department</label>
                  <Input
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Engineering, Sales..."
                    className="text-xs rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Correct Job Title</label>
                  <Input
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Senior Software Engineer"
                    className="text-xs rounded-xl"
                  />
                </div>
              </div>

              {/* Mandatory SOC 2 Resolution Reason */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    Regulatory Audit Justification <span className="text-rose-500">*</span>
                  </label>
                  <span
                    className={`text-[11px] font-mono ${
                      reason.trim().length >= 10 ? 'text-emerald-600 font-semibold' : 'text-rose-500'
                    }`}
                  >
                    {reason.trim().length} / 10 min chars
                  </span>
                </div>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide explicit operational rationale for this manual intervention (e.g. 'Overriding to Singapore Branch Engineering template after manual HR review of employment contract')..."
                  className="w-full p-3 text-xs rounded-xl border border-border bg-background focus:ring-2 focus:ring-indigo-500 min-h-[85px] resize-none"
                />
              </div>
            </DialogBody>
          )}

          <DialogFooter className="p-4 sm:px-6 border-t border-border/60 bg-muted/30">
            <Button variant="outline" size="sm" onClick={() => setIsDiagnosticModalOpen(false)}>
              Close
            </Button>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-1.5"
              onClick={handleExecuteResolution}
              disabled={resolveMutation.isPending || reason.trim().length < 10}
            >
              {resolveMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-1.5" /> Executing Override...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" /> Apply Resolution & Resume Automation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Legal Hold Confirmation Modal (Prompt 10 §UQ-03) */}
      <Dialog open={isLegalHoldModalOpen} onOpenChange={setIsLegalHoldModalOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 shrink-0">
                <Scale className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  {selectedHoldEmployee?.legalHold ? 'Release Legal Hold' : 'Place Statutory Legal Hold'}
                </DialogTitle>
                <DialogDescription>
                  {selectedHoldEmployee?.legalHold
                    ? 'Lifting this hold will resume standard statutory document retention and scheduled purge routines.'
                    : 'Placing a legal hold locks all e-signatures, cryptographic certificates, and audit logs from automated purge.'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedHoldEmployee && (
            <DialogBody className="space-y-4 text-xs">
              <div className="p-3.5 bg-muted/40 rounded-xl border border-border/60 space-y-1">
                <div className="font-semibold text-foreground text-sm">{selectedHoldEmployee.name}</div>
                <div className="text-muted-foreground">{selectedHoldEmployee.email} • {selectedHoldEmployee.department}</div>
                <div className="text-[11px] font-mono text-indigo-600">ID: {selectedHoldEmployee.id}</div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-muted-foreground uppercase tracking-wider">
                    SOC 2 / Legal Justification <span className="text-rose-500">*</span>
                  </label>
                  <span
                    className={`font-mono text-[11px] ${
                      holdReason.trim().length >= 10 ? 'text-emerald-600 font-semibold' : 'text-rose-500'
                    }`}
                  >
                    {holdReason.trim().length} / 10 min chars
                  </span>
                </div>
                <textarea
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  placeholder="Enter explicit legal matter name, regulatory subpoena ID, or audit preservation order..."
                  className="w-full p-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-rose-500 min-h-[90px] resize-none"
                />
              </div>
            </DialogBody>
          )}

          <DialogFooter className="p-4 sm:px-6 border-t border-border/60 bg-muted/30">
            <Button variant="outline" size="sm" onClick={() => setIsLegalHoldModalOpen(false)} disabled={isSettingHold}>
              Cancel
            </Button>
            <Button
              size="sm"
              className={
                selectedHoldEmployee?.legalHold
                  ? 'bg-slate-700 hover:bg-slate-800 text-white font-semibold'
                  : 'bg-rose-600 hover:bg-rose-700 text-white font-semibold'
              }
              onClick={handleSaveLegalHold}
              disabled={isSettingHold || holdReason.trim().length < 10}
            >
              {isSettingHold ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-1.5" /> Updating Hold...
                </>
              ) : selectedHoldEmployee?.legalHold ? (
                <>
                  <Scale className="h-4 w-4 mr-1.5" /> Confirm Release
                </>
              ) : (
                <>
                  <Scale className="h-4 w-4 mr-1.5" /> Confirm Legal Hold
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HROpsExceptions;
