import {
  Card
} from
  '../components/Card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from
  '../components/Table';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Skeleton } from '../components/Skeleton';
import { Plus, MoreHorizontal, AlertCircle, RefreshCw } from 'lucide-react';
import { useJourneys } from '../hooks/useJourneys';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from
  '../components/DropdownMenu';
import { Link } from 'react-router-dom';

export function JourneysList() {
  const { data: journeys = [], isLoading, isError, error, refetch } = useJourneys();

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Journeys</h1>
          <p className="text-muted-foreground">
            Manage onboarding and training journeys.
          </p>
        </div>
        <Button asChild>
          <Link to="/journeys/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Journey
          </Link>
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Enrolled</TableHead>
              <TableHead>Completion</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading Skeleton State
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                </TableRow>
              ))
            ) : isError ? (
              // Error State
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
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
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
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
                      to={`/journeys/${journey.id}`}
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
                  <TableCell>{journey.enrolled}</TableCell>
                  <TableCell>{journey.completion}%</TableCell>
                  <TableCell>{journey.lastUpdated}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem>Duplicate</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}