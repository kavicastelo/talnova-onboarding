/**
 * Talnova Kiosk Terminal - Runtime Crash Watchdog & Error Boundary (K-REL-001)
 *
 * Prevents unattended kiosk terminals from freezing or displaying a blank screen
 * upon unhandled JavaScript exceptions.
 *
 * Scope:
 * 1. Captures stack trace, active step index, and terminal ID to IndexedDB diagnostic logs.
 * 2. Displays reassuring visual screen:
 *    "We encountered a temporary briefing issue. Automatically restarting in 5 seconds..."
 *    with an animated circular progress ring.
 * 3. Restores mid-session state from IndexedDB checkpoint.
 * 4. Detects repeated crashes (>2 within 60s), purges corrupted session state,
 *    and returns cleanly to the Multi-Journey Home Screen.
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { RotateCcw, AlertTriangle, Home, ShieldCheck } from 'lucide-react';
import {
  KioskDiagnosticLogRecord,
  KioskSessionCheckpoint
} from '../../../types/kiosk/diagnostic.types';
import { kioskWatchdogService } from '../services/kiosk-watchdog.service';
import { deviceIdentityService } from '../services/device-identity.service';

export interface KioskErrorBoundaryProps {
  children: ReactNode;
  terminalId?: string;
  activeJourneyId?: string | null;
  activeStepIndex?: number | null;
  onRecover?: (checkpoint?: KioskSessionCheckpoint | null) => void;
  onResetToHome?: () => void;
  fallback?: (props: {
    error: Error | null;
    countdown: number;
    isCrashLoop: boolean;
    restoredCheckpoint: KioskSessionCheckpoint | null;
    onRestart: () => void;
    onHome: () => void;
  }) => ReactNode;
  countdownSeconds?: number; // default: 5
  crashWindowMs?: number; // default: 60000 (60s)
  crashThreshold?: number; // default: 2 (>2 crashes within 60s)
  autoRestart?: boolean; // default: true
}

export interface KioskErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  countdown: number;
  isCrashLoop: boolean;
  restoredCheckpoint: KioskSessionCheckpoint | null;
  diagnosticRecord: KioskDiagnosticLogRecord | null;
}

export class KioskErrorBoundary extends Component<KioskErrorBoundaryProps, KioskErrorBoundaryState> {
  private timer: NodeJS.Timeout | null = null;

  constructor(props: KioskErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      countdown: props.countdownSeconds ?? 5,
      isCrashLoop: false,
      restoredCheckpoint: null,
      diagnosticRecord: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<KioskErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.handleException(error, errorInfo);
  }

  componentWillUnmount(): void {
    this.clearCountdown();
  }

  private clearCountdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async handleException(error: Error, errorInfo: ErrorInfo): Promise<void> {
    const {
      terminalId,
      activeJourneyId,
      activeStepIndex,
      crashWindowMs,
      crashThreshold,
      autoRestart = true,
      countdownSeconds = 5
    } = this.props;

    // 1. Resolve terminal identity
    const resolvedTerminalId =
      terminalId ||
      deviceIdentityService.getHardwareGuidSync() ||
      deviceIdentityService.getStoredDevice()?.deviceId ||
      'terminal-watchdog-active';

    // 2. Resolve active step index: check props or inspect mid-session checkpoint
    let resolvedStepIndex = typeof activeStepIndex === 'number' ? activeStepIndex : null;
    let checkpoint: KioskSessionCheckpoint | null = null;

    if (activeJourneyId) {
      checkpoint = await kioskWatchdogService.getCheckpoint(activeJourneyId);
      if (resolvedStepIndex === null && checkpoint) {
        resolvedStepIndex = checkpoint.stepIndex;
      }
    } else {
      checkpoint = await kioskWatchdogService.getLastCheckpoint();
      if (resolvedStepIndex === null && checkpoint) {
        resolvedStepIndex = checkpoint.stepIndex;
      }
    }

    // 3. Record crash in IndexedDB diagnostic logs and inspect crash loop threshold
    const crashResult = await kioskWatchdogService.recordCrash({
      error,
      errorInfo,
      terminalId: resolvedTerminalId,
      activeStepIndex: resolvedStepIndex,
      journeyId: activeJourneyId || checkpoint?.journeyId || null,
      windowMs: crashWindowMs,
      threshold: crashThreshold
    });

    const isLoop = crashResult.isCrashLoop;

    const nextState: Partial<KioskErrorBoundaryState> = {
      hasError: true,
      error,
      errorInfo,
      countdown: countdownSeconds,
      isCrashLoop: isLoop,
      restoredCheckpoint: checkpoint,
      diagnosticRecord: crashResult.logRecord
    };
    this.state = { ...this.state, ...nextState } as KioskErrorBoundaryState;
    this.setState(nextState as KioskErrorBoundaryState);

    // 4. Repeated crashes (>2 within 60s): Purge corrupted session state and return to Home Screen
    if (isLoop) {
      console.warn(
        `[KioskErrorBoundary] Crash loop detected (${crashResult.crashCount} crashes in 60s). Purging corrupted session state...`
      );
      await kioskWatchdogService.purgeCheckpoint(activeJourneyId || undefined);

      if (this.props.onResetToHome) {
        this.props.onResetToHome();
      }
      return;
    }

    // 5. Single / recoverable crash: start 5-second automatic restart countdown
    if (autoRestart) {
      this.startCountdown();
    }
  }

  private startCountdown(): void {
    this.clearCountdown();
    this.timer = setInterval(() => {
      const nextCountdown = Math.max(0, this.state.countdown - 1);
      this.state = { ...this.state, countdown: nextCountdown };
      this.setState({ countdown: nextCountdown });
      if (nextCountdown === 0) {
        this.handleSoftRecovery();
      }
    }, 1000);
  }

  public handleSoftRecovery = (): void => {
    this.clearCountdown();
    const checkpoint = this.state.restoredCheckpoint;

    // Reset error boundary state
    const nextState = {
      hasError: false,
      error: null,
      errorInfo: null,
      isCrashLoop: false,
      countdown: this.props.countdownSeconds ?? 5
    };
    this.state = { ...this.state, ...nextState };
    this.setState(nextState);

    // Trigger recovery callback with checkpoint if mid-session
    if (this.props.onRecover) {
      this.props.onRecover(checkpoint);
    }
  };

  public handleManualExitToHome = async (): Promise<void> => {
    this.clearCountdown();
    // Purge checkpoint and reset crash history
    await kioskWatchdogService.purgeCheckpoint(this.props.activeJourneyId || undefined);
    kioskWatchdogService.resetCrashHistory();

    const nextState = {
      hasError: false,
      error: null,
      errorInfo: null,
      isCrashLoop: false
    };
    this.state = { ...this.state, ...nextState };
    this.setState(nextState);

    if (this.props.onResetToHome) {
      this.props.onResetToHome();
    } else if (typeof window !== 'undefined') {
      window.location.href = '/kiosk/terminal';
    }
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback({
        error: this.state.error,
        countdown: this.state.countdown,
        isCrashLoop: this.state.isCrashLoop,
        restoredCheckpoint: this.state.restoredCheckpoint,
        onRestart: this.handleSoftRecovery,
        onHome: this.handleManualExitToHome
      });
    }

    const {
      countdown,
      isCrashLoop,
      restoredCheckpoint,
      diagnosticRecord
    } = this.state;
    const initialCountdown = this.props.countdownSeconds ?? 5;

    // Animated SVG progress ring math
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.max(0, Math.min(1, countdown / initialCountdown));
    const strokeDashoffset = circumference - progress * circumference;

    return (
      <div
        data-testid="kiosk-error-boundary-view"
        className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-950 px-6 py-12 text-white select-none relative overflow-hidden font-sans"
      >
        {/* Ambient Industrial Glows */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-amber-600/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-indigo-600/15 blur-3xl pointer-events-none" />

        {/* Watchdog Glassmorphism Card */}
        <div
          data-testid="watchdog-recovery-card"
          className="relative z-10 w-full max-w-xl rounded-3xl border border-amber-500/25 bg-slate-900/90 backdrop-blur-2xl p-8 sm:p-10 shadow-2xl shadow-black/60 text-center space-y-8"
        >
          {/* Header Icon */}
          <div className="flex justify-center">
            {isCrashLoop ? (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-400 shadow-lg shadow-rose-950/50">
                <AlertTriangle className="h-10 w-10 animate-bounce" />
              </div>
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-950/70 border border-amber-500/40 text-amber-400 shadow-lg shadow-amber-950/50">
                <RotateCcw className="h-10 w-10 animate-spin" style={{ animationDuration: '6s' }} />
              </div>
            )}
          </div>

          {/* Title & Reassuring Visual Message */}
          <div className="space-y-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {isCrashLoop ? 'Session Purged & Reset' : 'System Self-Healing'}
            </h1>

            {/* Reassuring restart message (ADR-011, K-REL-001 Acceptance Criteria) */}
            <p
              data-testid="watchdog-countdown-message"
              className="text-base sm:text-lg font-medium text-slate-200 leading-relaxed"
            >
              {isCrashLoop
                ? 'Repeated briefing issues detected. Corrupted session data has been purged. Please select your journey again.'
                : `We encountered a temporary briefing issue. Automatically restarting in ${countdown} seconds...`}
            </p>
          </div>

          {/* Circular Countdown Progress Ring (Shown during recoverable countdown) */}
          {!isCrashLoop && (
            <div className="relative flex items-center justify-center py-2">
              <svg
                data-testid="watchdog-progress-ring"
                className="w-32 h-32 transform -rotate-90"
                viewBox="0 0 100 100"
              >
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="7"
                  className="text-slate-800/80"
                  fill="transparent"
                />
                {/* Animated Dynamic Foreground Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="7"
                  className="text-amber-500 transition-all duration-1000 ease-linear"
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>

              {/* Number in center of progress ring */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  data-testid="watchdog-countdown-number"
                  className="text-3xl font-black text-amber-400 tracking-tight font-mono"
                >
                  {`${countdown}s`}
                </span>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Restart
                </span>
              </div>
            </div>
          )}

          {/* Mid-Session State Recovery Badge */}
          {restoredCheckpoint && (
            <div
              data-testid="watchdog-checkpoint-badge"
              className="inline-flex items-center space-x-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-4 py-1.5 text-xs font-semibold text-emerald-300"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>
                {`Mid-session progress saved at Step ${restoredCheckpoint.stepIndex + 1}. Auto-restoring...`}
              </span>
            </div>
          )}

          {/* Diagnostic Log Capture Info */}
          {diagnosticRecord && (
            <div
              data-testid="watchdog-diagnostic-meta"
              className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400 text-left font-mono space-y-1"
            >
              <div className="flex justify-between">
                <span>Terminal ID:</span>
                <span className="text-slate-200 font-bold">{diagnosticRecord.terminalId}</span>
              </div>
              {diagnosticRecord.activeStepIndex !== null && (
                <div className="flex justify-between">
                  <span>Step Index:</span>
                  <span className="text-slate-200">{diagnosticRecord.activeStepIndex}</span>
                </div>
              )}
              <div className="truncate text-rose-400/90 text-[11px]">
                {`${diagnosticRecord.errorName}: ${diagnosticRecord.errorMessage}`}
              </div>
            </div>
          )}

          {/* Touch-Friendly Action Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {!isCrashLoop ? (
              <>
                <button
                  type="button"
                  data-testid="watchdog-restart-now-btn"
                  onClick={this.handleSoftRecovery}
                  className="w-full sm:w-auto flex-1 min-h-[52px] px-6 rounded-2xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 transition-all shadow-lg shadow-amber-500/25 active:scale-95 flex items-center justify-center space-x-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Restart Now</span>
                </button>
                <button
                  type="button"
                  data-testid="watchdog-exit-home-btn"
                  onClick={this.handleManualExitToHome}
                  className="w-full sm:w-auto px-6 min-h-[52px] rounded-2xl font-semibold text-sm bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white transition active:scale-95 flex items-center justify-center space-x-2 border border-slate-700/50"
                >
                  <Home className="w-4 h-4" />
                  <span>Exit to Home</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                data-testid="watchdog-home-clean-btn"
                onClick={this.handleManualExitToHome}
                className="w-full min-h-[52px] px-6 rounded-2xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-600/25 active:scale-95 flex items-center justify-center space-x-2"
              >
                <Home className="w-4 h-4" />
                <span>Return to Home Screen</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default KioskErrorBoundary;
