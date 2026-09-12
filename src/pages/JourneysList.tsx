import { useState } from 'react';
import {
  Card
} from '../components/Card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../components/Table';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Skeleton } from '../components/Skeleton';
import { Plus, MoreHorizontal, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import { useJourneys, useUpdateJourney, useDuplicateJourney } from '../hooks/useJourneys';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '../components/DropdownMenu';
import { Link, useNavigate } from 'react-router-dom';
import { useRole } from '../context/RoleContext';
import { Input } from '../components/Input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../components/Dialog';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { SimplePagination } from '../components/SimplePagination';
import { usePagination } from '../hooks/usePagination';
import { JourneyPathVisualizer } from '../components/journeys/JourneyPathVisualizer';
import { AutonomousJourneyViewer, IAutonomousAssignmentItem } from '../components/journeys/AutonomousJourneyViewer';
import { JourneyOverrideDrawer } from '../components/journeys/JourneyOverrideDrawer';

export function JourneysList() {
  const { can } = useRole();
  const canCreate = can('create_journey');
  const { data: journeys = [], isLoading, isError, error, refetch } = useJourneys();
  const navigate = useNavigate();
  const { t } = useTranslation('journeys');

  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    totalItems,
    totalPages,
    paginatedData: paginatedJourneys,
    startIndex,
    endIndex,
  } = usePagination({ data: journeys, initialPageSize: 10 });

  const [modals, setModals] = useState<{
    type: 'duplicate' | 'archive' | null;
    journeyId?: string;
    inputValue?: string;
  }>({ type: null });

  const duplicateJourney = useDuplicateJourney();
  const updateJourney = useUpdateJourney();

  const handleDuplicateClick = (id: string, title: string) => {
    setModals({
      type: 'duplicate',
      journeyId: id,
      inputValue: `${title} (Copy)`
    });
  };

  const handleArchiveClick = (id: string) => {
    setModals({
      type: 'archive',
      journeyId: id
    });
  };

  const handleConfirmDuplicate = () => {
    if (modals.journeyId && modals.inputValue) {
      duplicateJourney.mutate(
        { id: modals.journeyId, title: modals.inputValue },
        {
          onSuccess: () => {
            toast.success('Journey duplicated successfully');
            setModals({ type: null });
          },
          onError: (err: any) => {
            toast.error(err?.message || 'Failed to duplicate journey');
          }
        }
      );
    }
  };

  const handleConfirmArchive = () => {
    if (modals.journeyId) {
      updateJourney.mutate(
        { id: modals.journeyId, journey: { status: 'Archived' } },
        {
          onSuccess: () => {
            toast.success('Journey archived successfully');
            setModals({ type: null });
          },
          onError: (err: any) => {
            toast.error(err?.message || 'Failed to archive journey');
          }
        }
      );
    }
  };

  const [activeTab, setActiveTab] = useState<'templates' | 'intelligence'>('templates');
  const [selectedOverrideAssignment, setSelectedOverrideAssignment] = useState<any>(null);
  const [isOverrideDrawerOpen, setIsOverrideDrawerOpen] = useState(false);
  const [selectedVisualizerTitle, setSelectedVisualizerTitle] = useState<string>('Engineering Full-Stack Journey (Tokyo & Global)');

  const autonomousAssignments: IAutonomousAssignmentItem[] = [
    {
      id: 'asgn_1',
      employeeName: 'Sarah Chen',
      employeeEmail: 'sarah.chen@acme.corp',
      department: 'Engineering',
      location: 'Tokyo, Japan',
      journeyTitle: 'Engineering Full-Stack Journey (Tokyo & Global)',
      journeyId: journeys[0]?.id || 'j_eng_1',
      caseState: 'active',
      attribution: {
        matchedRuleId: 'rule_eng_tokyo',
        matchedRuleName: 'Tokyo Engineering Core Rule',
        priorityIndex: 85,
        specificityScore: 3,
        conditionMatches: [
          { field: 'department', operator: 'equals', value: 'Engineering', matched: true },
          { field: 'location', operator: 'equals', value: 'Tokyo', matched: true },
          { field: 'role', operator: 'equals', value: 'employee', matched: true },
        ],
        confidenceScore: 98,
        arbitrationReason: 'Specific office + department match prioritized over general Global Engineering rule.',
        source: 'sso',
        assignedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
      },
    },
    {
      id: 'asgn_2',
      employeeName: 'Marcus Vance',
      employeeEmail: 'marcus.v@acme.corp',
      department: 'Warehouse Operations',
      location: 'San Francisco, USA',
      journeyTitle: 'Frontline Warehouse Safety & PPE Briefing',
      journeyId: journeys[1]?.id || 'j_ops_1',
      caseState: 'active',
      attribution: {
        matchedRuleId: 'rule_warehouse_ops',
        matchedRuleName: 'Warehouse Frontline PPE Compliance Rule',
        priorityIndex: 75,
        specificityScore: 2,
        conditionMatches: [
          { field: 'department', operator: 'equals', value: 'Warehouse Operations', matched: true },
          { field: 'role', operator: 'equals', value: 'frontline_worker', matched: true },
        ],
        confidenceScore: 94,
        arbitrationReason: 'Mandatory frontline safety certification gate enabled.',
        source: 'hris',
        assignedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
      },
    },
    {
      id: 'asgn_3',
      employeeName: 'Elena Rostova',
      employeeEmail: 'elena.r@acme.corp',
      department: 'Product Design',
      location: 'London, UK',
      journeyTitle: 'Design Systems & UX Foundations Journey',
      journeyId: journeys[2]?.id || 'j_des_1',
      caseState: 'provisioning',
      attribution: {
        matchedRuleId: 'rule_product_design',
        matchedRuleName: 'Product Design General Onboarding',
        priorityIndex: 65,
        specificityScore: 2,
        conditionMatches: [
          { field: 'department', operator: 'equals', value: 'Product Design', matched: true },
        ],
        confidenceScore: 88,
        arbitrationReason: 'Default departmental template applied on initial user invite.',
        source: 'invite',
        assignedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
      },
    },
  ];

  const handleOpenOverride = (item: IAutonomousAssignmentItem) => {
    setSelectedOverrideAssignment({
      id: item.id,
      employeeName: item.employeeName,
      currentJourneyTitle: item.journeyTitle,
      department: item.department,
    });
    setIsOverrideDrawerOpen(true);
  };

  const handleConfirmOverride = async (params: { targetJourneyId: string; reason: string; grandfatherArtifacts: boolean }) => {
    toast.success(`Manual override applied: reassigned to ${journeys.find(j => j.id === params.targetJourneyId)?.title || 'selected journey'}`);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {canCreate ? t('list.title') : 'My Onboarding Journeys'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {canCreate
              ? 'Manage and track employee onboarding paths, stage gates, and autonomous assignments.'
              : 'Track and complete your assigned onboarding paths.'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canCreate && (
            <div className="flex items-center bg-muted/60 p-1 rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setActiveTab('templates')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === 'templates'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Journey Templates
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('intelligence')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                  activeTab === 'intelligence'
                    ? 'bg-background text-primary shadow-sm font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Autonomous Routing
              </button>
            </div>
          )}

          {canCreate && (
            <Button asChild className="w-full sm:w-auto">
              <Link to="/journeys/new">
                <Plus className="mr-2 h-4 w-4" />
                {t('list.createNew')}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {activeTab === 'intelligence' ? (
        <div className="space-y-6">
          <AutonomousJourneyViewer
            assignments={autonomousAssignments}
            onOpenOverride={handleOpenOverride}
            onViewPath={(item) => setSelectedVisualizerTitle(item.journeyTitle)}
          />

          <JourneyPathVisualizer
            journeyTitle={selectedVisualizerTitle}
            caseState="active"
          />
        </div>
      ) : (

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('list.columns.title')}</TableHead>
              <TableHead>{t('list.columns.status')}</TableHead>
              {canCreate ? (
                <>
                  <TableHead>{t('list.columns.enrolled')}</TableHead>
                  <TableHead>{t('list.columns.completion')}</TableHead>
                </>
              ) : null}
              <TableHead>{t('list.columns.lastUpdated')}</TableHead>
              {canCreate && <TableHead className="w-[50px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading Skeleton State
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  {canCreate ? (
                    <>
                      <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                    </>
                  ) : null}
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  {canCreate && <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>}
                </TableRow>
              ))
            ) : isError ? (
              // Error State
              <TableRow>
                <TableCell colSpan={canCreate ? 6 : 3} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-destructive">
                    <AlertCircle className="h-8 w-8" />
                    <p className="font-semibold">Failed to load journeys</p>
                    <p className="text-xs text-muted-foreground">{(error as any)?.message || 'An error occurred.'}</p>
                    <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
                      <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : journeys.length === 0 ? (
              // Empty State
              <TableRow>
                <TableCell colSpan={canCreate ? 6 : 3} className="h-32 text-center text-muted-foreground">
                  <p className="font-medium">{t('list.empty')}</p>
                  <p className="text-xs">{t('list.createNew')}</p>
                </TableCell>
              </TableRow>
            ) : (
              // Success State
              paginatedJourneys.map((journey) => (
                <TableRow key={journey.id}>
                  <TableCell className="font-medium">
                    <Link
                      to={canCreate ? `/journeys/${journey.id}` : `/course/${journey.id}`}
                      className="hover:underline">
                      {journey.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        journey.status === 'Active' ? 'default' : 'secondary'
                      }>
                      {journey.status}
                    </Badge>
                  </TableCell>
                  {canCreate ? (
                    <>
                      <TableCell>{journey.enrolled}</TableCell>
                      <TableCell>{journey.completion}%</TableCell>
                    </>
                  ) : null}
                  <TableCell>{journey.lastUpdated}</TableCell>
                  {canCreate && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/journeys/${journey.id}`)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicateClick(journey.id, journey.title)}>
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleArchiveClick(journey.id)}>
                            Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {!isLoading && !isError && totalItems > 0 && (
          <div className="px-4 border-t">
            <SimplePagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              startIndex={startIndex}
              endIndex={endIndex}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              itemLabel="journeys"
            />
          </div>
        )}
      </Card>
      )}

      <JourneyOverrideDrawer
        isOpen={isOverrideDrawerOpen}
        onClose={() => setIsOverrideDrawerOpen(false)}
        assignment={selectedOverrideAssignment}
        journeys={journeys.map((j) => ({ id: j.id, title: j.title }))}
        onConfirmOverride={handleConfirmOverride}
      />

      {/* Custom Dialogs */}
      <Dialog open={modals.type === 'duplicate'} onOpenChange={(open: boolean) => !open && setModals({ type: null })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Duplicate Journey</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Title</label>
              <Input
                value={modals.inputValue || ''}
                onChange={(e: any) => setModals({ ...modals, inputValue: e.target.value })}
                placeholder="e.g. Engineering Onboarding (Copy)"
                autoFocus
                onKeyDown={(e: any) => {
                  if (e.key === 'Enter' && modals.inputValue) {
                    handleConfirmDuplicate();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModals({ type: null })}>Cancel</Button>
            <Button
              onClick={handleConfirmDuplicate}
              disabled={!modals.inputValue || duplicateJourney.isPending}
            >
              {duplicateJourney.isPending ? 'Duplicating...' : 'Duplicate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modals.type === 'archive'} onOpenChange={(open: boolean) => !open && setModals({ type: null })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Archive Journey</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            Are you sure you want to archive this journey? Enrolled employees will no longer be able to access it.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModals({ type: null })}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleConfirmArchive}
              disabled={updateJourney.isPending}
            >
              {updateJourney.isPending ? 'Archiving...' : 'Archive'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}