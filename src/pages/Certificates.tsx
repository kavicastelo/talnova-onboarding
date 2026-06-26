import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '../components/Card';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { Award, Download, ExternalLink, Calendar, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEmployee } from '../hooks/useEmployees';
import { useCurrentUser } from '../hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/Dialog';
import { useState } from 'react';

export function Certificates() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { data: employee, isLoading: employeeLoading, isError, error, refetch } = useEmployee('1');
  const [selectedCert, setSelectedCert] = useState<any>(null);

  const isLoading = userLoading || employeeLoading;

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-48">
              <CardHeader className="space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-10 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !employee) {
    return (
      <div className="max-w-md mx-auto text-center p-8 border rounded-lg space-y-4 my-12">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold">Failed to Load Certificates</h2>
        <p className="text-muted-foreground">{(error as any)?.message || 'Your certificates could not be loaded.'}</p>
        <Button onClick={() => refetch()} className="mx-auto">
          <RefreshCw className="mr-2 h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  // Find completed journeys.
  const completedJourneys = employee.assignedJourneys?.filter(j => j.status === 'Completed') || [];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Certificates</h1>
        <p className="text-muted-foreground">
          View and download credentials for onboarding journeys you completed.
        </p>
      </div>

      {completedJourneys.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {completedJourneys.map((journey) => (
            <Card key={journey.id} className="relative overflow-hidden group hover:border-primary/50 transition-all shadow-sm">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full flex items-start justify-end p-4">
                <Award className="h-8 w-8 text-primary/40 group-hover:text-primary transition-colors" />
              </div>
              <CardHeader className="pb-3">
                <span className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <ShieldCheck className="h-4 w-4" /> Verified Credential
                </span>
                <CardTitle className="text-lg leading-snug group-hover:text-primary transition-colors">
                  {journey.title}
                </CardTitle>
                <CardDescription className="flex items-center gap-1 text-xs mt-1">
                  <Calendar className="h-3.5 w-3.5" /> Completed {journey.assignedAt}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2 flex flex-col gap-3">
                <div className="text-xs text-muted-foreground">
                  Recipient: <span className="font-semibold text-foreground">{user?.name || 'Jane Doe'}</span>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button variant="default" className="flex-1" size="sm" onClick={() => setSelectedCert(journey)}>
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSelectedCert(journey)}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Award className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">No Certificates Yet</CardTitle>
          <CardDescription className="max-w-md mt-2">
            Finish any of your assigned training or onboarding journeys to receive a verified completion certificate.
          </CardDescription>
          <Button className="mt-6" asChild>
            <Link to="/employee">Go to Dashboard</Link>
          </Button>
        </Card>
      )}

      {/* Certificate Viewer Modal */}
      <Dialog open={!!selectedCert} onOpenChange={() => setSelectedCert(null)}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-white border border-border">
          <DialogHeader className="sr-only">
            <DialogTitle>View Certificate</DialogTitle>
          </DialogHeader>
          <div className="p-8 md:p-12 text-center border-8 border-double border-primary/20 m-4 bg-amber-50/20 text-slate-800">
            <div className="flex justify-center mb-6">
              <Award className="h-20 w-20 text-primary animate-pulse" />
            </div>
            <h2 className="text-sm font-semibold tracking-widest text-primary uppercase mb-2">
              Certificate of Completion
            </h2>
            <div className="h-0.5 w-24 bg-primary/30 mx-auto mb-6" />
            <p className="italic text-muted-foreground text-sm font-serif mb-4">
              This credential is proudly presented to
            </p>
            <h3 className="text-3xl font-bold font-serif tracking-tight text-slate-900 mb-6">
              {user?.name || 'Jane Doe'}
            </h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto mb-8 font-serif leading-relaxed">
              for successfully finishing all lessons, tasks, and evaluations in the onboarding journey
            </p>
            <h4 className="text-xl font-bold text-slate-900 mb-8 border-b-2 border-slate-200 pb-4 max-w-lg mx-auto">
              {selectedCert?.title || 'General Onboarding'}
            </h4>
            <div className="flex justify-between items-center max-w-md mx-auto text-xs text-muted-foreground font-mono pt-4">
              <div>
                <p className="font-semibold text-slate-700">DATE</p>
                <p>{selectedCert?.assignedAt || 'June 2026'}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-700">CREDENTIAL ID</p>
                <p className="uppercase">CERT-{selectedCert?.id || 'ONB123'}-VERIFIED</p>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 p-4 bg-muted border-t">
            <Button variant="outline" onClick={() => setSelectedCert(null)}>
              Close
            </Button>
            <Button onClick={handlePrint}>
              <Download className="mr-2 h-4 w-4" /> Save / Print Certificate
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
