/**
 * Talnova Kiosk Terminal - Power Recovery Resume Modal (K-REL-002)
 *
 * Prompts frontline workers upon hardware reboot or browser reload when an
 * interrupted briefing checkpoint (<15 minutes old) is detected.
 *
 * Displays:
 * "A previous briefing was interrupted. Would you like to resume at Screen X?"
 * with a 15-second countdown.
 */

import React, { useEffect, useState, useRef } from 'react';
import { RotateCcw, XCircle, Zap, ShieldCheck } from 'lucide-react';
import { KioskActiveSessionCheckpoint } from '../../../../types/kiosk/recovery.types';

export interface PowerRecoveryResumeModalProps {
  checkpoint: KioskActiveSessionCheckpoint;
  onConfirm: (checkpoint: KioskActiveSessionCheckpoint) => void;
  onDismiss: () => void;
  countdownSeconds?: number; // default: 15
}

export const PowerRecoveryResumeModal: React.FC<PowerRecoveryResumeModalProps> = ({
  checkpoint,
  onConfirm,
  onDismiss,
  countdownSeconds = 15
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(countdownSeconds);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // 15-second countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // If countdown expires: auto-purge and dismiss to home screen
          onDismissRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  // Screen X: 1-indexed representation of checkpoint.stepIndex
  const screenNumber = checkpoint.stepIndex + 1;

  // Animated progress ring parameters
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, secondsLeft / countdownSeconds));
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="power-recovery-title"
      data-testid="power-recovery-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-6 select-none animate-in fade-in duration-300"
    >
      {/* Ambient background glow */}
      <div className="absolute w-96 h-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-amber-500/30 bg-slate-900/95 backdrop-blur-2xl p-8 sm:p-10 shadow-2xl shadow-black/80 text-center space-y-6">
        {/* Header Icon with Power/Resume Badge */}
        <div className="flex justify-center">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-950/70 border border-amber-500/40 text-amber-400 shadow-lg shadow-amber-950/50">
            <Zap className="h-10 w-10 text-amber-400 animate-pulse" />
            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-slate-900 border border-amber-500/50 flex items-center justify-center">
              <RotateCcw className="h-3.5 w-3.5 text-amber-300" />
            </div>
          </div>
        </div>

        {/* Modal Title & Exact Prompt Requirement */}
        <div className="space-y-3">
          <h2
            id="power-recovery-title"
            className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight"
          >
            Briefing Interrupted
          </h2>
          <p
            data-testid="power-recovery-message"
            className="text-base sm:text-lg font-medium text-slate-200 leading-relaxed"
          >
            {`A previous briefing was interrupted. Would you like to resume at Screen ${screenNumber}?`}
          </p>
        </div>

        {/* 15-Second Animated Countdown Ring */}
        <div className="relative flex items-center justify-center py-2">
          <svg
            className="w-28 h-28 transform -rotate-90"
            viewBox="0 0 100 100"
            aria-hidden="true"
          >
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke="currentColor"
              strokeWidth="6"
              className="text-slate-800/80"
              fill="transparent"
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke="currentColor"
              strokeWidth="6"
              className="text-amber-500 transition-all duration-1000 ease-linear"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              data-testid="power-recovery-countdown"
              className="text-2xl font-black text-amber-400 tracking-tight font-mono"
            >
              {`${secondsLeft}s`}
            </span>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
              Timeout
            </span>
          </div>
        </div>

        {/* Context metadata badge */}
        {checkpoint.journeyTitle && (
          <div className="inline-flex items-center space-x-2 rounded-full border border-slate-700/60 bg-slate-800/60 px-4 py-1.5 text-xs font-medium text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="truncate max-w-[280px]">{checkpoint.journeyTitle}</span>
          </div>
        )}

        {/* Touch-Friendly Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            data-testid="power-recovery-confirm-btn"
            onClick={() => onConfirm(checkpoint)}
            className="w-full sm:w-auto flex-1 min-h-[52px] px-6 rounded-2xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 transition-all shadow-lg shadow-amber-500/25 active:scale-95 flex items-center justify-center space-x-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{`Resume at Screen ${screenNumber}`}</span>
          </button>
          <button
            type="button"
            data-testid="power-recovery-cancel-btn"
            onClick={onDismiss}
            className="w-full sm:w-auto px-6 min-h-[52px] rounded-2xl font-semibold text-sm bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white transition active:scale-95 flex items-center justify-center space-x-2 border border-slate-700/50"
          >
            <XCircle className="w-4 h-4 text-slate-400" />
            <span>Start Over</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PowerRecoveryResumeModal;
