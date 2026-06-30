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
import { Plus, MoreHorizontal, AlertCircle, RefreshCw } from 'lucide-react';
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

export function JourneysList() {
  const { data: journeys = [], isLoading, isError, error, refetch } = useJourneys();
  const { role } = useRole();
  const navigate = useNavigate();

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

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {role === 'admin' ? 'Journeys' : 'My Learning'}
          </h1>
          <p className="text-muted-foreground">
            {role === 'admin'
              ? 'Manage onboarding and training journeys.'
              : 'View and complete your assigned training journeys.'}
          </p>
        </div>
        {role === 'admin' && (
          <Button asChild>
            <Link to="/journeys/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Journey
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              {role === 'admin' ? (
                <>
                  <TableHead>Enrolled</TableHead>
                  <TableHead>Completion</TableHead>
                </>
              ) : null}
              <TableHead>Last Updated</TableHead>
              {role === 'admin' && <TableHead className="w-[50px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading Skeleton State
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  {role === 'admin' ? (
                    <>
                      <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                    </>
                  ) : null}
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  {role === 'admin' && <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>}
                </TableRow>
              ))
            ) : isError ? (
              // Error State
              <TableRow>
                <TableCell colSpan={role === 'admin' ? 6 : 3} className="h-32 text-center">
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
                <TableCell colSpan={role === 'admin' ? 6 : 3} className="h-32 text-center text-muted-foreground">
                  <p className="font-medium">No journeys found</p>
                  <p className="text-xs">Create one to get started with onboarding.</p>
                </TableCell>
              </TableRow>
              ) : (
              // Success State
              journeys.map((journey) => (
                <TableRow key={journey.id}>
                  <TableCell className="font-medium">
                    <Link
                      to={role === 'admin' ? `/journeys/${journey.id}` : `/course/${journey.id}`}
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
                  {role === 'admin' ? (
                    <>
                      <TableCell>{journey.enrolled}</TableCell>
                      <TableCell>{journey.completion}%</TableCell>
                    </>
                  ) : null}
                  <TableCell>{journey.lastUpdated}</TableCell>
                  {role === 'admin' && (
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
      </Card>

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