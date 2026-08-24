import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from
  '../components/Card';
import { Button } from '../components/Button';
import { Progress } from '../components/Progress';
import { Skeleton } from '../components/Skeleton';
import { PlayCircle, Clock, Award, AlertCircle, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useAuth';
import { useEmployee } from '../hooks/useEmployees';
import { useJourneys, useAssignJourney } from '../hooks/useJourneys';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { SimplePagination } from '../components/SimplePagination';
import { usePagination } from '../hooks/usePagination';

export function EmployeeDashboard() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { t } = useTranslation('dashboard');
  // Fetch current logged in employee's profile
  const { data: employee, isLoading: employeeLoading, isError, error, refetch } = useEmployee('me');

  const { data: publicJourneys = [] } = useJourneys();
  const assignJourneyMut = useAssignJourney();

  const handleEnroll = (journeyId: string) => {
    if (!employee) return;
    assignJourneyMut.mutate(
      { journeyId, employeeId: employee.id },
      {
        onSuccess: () => {
          toast.success('Successfully enrolled in the journey!');
          refetch();
        },
        onError: (err: any) => {
          toast.error(err?.message || 'Failed to enroll.');
        }
      }
    );
  };

  const availablePublicJourneys = publicJourneys.filter((pj: any) => {
    return !employee?.assignedJourneys?.some((aj: any) => aj.journeyId === pj.id);
  });

  const assignedPagination = usePagination({ data: employee?.assignedJourneys || [], initialPageSize: 6 });
  const publicPagination = usePagination({ data: availablePublicJourneys, initialPageSize: 6 });

  const isLoading = userLoading || employeeLoading;

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-10 w-32" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isError || !employee) {
    return (
      <div className="max-w-md mx-auto text-center p-8 border rounded-lg space-y-4 my-12">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold">Failed to Load Dashboard</h2>
        <p className="text-muted-foreground">{(error as any)?.message || 'Your employee record could not be loaded.'}</p>
        <Button onClick={() => refetch()} className="mx-auto">
          <RefreshCw className="mr-2 h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  // Active journey is typically the first assigned journey in progress
  const activeJourney = employee.assignedJourneys?.find(j => j.status === 'In Progress') || employee.assignedJourneys?.[0];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t('employee.title')}, {user?.name || 'Jane'}!
        </h1>
        <p className="text-muted-foreground">
          {t('employee.progress')}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {activeJourney ? (
          <Card className="md:col-span-2 bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle>{t('employee.continuelearning')}</CardTitle>
              <CardDescription className="text-primary-foreground/80">
                You are {activeJourney.progress}% through {activeJourney.title}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Current Module: Progressing</span>
                  <span>{activeJourney.progress}%</span>
                </div>
                <Progress value={activeJourney.progress} className="h-2 bg-primary-foreground/20" />
              </div>
              <Button variant="secondary" asChild>
                <Link to={`/course/${activeJourney.id}`}>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  {t('employee.continuelearning')}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>{t('employee.startJourney')}</CardTitle>
              <CardDescription>
                {t('employee.noJourneys')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Please check back later or contact your workspace administrator.</p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Your Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Award className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{employee.certificatesCount || 0} Certificates</p>
                <p className="text-xs text-muted-foreground">
                  Earned this year
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{employee.progress > 0 ? '14 Hours' : '0 Hours'}</p>
                <p className="text-xs text-muted-foreground">Learning time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight mb-4">
          {t('employee.assignedJourneys')}
        </h2>
        {!employee.assignedJourneys || employee.assignedJourneys.length === 0 ? (
          <div className="col-span-full py-8 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
            {t('employee.noJourneys')}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {assignedPagination.paginatedData.map((j) => (
                <Card key={j.id}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {j.title}
                    </CardTitle>
                    <CardDescription>
                      {j.status === 'Completed' ? t('employee.completedJourneys') : t('employee.inProgress')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                      <Clock className="h-4 w-4" />
                      <span>Assigned {j.assignedAt}</span>
                    </div>
                    <Button variant={j.status === 'Completed' ? 'outline' : 'default'} className="w-full" asChild>
                      <Link to={`/course/${j.id}`}>
                        {j.status === 'Completed' ? 'Review Course' : 'Start Course'}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <SimplePagination
              currentPage={assignedPagination.page}
              totalPages={assignedPagination.totalPages}
              totalItems={assignedPagination.totalItems}
              startIndex={assignedPagination.startIndex}
              endIndex={assignedPagination.endIndex}
              pageSize={assignedPagination.pageSize}
              onPageChange={assignedPagination.setPage}
              onPageSizeChange={assignedPagination.setPageSize}
              itemLabel="journeys"
            />
          </div>
        )}
      </div>

      {availablePublicJourneys.length > 0 && (
        <div className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold tracking-tight mb-4 flex items-center gap-2">
            Explore Public Journeys
            <span className="text-xs font-normal text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/10">Self-Enroll</span>
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {publicPagination.paginatedData.map((j: any) => (
              <Card key={j.id} className="hover:shadow-md transition-all flex flex-col justify-between">
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    {j.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {j.description || 'No description provided.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                    <span>{j.category || 'General'}</span>
                    <span>•</span>
                    <span>{j.modules?.length || 0} modules</span>
                  </div>
                  <Button 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" 
                    onClick={() => handleEnroll(j.id)}
                    disabled={assignJourneyMut.isPending}
                  >
                    {assignJourneyMut.isPending ? 'Enrolling...' : 'Enroll & Start'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <SimplePagination
            currentPage={publicPagination.page}
            totalPages={publicPagination.totalPages}
            totalItems={publicPagination.totalItems}
            startIndex={publicPagination.startIndex}
            endIndex={publicPagination.endIndex}
            pageSize={publicPagination.pageSize}
            onPageChange={publicPagination.setPage}
            onPageSizeChange={publicPagination.setPageSize}
            itemLabel="journeys"
          />
        </div>
      )}
    </div>
  );
}