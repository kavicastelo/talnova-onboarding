import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { certificateService, PublicCertificate } from '../services/certificate.service';
import { Award, ShieldCheck, Linkedin, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../components/Button';

export function PublicCertificateViewer() {
  const { id } = useParams<{ id: string }>();
  const [cert, setCert] = useState<PublicCertificate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    certificateService.verifyCertificate(id)
      .then((data) => {
        setCert(data);
        if (data.branding?.primaryColor) {
          document.documentElement.style.setProperty('--primary', data.branding.primaryColor);
        }
      })
      .catch((err) => {
        setError(err?.response?.data?.message || err?.message || 'No certificates found');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  const handleShareLinkedIn = () => {
    const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`;
    window.open(shareUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">Verifying digital credential...</p>
        </div>
      </div>
    );
  }

  if (error || !cert) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <div className="max-w-md w-full text-center p-8 bg-white dark:bg-slate-800 border rounded-xl shadow-sm space-y-6">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight">No Certificates Found</h2>
            <p className="text-muted-foreground text-sm">
              The requested certificate could not be found, or it may have been revoked.
            </p>
          </div>
          <Button asChild className="w-full">
            <Link to="/login">Go to Talnova Onboarding</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 py-12">
      <style>{`
        @media print {
          html, body {
            background-color: #fff !important;
            color: #000 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-hide {
            display: none !important;
          }
          .print-container {
            border: 4px double rgba(0, 0, 0, 0.15) !important;
            box-shadow: none !important;
            background: #fff !important;
            color: #000 !important;
            margin: 0 auto !important;
            padding: 2rem !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: 100% !important;
            position: relative !important;
          }
          @page {
            size: landscape;
            margin: 10mm;
          }
        }
      `}</style>

      {/* Verification Badge */}
      <div className="flex items-center gap-2 mb-8 bg-green-500/10 text-green-600 dark:text-green-400 px-4 py-2 rounded-full border border-green-500/20 text-xs font-semibold uppercase tracking-wider print-hide">
        <ShieldCheck className="h-4 w-4" /> Verified Digital Credential
      </div>

      {/* Modern Certificate Container */}
      <div className="max-w-4xl w-full bg-white dark:bg-slate-900 border-8 border-double border-primary/20 rounded-2xl shadow-xl p-8 md:p-16 relative overflow-hidden flex flex-col justify-between min-h-[500px] print-container">
        {/* Decorative corner background graphics */}
        <div className="absolute -top-16 -left-16 w-32 h-32 bg-primary/5 rounded-full blur-2xl animate-pulse print-hide" />
        <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-primary/5 rounded-full blur-2xl animate-pulse print-hide" />

        {/* Certificate Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b pb-8">
          {/* Top Left: Company Logo */}
          <div className="h-12 flex items-center">
            {cert.branding.logoUrl ? (
              <img src={cert.branding.logoUrl} alt={cert.branding.orgName} className="h-10 object-contain" />
            ) : (
              <div className="flex items-center gap-2 border px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800">
                <div className="w-6 h-6 rounded bg-primary text-primary-foreground font-bold flex items-center justify-center text-xs">
                  {cert.branding.orgName.charAt(0).toUpperCase()}
                </div>
                <span className="font-semibold text-sm tracking-tight text-slate-800 dark:text-slate-200">{cert.branding.orgName}</span>
              </div>
            )}
          </div>

          {/* Top Right: Talnova Logo */}
          <div className="h-12 flex items-center">
            <img src="/assets/images/talnova-long-black.png" alt="Talnova Logo" className="h-8 dark:invert object-contain" />
          </div>
        </div>

        {/* Certificate Body Content */}
        <div className="my-10 text-center space-y-6">
          <div className="inline-flex p-3 bg-primary/10 rounded-full text-primary mb-2 print-hide">
            <Award className="h-10 w-10" />
          </div>
          
          <h1 className="text-sm font-semibold tracking-widest text-primary uppercase font-mono">
            Certificate of Completion
          </h1>
          
          <p className="italic text-muted-foreground text-sm font-serif">
            This credential is proudly presented to
          </p>
          
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight font-serif">
            {cert.recipientName}
          </h2>
          
          <p className="text-slate-600 dark:text-slate-400 text-sm max-w-lg mx-auto font-serif leading-relaxed">
            for successfully completing all curriculum requirements, lessons, and assessments in the onboarding journey
          </p>
          
          <h3 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-200 pt-2 pb-1 max-w-xl mx-auto border-b border-dashed border-slate-200 dark:border-slate-800">
            {cert.journeyTitle}
          </h3>
        </div>

        {/* Certificate Footer */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-muted-foreground font-mono pt-8 border-t mt-4">
          <div className="text-center sm:text-left">
            <p className="font-bold text-slate-700 dark:text-slate-400">ISSUED DATE</p>
            <p>{new Date(cert.issuedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="text-center sm:text-right">
            <p className="font-bold text-slate-700 dark:text-slate-400">CREDENTIAL ID</p>
            <p className="uppercase">{cert.certificateId.slice(-12)}</p>
          </div>
        </div>
      </div>

      {/* Share / Actions bar */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full max-w-4xl justify-center items-center print-hide">
        <Button onClick={handleShareLinkedIn} className="gap-2 bg-[#0A66C2] hover:bg-[#004182] text-white">
          <Linkedin className="h-4 w-4 fill-white" /> Share on LinkedIn
        </Button>
        <Button variant="outline" onClick={() => window.print()} className="gap-2">
          Share / Print Local Copy
        </Button>
      </div>
    </div>
  );
}
