import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowLeft,
  PenTool,
  History,
  Lock,
  Hash
} from 'lucide-react';
import { useDocumentAssignment, useSignDocument } from '../hooks/useDocuments';
import { SignatureCanvas } from '../components/SignatureCanvas';
import { Button } from '../components/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/Card';
import { Badge } from '../components/Badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '../components/Dialog';
import { toast } from 'sonner';

export const DocumentSigner: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  const { data: document, isLoading, refetch } = useDocumentAssignment(id || null);
  const signMutation = useSignDocument();

  if (isLoading) {
    return <div className="p-12 text-center text-muted-foreground">Loading document...</div>;
  }

  if (!document) {
    return (
      <div className="p-12 text-center space-y-4">
        <p className="text-muted-foreground">Document assignment not found.</p>
        <Button onClick={() => navigate('/documents')}>Back to Documents</Button>
      </div>
    );
  }

  const isSigned = document.status === 'signed';

  const handleSignatureSubmit = (payload: { type: 'draw' | 'type'; signatureDataUrl?: string; signerName: string }) => {
    if (!id) return;
    signMutation.mutate(
      { id, payload },
      {
        onSuccess: (res) => {
          toast.success(res.signatureData?.sha256Hash ? 'E-Signature verified & recorded!' : 'Document signed!');
          setIsSignModalOpen(false);
          refetch();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to apply e-signature');
        }
      }
    );
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Back Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/documents')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Documents
        </Button>
        <Button variant="outline" size="sm" onClick={() => setIsAuditModalOpen(true)}>
          <History className="h-4 w-4 mr-1.5" /> Audit Trail & Checksum
        </Button>
      </div>

      {/* Main Document Card */}
      <Card className="border-t-4 border-t-indigo-600 shadow-sm">
        <CardHeader className="border-b pb-4 bg-muted/10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl font-bold">{document.templateTitle}</CardTitle>
                <Badge variant="outline" className="text-xs">
                  v{document.templateVersion}
                </Badge>
              </div>
              <CardDescription className="text-xs mt-1">
                Assigned on {new Date(document.assignedAt).toLocaleDateString()}
              </CardDescription>
            </div>

            {isSigned ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 px-3 py-1 text-xs flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Verified & Signed
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 px-3 py-1 text-xs flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> Signature Required
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-8 space-y-8">
          {/* Document Content Box */}
          <div className="prose max-w-none text-sm leading-relaxed p-6 border rounded-lg bg-white shadow-inner min-h-[250px] whitespace-pre-wrap font-sans text-slate-800">
            {document.renderedContent || 'No document content available.'}
          </div>

          {/* Signature Status Box */}
          {isSigned && document.signatureData ? (
            <div className="p-6 border-2 border-emerald-500/30 rounded-xl bg-emerald-50/20 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
                  <ShieldCheck className="h-5 w-5" /> Electronic Signature Verified
                </div>
                <div className="text-xs text-muted-foreground">
                  Signed on {new Date(document.signatureData.signedAt).toLocaleString()}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground block">Signer Legal Name:</span>
                  <span className="font-semibold text-slate-800 text-sm">{document.signatureData.signerName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">IP Address:</span>
                  <span className="font-mono text-slate-800">{document.signatureData.ipAddress || 'Verified'}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground block flex items-center gap-1">
                    <Hash className="h-3.5 w-3.5" /> SHA-256 Checksum Hash:
                  </span>
                  <span className="font-mono text-[11px] text-slate-700 break-all bg-muted/40 p-1.5 rounded block mt-1">
                    {document.signatureData.sha256Hash}
                  </span>
                </div>
              </div>

              {document.signatureData.signatureDataUrl && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground text-xs block mb-1">Signature Image:</span>
                  <img
                    src={document.signatureData.signatureDataUrl}
                    alt="E-Signature"
                    className="h-14 object-contain bg-white p-2 border rounded"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 border-2 border-dashed border-indigo-200 rounded-xl bg-indigo-50/10 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <PenTool className="h-4 w-4 text-indigo-600" /> E-Signature Required
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  By clicking below, you acknowledge and accept the terms of this document electronically.
                </p>
              </div>
              <Button
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                onClick={() => setIsSignModalOpen(true)}
              >
                Sign Document Now
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Signature Capture Modal */}
      <Dialog open={isSignModalOpen} onOpenChange={setIsSignModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5 text-indigo-600" /> Apply Electronic Signature
            </DialogTitle>
            <DialogDescription>
              Draw or type your signature below. A cryptographic SHA-256 checksum and IP timestamp will be generated.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <SignatureCanvas onSave={handleSignatureSubmit} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Audit Trail Modal */}
      <Dialog open={isAuditModalOpen} onOpenChange={setIsAuditModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-indigo-600" /> Document Audit Trail & Logs
            </DialogTitle>
            <DialogDescription>
              Cryptographic verification history for "{document.templateTitle}".
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 max-h-[300px] overflow-y-auto">
            {document.auditTrail.map((log, idx) => (
              <div key={idx} className="p-3 border rounded-lg bg-card text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <Badge variant="outline" className="capitalize font-semibold text-[10px]">
                    {log.action}
                  </Badge>
                  <span className="text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</span>
                </div>
                {log.details && <p className="text-slate-700 font-medium">{log.details}</p>}
                {log.ipAddress && <p className="text-muted-foreground font-mono text-[10px]">IP: {log.ipAddress}</p>}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAuditModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentSigner;
