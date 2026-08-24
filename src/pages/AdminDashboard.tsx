import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from
  '../components/Card';
import { Users, BookOpen, CheckCircle2, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  Tooltip
} from
  'recharts';
import { ChartContainer, ChartTooltipContent } from '../components/Chart';
import { useDashboardSummary } from '../hooks/useDashboard';
import { Skeleton } from '../components/Skeleton';
import { Button } from '../components/Button';
import { useTranslation } from 'react-i18next';
import { SimplePagination } from '../components/SimplePagination';
import { usePagination } from '../hooks/usePagination';

export function AdminDashboard() {
  const { data: summary, isLoading, isError, error, refetch } = useDashboardSummary();
  const { t } = useTranslation('dashboard');

  const activityPagination = usePagination({ data: summary?.recentActivity || [], initialPageSize: 5 });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('admin.title')}</h1>
          <p className="text-muted-foreground">
            {t('admin.stats.totalEmployees')}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <Skeleton className="h-6 w-36" />
            </CardHeader>
            <CardContent className="h-[300px] flex items-end justify-between gap-2 px-6 pb-6">
              <Skeleton className="h-[20%] w-8" />
              <Skeleton className="h-[40%] w-8" />
              <Skeleton className="h-[15%] w-8" />
              <Skeleton className="h-[60%] w-8" />
              <Skeleton className="h-[30%] w-8" />
              <Skeleton className="h-[75%] w-8" />
              <Skeleton className="h-[50%] w-8" />
            </CardContent>
          </Card>
          <Card className="col-span-3">
            <CardHeader>
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3.5 w-24" />
                  </div>
                  <Skeleton className="h-4 w-8 ml-auto" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isError || !summary) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto text-center p-12 border rounded-xl my-12">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold">Failed to Load Dashboard</h2>
        <p className="text-muted-foreground">{(error as any)?.message || 'An error occurred while loading dashboard statistics.'}</p>
        <Button onClick={() => refetch()} className="mx-auto mt-4">
          <RefreshCw className="mr-2 h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your organization's learning progress.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('admin.stats.totalEmployees')}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalEmployees.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{summary.totalEmployeesDelta}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('admin.stats.activeJourneys')}
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.activeJourneys}</div>
            <p className="text-xs text-muted-foreground">{summary.activeJourneysDelta}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('admin.stats.completionRate')}
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.completionRate}%</div>
            <p className="text-xs text-muted-foreground">{summary.completionRateDelta}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('admin.stats.avgTimeToComplete')}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.avgTimeToComplete}</div>
            <p className="text-xs text-muted-foreground">
              {summary.avgTimeToCompleteDelta}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>{t('admin.completionsOverTime')}</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ChartContainer
              config={{
                completions: {
                  label: 'Completions',
                  color: 'var(--primary)'
                }
              }}
              className="h-[300px] w-full">

              <BarChart data={summary.completionsOverTime}>
                <XAxis
                  dataKey="name"
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false} />

                <YAxis
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}`} />

                <Tooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="completions"
                  fill="var(--color-completions)"
                  radius={[4, 4, 0, 0]} />

              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>{t('admin.recentActivity')}</CardTitle>
            <CardDescription>
              {t('admin.recentActivity')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-6">
                {activityPagination.paginatedData.map((activity) => (
                  <div key={activity.id} className="flex items-center">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                      {activity.userInitials}
                    </div>
                    <div className="ml-4 space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {activity.userName} {activity.actionDescription}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {activity.journeyTitle}
                      </p>
                    </div>
                    <div className="ml-auto font-medium text-sm text-muted-foreground">
                      {activity.timeAgo}
                    </div>
                  </div>
                ))}
              </div>

              <SimplePagination
                currentPage={activityPagination.page}
                totalPages={activityPagination.totalPages}
                totalItems={activityPagination.totalItems}
                startIndex={activityPagination.startIndex}
                endIndex={activityPagination.endIndex}
                pageSize={activityPagination.pageSize}
                onPageChange={activityPagination.setPage}
                onPageSizeChange={activityPagination.setPageSize}
                itemLabel="activities"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}