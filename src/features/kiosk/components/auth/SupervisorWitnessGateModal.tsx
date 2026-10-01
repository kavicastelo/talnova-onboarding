import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, X, Delete, CheckCircle2 } from 'lucide-react';
import { kioskService } from '../../services/kiosk.service';

export interface SupervisorWitnessGateModalProps {
  isOpen: boolean;
  sessionId?: string;
  workerName?: string;
  journeyTitle?: string;
  onClose: () => void;
  onSuccess: (witnessData: {
    verified: boolean;
    supervisor: {
      id: string;
      fullName?: string;
      name?: string;
      email?: string;
      role?: string;
      badgeId?: string;
    };
    witnessToken?: string;
    session?: any;
  }) => void;
  highContrast?: boolean;
}

/**
 * Synthesizes a dual-tone harmonic confirmation chime upon successful witness verification
 * using the Web Audio API without requiring external audio assets.
 */
export const playConfirmationChime = () => {
  try {
    const globalScope: any = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
    if (!globalScope) return;
    const AudioContextClass = globalScope.AudioContext || globalScope.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Tone 1: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Tone 2: 880 Hz (A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.25, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.45);
  } catch {
    // AudioContext blocked or not supported in test environment
  }
};

export const SupervisorWitnessGateModal: React.FC<SupervisorWitnessGateModalProps> = ({
  isOpen,
  sessionId,
  workerName,
  journeyTitle,
  onClose,
  onSuccess,
  highContrast = false
}) => {
  const { t } = useTranslation('kiosk');

  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);

  // Requirement 3: Inactivity timer (30 seconds) to clear entered PIN
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(() => {
      setPin([]);
    }, 30000);
  }, []);

  // Reset state when modal is opened or closed
  useEffect(() => {
    if (isOpen) {
      setIdentifier('');
      setPin([]);
      setErrorMessage(null);
      setIsShaking(false);
      setIsSubmitting(false);
    }
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [isOpen]);

  // Monitor PIN entry for 30s inactivity auto-clear
  useEffect(() => {
    if (pin.length > 0) {
      resetInactivityTimer();
    } else if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
  }, [pin, resetInactivityTimer]);

  if (!isOpen) return null;

  // Keypad click handlers
  const handleDigitPress = (digit: string) => {
    if (isSubmitting) return;
    setErrorMessage(null);
    resetInactivityTimer();

    if (pin.length < 4) {
      const nextPin = [...pin, digit];
      setPin(nextPin);
      if (nextPin.length === 4 && identifier.trim()) {
        executeVerification(identifier.trim(), nextPin.join(''));
      }
    }
  };

  const handleBackspace = () => {
    if (isSubmitting) return;
    setErrorMessage(null);
    resetInactivityTimer();
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (isSubmitting) return;
    setErrorMessage(null);
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    setPin([]);
  };

  // Verification submission
  const executeVerification = async (supervisorIdentifier: string, pinString: string) => {
    if (!supervisorIdentifier) {
      setErrorMessage(
        t('supervisor.missingIdentifier', {
          defaultValue: 'Please enter your supervisor badge ID or email.'
        })
      );
      return;
    }

    if (pinString.length !== 4) {
      setErrorMessage(
        t('supervisor.invalidPinLength', {
          defaultValue: 'Please enter a 4-digit PIN.'
        })
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await kioskService.verifySupervisorPin(
        supervisorIdentifier,
        pinString,
        sessionId
      );

      if (result && result.verified) {
        // Play confirmation sound chime
        playConfirmationChime();

        onSuccess({
          verified: true,
          supervisor: result.supervisor,
          witnessToken: result.witnessToken,
          session: result.session
        });
      } else {
        handleVerificationFailure(
          t('supervisor.invalidPin', {
            defaultValue: 'Invalid supervisor authorization PIN.'
          })
        );
      }
    } catch (err: any) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        t('supervisor.invalidPin', {
          defaultValue: 'Invalid supervisor authorization PIN.'
        });
      handleVerificationFailure(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerificationFailure = (message: string) => {
    setErrorMessage(message);
    setIsShaking(true);
    setPin([]); // Clear PIN upon failure
    setTimeout(() => {
      setIsShaking(false);
    }, 600);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pin.length === 4 && identifier.trim()) {
      executeVerification(identifier.trim(), pin.join(''));
    } else if (!identifier.trim()) {
      setErrorMessage(
        t('supervisor.missingIdentifier', {
          defaultValue: 'Please enter your supervisor badge ID or email.'
        })
      );
    } else {
      setErrorMessage(
        t('supervisor.enterPinPrompt', {
          defaultValue: 'Please enter your complete 4-digit authorization PIN.'
        })
      );
    }
  };

  return (
    <div
      id="supervisor-witness-gate-modal"
      data-testid="supervisor-witness-gate-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="supervisor-gate-title"
      aria-describedby="supervisor-gate-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/90 backdrop-blur-md select-none animate-fade-in"
    >
      <style>{`
        @keyframes shakeKeypad {
          0%, 100% { transform: translateX(0); }
          15%, 45%, 75% { transform: translateX(-8px); }
          30%, 60%, 90% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shakeKeypad 0.5s ease-in-out;
        }
      `}</style>

      <div
        className={`relative w-full max-w-lg rounded-3xl border shadow-2xl p-6 sm:p-8 overflow-hidden transition-colors ${
          highContrast
            ? 'bg-black border-2 border-amber-400 text-white'
            : 'bg-slate-900 border-slate-800 text-white'
        }`}
      >
        {/* Glow accent */}
        <div className="absolute -top-24 -left-24 w-52 h-52 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div
              className={`p-3 rounded-2xl flex items-center justify-center ${
                highContrast
                  ? 'bg-amber-400 text-black'
                  : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
              }`}
            >
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <h2
                id="supervisor-gate-title"
                data-testid="supervisor-gate-title"
                className="text-xl sm:text-2xl font-bold tracking-tight text-white"
              >
                {t('supervisor.title', { defaultValue: 'Supervisor Witness Required' })}
              </h2>
              <span className="text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider">
                {t('supervisor.coSignature', { defaultValue: 'Dual-Custody Co-Signature Gate' })}
              </span>
            </div>
          </div>
          <button
            type="button"
            data-testid="supervisor-modal-close-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Context description */}
        <div className="mt-4 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs sm:text-sm text-slate-300">
          <p id="supervisor-gate-desc" data-testid="supervisor-gate-desc">
            {workerName ? (
              <span>
                Worker <strong className="text-white">{workerName}</strong> has completed{' '}
                <strong className="text-emerald-400">{journeyTitle || 'this safety briefing'}</strong>.
              </span>
            ) : (
              <span>
                Completion of <strong className="text-emerald-400">{journeyTitle || 'this safety briefing'}</strong>{' '}
                requires on-site physical witnessing and authorization.
              </span>
            )}
          </p>
          <p className="mt-1 text-slate-400 text-[11px]">
            {t('supervisor.policyNotice', {
              defaultValue: 'An authorized supervisor must enter their credentials to confirm PPE/safety adherence.'
            })}
          </p>
        </div>

        {/* Supervisor Identifier Input (Email, Badge ID, Employee ID) */}
        <div className="mt-5 space-y-1.5">
          <label
            htmlFor="supervisor-identifier-input"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
          >
            {t('supervisor.identifierLabel', { defaultValue: 'Supervisor Email or Badge ID' })}
          </label>
          <input
            id="supervisor-identifier-input"
            data-testid="supervisor-identifier-input"
            type="text"
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              resetInactivityTimer();
              setErrorMessage(null);
            }}
            placeholder={t('supervisor.identifierPlaceholder', {
              defaultValue: 'Enter supervisor email or badge ID'
            })}
            disabled={isSubmitting}
            className={`w-full min-h-[52px] px-4 rounded-xl border text-sm font-medium transition focus:outline-none focus:ring-2 ${
              highContrast
                ? 'bg-black border-2 border-white text-white focus:ring-amber-400'
                : 'bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20'
            }`}
          />
        </div>

        {/* PIN Slot Indicators with shake animation */}
        <div className="mt-5 text-center">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            {t('supervisor.pinLabel', { defaultValue: '4-Digit Authorization PIN' })}
          </label>

          <div
            id="supervisor-pin-slots"
            data-testid="supervisor-pin-slots"
            className={`flex justify-center items-center gap-3 py-1 ${
              isShaking ? 'animate-shake' : ''
            }`}
          >
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = pin[idx] !== undefined;
              return (
                <div
                  key={idx}
                  id={`pin-slot-${idx}`}
                  data-testid={`pin-slot-${idx}`}
                  className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                    isFilled
                      ? highContrast
                        ? 'bg-amber-400 border-amber-300 text-black'
                        : 'bg-emerald-500/20 border-emerald-400 text-emerald-400 shadow-lg shadow-emerald-500/20 scale-105'
                      : highContrast
                      ? 'bg-black border-white/60 text-transparent'
                      : 'bg-slate-950 border-slate-800 text-transparent'
                  }`}
                >
                  {isFilled ? '●' : '○'}
                </div>
              );
            })}
          </div>
        </div>

        {/* Error message banner */}
        {errorMessage && (
          <div
            id="supervisor-pin-error"
            data-testid="supervisor-pin-error"
            role="alert"
            className="mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs text-center font-medium animate-fade-in"
          >
            {errorMessage}
          </div>
        )}

        {/* Touch-Friendly Numeric Keypad with 64x64px keys (Requirement 1) */}
        <div
          id="supervisor-pin-keypad"
          data-testid="supervisor-pin-keypad"
          className={`grid grid-cols-3 gap-2.5 sm:gap-3 max-w-[260px] mx-auto mt-4 place-items-center ${
            isShaking ? 'animate-shake' : ''
          }`}
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              id={`keypad-${digit}`}
              data-testid={`keypad-${digit}`}
              disabled={isSubmitting}
              onClick={() => handleDigitPress(digit)}
              className={`w-16 h-16 min-w-[64px] min-h-[64px] rounded-2xl border text-xl font-bold flex items-center justify-center transition active:scale-95 disabled:opacity-40 ${
                highContrast
                  ? 'bg-black border-2 border-white text-white hover:bg-white/20 active:bg-white/30'
                  : 'bg-slate-950/80 border-slate-800 text-slate-100 hover:bg-slate-800 hover:border-slate-700 active:bg-slate-750'
              }`}
            >
              {digit}
            </button>
          ))}

          {/* Clear Key */}
          <button
            type="button"
            id="keypad-clear"
            data-testid="keypad-clear"
            disabled={isSubmitting || pin.length === 0}
            onClick={handleClear}
            className={`w-16 h-16 min-w-[64px] min-h-[64px] rounded-2xl border text-xs font-bold uppercase tracking-wider flex items-center justify-center transition active:scale-95 disabled:opacity-30 ${
              highContrast
                ? 'bg-black border-2 border-amber-400 text-amber-300 hover:bg-amber-400/20'
                : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            {t('supervisor.clear', { defaultValue: 'CLEAR' })}
          </button>

          {/* 0 Key */}
          <button
            type="button"
            id="keypad-0"
            data-testid="keypad-0"
            disabled={isSubmitting}
            onClick={() => handleDigitPress('0')}
            className={`w-16 h-16 min-w-[64px] min-h-[64px] rounded-2xl border text-xl font-bold flex items-center justify-center transition active:scale-95 disabled:opacity-40 ${
              highContrast
                ? 'bg-black border-2 border-white text-white hover:bg-white/20 active:bg-white/30'
                : 'bg-slate-950/80 border-slate-800 text-slate-100 hover:bg-slate-800 hover:border-slate-700 active:bg-slate-750'
            }`}
          >
            0
          </button>

          {/* Backspace Key */}
          <button
            type="button"
            id="keypad-back"
            data-testid="keypad-back"
            disabled={isSubmitting || pin.length === 0}
            onClick={handleBackspace}
            className={`w-16 h-16 min-w-[64px] min-h-[64px] rounded-2xl border text-xs font-bold uppercase tracking-wider flex items-center justify-center transition active:scale-95 disabled:opacity-30 ${
              highContrast
                ? 'bg-black border-2 border-white text-white hover:bg-white/20'
                : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Actions */}
        <div className="mt-6 flex flex-col-reverse sm:flex-row items-center gap-3 pt-4 border-t border-slate-800">
          {/* Requirement 2: Cancel Button */}
          <button
            type="button"
            id="supervisor-cancel-btn"
            data-testid="supervisor-cancel-btn"
            disabled={isSubmitting}
            onClick={onClose}
            className={`w-full sm:w-1/2 min-h-[52px] px-4 rounded-xl border text-sm font-semibold transition active:scale-95 ${
              highContrast
                ? 'border-white text-white hover:bg-white/20'
                : 'border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {t('supervisor.cancel', { defaultValue: 'Cancel' })}
          </button>

          {/* Submit Button */}
          <button
            type="button"
            id="supervisor-submit-btn"
            data-testid="supervisor-submit-btn"
            disabled={isSubmitting || pin.length < 4 || !identifier.trim()}
            onClick={() => handleSubmit()}
            className={`w-full sm:w-1/2 min-h-[52px] px-4 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 transition active:scale-95 shadow-lg ${
              pin.length < 4 || !identifier.trim() || isSubmitting
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50'
                : highContrast
                ? 'bg-amber-400 text-black border-2 border-amber-300 hover:bg-amber-300'
                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/20'
            }`}
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                <span>{t('supervisor.authorize', { defaultValue: 'Authorize & Sign Off' })}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupervisorWitnessGateModal;
