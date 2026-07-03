import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '../components/Card';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { Award, Download, ExternalLink, Calendar, ShieldCheck, AlertCircle, RefreshCw, Linkedin, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEmployee } from '../hooks/useEmployees';
import { useCurrentUser } from '../hooks/useAuth';
import { useWorkspaceSettings } from '../hooks/useSettings';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/Dialog';
import { useState } from 'react';
import { toast } from 'sonner';

export function Certificates() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { data: employee, isLoading: employeeLoading, isError, error, refetch } = useEmployee('me');
  const { data: settings } = useWorkspaceSettings();
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

  // Handle "No Certificates Found" message state if the employee has no assignments or completed training
  const completedJourneys = employee?.assignedJourneys?.filter(
    j => j.status === 'Completed' && j.certificate?.issued
  ) || [];

  if (isError) {
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

  const handlePrint = () => {
    window.print();
  };

  const handleShareLinkedIn = (journeyId: string) => {
    const publicUrl = `${window.location.origin}/public/certificate/${journeyId}`;
    const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(publicUrl)}`;
    window.open(shareUrl, '_blank');
    toast.success('LinkedIn sharing link opened!');
  };

  const handleCopyLink = (journeyId: string) => {
    const publicUrl = `${window.location.origin}/public/certificate/${journeyId}`;
    navigator.clipboard.writeText(publicUrl);
    toast.success('Certificate link copied to clipboard!');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Certificates</h1>
          <p className="text-muted-foreground">
            View, download, and share verified digital credentials for onboarding journeys you completed.
          </p>
        </div>
      </div>

      {completedJourneys.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {completedJourneys.map((journey) => (
            <Card key={journey.id} className="relative overflow-hidden group hover:border-primary/50 transition-all shadow-sm flex flex-col justify-between">
              <div>
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
                <CardContent className="pt-2 flex flex-col gap-1">
                  <div className="text-xs text-muted-foreground">
                    Recipient: <span className="font-semibold text-foreground">{employee?.name || user?.name || 'Jane Doe'}</span>
                  </div>
                  {journey.certificate?.certificateId && (
                    <div className="text-xs text-muted-foreground">
                      ID: <span className="font-mono">{journey.certificate.certificateId.slice(-12)}</span>
                    </div>
                  )}
                </CardContent>
              </div>
              <CardContent className="pt-4 border-t bg-slate-50/50 dark:bg-slate-900/20 flex flex-col gap-2 mt-auto">
                <div className="flex gap-2">
                  <Button variant="default" className="flex-1" size="sm" onClick={() => setSelectedCert(journey)}>
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleShareLinkedIn(journey.id)} title="Share on LinkedIn">
                    <Linkedin className="h-3.5 w-3.5 text-[#0A66C2] fill-[#0A66C2]" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleCopyLink(journey.id)} title="Copy verification link">
                    <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
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
          <CardTitle className="text-xl">No Certificates Found</CardTitle>
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
          
          {/* Certificate Board */}
          <div className="p-8 md:p-12 text-center border-8 border-double border-primary/20 m-4 bg-white text-slate-800 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute -top-16 -left-16 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
            <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />

            <div className="flex justify-between items-center border-b pb-6 mb-6">
              {/* Top Left: Company Logo */}
              <div className="h-10 flex items-center">
                {settings?.logoUrl ? (
                  <img src={settings.logoUrl} alt={settings.orgName} className="h-8 object-contain" />
                ) : (
                  <div className="flex items-center gap-1.5 border px-2 py-1 rounded bg-slate-50">
                    <div className="w-5 h-5 rounded bg-primary text-primary-foreground font-bold flex items-center justify-center text-[10px]">
                      {settings?.orgName ? settings.orgName.charAt(0).toUpperCase() : 'T'}
                    </div>
                    <span className="font-semibold text-xs tracking-tight text-slate-800">{settings?.orgName || 'Talnova'}</span>
                  </div>
                )}
              </div>

              {/* Top Right: Talnova Logo */}
              <div className="h-10 flex items-center">
                <img src="/assets/images/talnova-long-black.png" alt="Talnova Logo" className="h-6 object-contain" />
              </div>
            </div>

            <div className="flex justify-center mb-4">
              <Award className="h-16 w-16 text-primary" />
            </div>
            
            <h2 className="text-xs font-semibold tracking-widest text-primary uppercase mb-1.5 font-mono">
              Certificate of Completion
            </h2>
            <div className="h-0.5 w-16 bg-primary/30 mx-auto mb-4" />
            <p className="italic text-muted-foreground text-xs font-serif mb-3">
              This credential is proudly presented to
            </p>
            <h3 className="text-2xl font-bold font-serif tracking-tight text-slate-900 mb-4">
              {employee?.name || user?.name || 'Jane Doe'}
            </h3>
            <p className="text-slate-500 text-xs max-w-md mx-auto mb-4 font-serif leading-relaxed">
              for successfully finishing all lessons, tasks, and evaluations in the onboarding journey
            </p>
            <h4 className="text-lg font-bold text-slate-900 mb-6 border-b border-dashed pb-3 max-w-md mx-auto">
              {selectedCert?.title || 'General Onboarding'}
            </h4>
            
            <div className="flex justify-between items-center max-w-sm mx-auto text-[10px] text-muted-foreground font-mono pt-2">
              <div>
                <p className="font-semibold text-slate-700">DATE</p>
                <p>{selectedCert?.assignedAt || 'June 2026'}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-700">CREDENTIAL ID</p>
                <p className="uppercase">{selectedCert?.certificate?.certificateId?.slice(-12) || selectedCert?.id?.slice(-12) || 'ONB123'}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center p-4 bg-muted border-t">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleShareLinkedIn(selectedCert.id)}>
                <Linkedin className="h-3.5 w-3.5 text-[#0A66C2] fill-[#0A66C2]" /> Share on LinkedIn
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleCopyLink(selectedCert.id)}>
                <ExternalLink className="h-3.5 w-3.5" /> Copy Link
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedCert(null)}>
                Close
              </Button>
              <Button size="sm" onClick={handlePrint}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> Save / Print
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
