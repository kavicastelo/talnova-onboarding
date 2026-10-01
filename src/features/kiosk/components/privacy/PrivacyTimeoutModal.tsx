import React from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, ShieldAlert, CheckCircle2, LogOut } from 'lucide-react';

export interface PrivacyTimeoutModalProps {
  isOpen: boolean;
  remainingSeconds: number;
  onStay: () => void;
  onExit: () => void;
}

export const PrivacyTimeoutModal: React.FC<PrivacyTimeoutModalProps> = ({
  isOpen,
  remainingSeconds,
  onStay,
  onExit
}) => {
  const { t } = useTranslation(['kiosk', 'common']);

  if (!isOpen) return null;

  // Percentage for countdown progress ring (from 15s to 0s)
  const totalSeconds = 15;
  const progressPercent = Math.max(0, Math.min(100, (remainingSeconds / totalSeconds) * 100));
  const strokeDashoffset = 283 - (283 * progressPercent) / 100;
  const isUrgent = remainingSeconds <= 5;

  return (
    <div
      data-testid="privacy-timeout-modal"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="privacy-timeout-title"
      aria-describedby="privacy-timeout-desc"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in"
    >
      <div className="relative w-full max-w-lg bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-amber-500/20 text-white overflow-hidden">
        {/* Top compliance banner */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-amber-400 text-xs sm:text-sm font-semibold tracking-wide uppercase">
            <ShieldAlert className="w-5 h-5 text-amber-400 animate-pulse" />
            <span>{t('privacy.complianceNotice', { defaultValue: 'Enterprise Terminal Security' })}</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700">
            GDPR / ISO 27001
          </span>
        </div>

        {/* Center Countdown Ring */}
        <div className="my-6 flex flex-col items-center justify-center">
          <div className="relative w-32 h-32 flex items-center justify-center">
            {/* SVG Progress Ring */}
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                className="stroke-slate-800"
                strokeWidth="8"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                className={`transition-all duration-1000 ease-linear ${
                  isUrgent ? 'stroke-rose-500' : 'stroke-amber-400'
                }`}
                strokeWidth="8"
                strokeDasharray="283"
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
              />
            </svg>

            {/* Countdown Number & Icon */}
            <div
              data-testid="privacy-countdown-timer"
              className="absolute inset-0 flex flex-col items-center justify-center text-center"
            >
              <Clock
                className={`w-5 h-5 mb-1 ${
                  isUrgent ? 'text-rose-400 animate-bounce' : 'text-amber-400'
                }`}
              />
              <span
                className={`text-3xl font-black font-mono tracking-tight ${
                  isUrgent ? 'text-rose-400' : 'text-white'
                }`}
              >
                {`${remainingSeconds}s`}
              </span>
            </div>
          </div>

          <h2
            id="privacy-timeout-title"
            className="mt-4 text-2xl font-bold text-center text-slate-100"
          >
            {t('privacy.title', { defaultValue: 'Session timing out. Still here?' })}
          </h2>

          <p
            id="privacy-timeout-desc"
            className="mt-2 text-sm text-center text-slate-300 max-w-sm"
          >
            {t('privacy.description', {
              defaultValue:
                'For your privacy and security, this shared terminal will automatically wipe all employee credentials and reset to the home screen.'
            })}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {/* Primary Continue / Still Here Button */}
          <button
            type="button"
            data-testid="btn-still-here"
            onClick={onStay}
            className="flex-1 min-h-[56px] inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-bold text-lg shadow-lg shadow-amber-500/30 transition-all focus:outline-none focus:ring-4 focus:ring-amber-500/50"
          >
            <CheckCircle2 className="w-6 h-6 text-slate-950" />
            <span>{t('privacy.stay', { defaultValue: 'Still Here — Continue' })}</span>
          </button>

          {/* Secondary Exit & Wipe Now Button */}
          <button
            type="button"
            data-testid="btn-exit-now"
            onClick={onExit}
            className="min-h-[56px] inline-flex items-center justify-center gap-2 px-5 py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-300 hover:text-white font-semibold text-base border border-slate-700 transition-all focus:outline-none focus:ring-4 focus:ring-slate-600"
          >
            <LogOut className="w-5 h-5 text-slate-400" />
            <span>{t('privacy.exit', { defaultValue: 'Exit Now' })}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
