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

export function EmployeeDashboard() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  // Using employee '1' as a standard active employee reference for demo purposes
  const { data: employee, isLoading: employeeLoading, isError, error, refetch } = useEmployee('1');

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
          Welcome back, {user?.name || 'Jane'}!
        </h1>
        <p className="text-muted-foreground">
          Here is your learning progress for today.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {activeJourney ? (
          <Card className="md:col-span-2 bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle>Continue Learning</CardTitle>
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
                  Resume Course
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Get Started</CardTitle>
              <CardDescription>
                You don't have any active onboarding journeys assigned.
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

      <div>
        <h2 className="text-xl font-semibold tracking-tight mb-4">
          Assigned to You
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {!employee.assignedJourneys || employee.assignedJourneys.length === 0 ? (
            <div className="col-span-full py-8 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
              No assigned journeys.
            </div>
          ) : (
            employee.assignedJourneys.map((j) => (
              <Card key={j.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {j.title}
                  </CardTitle>
                  <CardDescription>
                    {j.status === 'Completed' ? 'Completed Journey' : 'In Progress'}
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
            ))
          )}
        </div>
      </div>
    </div>
  );
}