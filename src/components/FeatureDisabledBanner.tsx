import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sliders, ArrowLeft, Home, Copy, Check, ShieldAlert, Building2 } from 'lucide-react';
import { Button } from './Button';
import { Badge } from './Badge';
import { getFeatureMetadata } from '../config/platformFeatures';

export interface FeatureDisabledBannerProps {
  featureKey: string;
  compact?: boolean;
  reason?: string;
  organizationName?: string;
  onRefresh?: () => void;
}

export function FeatureDisabledBanner({
  featureKey,
  compact = false,
  reason,
  organizationName,
  onRefresh,
}: FeatureDisabledBannerProps) {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const [copied, setCopied] = useState(false);

  const meta = getFeatureMetadata(featureKey);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(featureKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (compact) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50/70 via-orange-50/40 to-amber-50/70 p-4 dark:border-amber-900/50 dark:from-amber-950/20 dark:via-orange-950/10 dark:to-amber-950/20 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 shadow-xs ring-1 ring-amber-300/40">
              <Sliders className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {meta.name}
                </span>
                <Badge variant="outline" className="border-amber-300 text-amber-800 dark:border-amber-800 dark:text-amber-300 text-[10px] px-1.5 py-0 font-medium">
                  {meta.category}
                </Badge>
                <span className="inline-flex items-center gap-1 rounded bg-amber-200/60 dark:bg-amber-900/40 px-1.5 py-0.2 text-[10px] font-mono text-amber-800 dark:text-amber-300">
                  {featureKey}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {reason || t('featureDisabledDesc', {
                  defaultValue: `This capability is currently disabled for your organization by platform governance.`,
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                className="h-7 text-xs border-amber-300 hover:bg-amber-100 text-amber-900 dark:text-amber-200"
              >
                Re-check
              </Button>
            )}
            <button
              onClick={handleCopyKey}
              title="Copy Feature Key"
              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2 py-1 rounded bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 transition"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied' : 'Key'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Full-Page Mode (for Route Gate)
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-200">
      <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 via-orange-100 to-amber-200 dark:from-amber-950/60 dark:to-orange-900/40 text-amber-600 dark:text-amber-400 shadow-md ring-8 ring-amber-50 dark:ring-amber-950/20">
        <Sliders className="h-10 w-10 stroke-[2.2]" />
        <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white shadow-sm ring-2 ring-white dark:ring-slate-900">
          <ShieldAlert className="h-3.5 w-3.5" />
        </span>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-300 text-xs px-2.5 py-0.5">
          {meta.category}
        </Badge>
        {organizationName && (
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs px-2 py-0.5 flex items-center gap-1">
            <Building2 className="h-3 w-3" /> {organizationName}
          </Badge>
        )}
      </div>

      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
        {meta.name}
      </h1>

      <p className="mt-1 text-sm font-medium text-amber-600 dark:text-amber-400">
        Feature Temporarily Restricted
      </p>

      <div className="mt-4 max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-4 text-xs text-slate-600 dark:text-slate-300 shadow-2xs space-y-2">
        <p>
          {reason || `The feature "${meta.name}" is currently disabled for this tenant workspace. This restriction may stem from global maintenance, tenant exclusion, or tier entitlement.`}
        </p>
        <div className="flex items-center justify-center gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
          <span className="text-slate-500 font-mono text-[11px]">Feature Flag:</span>
          <button
            onClick={handleCopyKey}
            className="inline-flex items-center gap-1.5 rounded-md bg-white dark:bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 transition"
          >
            {featureKey}
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-slate-400" />}
          </button>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="gap-2 text-xs h-9 px-4 border-slate-300 dark:border-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('goBack', 'Go Back')}
        </Button>
        <Button
          onClick={() => navigate('/')}
          className="gap-2 text-xs h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
        >
          <Home className="h-3.5 w-3.5" />
          {t('returnToDashboard', 'Return to Dashboard')}
        </Button>
      </div>

      <p className="mt-8 text-[11px] text-slate-400 dark:text-slate-500 max-w-xs">
        To request activation of this capability, please reach out to your platform administrator.
      </p>
    </div>
  );
}
