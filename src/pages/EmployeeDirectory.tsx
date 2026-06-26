import { useState } from 'react';
import { Card } from '../components/Card';
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
import { Progress } from '../components/Progress';
import { Skeleton } from '../components/Skeleton';
import { Plus, Search, Filter, AlertCircle, RefreshCw } from 'lucide-react';
import { useEmployees } from '../hooks/useEmployees';
import { Input } from '../components/Input';
import { Link } from 'react-router-dom';

export function EmployeeDirectory() {
  const [search, setSearch] = useState('');
  const { data: employees = [], isLoading, isError, error, refetch } = useEmployees({ search });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Directory</h1>
          <p className="text-muted-foreground">
            Manage employees and track their progress.
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Invite Employee
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            className="pl-9"
            value={search}
            onChange={(e: any) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          Filter
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading Skeleton State
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-2 w-32" />
                      <Skeleton className="h-4 w-8" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : isError ? (
              // Error State
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-destructive">
                    <AlertCircle className="h-8 w-8" />
                    <p className="font-semibold">Failed to load directory</p>
                    <p className="text-xs text-muted-foreground">{(error as any)?.message || 'An error occurred.'}</p>
                    <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
                      <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : employees.length === 0 ? (
              // Empty State
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  <p className="font-medium">No employees found</p>
                  <p className="text-xs">Invite new team members to track progress here.</p>
                </TableCell>
              </TableRow>
            ) : (
              // Success State
              employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">
                    <Link
                      to={`/directory/${employee.id}`}
                      className="hover:underline">
                      {employee.name}
                    </Link>
                  </TableCell>
                  <TableCell>{employee.role}</TableCell>
                  <TableCell>{employee.department}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        employee.status === 'Active' ? 'default' : 'secondary'
                      }>
                      {employee.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="w-[200px]">
                    <div className="flex items-center gap-2">
                      <Progress value={employee.progress} className="h-2" />
                      <span className="text-xs text-muted-foreground w-8">
                        {employee.progress}%
                      </span>
                    </div>
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