import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, CheckCircle2, RotateCcw, Hand } from 'lucide-react';

export interface KioskActionFooterProps {
  currentStepIndex: number;
  totalSteps: number;
  canGoBack?: boolean;
  canGoNext?: boolean;
  isLastStep?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onRestart: () => void;
  onFinish: () => void;
  nextButtonLabel?: string;
  finishButtonLabel?: string;
  highContrast?: boolean;
  showRestart?: boolean;
  showBack?: boolean;
  showNext?: boolean;
  showFinish?: boolean;
  // Optional hold-to-confirm mode on footer action
  isHoldToConfirm?: boolean;
  holdProgress?: number;
  onHoldStart?: () => void;
  onHoldEnd?: () => void;
  className?: string;
}

export const KioskActionFooter: React.FC<KioskActionFooterProps> = ({
  currentStepIndex,
  totalSteps,
  canGoBack = true,
  canGoNext = true,
  isLastStep = false,
  onPrev,
  onNext,
  onRestart,
  onFinish,
  nextButtonLabel,
  finishButtonLabel,
  highContrast = false,
  showRestart = true,
  showBack = true,
  showNext = true,
  showFinish = true,
  isHoldToConfirm = false,
  holdProgress = 0,
  onHoldStart,
  onHoldEnd,
  className = ''
}) => {
  const { t } = useTranslation('kiosk');

  const defaultNextLabel = currentStepIndex === 0
    ? t('player.beginBriefing', { defaultValue: 'Begin Briefing' })
    : t('player.next', { defaultValue: 'Next' });
  const resolvedNextLabel = nextButtonLabel || defaultNextLabel;

  const defaultFinishLabel = t('player.finish', { defaultValue: 'Finish' });
  const resolvedFinishLabel = finishButtonLabel || defaultFinishLabel;

  const showBackButton = showBack && currentStepIndex > 0 && canGoBack;
  const showFinishButton = showFinish && isLastStep;
  const showNextButton = showNext && !isLastStep;

  return (
    <footer
      id="kiosk-action-footer"
      data-testid="kiosk-action-footer"
      className={`h-24 min-h-[96px] max-h-[96px] shrink-0 sticky bottom-0 z-30 w-full px-4 sm:px-8 lg:px-12 flex items-center justify-between gap-4 transition-colors select-none ${
        highContrast
          ? 'bg-black border-t-2 border-amber-400 text-white'
          : 'bg-slate-950/85 border-t border-slate-900 text-white backdrop-blur-md'
      } ${className}`}
    >
      {/* Left: Restart Button */}
      <div className="flex items-center space-x-3 shrink-0">
        {showRestart && (
          <button
            type="button"
            id="kiosk-btn-restart"
            data-testid="kiosk-btn-restart"
            onClick={onRestart}
            title={t('player.restartJourney', { defaultValue: 'Restart Journey' })}
            className={`min-h-[56px] px-4 sm:px-6 py-3 rounded-2xl border text-sm font-semibold flex items-center space-x-2.5 transition active:scale-95 ${
              highContrast
                ? 'bg-black border-amber-400 text-amber-300 hover:bg-amber-400/20 active:bg-amber-400/30'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850 hover:text-white'
            }`}
          >
            <RotateCcw className="w-5 h-5 shrink-0" />
            <span className="hidden sm:inline">{t('player.restart', { defaultValue: 'Restart' })}</span>
          </button>
        )}
      </div>

      {/* Center: Pagination & Screen Indicator */}
      <div
        id="kiosk-step-counter"
        data-testid="kiosk-step-counter"
        className={`text-sm sm:text-base font-medium tracking-wider flex items-center space-x-1.5 ${
          highContrast ? 'text-amber-300 font-bold' : 'text-slate-400 font-light'
        }`}
      >
        <span>{t('player.screen', { defaultValue: 'Screen' })}</span>
        <span className={`font-bold ${highContrast ? 'text-white underline decoration-amber-400' : 'text-white'}`}>
          {totalSteps > 0 ? currentStepIndex + 1 : 0}
        </span>
        <span>{t('player.of', { defaultValue: 'of' })}</span>
        <span className={highContrast ? 'text-amber-200' : 'text-slate-300'}>{totalSteps}</span>
      </div>

      {/* Right: Back, Next, Hold-to-Confirm, Finish */}
      <div className="flex items-center space-x-3 sm:space-x-4 shrink-0">
        {/* Back Button */}
        {showBackButton && (
          <button
            type="button"
            id="kiosk-btn-prev"
            data-testid="kiosk-btn-prev"
            onClick={onPrev}
            className={`min-h-[56px] min-w-[90px] sm:min-w-[120px] px-5 sm:px-6 py-3 rounded-2xl border font-bold text-sm sm:text-base flex items-center justify-center space-x-2 transition active:scale-95 ${
              highContrast
                ? 'bg-black border-white text-white hover:bg-white/20 active:bg-white/30'
                : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
            <span>{t('player.back', { defaultValue: 'Back' })}</span>
          </button>
        )}

        {/* Hold-to-Confirm Button (if required by current step) */}
        {isHoldToConfirm && (
          <button
            type="button"
            id="kiosk-btn-hold"
            data-testid="kiosk-btn-hold"
            onMouseDown={onHoldStart}
            onMouseUp={onHoldEnd}
            onMouseLeave={onHoldEnd}
            onTouchStart={onHoldStart}
            onTouchEnd={onHoldEnd}
            className={`relative min-h-[56px] min-w-[140px] sm:min-w-[180px] px-6 py-3 rounded-2xl border overflow-hidden font-bold text-sm sm:text-base flex items-center justify-center space-x-2.5 transition active:scale-95 ${
              highContrast
                ? 'bg-amber-400 text-black border-amber-300'
                : 'bg-slate-900 border-emerald-500/40 text-emerald-400 hover:border-emerald-400'
            }`}
          >
            {/* Progress Fill Bar */}
            <div
              className={`absolute left-0 top-0 bottom-0 transition-all duration-75 ${
                highContrast ? 'bg-amber-300/60' : 'bg-emerald-500/20'
              }`}
              style={{ width: `${Math.min(Math.max(holdProgress, 0), 100)}%` }}
            />
            <Hand className="w-5 h-5 shrink-0 z-10 animate-pulse" />
            <span className="z-10">{t('player.holdToConfirm', { defaultValue: 'Hold to Confirm' })}</span>
          </button>
        )}

        {/* Next Button */}
        {showNextButton && !isHoldToConfirm && (
          <button
            type="button"
            id="kiosk-btn-next"
            data-testid="kiosk-btn-next"
            disabled={!canGoNext}
            onClick={onNext}
            className={`min-h-[56px] min-w-[110px] sm:min-w-[140px] px-6 sm:px-8 py-3 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center space-x-2 transition active:scale-95 ${
              !canGoNext
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50'
                : highContrast
                ? 'bg-amber-400 text-black border-2 border-amber-300 hover:bg-amber-300 active:bg-amber-200 shadow-xl'
                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'
            }`}
          >
            <span>{resolvedNextLabel}</span>
            <ArrowRight className="w-5 h-5 stroke-[2.5]" />
          </button>
        )}

        {/* Finish Button (Final Step) */}
        {showFinishButton && !isHoldToConfirm && (
          <button
            type="button"
            id="kiosk-btn-finish"
            data-testid="kiosk-btn-finish"
            onClick={onFinish}
            className={`min-h-[56px] min-w-[110px] sm:min-w-[140px] px-6 sm:px-8 py-3 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center space-x-2 transition active:scale-95 ${
              highContrast
                ? 'bg-amber-400 text-black border-2 border-amber-300 hover:bg-amber-300 active:bg-amber-200 shadow-xl'
                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'
            }`}
          >
            <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
            <span>{resolvedFinishLabel}</span>
          </button>
        )}
      </div>
    </footer>
  );
};

export default KioskActionFooter;
