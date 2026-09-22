import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { certificateService, PublicCertificate } from '../services/certificate.service';
import { ShieldCheck, Linkedin, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../components/Button';
import { CertificateRenderer } from '../components/certificates/CertificateRenderer';

export function PublicCertificateViewer() {
  const { t } = useTranslation(['journeys', 'common']);
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
        setError(err?.response?.data?.message || err?.message || t('certificates.publicViewer.notFound', 'No certificates found'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, t]);

  const handleShareLinkedIn = () => {
    const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`;
    window.open(shareUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">{t('certificates.publicViewer.verifying', 'Verifying digital credential...')}</p>
        </div>
      </div>
    );
  }

  if (error || !cert) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <div data-testid="invalid-credential-alert" className="max-w-md w-full text-center p-8 bg-white dark:bg-slate-800 border border-rose-500/20 rounded-xl shadow-sm space-y-6">
          <div className="h-14 w-14 rounded-full bg-rose-500/10 text-rose-500 mx-auto flex items-center justify-center">
            <AlertCircle className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              {t('certificates.publicViewer.invalidTitle', 'Invalid or Revoked Credential')}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t('certificates.publicViewer.invalidDesc', 'The requested certificate could not be found, or it may have been revoked by the issuing organization.')}
            </p>
          </div>
          <Button asChild className="w-full">
            <Link to="/login">{t('certificates.publicViewer.goToOnboarding', 'Go to Talnova Onboarding')}</Link>
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
      <div
        id="verified-authentic-badge"
        data-testid="verified-authentic-badge"
        className="flex items-center gap-2 mb-8 bg-green-500/10 text-green-600 dark:text-green-400 px-4 py-2 rounded-full border border-green-500/20 text-xs font-semibold uppercase tracking-wider print-hide"
      >
        <ShieldCheck className="h-4 w-4 text-green-500" /> {t('certificates.publicViewer.verifiedAuthentic', 'Verified Authentic Credential')}
      </div>

      {/* Certificate Rendering Container */}
      <div className="max-w-4xl w-full relative print-container">
        <CertificateRenderer
          template={cert.certificate?.template || 'classic'}
          theme={(cert.certificate?.theme as any) || 'light'}
          accentColor={cert.certificate?.accentColor || cert.branding?.primaryColor}
          badgeStyle={(cert.certificate?.badgeStyle as any) || 'medal'}
          recipientName={cert.recipientName}
          organizationName={cert.branding.orgName}
          logoUrl={cert.branding.logoUrl}
          journeyTitle={cert.journeyTitle}
          issuedAt={cert.issuedAt}
          certificateId={cert.certificateId}
          signatoryName={cert.certificate?.signatoryName}
          signatoryTitle={cert.certificate?.signatoryTitle}
          signatureUrl={cert.certificate?.signatureUrl}
          qrCode={true}
        />
      </div>

      {/* Share / Actions bar */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full max-w-4xl justify-center items-center print-hide">
        <Button onClick={handleShareLinkedIn} className="gap-2 bg-[#0A66C2] hover:bg-[#004182] text-white">
          <Linkedin className="h-4 w-4 fill-white" /> {t('certificates.shareLinkedIn', 'Share on LinkedIn')}
        </Button>
        <Button variant="outline" onClick={() => window.print()} className="gap-2">
          {t('certificates.publicViewer.printLocalCopy', 'Share / Print Local Copy')}
        </Button>
      </div>
    </div>
  );
}

export default PublicCertificateViewer;
