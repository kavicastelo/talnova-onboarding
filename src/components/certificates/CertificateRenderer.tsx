import { useTranslation } from 'react-i18next';
import { Award, ShieldCheck, CheckCircle2, Shield, QrCode } from 'lucide-react';

export type CertificateTemplateId =
  | 'classic'
  | 'modern'
  | 'minimalist'
  | 'academic'
  | 'gradient'
  | 'executive';

export type CertificateTheme = 'light' | 'dark';

export type CertificateBadge = 'medal' | 'laurel' | 'shield' | 'crypto' | 'ribbon';

export type CertificateBorder = 'double' | 'solid' | 'engraved' | 'minimal' | 'tech';

export interface CertificateRendererProps {
  template?: CertificateTemplateId | string;
  theme?: CertificateTheme;
  accentColor?: string;
  badgeStyle?: CertificateBadge;
  borderStyle?: CertificateBorder;
  recipientName: string;
  organizationName: string;
  logoUrl?: string;
  journeyTitle: string;
  issuedAt?: string | Date;
  completionDate?: string | Date;
  certificateId?: string;
  signatoryName?: string;
  signatoryTitle?: string;
  signatureUrl?: string;
  qrCode?: boolean;
  className?: string;
}

export function CertificateRenderer({
  template = 'classic',
  theme = 'light',
  accentColor,
  badgeStyle = 'medal',
  recipientName,
  organizationName,
  logoUrl,
  journeyTitle,
  issuedAt,
  completionDate,
  certificateId = 'TLNV-ONB-001',
  signatoryName = 'Authorized Officer',
  signatoryTitle = 'Head of People & Operations',
  signatureUrl,
  qrCode = true,
  className = '',
}: CertificateRendererProps) {
  const { t } = useTranslation('documents');
  const normalizedTemplate: CertificateTemplateId =
    template === 'modern' ||
    template === 'minimalist' ||
    template === 'academic' ||
    template === 'gradient' ||
    template === 'executive'
      ? template
      : 'classic';

  const isDark = theme === 'dark';

  const effectiveDate = issuedAt || completionDate;
  const formattedDate = effectiveDate
    ? new Date(effectiveDate).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

  const shortId = (certificateId || 'ONB12345').toUpperCase();

  // Badge icon helper
  const renderBadgeIcon = () => {
    switch (badgeStyle) {
      case 'laurel':
        return (
          <div className="relative inline-flex items-center justify-center p-3 rounded-full border border-current">
            <ShieldCheck className="h-8 w-8" />
          </div>
        );
      case 'shield':
        return (
          <div className="relative inline-flex items-center justify-center p-3 rounded-full border border-current">
            <Shield className="h-8 w-8" />
          </div>
        );
      case 'crypto':
        return (
          <div className="relative inline-flex items-center justify-center p-3 rounded-xl border border-current font-mono text-xs font-bold">
            <CheckCircle2 className="h-7 w-7" />
          </div>
        );
      case 'ribbon':
      case 'medal':
      default:
        return (
          <div className="relative inline-flex items-center justify-center p-3 rounded-full border border-current">
            <Award className="h-8 w-8" />
          </div>
        );
    }
  };

  // QR Code Icon Component
  const renderQRCode = (qrClassName?: string) => (
    <div className={`p-2 rounded border shadow-xs flex flex-col items-center shrink-0 ${qrClassName || 'bg-white text-slate-900 border-slate-200'}`}>
      <QrCode className="h-10 w-10 sm:h-12 sm:w-12" />
      <span className="text-[6px] font-mono tracking-widest uppercase mt-0.5 opacity-70">{t('certificates.verify', 'Verify')}</span>
    </div>
  );

  // Logo / Org identity header block
  const renderOrgHeader = (isDarkLocal: boolean) => (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pb-4 border-b border-current/15 mb-4">
      <div className="h-10 flex items-center">
        {logoUrl ? (
          <img src={logoUrl} alt={organizationName} className="h-8 sm:h-9 object-contain max-w-[160px]" />
        ) : (
          <div className={`flex items-center gap-2 border px-2.5 py-1 rounded-lg ${isDarkLocal ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
            <div className="w-5 h-5 rounded bg-primary text-primary-foreground font-bold flex items-center justify-center text-[10px]">
              {organizationName ? organizationName.charAt(0).toUpperCase() : 'T'}
            </div>
            <span data-testid="organization-name" className="font-semibold text-xs tracking-tight">{organizationName || 'Talnova'}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[8px] font-mono tracking-wider uppercase opacity-60">{t('certificates.verifiedCredential', 'Verified Credential')}</span>
        <img
          src="/assets/images/talnova-long-black.png"
          alt="Talnova"
          className={`h-5 sm:h-6 object-contain ${isDarkLocal ? 'invert' : ''}`}
        />
      </div>
    </div>
  );

  // Signature and date footer block
  const renderFooter = (isDarkLocal: boolean) => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[9px] font-mono pt-4 border-t border-current/15 items-end mt-4">
      <div className="text-center sm:text-left">
        <p className="font-semibold uppercase tracking-wider opacity-60">{t('certificates.issuedDate', 'ISSUED DATE')}</p>
        <p data-testid="issue-date" className="font-medium">{formattedDate}</p>
      </div>

      <div className="text-center">
        <p className="font-semibold uppercase tracking-wider opacity-60">{t('certificates.credentialId', 'CREDENTIAL ID')}</p>
        <p data-testid="credential-id" className="font-semibold tracking-wider">{shortId}</p>
      </div>

      <div className="text-center sm:text-right flex flex-col items-center sm:items-end">
        {signatureUrl ? (
          <img
            src={signatureUrl}
            alt="Signature"
            className={`h-7 object-contain mb-1 ${isDarkLocal ? 'brightness-200' : ''}`}
          />
        ) : (
          <div className="h-6 w-20 border-b border-dashed border-current/40 mb-1 flex items-center justify-center text-[8px] opacity-40">
            Pending Sign
          </div>
        )}
        <p className="font-bold truncate max-w-[160px]">{signatoryName}</p>
        <p className="text-[8px] opacity-60 truncate max-w-[160px]">{signatoryTitle}</p>
      </div>
    </div>
  );

  // -------------------------------------------------------------
  // TEMPLATE 1: CLASSIC FORMAL EXECUTIVE GOLD
  // -------------------------------------------------------------
  if (normalizedTemplate === 'classic') {
    return (
      <div
        className={`relative overflow-hidden rounded-xl p-6 sm:p-10 flex flex-col justify-between min-h-[500px] border-8 border-double transition-all ${
          isDark
            ? 'bg-[#10131d] text-amber-50 border-amber-500/40 shadow-2xl'
            : 'bg-[#fcfaf5] text-slate-900 border-yellow-800/40 shadow-xl'
        } ${className}`}
        style={accentColor ? { borderColor: `${accentColor}66` } : undefined}
      >
        {/* Subtle background flourishes */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

        {renderOrgHeader(isDark)}

        <div className="text-center my-4 space-y-3 font-serif">
          <div className="flex justify-center mb-1 text-amber-600 dark:text-amber-400">
            {renderBadgeIcon()}
          </div>
          <h4 className="text-[10px] sm:text-xs font-bold tracking-widest uppercase text-amber-700 dark:text-amber-400 font-mono">
            Certificate of Completion
          </h4>
          <p className="text-[11px] italic opacity-75">
            This credential is officially conferred upon
          </p>
          <h2 data-testid="recipient-name" className="text-2xl sm:text-3xl font-extrabold tracking-tight pb-1 inline-block border-b-2 border-amber-600/30 px-6">
            {recipientName || 'Employee Name'}
          </h2>
          <p className="text-xs max-w-md mx-auto leading-relaxed opacity-80 pt-1">
            for successfully fulfilling all curriculum requirements, evaluations, and compliance standards for:
          </p>
          <h3 data-testid="journey-title" className="text-base sm:text-lg font-bold text-amber-800 dark:text-amber-300">
            {journeyTitle || 'Onboarding Curriculum'}
          </h3>

          {qrCode && (
            <div className="flex justify-center pt-2">
              {renderQRCode(isDark ? 'bg-amber-950/40 text-amber-200 border-amber-800/40' : undefined)}
            </div>
          )}
        </div>

        {renderFooter(isDark)}
      </div>
    );
  }

  // -------------------------------------------------------------
  // TEMPLATE 2: MODERN CYBER / TECH
  // -------------------------------------------------------------
  if (normalizedTemplate === 'modern') {
    return (
      <div
        className={`relative overflow-hidden rounded-2xl p-6 sm:p-10 flex flex-col justify-between min-h-[500px] border transition-all ${
          isDark
            ? 'bg-[#0a0d18] text-slate-100 border-cyan-500/30 shadow-2xl'
            : 'bg-slate-50 text-slate-900 border-indigo-200 shadow-xl'
        } ${className}`}
        style={accentColor ? { borderColor: `${accentColor}55` } : undefined}
      >
        {/* Glowing cyber accent corner */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-cyan-500/20 via-indigo-500/10 to-transparent rounded-br-full pointer-events-none" />

        {renderOrgHeader(isDark)}

        <div className="my-auto py-4 text-left space-y-3 z-10">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono tracking-widest text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-0.5 rounded-full font-bold uppercase">
              Authenticated Credential
            </span>
            <span className="text-[9px] font-mono opacity-50">{t('certificates.sha256Verified', 'SHA-256 Verified')}</span>
          </div>

          <h1 className="text-lg sm:text-xl font-black tracking-tight uppercase">
            CERTIFICATE OF COMPLETION
          </h1>

          <div className="pt-1">
            <p className="text-[11px] opacity-60 font-mono">{t('certificates.awardedTo', 'AWARDED TO RECIPIENT:')}</p>
            <h2 data-testid="recipient-name" className="text-2xl sm:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500 mt-0.5">
              {recipientName || 'Employee Name'}
            </h2>
          </div>

          <p className="text-xs opacity-75 max-w-lg leading-relaxed">
            In formal recognition of finishing all operational tasks, security standards, and course modules for:
            <span data-testid="journey-title" className="block text-sm font-bold text-foreground mt-1">{journeyTitle || 'Onboarding Curriculum'}</span>
          </p>

          {qrCode && (
            <div className="pt-2">
              {renderQRCode(isDark ? 'bg-slate-900 text-cyan-300 border-cyan-500/30' : undefined)}
            </div>
          )}
        </div>

        {renderFooter(isDark)}
      </div>
    );
  }

  // -------------------------------------------------------------
  // TEMPLATE 3: SCANDINAVIAN MINIMALIST
  // -------------------------------------------------------------
  if (normalizedTemplate === 'minimalist') {
    return (
      <div
        className={`relative overflow-hidden rounded-xl p-6 sm:p-10 flex flex-col justify-between min-h-[500px] border transition-all ${
          isDark
            ? 'bg-[#141417] text-zinc-100 border-zinc-800 shadow-xl'
            : 'bg-white text-zinc-900 border-zinc-200 shadow-md'
        } ${className}`}
      >
        {renderOrgHeader(isDark)}

        <div className="my-auto py-6 text-center space-y-3 font-sans">
          <p className="text-[9px] font-mono tracking-widest uppercase opacity-50">{t('certificates.attestation', 'Attestation of Knowledge')}</p>
          <p className="text-xs font-light opacity-70">{t('certificates.thisCertifies', 'This certifies that')}</p>
          <h2 data-testid="recipient-name" className="text-2xl sm:text-3xl font-light tracking-wide py-1 border-b border-current/20 inline-block px-8">
            {recipientName || 'Employee Name'}
          </h2>
          <p className="text-xs opacity-75 max-w-md mx-auto pt-2 leading-relaxed">
            has fulfilled all mandatory steps and assessments of the curriculum:
          </p>
          <h3 data-testid="journey-title" className="text-sm font-semibold tracking-wider uppercase font-mono">
            {journeyTitle || 'Onboarding Curriculum'}
          </h3>

          {qrCode && (
            <div className="flex justify-center pt-2">
              {renderQRCode(isDark ? 'bg-zinc-900 text-zinc-200 border-zinc-700' : undefined)}
            </div>
          )}
        </div>

        {renderFooter(isDark)}
      </div>
    );
  }

  // -------------------------------------------------------------
  // TEMPLATE 4: ACADEMIC DIPLOMA
  // -------------------------------------------------------------
  if (normalizedTemplate === 'academic') {
    return (
      <div
        className={`relative overflow-hidden rounded-xl p-6 sm:p-10 flex flex-col justify-between min-h-[500px] border-4 border-solid transition-all ${
          isDark
            ? 'bg-[#0d1524] text-slate-100 border-amber-600/40 shadow-2xl'
            : 'bg-[#faf8f2] text-slate-900 border-amber-900/30 shadow-xl'
        } ${className}`}
        style={accentColor ? { borderColor: accentColor } : undefined}
      >
        {/* Ornate corner brackets */}
        <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-amber-600/60" />
        <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-amber-600/60" />
        <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-amber-600/60" />
        <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-amber-600/60" />

        {renderOrgHeader(isDark)}

        <div className="my-auto text-center space-y-3 font-serif">
          <div className="flex justify-center text-amber-600 dark:text-amber-400">
            <ShieldCheck className="h-9 w-9" />
          </div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-amber-700 dark:text-amber-300 font-bold">
            Omnibus Ad Quos Praesentes Literae Pervenerint
          </span>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight uppercase">
            Diploma of Professional Mastery
          </h2>
          <p className="text-xs italic opacity-80">{t('certificates.beItKnown', 'Be it known that the candidate')}</p>
          <h3 data-testid="recipient-name" className="text-2xl sm:text-3xl font-extrabold tracking-wide text-amber-900 dark:text-amber-200">
            {recipientName || 'Employee Name'}
          </h3>
          <p className="text-xs max-w-md mx-auto opacity-80 leading-relaxed font-sans">
            having satisfied the criteria of instruction, compliance, and excellence, is granted this testimonial for:
          </p>
          <h4 data-testid="journey-title" className="text-sm sm:text-base font-bold text-amber-700 dark:text-amber-400">
            {journeyTitle || 'Onboarding Curriculum'}
          </h4>

          {qrCode && (
            <div className="flex justify-center pt-2">
              {renderQRCode(isDark ? 'bg-slate-900 text-amber-200 border-amber-700/40' : undefined)}
            </div>
          )}
        </div>

        {renderFooter(isDark)}
      </div>
    );
  }

  // -------------------------------------------------------------
  // TEMPLATE 5: VIBRANT MESH GRADIENT
  // -------------------------------------------------------------
  if (normalizedTemplate === 'gradient') {
    return (
      <div
        className={`relative overflow-hidden rounded-2xl p-6 sm:p-10 flex flex-col justify-between min-h-[500px] border shadow-2xl transition-all ${
          isDark
            ? 'bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 text-white border-purple-500/30'
            : 'bg-gradient-to-br from-indigo-50 via-white to-pink-50 text-slate-900 border-indigo-200'
        } ${className}`}
      >
        {/* Radiant gradient blobs */}
        <div className="absolute top-1/4 right-1/4 w-48 h-48 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/4 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {renderOrgHeader(isDark)}

        <div className="my-auto py-4 text-center space-y-3 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-indigo-500 to-pink-500 text-white shadow-sm">
            <Award className="h-4 w-4" /> Official Onboarding Certificate
          </div>

          <h1 className="text-xl sm:text-2xl font-black tracking-tight uppercase mt-2">
            Achievement Verified
          </h1>
          <p className="text-xs opacity-75">{t('certificates.presentedTo', 'Presented to')}</p>
          <h2 data-testid="recipient-name" className="text-3xl sm:text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-300 dark:via-purple-300 dark:to-pink-300">
            {recipientName || 'Employee Name'}
          </h2>
          <p className="text-xs max-w-md mx-auto opacity-80 leading-relaxed">
            for successfully mastering all modules, tasks, and prerequisites in:
          </p>
          <h3 data-testid="journey-title" className="text-base font-bold text-indigo-700 dark:text-indigo-300">
            {journeyTitle || 'Onboarding Curriculum'}
          </h3>

          {qrCode && (
            <div className="flex justify-center pt-2">
              {renderQRCode(isDark ? 'bg-slate-900 text-indigo-300 border-purple-500/40' : undefined)}
            </div>
          )}
        </div>

        {renderFooter(isDark)}
      </div>
    );
  }

  // -------------------------------------------------------------
  // TEMPLATE 6: EXECUTIVE OBSIDIAN LUXURY
  // -------------------------------------------------------------
  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-6 sm:p-10 flex flex-col justify-between min-h-[500px] border-2 transition-all ${
        isDark
          ? 'bg-[#08090d] text-slate-100 border-amber-500/50 shadow-2xl'
          : 'bg-[#181a20] text-slate-100 border-amber-400/40 shadow-xl'
      } ${className}`}
      style={accentColor ? { borderColor: accentColor } : undefined}
    >
      {/* Luxury metallic hairline frame */}
      <div className="absolute inset-2 sm:inset-3 border border-amber-500/20 rounded-xl pointer-events-none" />

      {renderOrgHeader(true)}

      <div className="my-auto py-4 text-center space-y-3 z-10 font-sans">
        <div className="flex justify-center text-amber-400">
          <Shield className="h-10 w-10 stroke-[1.5]" />
        </div>
        <p className="text-[9px] font-mono tracking-widest uppercase text-amber-400 font-bold">
          Executive Honor Roll
        </p>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white uppercase">
          Certificate of Executive Completion
        </h2>
        <p className="text-xs text-slate-400">{t('certificates.awardedDistinction', 'Awarded in distinction to')}</p>
        <h3 data-testid="recipient-name" className="text-2xl sm:text-3xl font-extrabold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300">
          {recipientName || 'Employee Name'}
        </h3>
        <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
          having established compliance with executive directives, milestones, and training for:
        </p>
        <h4 data-testid="journey-title" className="text-sm font-bold text-amber-300 font-mono uppercase tracking-wider">
          {journeyTitle || 'Onboarding Curriculum'}
        </h4>

        {qrCode && (
          <div className="flex justify-center pt-2">
            {renderQRCode('bg-black text-amber-300 border-amber-500/40')}
          </div>
        )}
      </div>

      {renderFooter(true)}
    </div>
  );
}
