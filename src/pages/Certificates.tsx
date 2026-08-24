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
import { SimplePagination } from '../components/SimplePagination';
import { usePagination } from '../hooks/usePagination';

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

  const certsPagination = usePagination({ data: completedJourneys, initialPageSize: 6 });

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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My Certificates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View, download, and share verified digital credentials for onboarding journeys you completed.
          </p>
        </div>
      </div>

      {completedJourneys.length > 0 ? (
        <div className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {certsPagination.paginatedData.map((journey) => (
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
                    <CardDescription className="flex items-center gap-1 mt-1 text-xs">
                      <Calendar className="h-3.5 w-3.5" />
                      Issued: {journey.certificate?.issuedAt ? new Date(journey.certificate.issuedAt).toLocaleDateString() : 'N/A'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-xs text-muted-foreground flex justify-between border-t pt-3">
                      <span>Credential ID:</span>
                      <span className="font-mono text-foreground font-medium">{journey.certificate?.certificateId || journey.id.slice(0, 8)}</span>
                    </div>
                  </CardContent>
                </div>

                <div className="p-6 pt-0 space-y-2">
                  <Button
                    onClick={() => setSelectedCert(journey)}
                    className="w-full text-xs font-medium"
                  >
                    <ExternalLink className="mr-2 h-3.5 w-3.5" /> View & Download Certificate
                  </Button>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs text-indigo-600 hover:text-indigo-700"
                      onClick={() => handleShareLinkedIn(journey.id)}
                    >
                      <Linkedin className="mr-1.5 h-3.5 w-3.5" /> Share
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleCopyLink(journey.id)}
                    >
                      <Share2 className="mr-1.5 h-3.5 w-3.5" /> Copy Link
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <SimplePagination
            currentPage={certsPagination.page}
            totalPages={certsPagination.totalPages}
            totalItems={certsPagination.totalItems}
            startIndex={certsPagination.startIndex}
            endIndex={certsPagination.endIndex}
            pageSize={certsPagination.pageSize}
            onPageChange={certsPagination.setPage}
            onPageSizeChange={certsPagination.setPageSize}
            itemLabel="certificates"
          />
        </div>
      ) : (
        <Card className="flex flex-col items-center justify-center p-12 text-center my-8 border-dashed">
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
        <DialogContent className="max-w-full sm:max-w-2xl p-0 overflow-y-auto max-h-[90vh] bg-white border border-border">
          <DialogHeader className="sr-only">
            <DialogTitle>View Certificate</DialogTitle>
          </DialogHeader>
          
          {/* Certificate Board */}
          {(!settings?.certificate || settings.certificate.template === 'classic') && (
            <div className="p-4 sm:p-8 md:p-12 text-center border-4 sm:border-8 border-double border-yellow-800/40 m-2 sm:m-4 bg-white text-slate-800 relative overflow-hidden flex flex-col justify-between min-h-[480px]">
              {/* Background elements */}
              <div className="absolute -top-16 -left-16 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
              <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />

              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-yellow-800/20 pb-4 mb-4">
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

              <div className="flex justify-center mb-2">
                <Award className="h-10 w-10 text-primary" />
              </div>
              
              <h2 className="text-[10px] sm:text-xs font-semibold tracking-widest text-primary uppercase mb-1 font-mono">
                Certificate of Completion
              </h2>
              <p className="italic text-muted-foreground text-[10px] sm:text-xs font-serif mb-2">
                This credential is proudly presented to
              </p>
              <h3 className="text-xl font-bold font-serif tracking-tight text-slate-900 mb-2">
                {employee?.name || user?.name || 'Jane Doe'}
              </h3>
              <p className="text-slate-500 text-[10px] sm:text-xs max-w-md mx-auto mb-2 font-serif leading-relaxed">
                for successfully finishing all lessons, tasks, and evaluations in the onboarding journey
              </p>
              <h4 className="text-sm font-bold text-slate-900 mb-4 border-b border-dashed pb-2 max-w-md mx-auto">
                {selectedCert?.title || 'General Onboarding'}
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[9px] text-muted-foreground font-mono pt-4 border-t border-yellow-800/20 items-end">
                <div className="text-left">
                  <p className="font-semibold text-slate-700">DATE</p>
                  <p>{selectedCert?.assignedAt || 'June 2026'}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-700">CREDENTIAL ID</p>
                  <p className="uppercase">{selectedCert?.certificate?.certificateId?.slice(-12) || selectedCert?.id?.slice(-12) || 'ONB123'}</p>
                </div>
                <div className="text-right flex flex-col items-center sm:items-end">
                  {settings?.certificate?.signatureUrl ? (
                    <img src={settings.certificate.signatureUrl} alt="Signature" className="h-6 object-contain mb-1" />
                  ) : (
                    <div className="h-6" />
                  )}
                  <p className="font-semibold text-slate-800">{settings?.certificate?.signatoryName || 'Talnova Admin'}</p>
                  <p className="text-[8px] text-slate-500">{settings?.certificate?.signatoryTitle || 'Authorized Representative'}</p>
                </div>
              </div>
            </div>
          )}

          {settings?.certificate?.template === 'modern' && (
            <div className="p-4 sm:p-8 md:p-12 text-slate-150 m-2 sm:m-4 bg-[#0c101d] rounded-2xl shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[480px] border border-white/10">
              <div className="absolute top-0 left-0 w-24 h-24 bg-gradient-to-br from-primary/30 to-transparent rounded-br-full" />
              
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 z-10 border-b border-white/10 pb-4 mb-4">
                <div className="h-10 flex items-center">
                  {settings?.logoUrl ? (
                    <img src={settings.logoUrl} alt={settings.orgName} className="h-8 object-contain" />
                  ) : (
                    <div className="flex items-center gap-1.5 border border-white/10 px-2 py-1 rounded bg-white/5">
                      <div className="w-5 h-5 rounded bg-primary text-primary-foreground font-bold flex items-center justify-center text-[10px]">
                        {settings?.orgName ? settings.orgName.charAt(0).toUpperCase() : 'T'}
                      </div>
                      <span className="font-semibold text-xs tracking-tight text-white">{settings?.orgName || 'Talnova'}</span>
                    </div>
                  )}
                </div>
                <div className="h-10 flex items-center">
                  <img src="/assets/images/talnova-long-black.png" alt="Talnova Logo" className="h-6 invert object-contain" />
                </div>
              </div>

              <div className="my-2 text-left space-y-2 z-10">
                <span className="text-[8px] font-mono tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full font-semibold uppercase">Verification Credential</span>
                <h1 className="text-lg font-extrabold text-white tracking-tight mt-2">CERTIFICATE OF COMPLETION</h1>
                <div>
                  <p className="text-[9px] text-slate-400">Awarded to:</p>
                  <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-indigo-400 tracking-tight mt-0.5">
                    {employee?.name || user?.name || 'Jane Doe'}
                  </h2>
                </div>
                <p className="text-slate-400 text-[10px]">
                  For the successful review, study, and completion of all lessons, quizzes, and standard practices of:
                  <span className="block text-xs font-semibold text-white mt-0.5">{selectedCert?.title || 'General Onboarding'}</span>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[9px] font-mono pt-4 border-t border-white/10 z-10 items-end">
                <div>
                  <p className="text-slate-500">ISSUED ON</p>
                  <p className="text-white">{selectedCert?.assignedAt || 'June 2026'}</p>
                </div>
                <div>
                  <p className="text-slate-500">CREDENTIAL ID</p>
                  <p className="text-white uppercase">{selectedCert?.certificate?.certificateId?.slice(-12) || selectedCert?.id?.slice(-12) || 'ONB123'}</p>
                </div>
                <div className="text-right flex flex-col items-end">
                  {settings?.certificate?.signatureUrl ? (
                    <img src={settings.certificate.signatureUrl} alt="Signature" className="h-6 object-contain mb-1 brightness-200" />
                  ) : (
                    <div className="h-6" />
                  )}
                  <p className="font-semibold text-white">{settings?.certificate?.signatoryName || 'Talnova Admin'}</p>
                  <p className="text-slate-400 text-[8px]">{settings?.certificate?.signatoryTitle || 'Authorized Representative'}</p>
                </div>
              </div>
            </div>
          )}

          {settings?.certificate?.template === 'minimalist' && (
            <div className="p-4 sm:p-8 md:p-12 text-slate-800 dark:text-slate-200 m-2 sm:m-4 bg-white dark:bg-slate-950 rounded-2xl shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[480px] border border-slate-200 dark:border-white/10">
              <div className="flex justify-between items-center border-b pb-4 mb-4 border-slate-100 dark:border-white/5">
                <div className="h-8 flex items-center">
                  {settings?.logoUrl ? (
                    <img src={settings.logoUrl} alt={settings.orgName} className="h-6 object-contain" />
                  ) : (
                    <span className="font-semibold text-[10px] tracking-widest uppercase">{settings?.orgName || 'Talnova'}</span>
                  )}
                </div>
                <span className="text-[8px] tracking-widest text-slate-400 font-mono">ATTESTATION</span>
              </div>

              <div className="my-4 text-center space-y-2">
                <p className="text-[8px] uppercase tracking-widest text-slate-400 font-mono">This is to certify that</p>
                <h2 className="text-2xl font-light text-slate-900 dark:text-white my-1 tracking-wide">
                  {employee?.name || user?.name || 'Jane Doe'}
                </h2>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                  has successfully fulfilled all course requirements and assessments for the onboarding learning path:
                </p>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 font-mono uppercase tracking-wider">
                  {selectedCert?.title || 'General Onboarding'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[9px] font-mono pt-4 border-t border-slate-100 dark:border-white/5 items-end">
                <div className="text-left">
                  <p className="text-slate-400">ISSUED ON</p>
                  <p className="text-slate-805 dark:text-slate-200">{selectedCert?.assignedAt || 'June 2026'}</p>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-slate-400">CREDENTIAL ID</p>
                  <p className="text-slate-805 dark:text-slate-200 uppercase">{selectedCert?.certificate?.certificateId?.slice(-12) || selectedCert?.id?.slice(-12) || 'ONB123'}</p>
                </div>
                <div className="text-right flex flex-col items-end">
                  {settings?.certificate?.signatureUrl ? (
                    <img src={settings.certificate.signatureUrl} alt="Signature" className="h-6 object-contain mb-1 dark:brightness-200" />
                  ) : (
                    <div className="h-6" />
                  )}
                  <p className="font-semibold text-slate-805 dark:text-slate-200">{settings?.certificate?.signatoryName || 'Talnova Admin'}</p>
                  <p className="text-slate-450 text-[8px]">{settings?.certificate?.signatoryTitle || 'Authorized Representative'}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center p-4 bg-muted border-t">
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 justify-center" onClick={() => handleShareLinkedIn(selectedCert.id)}>
                <Linkedin className="h-3.5 w-3.5 text-[#0A66C2] fill-[#0A66C2]" /> Share on LinkedIn
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 justify-center" onClick={() => handleCopyLink(selectedCert.id)}>
                <ExternalLink className="h-3.5 w-3.5" /> Copy Link
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" size="sm" className="justify-center" onClick={() => setSelectedCert(null)}>
                Close
              </Button>
              <Button size="sm" className="justify-center" onClick={handlePrint}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> Save / Print
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
