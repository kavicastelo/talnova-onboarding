import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheck,
  Copy,
  Check,
  Sparkles
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../Tooltip';
import { toast } from 'sonner';

export interface IAutoVerificationEvidence {
  enabled: boolean;
  ruleType?: 'document_signed' | 'quiz_passed' | 'course_completed' | 'form_submitted';
  signatureHash?: string;
  quizScorePercent?: number;
  minPassingScore?: number;
  verifiedAt?: string;
  verifiedBy?: string;
  evidenceNote?: string;
}

interface AutoVerificationBadgeProps {
  evidence?: IAutoVerificationEvidence;
  status: string;
  onRevoke?: () => void;
}

export const AutoVerificationBadge: React.FC<AutoVerificationBadgeProps> = ({
  evidence,
  status,
  onRevoke: _onRevoke,
}) => {
  const { t } = useTranslation(['tasks', 'common']);
  const [copied, setCopied] = useState(false);

  if (!evidence?.enabled && status !== 'verified') {
    return null;
  }

  const isVerified = status === 'verified';
  const isQuiz = evidence?.ruleType === 'quiz_passed';
  const hash = evidence?.signatureHash;

  const handleCopyHash = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopied(true);
    toast.success(t('autoVerification.copiedHashToast', { defaultValue: 'SHA-256 signature hash copied to clipboard' }));
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <TooltipProvider>
      <div className="inline-flex items-center gap-1.5 flex-wrap">
        {isVerified ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 cursor-help">
                <ShieldCheck className="h-3 w-3" />
                <span>{t('autoVerification.badgeAutoVerified', { defaultValue: 'Auto-Verified' })}</span>
                {isQuiz && evidence.quizScorePercent !== undefined && (
                  <span className="font-semibold">({evidence.quizScorePercent}%)</span>
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs space-y-1 p-2.5">
              <p className="font-semibold text-emerald-500 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t('autoVerification.cryptoConfirmed', { defaultValue: 'Cryptographically Confirmed' })}
              </p>
              <p className="text-muted-foreground text-[11px]">
                {evidence?.evidenceNote ||
                  t('autoVerification.verifiedBy', {
                    by: evidence?.verifiedBy || 'system.autonomous.sentinel',
                    defaultValue: 'Verified by {{by}} on completion event.'
                  })}
              </p>
              {hash && (
                <div className="pt-1 mt-1 border-t border-border flex items-center justify-between gap-1 text-[10px] font-mono text-muted-foreground">
                  <span className="truncate">
                    {t('autoVerification.hashLabel', { hash: hash.slice(0, 16), defaultValue: `Hash: ${hash.slice(0, 16)}...` })}
                  </span>
                  <button
                    onClick={handleCopyHash}
                    className="hover:text-foreground text-primary shrink-0"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              )}
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
            <Sparkles className="h-3 w-3" />
            <span>{t('autoVerification.sentinelReady', { defaultValue: 'Autonomous Sentinel Ready' })}</span>
          </span>
        )}
      </div>
    </TooltipProvider>
  );
};
