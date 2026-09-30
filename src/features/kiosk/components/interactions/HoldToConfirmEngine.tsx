import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Hand, CheckCircle2, ShieldCheck } from 'lucide-react';

export interface HoldToConfirmEngineProps {
  holdDurationMs?: number;
  onComplete: () => void;
  onHoldStart?: () => void;
  onHoldEnd?: () => void;
  label?: string;
  sublabel?: string;
  size?: 'normal' | 'large';
  variant?: 'circular' | 'linear';
  buttonTestId?: string;
  highContrast?: boolean;
  disabled?: boolean;
  className?: string;
}

export const HoldToConfirmEngine: React.FC<HoldToConfirmEngineProps> = ({
  holdDurationMs = 2000,
  onComplete,
  onHoldStart,
  onHoldEnd,
  label,
  sublabel,
  size = 'normal',
  variant = 'circular',
  buttonTestId = 'hold-to-confirm-btn',
  highContrast = false,
  disabled = false,
  className = ''
}) => {
  const { t } = useTranslation('kiosk');
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const defaultLabel = label || t('interactions.holdToConfirm', { defaultValue: 'Touch & Hold to Confirm' });
  const defaultSublabel = sublabel || t('interactions.holdInstruction', {
    defaultValue: `Hold continuously for ${(holdDurationMs / 1000).toFixed(1)}s to verify`,
    duration: (holdDurationMs / 1000).toFixed(1)
  });

  const clearHoldTimers = useCallback(() => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
  }, []);

  const handleHoldStart = useCallback((e?: React.SyntheticEvent) => {
    if (disabled || isCompleted) return;
    if (e && 'preventDefault' in e && e.type === 'touchstart') {
      // Prevent phantom mouse event or context menu
    }

    clearHoldTimers();
    setIsHolding(true);
    startTimeRef.current = Date.now();
    onHoldStart?.();

    const intervalStepMs = 30;

    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const currentProgress = Math.min((elapsed / holdDurationMs) * 100, 100);
      setProgress(currentProgress);
    }, intervalStepMs);

    holdTimeoutRef.current = setTimeout(() => {
      clearHoldTimers();
      setProgress(100);
      setIsHolding(false);
      setIsCompleted(true);

      // Trigger haptic feedback if supported by touch kiosk hardware
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate([60, 40, 60]);
        } catch {
          // Ignore vibration errors
        }
      }

      onComplete();
    }, holdDurationMs);
  }, [disabled, isCompleted, clearHoldTimers, onHoldStart, holdDurationMs, onComplete]);

  const handleHoldEnd = useCallback(() => {
    if (isCompleted) return;
    clearHoldTimers();
    setIsHolding(false);
    setProgress(0);
    onHoldEnd?.();
  }, [isCompleted, clearHoldTimers, onHoldEnd]);

  useEffect(() => {
    return () => {
      clearHoldTimers();
    };
  }, [clearHoldTimers]);

  // Dimension scaling
  const isLarge = size === 'large';
  const circleSize = isLarge ? 144 : 112; // in px
  const strokeWidth = isLarge ? 8 : 6;
  const radius = (circleSize - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress / 100);

  return (
    <div
      data-testid="hold-to-confirm-engine"
      data-holding={isHolding}
      data-completed={isCompleted}
      data-progress={Math.round(progress)}
      className={`flex flex-col items-center justify-center select-none py-4 ${className}`}
    >
      {variant === 'circular' ? (
        <div className="flex flex-col items-center space-y-4">
          <button
            type="button"
            id="hold-trigger-btn"
            data-testid={buttonTestId}
            disabled={disabled}
            onMouseDown={handleHoldStart}
            onMouseUp={handleHoldEnd}
            onMouseLeave={handleHoldEnd}
            onTouchStart={handleHoldStart}
            onTouchEnd={handleHoldEnd}
            onTouchCancel={handleHoldEnd}
            style={{ width: `${circleSize}px`, height: `${circleSize}px` }}
            className={`relative rounded-full flex items-center justify-center transition-transform active:scale-95 cursor-pointer touch-none shadow-2xl ${
              disabled
                ? 'opacity-40 cursor-not-allowed bg-slate-900 border-2 border-slate-800'
                : isCompleted
                ? highContrast
                  ? 'bg-amber-400 text-black border-2 border-amber-300'
                  : 'bg-emerald-500/20 text-emerald-300 border-2 border-emerald-400'
                : highContrast
                ? 'bg-black border-2 border-amber-400 text-amber-300 hover:border-amber-300'
                : 'bg-slate-900 border-2 border-slate-800 hover:border-emerald-500/40 text-emerald-400'
            }`}
          >
            {/* SVG circular progress ring */}
            <svg
              className="absolute inset-0 -rotate-90 pointer-events-none"
              width={circleSize}
              height={circleSize}
              viewBox={`0 0 ${circleSize} ${circleSize}`}
            >
              {/* Background Track Ring */}
              <circle
                cx={circleSize / 2}
                cy={circleSize / 2}
                r={radius}
                className={highContrast ? 'stroke-neutral-800' : 'stroke-slate-800'}
                strokeWidth={strokeWidth}
                fill="transparent"
              />
              {/* Animated Progress Ring */}
              <circle
                data-testid="hold-progress-ring"
                cx={circleSize / 2}
                cy={circleSize / 2}
                r={radius}
                className={`transition-all duration-75 ${
                  highContrast
                    ? 'stroke-amber-400'
                    : isCompleted
                    ? 'stroke-emerald-400'
                    : 'stroke-emerald-500'
                }`}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>

            {/* Inner Icon & Feedback */}
            <div className="relative z-10 flex flex-col items-center justify-center pointer-events-none">
              {isCompleted ? (
                <CheckCircle2 className={`stroke-[2.5] ${isLarge ? 'w-14 h-14' : 'w-10 h-10'} ${highContrast ? 'text-black' : 'text-emerald-400'}`} />
              ) : (
                <Hand className={`stroke-[2] transition-transform ${isHolding ? 'scale-110' : 'animate-pulse'} ${isLarge ? 'w-12 h-12' : 'w-9 h-9'}`} />
              )}
            </div>
          </button>

          {/* Progress Percentage Display */}
          <div className="flex flex-col items-center text-center space-y-1">
            <span
              data-testid="hold-progress-text"
              className={`text-xs font-bold tracking-widest uppercase ${
                isCompleted
                  ? highContrast ? 'text-amber-300' : 'text-emerald-400'
                  : highContrast ? 'text-white' : 'text-slate-300'
              }`}
            >
              {isCompleted
                ? t('interactions.verified', { defaultValue: 'VERIFIED & CONFIRMED' })
                : isHolding
                ? `${Math.round(progress)}%`
                : defaultLabel}
            </span>
            <p className="text-xs text-slate-400 max-w-xs">{defaultSublabel}</p>
          </div>
        </div>
      ) : (
        /* Linear Progress Bar Variant */
        <div className="w-full max-w-md space-y-3">
          <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
            <span className={highContrast ? 'text-amber-300' : 'text-slate-300'}>{defaultLabel}</span>
            <span data-testid="hold-progress-text" className={highContrast ? 'text-white' : 'text-emerald-400'}>
              {Math.round(progress)}%
            </span>
          </div>

          <button
            type="button"
            id="hold-trigger-btn"
            data-testid={buttonTestId}
            disabled={disabled}
            onMouseDown={handleHoldStart}
            onMouseUp={handleHoldEnd}
            onMouseLeave={handleHoldEnd}
            onTouchStart={handleHoldStart}
            onTouchEnd={handleHoldEnd}
            onTouchCancel={handleHoldEnd}
            className={`relative w-full h-16 rounded-2xl border-2 overflow-hidden flex items-center justify-center font-bold text-base transition active:scale-98 cursor-pointer select-none ${
              disabled
                ? 'opacity-40 cursor-not-allowed bg-slate-900 border-slate-800'
                : isCompleted
                ? highContrast
                  ? 'bg-amber-400 text-black border-amber-300'
                  : 'bg-emerald-500 text-slate-950 border-emerald-400'
                : highContrast
                ? 'bg-black border-amber-400 text-amber-300'
                : 'bg-slate-900 border-slate-700 text-slate-100 hover:border-emerald-500/50'
            }`}
          >
            {/* Linear Progress Fill */}
            <div
              data-testid="hold-progress-bar"
              className={`absolute left-0 top-0 bottom-0 transition-all duration-75 ${
                highContrast ? 'bg-amber-400/40' : 'bg-emerald-500/30'
              }`}
              style={{ width: `${progress}%` }}
            />

            <div className="relative z-10 flex items-center space-x-2.5">
              {isCompleted ? (
                <>
                  <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
                  <span>{t('interactions.confirmed', { defaultValue: 'Confirmation Complete' })}</span>
                </>
              ) : (
                <>
                  <Hand className={`w-6 h-6 ${isHolding ? 'scale-110' : 'animate-pulse'}`} />
                  <span>{isHolding ? t('interactions.holding', { defaultValue: 'Keep Holding...' }) : defaultLabel}</span>
                </>
              )}
            </div>
          </button>

          <p className="text-center text-xs text-slate-400">{defaultSublabel}</p>
        </div>
      )}
    </div>
  );
};

export default HoldToConfirmEngine;
