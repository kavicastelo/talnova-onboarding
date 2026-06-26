import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from
  '../components/Card';
import { Button } from '../components/Button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from
  '../components/Select';
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid
} from
  'recharts';
import { ChartContainer, ChartTooltipContent } from '../components/Chart';
import { Download, TrendingUp, Users, Clock, Award, AlertCircle, RefreshCw } from 'lucide-react';
import { useAnalytics } from '../hooks/useAnalytics';
import { Skeleton } from '../components/Skeleton';

export function Analytics() {
  const [range, setRange] = useState('30d');
  const { data: analytics, isLoading, isError, error, refetch } = useAnalytics(range);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-[150px]" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent className="h-[300px] flex items-end justify-between gap-2 px-6 pb-6">
                <Skeleton className="h-[20%] w-12" />
                <Skeleton className="h-[40%] w-12" />
                <Skeleton className="h-[60%] w-12" />
                <Skeleton className="h-[80%] w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !analytics) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto text-center p-12 border rounded-xl my-12">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold">Failed to Load Analytics</h2>
        <p className="text-muted-foreground">{(error as any)?.message || 'An error occurred while loading analytics summary.'}</p>
        <Button onClick={() => refetch()} className="mx-auto mt-4">
          <RefreshCw className="mr-2 h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Detailed insights into organizational learning.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg. Completion Rate
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.avgCompletionRate}%</div>
            <p className="text-xs text-muted-foreground text-emerald-500 flex items-center mt-1">
              <TrendingUp className="h-3 w-3 mr-1" /> {analytics.avgCompletionRateDelta}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Learners
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.activeLearners.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.activeLearnersPercent} of total organization
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Learning Hours
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.learningHours.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.learningHoursAverage}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Certificates Issued
            </CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.certificatesIssued.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">{analytics.certificatesIssuedDelta}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Completion Trend</CardTitle>
            <CardDescription>Average completion rate over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                rate: {
                  label: 'Completion Rate (%)',
                  color: 'var(--primary)'
                }
              }}
              className="h-[300px] w-full">

              <LineChart
                data={analytics.completionTrend}
                margin={{
                  top: 5,
                  right: 10,
                  left: 10,
                  bottom: 0
                }}>

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--border)" />

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
                  tickFormatter={(value) => `${value}%`} />

                <Tooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="var(--color-rate)"
                  strokeWidth={2}
                  activeDot={{
                    r: 8
                  }} />

              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Completions by Department</CardTitle>
            <CardDescription>Total journey completions by team</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                completions: {
                  label: 'Completions',
                  color: 'var(--primary)'
                }
              }}
              className="h-[300px] w-full">

              <BarChart
                data={analytics.departmentCompletions}
                margin={{
                  top: 5,
                  right: 10,
                  left: 10,
                  bottom: 0
                }}>

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--border)" />

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
                  axisLine={false} />

                <Tooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="completions"
                  fill="var(--color-completions)"
                  radius={[4, 4, 0, 0]} />

              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}