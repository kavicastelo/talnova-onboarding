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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '../components/Dialog';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { SimplePagination } from '../components/SimplePagination';
import { usePagination } from '../hooks/usePagination';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { ApiResponse } from '../types';
import { CertificateRenderer } from '../components/certificates/CertificateRenderer';

export function Certificates() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { data: employee, isLoading: employeeLoading, isError, error, refetch } = useEmployee('me');
  const { data: settings } = useWorkspaceSettings();
  const [selectedCert, setSelectedCert] = useState<any>(null);

  // Fetch verified digital certificates from GET /api/v1/certificates/me
  const { data: myCertsData, isLoading: myCertsLoading } = useQuery({
    queryKey: ['myCertificates'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<{ certificates: any[] }>>('/certificates/me');
      return res.data?.data?.certificates || [];
    },
  });

  const isLoading = userLoading || employeeLoading || myCertsLoading;

  // Merge digital certificates from backend API with local assigned journeys
  const completedJourneys = useMemo(() => {
    const apiCerts = (myCertsData || []).map((c: any) => ({
      id: c.id || c._id,
      title: c.journeyTitle || 'Employee Onboarding Journey',
      status: 'Completed',
      assignedAt: c.issueDate ? new Date(c.issueDate).toLocaleDateString() : new Date().toLocaleDateString(),
      completionDate: c.completionDate ? new Date(c.completionDate).toLocaleDateString() : new Date().toLocaleDateString(),
      recipientName: c.recipientName,
      organizationName: c.organizationName,
      certificate: {
        issued: true,
        issuedAt: c.issueDate,
        certificateId: c.certificateNumber || c.certificateId || c.id,
        sha256Signature: c.sha256Signature,
      },
    }));

    const localCompleted = (employee?.assignedJourneys || []).filter(
      (j) => j.status === 'Completed' && j.certificate?.issued && !apiCerts.some((c: any) => c.id === j.id || c.certificate.certificateId === j.certificate?.certificateId)
    );

    return [...apiCerts, ...localCompleted];
  }, [myCertsData, employee?.assignedJourneys]);

  const certsPagination = usePagination({ data: completedJourneys, initialPageSize: 6 });

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
                    id="view-cert-modal-btn"
                  >
                    <ExternalLink className="mr-2 h-3.5 w-3.5" /> View & Download Certificate
                  </Button>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      id="verify-public-link-btn"
                      className="text-xs text-indigo-600 hover:text-indigo-700"
                    >
                      <Link to={`/public/certificate/${journey.id}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Verify Public Link
                      </Link>
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
        <DialogContent className="max-w-full sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white border border-border">
          <DialogHeader className="sr-only">
            <DialogTitle>View Certificate</DialogTitle>
          </DialogHeader>
          
          <DialogBody className="p-2 sm:p-4">
            {/* Unified Certificate Renderer with 6 Templates & Themes */}
            {selectedCert && (
              <div id="certificate-print-area" className="w-full">
                <CertificateRenderer
                  template={settings?.certificate?.template || 'classic'}
                  theme={(settings?.certificate?.theme as any) || 'light'}
                  accentColor={settings?.certificate?.accentColor}
                  badgeStyle={(settings?.certificate?.badgeStyle as any) || 'medal'}
                  recipientName={selectedCert?.recipientName || employee?.name || user?.name || 'Jane Doe'}
                  organizationName={selectedCert?.organizationName || settings?.orgName || 'Talnova'}
                  logoUrl={settings?.logoUrl}
                  journeyTitle={selectedCert?.title || 'General Onboarding'}
                  issuedAt={selectedCert?.completionDate || selectedCert?.assignedAt}
                  certificateId={selectedCert?.certificate?.certificateId || selectedCert?.id}
                  signatoryName={settings?.certificate?.signatoryName}
                  signatoryTitle={settings?.certificate?.signatoryTitle}
                  signatureUrl={settings?.certificate?.signatureUrl}
                  qrCode={true}
                />
              </div>
            )}
          </DialogBody>

          <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center p-4 bg-muted border-t">
            <div className="flex flex-col sm:flex-row gap-2">
              <Button asChild variant="outline" size="sm" id="modal-verify-public-link-btn" className="gap-1.5 justify-center text-xs">
                <Link to={`/public/certificate/${selectedCert?.id}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" /> Verify Public Link
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 justify-center text-xs" onClick={() => handleShareLinkedIn(selectedCert.id)}>
                <Linkedin className="h-3.5 w-3.5 text-[#0A66C2] fill-[#0A66C2]" /> Share on LinkedIn
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" size="sm" className="justify-center" onClick={() => setSelectedCert(null)}>
                Close
              </Button>
              <Button size="sm" id="download-print-cert-btn" className="justify-center" onClick={handlePrint}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> Download / Print Certificate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
