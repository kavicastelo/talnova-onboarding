import { useParams, Link } from 'react-router-dom';
import { Button } from '../components/Button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from
  '../components/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/Tabs';
import { Avatar, AvatarFallback, AvatarImage } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { Progress } from '../components/Progress';
import {
  ChevronLeft,
  Mail,
  MapPin,
  Calendar,
  Award,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw
} from
  'lucide-react';
import { useEmployee } from '../hooks/useEmployees';
import { Skeleton } from '../components/Skeleton';

export function EmployeeProfile() {
  const { id } = useParams();
  const { data: employee, isLoading, isError, error, refetch } = useEmployee(id || '');

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" disabled>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Skeleton className="h-8 w-48" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              <Skeleton className="w-24 h-24 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-96" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !employee) {
    return (
      <div className="max-w-md mx-auto text-center p-8 border rounded-lg space-y-4 my-12">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold">Failed to Load Profile</h2>
        <p className="text-muted-foreground">{(error as any)?.message || 'The requested employee profile was not found.'}</p>
        <Button onClick={() => refetch()} className="mx-auto">
          <RefreshCw className="mr-2 h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/directory">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Employee Profile</h1>
      </div>

      {/* Profile Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            <Avatar className="w-24 h-24 border-4 border-background shadow-sm">
              <AvatarImage src={`https://i.pravatar.cc/150?u=${employee.id}`} />
              <AvatarFallback>
                {employee.name.
                  split(' ').
                  map((n) => n[0]).
                  join('')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold">{employee.name}</h2>
                <Badge
                  variant={
                    employee.status === 'Active' ? 'default' : 'secondary'
                  }>

                  {employee.status}
                </Badge>
              </div>
              <p className="text-lg text-muted-foreground">
                {employee.role} • {employee.department}
              </p>
              <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4" />{' '}
                  {employee.name.toLowerCase().replace(' ', '.')}@acmecorp.com
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" /> San Francisco, CA
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" /> Hired Jan 2023
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full md:w-auto">
              <Button>Assign Training</Button>
              <Button variant="outline">Message</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">Learning History</TabsTrigger>
          <TabsTrigger value="activity">Activity Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Overall Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{employee.progress}%</div>
                <Progress value={employee.progress} className="h-2 mt-3" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Completed Journeys
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">3</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Certificates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">2</div>
              </CardContent>
            </Card>
          </div>

          <h3 className="text-lg font-semibold mt-8 mb-4">Assigned Journeys</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Engineering Onboarding
                </CardTitle>
                <CardDescription>Assigned 2 weeks ago</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span>In Progress</span>
                  <span className="font-medium">45%</span>
                </div>
                <Progress value={45} className="h-2 mb-4" />
                <Button variant="outline" size="sm" className="w-full">
                  View Details
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Security Awareness 2026
                </CardTitle>
                <CardDescription>Assigned 1 month ago</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm mb-2 text-primary">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Completed
                  </span>
                  <span className="font-medium">100%</span>
                </div>
                <Progress value={100} className="h-2 mb-4" />
                <Button variant="outline" size="sm" className="w-full">
                  View Certificate
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              <div className="p-8 text-center text-muted-foreground">
                <Award className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Learning history will appear here.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardContent className="p-0">
              <div className="p-8 text-center text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Recent activity timeline will appear here.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>);

}