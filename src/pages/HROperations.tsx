import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  AlertOctagon,
  Users,
  CheckCircle2,
  AlertTriangle,
  Pause,
  Play,
  Calendar,
  Send,
  FileSpreadsheet,
  UserX,
  FileText
} from 'lucide-react';
import {
  useHRDashboard,
  useHRExceptions,
  useHRComplianceReport,
  useUpdateLifecycleState,
  useCompleteHandover,
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
  DialogBody,
  DialogFooter
} from '../components/Dialog';
import { toast } from 'sonner';
import { SimplePagination } from '../components/SimplePagination';
import { SearchableSelect } from '../components/SearchableSelect';
import { usePagination } from '../hooks/usePagination';
import { useRole } from '../context/RoleContext';
import { useTranslation } from 'react-i18next';

export const HROperations: React.FC = () => {
  const { t } = useTranslation(['hr', 'common']);
  const { hasFeature } = useRole();
  const navigate = useNavigate();
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const [activeDirectoryTab, setActiveDirectoryTab] = useState<'ready' | 'completed' | 'drilldown' | 'all'>('ready');

  // Modals State
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);

  const [activeEmpUser, setActiveEmpUser] = useState<any>(null);
  const [pauseReason, setPauseReason] = useState('');
  const [extensionDays, setExtensionDays] = useState('7');

  // Bulk Action State
  const [bulkAction, setBulkAction] = useState<'assign_journey' | 'request_document' | 'send_reminder'>('send_reminder');
  const [selectedJourneyId, setSelectedJourneyId] = useState('');
  const [bulkMessage, setBulkMessage] = useState('');

  const { data: metrics } = useHRDashboard();
  const { data: exceptions, isLoading: exceptionsLoading, refetch: refetchExceptions } = useHRExceptions();
  const { data: complianceReport } = useHRComplianceReport();
  const { data: employeesData, isLoading: employeesLoading, refetch: refetchEmployees } = useEmployees({ page: 1, limit: 100 });
  const { data: journeys } = useJourneys();

  const updateLifecycleMutation = useUpdateLifecycleState();
  const completeHandoverMutation = useCompleteHandover();
  const executeBulkMutation = useExecuteHRBulkAction();

  const employees = employeesData?.employees || [];
  const searchedEmployees = employees.filter(
    (e: any) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase()) ||
      (e.employeeId || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.department || '').toLowerCase().includes(search.toLowerCase())
  );

  const tabEmployees = searchedEmployees.filter((e: any) => {
    if (activeDirectoryTab === 'ready') {
      return e.status !== 'Active' && e.onboardingState !== 'completed';
    }
    if (activeDirectoryTab === 'completed') {
      return e.status === 'Active' || e.onboardingState === 'completed';
    }
    return true; // 'all' or 'drilldown'
  });

  const empPagination = usePagination({ data: tabEmployees, initialPageSize: 10 });
  const excPagination = usePagination({ data: exceptions || [], initialPageSize: 5 });
  const compPagination = usePagination({ data: complianceReport || [], initialPageSize: 10 });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmpIds(tabEmployees.map((e: any) => e.id));
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
          toast.success(t('pauseModal.successToast', { name: activeEmpUser.name }));
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
          toast.success(t('directory.resumeSuccessToast', { name: emp.name }));
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
          toast.success(t('extendModal.successToast', { days: extensionDays, name: activeEmpUser.name }));
          setIsExtendModalOpen(false);
          refetchEmployees();
          refetchExceptions();
        },
      }
    );
  };

  const handleFinalizeHandover = (emp: any) => {
    const targetId = emp.employeeId || emp.id;
    completeHandoverMutation.mutate(
      { userId: targetId },
      {
        onSuccess: (res: any) => {
          toast.success(res?.message || t('handoverModal.success', { name: emp.name }));
          setIsHandoverModalOpen(false);
          refetchEmployees();
          refetchExceptions();
        },
        onError: (err: any) => {
          const errData = err?.response?.data || {};
          const openTasks = errData.openTasks;
          const msg = errData.error === 'ONBOARDING_INCOMPLETE'
            ? t('handoverModal.blockedIncomplete', { openTasks })
            : (errData.message || err?.message || t('handoverModal.blockedGeneric'));
          toast.error(msg);
        },
      }
    );
  };

  const handleCompleteHandover = () => {
    if (!activeEmpUser) return;
    handleFinalizeHandover(activeEmpUser);
  };

  const handleExecuteBulkAction = () => {
    if (selectedEmpIds.length === 0) {
      toast.error(t('bulkModal.selectAtLeastOne'));
      return;
    }

    executeBulkMutation.mutate(
      {
        action: bulkAction,
        employeeIds: selectedEmpIds,
        payload: {
          journeyId: selectedJourneyId,
          message: bulkMessage || t('bulkModal.defaultMessage'),
        },
      },
      {
        onSuccess: (data) => {
          toast.success(t('bulkModal.successToast', { count: data.processedCount }));
          setIsBulkModalOpen(false);
          setSelectedEmpIds([]);
          setBulkMessage('');
          refetchEmployees();
          refetchExceptions();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || t('bulkModal.errorToast'));
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
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            className="bg-rose-600 hover:bg-rose-700 text-white"
            onClick={() => navigate('/hr-ops/exceptions')}
          >
            <AlertOctagon className="h-4 w-4 mr-2" /> {t('buttons.exceptionWorkbench')}
          </Button>
          <Button variant="outline" onClick={() => setIsReportModalOpen(true)}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> {t('buttons.complianceReport')}
          </Button>
          {selectedEmpIds.length > 0 && (
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => setIsBulkModalOpen(true)}
            >
              <Send className="h-4 w-4 mr-2" /> {t('buttons.bulkAction', { count: selectedEmpIds.length })}
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <Card className="p-4 bg-card border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">{t('kpis.activeOnboardees')}</span>
            <Users className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold mt-2">{metrics?.activeOnboardees ?? '-'}</div>
          <p className="text-[11px] text-muted-foreground mt-1">{t('kpis.activeOnboardeesDesc')}</p>
        </Card>

        <Card className="p-4 bg-card border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">{t('kpis.complianceRate')}</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold mt-2">{metrics?.journeyComplianceRate ?? '-'}%</div>
          <p className="text-[11px] text-muted-foreground mt-1">{t('kpis.complianceRateDesc')}</p>
        </Card>

        {hasFeature('digital_signatures') && (
          <Card data-testid="kpi-pending-documents" className="p-4 bg-card border shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-semibold">{t('kpis.pendingDocuments')}</span>
              <FileText className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold mt-2">{metrics?.pendingDocuments ?? '-'}</div>
            <p className="text-[11px] text-muted-foreground mt-1">{t('kpis.pendingDocumentsDesc')}</p>
          </Card>
        )}

        {(hasFeature('milestone_approval') || hasFeature('milestone_ratings')) && (
          <Card data-testid="kpi-overdue-milestones" className="p-4 bg-card border shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-semibold">{t('kpis.overdueMilestones')}</span>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
            <div className="text-2xl font-bold mt-2">{metrics?.overdueMilestones ?? '-'}</div>
            <p className="text-[11px] text-muted-foreground mt-1">{t('kpis.overdueMilestonesDesc')}</p>
          </Card>
        )}

        {(hasFeature('buddy_assignment') || hasFeature('buddy_connection')) && (
          <Card data-testid="kpi-unassigned-buddies" className="p-4 bg-card border shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-semibold">{t('kpis.unassignedBuddies')}</span>
              <UserX className="h-4 w-4 text-purple-600" />
            </div>
            <div className="text-2xl font-bold mt-2">{metrics?.unassignedBuddiesCount ?? '-'}</div>
            <p className="text-[11px] text-muted-foreground mt-1">{t('kpis.unassignedBuddiesDesc')}</p>
          </Card>
        )}
      </div>

      {/* Exception & Escalation Queue */}
      <Card className="border-red-500/20">
        <CardHeader className="pb-3 border-b bg-red-500/5">
          <CardTitle className="text-base font-semibold text-red-700 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            {t('queue.title')}
          </CardTitle>
          <CardDescription>{t('queue.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {exceptionsLoading ? (
            <div className="p-8 text-center text-muted-foreground">{t('queue.scanning')}</div>
          ) : (exceptions || []).length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">{t('queue.empty')}</div>
          ) : (
            <div>
              <div className="divide-y">
                {excPagination.paginatedData.map((exc) => (
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
                          {t('queue.riskBadge', { risk: t(`queue.riskLevels.${exc.riskLevel}`, { defaultValue: exc.riskLevel.toUpperCase() }) })}
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
                        <Calendar className="h-3.5 w-3.5 mr-1" /> {t('queue.extendDueDate')}
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
                        <Pause className="h-3.5 w-3.5 mr-1" /> {t('queue.pause')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 border-t">
                <SimplePagination
                  currentPage={excPagination.page}
                  totalPages={excPagination.totalPages}
                  totalItems={excPagination.totalItems}
                  startIndex={excPagination.startIndex}
                  endIndex={excPagination.endIndex}
                  pageSize={excPagination.pageSize}
                  onPageChange={excPagination.setPage}
                  onPageSizeChange={excPagination.setPageSize}
                  itemLabel={t('queue.exceptionsLabel')}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employee Lifecycle Operations Directory */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-600" />
                {t('directory.title')}
              </CardTitle>
              <CardDescription>{t('directory.subtitle')}</CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Input
                placeholder={t('directory.searchPlaceholder')}
                value={search}
                onChange={(e: any) => setSearch(e.target.value)}
                className="h-9 w-full sm:w-64"
              />
              {selectedEmpIds.length > 0 && (
                <Button size="sm" onClick={() => setIsBulkModalOpen(true)}>
                  {t('directory.bulkActionsBtn', { count: selectedEmpIds.length })}
                </Button>
              )}
            </div>
          </div>

          {/* Directory Tabs */}
          <div className="flex border-b border-border/60 mt-4 gap-6 overflow-x-auto">
            <button
              id="tab-ready-for-handover"
              className={`pb-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeDirectoryTab === 'ready'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveDirectoryTab('ready')}
            >
              <CheckCircle2 className="h-4 w-4" /> {t('directory.tabs.readyForHandover')}
              <span className="text-xs ml-1 px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold">
                {searchedEmployees.filter((e: any) => e.status !== 'Active' && e.onboardingState !== 'completed').length}
              </span>
            </button>
            <button
              id="tab-completed-archive"
              className={`pb-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeDirectoryTab === 'completed'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveDirectoryTab('completed')}
            >
              <Users className="h-4 w-4" /> {t('directory.tabs.completedArchive')}
              <span className="text-xs ml-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">
                {searchedEmployees.filter((e: any) => e.status === 'Active' || e.onboardingState === 'completed').length}
              </span>
            </button>
            <button
              id="tab-dropoff-drilldown"
              className={`pb-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeDirectoryTab === 'drilldown'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveDirectoryTab('drilldown')}
            >
              <AlertTriangle className="h-4 w-4 text-red-500" /> {t('directory.tabs.dropoffDrilldown')}
              <span className="text-xs ml-1 px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 font-bold">
                {(exceptions || []).length}
              </span>
            </button>
            <button
              id="tab-all-employees"
              className={`pb-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeDirectoryTab === 'all'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveDirectoryTab('all')}
            >
              {t('directory.tabs.allEmployees', { count: searchedEmployees.length })}
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {activeDirectoryTab === 'drilldown' ? (
            /* Drilldown Table View */
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/40 text-xs text-muted-foreground border-b uppercase">
                    <tr>
                      <th className="p-3 font-semibold">{t('directory.columns.employee')}</th>
                      <th className="p-3 font-semibold">{t('directory.columns.riskLevel')}</th>
                      <th className="p-3 font-semibold">{t('directory.columns.issues')}</th>
                      <th className="p-3 font-semibold text-right">{t('directory.columns.intervention')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(exceptions || []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-muted-foreground">
                          {t('directory.emptyDrilldown')}
                        </td>
                      </tr>
                    ) : (
                      (exceptions || []).map((exc) => (
                        <tr key={exc.employee._id} className="hover:bg-muted/10 transition-colors">
                          <td className="p-3">
                            <div className="font-semibold text-foreground">{exc.employee.name}</div>
                            <div className="text-xs text-muted-foreground">{exc.employee.email} • {exc.employee.department}</div>
                          </td>
                          <td className="p-3">
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
                              {t('queue.riskBadge', { risk: t(`queue.riskLevels.${exc.riskLevel}`, { defaultValue: exc.riskLevel.toUpperCase() }) })}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1.5">
                              {exc.issues.map((issue, idx) => (
                                <span key={idx} className="text-xs text-red-600 font-medium bg-red-500/10 px-2 py-0.5 rounded">
                                  ⚠️ {issue}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={() => {
                                  setActiveEmpUser({ id: exc.employee._id, name: exc.employee.name });
                                  setIsExtendModalOpen(true);
                                }}
                              >
                                <Calendar className="h-3.5 w-3.5 mr-1" /> {t('directory.actions.extend')}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs text-amber-600"
                                onClick={() => {
                                  setActiveEmpUser({ id: exc.employee._id, name: exc.employee.name });
                                  setIsPauseModalOpen(true);
                                }}
                              >
                                <Pause className="h-3.5 w-3.5 mr-1" /> {t('directory.actions.pause')}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : employeesLoading ? (
            <div className="p-8 text-center text-muted-foreground">{t('directory.loading')}</div>
          ) : (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/40 text-xs text-muted-foreground border-b uppercase">
                    <tr>
                      <th className="p-3 w-10">
                        <input
                          type="checkbox"
                          className="rounded"
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          checked={selectedEmpIds.length === tabEmployees.length && tabEmployees.length > 0}
                        />
                      </th>
                      <th className="p-3 font-semibold">{t('directory.columns.employee')}</th>
                      <th className="p-3 font-semibold">{t('directory.columns.department')}</th>
                      <th className="p-3 font-semibold">{t('directory.columns.onboardingState')}</th>
                      <th className="p-3 font-semibold text-right">{t('directory.columns.lifecycleActions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {empPagination.paginatedData.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                          {activeDirectoryTab === 'ready'
                            ? t('directory.emptyReady')
                            : activeDirectoryTab === 'completed'
                            ? t('directory.emptyCompleted')
                            : t('directory.emptyGeneric')}
                        </td>
                      </tr>
                    ) : (
                      empPagination.paginatedData.map((emp: any) => (
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
                            <div className="text-xs text-muted-foreground">
                              {emp.email} {emp.employeeId ? t('directory.employeeId', { id: emp.employeeId }) : ''}
                            </div>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">{emp.department || t('directory.generalDepartment')}</td>
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={
                                emp.onboardingState === 'paused'
                                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs'
                                  : emp.status === 'Active' || emp.onboardingState === 'completed'
                                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs font-semibold'
                                  : 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 text-xs'
                              }
                            >
                              {t(`directory.states.${emp.status === 'Active' ? 'active' : (emp.onboardingState || 'active')}`, { defaultValue: (emp.status === 'Active' ? 'ACTIVE' : emp.onboardingState || 'active').toUpperCase() })}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end gap-2 items-center">
                              {emp.onboardingState === 'paused' ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs text-emerald-600"
                                  onClick={() => handleResumeOnboarding(emp)}
                                >
                                  <Play className="h-3 w-3 mr-1" /> {t('directory.actions.resume')}
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
                                  <Pause className="h-3 w-3 mr-1" /> {t('directory.actions.pause')}
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
                                <Calendar className="h-3 w-3 mr-1" /> {t('directory.actions.extend')}
                              </Button>
                              <Button
                                id={`finalize-handover-btn-${emp.employeeId || emp.id}`}
                                variant="default"
                                size="sm"
                                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 font-medium"
                                disabled={completeHandoverMutation.isPending}
                                onClick={() => handleFinalizeHandover(emp)}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> {t('directory.actions.finalizeHandover')}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-3 border-t">
                <SimplePagination
                  currentPage={empPagination.page}
                  totalPages={empPagination.totalPages}
                  totalItems={empPagination.totalItems}
                  startIndex={empPagination.startIndex}
                  endIndex={empPagination.endIndex}
                  pageSize={empPagination.pageSize}
                  onPageChange={empPagination.setPage}
                  onPageSizeChange={empPagination.setPageSize}
                  itemLabel={t('directory.employeesLabel')}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Pause Onboarding */}
      <Dialog open={isPauseModalOpen} onOpenChange={setIsPauseModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('pauseModal.title')}</DialogTitle>
            <DialogDescription>
              {t('pauseModal.desc', { name: activeEmpUser?.name })}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">{t('pauseModal.reasonLabel')}</label>
              <Input
                placeholder={t('pauseModal.reasonPlaceholder')}
                value={pauseReason}
                onChange={(e: any) => setPauseReason(e.target.value)}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPauseModalOpen(false)}>
              {t('pauseModal.cancel')}
            </Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handlePauseOnboarding}>
              {t('pauseModal.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Extend Due Date */}
      <Dialog open={isExtendModalOpen} onOpenChange={setIsExtendModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('extendModal.title')}</DialogTitle>
            <DialogDescription>
              {t('extendModal.desc', { name: activeEmpUser?.name })}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">{t('extendModal.daysLabel')}</label>
              <Input
                type="number"
                min="1"
                max="90"
                value={extensionDays}
                onChange={(e: any) => setExtensionDays(e.target.value)}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExtendModalOpen(false)}>
              {t('extendModal.cancel')}
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleExtendDueDate}>
              {t('extendModal.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Bulk Actions */}
      <Dialog open={isBulkModalOpen} onOpenChange={setIsBulkModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('bulkModal.title', { count: selectedEmpIds.length })}</DialogTitle>
            <DialogDescription>{t('bulkModal.desc')}</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">{t('bulkModal.actionType')}</label>
              <select
                className="w-full text-sm p-2 border rounded-md bg-background focus:outline-none"
                value={bulkAction}
                onChange={(e: any) => setBulkAction(e.target.value)}
              >
                <option value="send_reminder">{t('bulkModal.sendReminder')}</option>
                <option value="assign_journey">{t('bulkModal.assignJourney')}</option>
              </select>
            </div>

            {bulkAction === 'assign_journey' && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">{t('bulkModal.selectJourney')}</label>
                <SearchableSelect
                  value={selectedJourneyId}
                  onChange={(val) => setSelectedJourneyId(val)}
                  placeholder={t('bulkModal.searchJourney')}
                  searchPlaceholder={t('bulkModal.searchJourney')}
                  options={(journeys || []).map((j: any) => ({
                    value: j.id,
                    label: j.title,
                    sublabel: j.description || j.category,
                    badge: j.category,
                  }))}
                />
              </div>
            )}

            {bulkAction === 'send_reminder' && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">{t('bulkModal.customMessage')}</label>
                <Input
                  value={bulkMessage}
                  placeholder={t('bulkModal.defaultMessage')}
                  onChange={(e: any) => setBulkMessage(e.target.value)}
                />
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkModalOpen(false)}>
              {t('bulkModal.cancel')}
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleExecuteBulkAction}>
              {t('bulkModal.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Compliance Audit Report */}
      <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('complianceModal.title')}</DialogTitle>
            <DialogDescription>{t('complianceModal.desc')}</DialogDescription>
          </DialogHeader>

          <DialogBody className="p-0 sm:p-0">
            {/* Mobile View: Stacked Cards */}
            <div className="sm:hidden p-4 space-y-2.5">
              {compPagination.paginatedData.map((row) => (
                <div key={row.employeeId} className="p-3 border rounded-xl bg-card space-y-1.5 text-xs shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-semibold text-foreground text-sm block">{row.name}</span>
                      <span className="text-muted-foreground text-[11px]">{row.department} • {row.email}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono">
                      {t(`directory.states.${row.onboardingState}`, { defaultValue: (row.onboardingState || '').toUpperCase() })}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t text-[11px]">
                    <span className="text-muted-foreground">{t('complianceModal.completionRate')}</span>
                    <span className="font-bold text-indigo-600">{row.completionRate}%</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View: Full Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 font-semibold border-b">
                  <tr>
                    <th className="p-3">{t('directory.columns.employee')}</th>
                    <th className="p-3">{t('directory.columns.department')}</th>
                    <th className="p-3">{t('directory.columns.onboardingState')}</th>
                    <th className="p-3 text-right">{t('complianceModal.completionRate')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {compPagination.paginatedData.map((row) => (
                    <tr key={row.employeeId} className="hover:bg-muted/10 transition-colors">
                      <td className="p-3 font-medium">{row.name} ({row.email})</td>
                      <td className="p-3 text-muted-foreground">{row.department}</td>
                      <td className="p-3">{t(`directory.states.${row.onboardingState}`, { defaultValue: row.onboardingState })}</td>
                      <td className="p-3 text-right font-bold text-indigo-600">{row.completionRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t">
              <SimplePagination
                currentPage={compPagination.page}
                totalPages={compPagination.totalPages}
                totalItems={compPagination.totalItems}
                startIndex={compPagination.startIndex}
                endIndex={compPagination.endIndex}
                pageSize={compPagination.pageSize}
                onPageChange={compPagination.setPage}
                onPageSizeChange={compPagination.setPageSize}
                itemLabel={t('complianceModal.recordsLabel')}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReportModalOpen(false)}>
              {t('complianceModal.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Handover & Completion Verification */}
      <Dialog open={isHandoverModalOpen} onOpenChange={setIsHandoverModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              {t('handoverModal.title')}
            </DialogTitle>
            <DialogDescription>
              {t('handoverModal.desc', { name: activeEmpUser?.name })}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-3">
            <div className="p-3 bg-muted/40 rounded-xl space-y-2 border">
              <div className="flex justify-between items-center font-medium text-foreground">
                <span>{t('handoverModal.modules')}</span>
                <span className="text-emerald-600 font-bold">{t('handoverModal.passed')}</span>
              </div>
              <div className="flex justify-between items-center font-medium text-foreground">
                <span>{t('handoverModal.itSetup')}</span>
                <span className="text-emerald-600 font-bold">{t('handoverModal.completed')}</span>
              </div>
              <div className="flex justify-between items-center font-medium text-foreground">
                <span>{t('handoverModal.signatures')}</span>
                <span className="text-emerald-600 font-bold">{t('handoverModal.signed')}</span>
              </div>
              <div className="flex justify-between items-center font-medium text-foreground">
                <span>{t('handoverModal.buddy')}</span>
                <span className="text-emerald-600 font-bold">{t('handoverModal.active')}</span>
              </div>
            </div>

            <p className="text-muted-foreground text-[11px]">
              {t('handoverModal.disclaimer')}
            </p>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHandoverModalOpen(false)}>
              {t('handoverModal.cancel')}
            </Button>
            <Button
              id="modal-finalize-handover-btn"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleCompleteHandover}
              disabled={completeHandoverMutation.isPending}
            >
              {completeHandoverMutation.isPending ? t('handoverModal.processing') : t('handoverModal.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HROperations;
