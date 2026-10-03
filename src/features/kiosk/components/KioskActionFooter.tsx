import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, CheckCircle2, RotateCcw, Hand } from 'lucide-react';
import { isRtlLanguage } from '../constants/language.constants';

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
  isRtl?: boolean;
  selectedLanguage?: string;
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
  isRtl,
  selectedLanguage,
  className = ''
}) => {
  const { t } = useTranslation('kiosk');

  const isRtlMode = isRtl ?? (selectedLanguage ? isRtlLanguage(selectedLanguage) : false);

  const defaultNextLabel = currentStepIndex === 0
    ? t('player.beginBriefing', { defaultValue: 'Begin Briefing' })
    : t('player.next', { defaultValue: 'Next' });
  const resolvedNextLabel = nextButtonLabel || defaultNextLabel;

  const defaultFinishLabel = t('player.finish', { defaultValue: 'Finish' });
  const resolvedFinishLabel = finishButtonLabel || defaultFinishLabel;

  const showBackButton = showBack && currentStepIndex > 0 && canGoBack;
  const showFinishButton = showFinish && isLastStep;
  const showNextButton = showNext && !isLastStep;

  // Render Next, Finish, or Hold-to-Confirm action button
  const renderNextFinishButton = () => {
    if (isHoldToConfirm) {
      return (
        <button
          type="button"
          id="kiosk-btn-hold"
          data-testid="kiosk-btn-hold"
          data-position={isRtlMode ? 'bottom-left' : 'bottom-right'}
          onMouseDown={onHoldStart}
          onMouseUp={onHoldEnd}
          onMouseLeave={onHoldEnd}
          onTouchStart={onHoldStart}
          onTouchEnd={onHoldEnd}
          className={`relative min-h-[64px] min-w-[64px] sm:min-w-[180px] px-7 py-4 rounded-2xl border overflow-hidden font-bold text-sm sm:text-base flex items-center justify-center space-x-2.5 transition active:scale-95 focus-visible:outline-4 focus-visible:outline-sky-500 focus-visible:ring-4 focus-visible:ring-sky-500/30 ${
            highContrast
              ? 'bg-amber-400 text-black border-amber-300 focus-visible:outline-white'
              : 'bg-slate-900 border-emerald-500/40 text-emerald-400 hover:border-emerald-400'
          }`}
        >
          {/* Progress Fill Bar: starts from right in RTL, left in LTR */}
          <div
            data-testid="hold-progress-fill"
            className={`absolute top-0 bottom-0 transition-all duration-75 ${
              isRtlMode ? 'right-0' : 'left-0'
            } ${
              highContrast ? 'bg-amber-300/60' : 'bg-emerald-500/20'
            }`}
            style={{ width: `${Math.min(Math.max(holdProgress, 0), 100)}%` }}
          />
          <Hand className="w-5 h-5 shrink-0 z-10 animate-pulse" />
          <span className="z-10">{t('player.holdToConfirm', { defaultValue: 'Hold to Confirm' })}</span>
        </button>
      );
    }

    if (showFinishButton) {
      return (
        <button
          type="button"
          id="kiosk-btn-finish"
          data-testid="kiosk-btn-finish"
          data-position={isRtlMode ? 'bottom-left' : 'bottom-right'}
          data-tamper-guard="progression"
          disabled={!canGoNext}
          aria-disabled={!canGoNext}
          onClick={onFinish}
          className={`min-h-[64px] min-w-[64px] sm:min-w-[140px] px-5 sm:px-8 py-4 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center space-x-2 transition active:scale-95 focus-visible:outline-4 focus-visible:outline-sky-500 focus-visible:ring-4 focus-visible:ring-sky-500/30 ${
            !canGoNext
              ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50'
              : highContrast
              ? 'bg-amber-400 text-black border-2 border-amber-300 hover:bg-amber-300 active:bg-amber-200 shadow-xl focus-visible:outline-white'
              : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'
          }`}
        >
          <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
          <span>{resolvedFinishLabel}</span>
        </button>
      );
    }

    if (showNextButton) {
      return (
        <button
          type="button"
          id="kiosk-btn-next"
          data-testid="kiosk-btn-next"
          data-position={isRtlMode ? 'bottom-left' : 'bottom-right'}
          data-tamper-guard="progression"
          disabled={!canGoNext}
          aria-disabled={!canGoNext}
          onClick={onNext}
          className={`min-h-[64px] min-w-[64px] sm:min-w-[140px] px-5 sm:px-8 py-4 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center space-x-2 transition active:scale-95 focus-visible:outline-4 focus-visible:outline-sky-500 focus-visible:ring-4 focus-visible:ring-sky-500/30 ${
            !canGoNext
              ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50'
              : highContrast
              ? 'bg-amber-400 text-black border-2 border-amber-300 hover:bg-amber-300 active:bg-amber-200 shadow-xl focus-visible:outline-white'
              : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'
          }`}
        >
          {isRtlMode ? (
            <>
              {/* In RTL: Arrow points LEFT (direction of forward progression) */}
              <ArrowLeft
                data-testid="next-arrow-icon"
                className="w-5 h-5 stroke-[2.5]"
              />
              <span>{resolvedNextLabel}</span>
            </>
          ) : (
            <>
              <span>{resolvedNextLabel}</span>
              <ArrowRight
                data-testid="next-arrow-icon"
                className="w-5 h-5 stroke-[2.5]"
              />
            </>
          )}
        </button>
      );
    }

    return null;
  };

  // Render Back button
  const renderBackButton = () => {
    if (!showBackButton) return null;

    return (
      <button
        type="button"
        id="kiosk-btn-prev"
        data-testid="kiosk-btn-prev"
        data-position={isRtlMode ? 'bottom-right' : 'bottom-left'}
        onClick={onPrev}
        className={`min-h-[64px] min-w-[64px] sm:min-w-[120px] px-4 sm:px-6 py-4 rounded-2xl border font-bold text-sm sm:text-base flex items-center justify-center space-x-2 transition active:scale-95 focus-visible:outline-4 focus-visible:outline-sky-500 focus-visible:ring-4 focus-visible:ring-sky-500/30 ${
          highContrast
            ? 'bg-black border-white text-white hover:bg-white/20 active:bg-white/30 focus-visible:outline-amber-400'
            : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800 hover:text-white'
        }`}
      >
        {isRtlMode ? (
          <>
            <span>{t('player.back', { defaultValue: 'Back' })}</span>
            {/* In RTL: Arrow points RIGHT (direction of returning) */}
            <ArrowRight
              data-testid="back-arrow-icon"
              className="w-5 h-5 stroke-[2.5]"
            />
          </>
        ) : (
          <>
            <ArrowLeft
              data-testid="back-arrow-icon"
              className="w-5 h-5 stroke-[2.5]"
            />
            <span>{t('player.back', { defaultValue: 'Back' })}</span>
          </>
        )}
      </button>
    );
  };

  // Render Restart button
  const renderRestartButton = () => {
    if (!showRestart) return null;

    return (
      <button
        type="button"
        id="kiosk-btn-restart"
        data-testid="kiosk-btn-restart"
        data-position={isRtlMode ? 'bottom-right' : 'bottom-left'}
        onClick={onRestart}
        title={t('player.restartJourney', { defaultValue: 'Restart Journey' })}
        className={`min-h-[56px] min-w-[56px] px-4 sm:px-6 py-3.5 rounded-2xl border text-sm font-semibold flex items-center justify-center space-x-2.5 transition active:scale-95 focus-visible:outline-4 focus-visible:outline-sky-500 focus-visible:ring-4 focus-visible:ring-sky-500/30 ${
          highContrast
            ? 'bg-black border-amber-400 text-amber-300 hover:bg-amber-400/20 active:bg-amber-400/30 focus-visible:outline-amber-400'
            : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850 hover:text-white'
        }`}
      >
        <RotateCcw className={`w-5 h-5 shrink-0 ${isRtlMode ? '-scale-x-100' : ''}`} />
        <span className="hidden sm:inline">{t('player.restart', { defaultValue: 'Restart' })}</span>
      </button>
    );
  };

  return (
    <footer
      id="kiosk-action-footer"
      data-testid="kiosk-action-footer"
      role="contentinfo"
      dir={isRtlMode ? 'rtl' : 'ltr'}
      data-dir={isRtlMode ? 'rtl' : 'ltr'}
      data-rtl={isRtlMode}
      aria-label={t('player.navigationControls', { defaultValue: 'Step Navigation Controls' })}
      className={`h-24 min-h-[96px] max-h-[96px] shrink-0 sticky bottom-0 z-30 w-full px-4 sm:px-8 lg:px-12 flex items-center justify-between gap-4 transition-colors select-none ${
        highContrast
          ? 'bg-black border-t-2 border-amber-400 text-white'
          : 'bg-slate-950/85 border-t border-slate-900 text-white backdrop-blur-md'
      } ${className}`}
    >
      {isRtlMode ? (
        <>
          {/* RTL Start (Right Side of Screen): Back and Restart buttons */}
          <div
            data-testid="footer-right-slot"
            className="flex items-center space-x-3 sm:space-x-4 rtl:space-x-reverse shrink-0"
          >
            {renderBackButton()}
            {renderRestartButton()}
          </div>

          {/* Center: Step Counter */}
          <div
            id="kiosk-step-counter"
            data-testid="kiosk-step-counter"
            className={`text-sm sm:text-base font-medium tracking-wider flex items-center space-x-1.5 rtl:space-x-reverse ${
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

          {/* RTL End (Left Side of Screen): Next / Finish / Hold button */}
          <div
            data-testid="footer-left-slot"
            className="flex items-center space-x-3 sm:space-x-4 rtl:space-x-reverse shrink-0"
          >
            {renderNextFinishButton()}
          </div>
        </>
      ) : (
        <>
          {/* LTR Start (Left Side of Screen): Restart button */}
          <div
            data-testid="footer-left-slot"
            className="flex items-center space-x-3 shrink-0"
          >
            {renderRestartButton()}
          </div>

          {/* Center: Step Counter */}
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

          {/* LTR End (Right Side of Screen): Back and Next/Finish buttons */}
          <div
            data-testid="footer-right-slot"
            className="flex items-center space-x-3 sm:space-x-4 shrink-0"
          >
            {renderBackButton()}
            {renderNextFinishButton()}
          </div>
        </>
      )}
    </footer>
  );
};

export default KioskActionFooter;
