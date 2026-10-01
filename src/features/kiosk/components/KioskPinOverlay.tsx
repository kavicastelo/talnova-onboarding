import React, { useState, useEffect, useCallback } from 'react';
import { Timer, Lock } from 'lucide-react';
import { kioskService } from '../services/kiosk.service';

export interface KioskPinOverlayProps {
  journeyId: string;
  pinLength?: number;
  expectedPin?: string;
  title?: string;
  description?: string;
  onSuccess: () => void;
  onCancel?: () => void;
  onVerify?: (pin: string) => Promise<boolean> | boolean;
}

export const KioskPinOverlay: React.FC<KioskPinOverlayProps> = ({
  journeyId,
  pinLength = 6,
  expectedPin,
  title,
  description,
  onSuccess,
  onCancel,
  onVerify
}) => {
  const [pin, setPin] = useState<string[]>([]);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0); // in seconds
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const targetLength = pinLength || 6;

  // Handle lockout countdown
  useEffect(() => {
    if (lockoutTime <= 0) return;

    const interval = setInterval(() => {
      setLockoutTime((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setFailedAttempts(0); // Reset failures on lockout expiry
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutTime]);

  const handleKeyPress = useCallback((num: string) => {
    if (lockoutTime > 0) return;
    setPin((prev) => {
      if (prev.length < targetLength) {
        return [...prev, num];
      }
      return prev;
    });
    setError(null);
  }, [lockoutTime, targetLength]);

  const handleBackspace = useCallback(() => {
    if (lockoutTime > 0) return;
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  }, [lockoutTime]);

  const handleClear = useCallback(() => {
    if (lockoutTime > 0) return;
    setPin([]);
    setError(null);
  }, [lockoutTime]);

  // Keyboard shortcut listener inside the overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lockoutTime > 0) return;
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape' && onCancel) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lockoutTime, handleKeyPress, handleBackspace, onCancel]);

  const handleFailure = useCallback(() => {
    const nextFailed = failedAttempts + 1;
    setFailedAttempts(nextFailed);
    setPin([]); // Clear PIN

    if (nextFailed >= 5) {
      setLockoutTime(60); // 1-minute lockout
      setError('Too many failed attempts. Keypad locked for 60 seconds.');
    } else {
      setError(`Incorrect PIN. ${5 - nextFailed} attempts remaining.`);
    }
  }, [failedAttempts]);

  // Submit and verify when target length digits are entered
  useEffect(() => {
    if (pin.length === targetLength) {
      let isMounted = true;

      const submitPin = async () => {
        setIsLoading(true);
        setError(null);
        const pinString = pin.join('');

        try {
          let isValid = false;

          if (onVerify) {
            isValid = await onVerify(pinString);
          } else if (expectedPin) {
            isValid = pinString === expectedPin;
          } else {
            isValid = await kioskService.verifyPin(journeyId, pinString);
          }

          if (!isMounted) return;

          if (isValid) {
            onSuccess();
          } else {
            handleFailure();
          }
        } catch (err: any) {
          if (isMounted) {
            handleFailure();
          }
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      };

      submitPin();

      return () => {
        isMounted = false;
      };
    }
  }, [pin, targetLength, journeyId, expectedPin, onVerify, onSuccess, handleFailure]);

  return (
    <div
      id="kiosk-pin-overlay"
      data-testid="kiosk-pin-overlay"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-md text-white select-none"
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-900 bg-slate-900/60 p-8 shadow-2xl relative">
        <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-rose-500/5 blur-3xl" />

        <div className="flex flex-col items-center text-center space-y-4">
          <div className="p-4 rounded-full bg-slate-950 border border-slate-800">
            {lockoutTime > 0 ? (
              <Timer className="h-10 w-10 text-rose-500 animate-pulse" />
            ) : (
              <Lock className="h-10 w-10 text-emerald-400" />
            )}
          </div>

          <h2 id="kiosk-pin-title" data-testid="kiosk-pin-title" className="text-xl font-bold">
            {title || (lockoutTime > 0 ? 'Security Lockout' : 'Enter Security PIN')}
          </h2>
          <p id="kiosk-pin-desc" data-testid="kiosk-pin-desc" className="text-xs text-slate-400 max-w-xs">
            {description ||
              (lockoutTime > 0
                ? 'Please wait until the security timer expires before retrying.'
                : `Private Kiosk. Enter your ${targetLength}-digit administrative Exit PIN code.`)}
          </p>
        </div>

        {/* PIN slots display */}
        <div className="flex justify-center space-x-2.5 sm:space-x-3 my-6">
          {Array.from({ length: targetLength }).map((_, i) => (
            <div
              key={i}
              data-testid={`kiosk-pin-slot-${i}`}
              className={`h-11 w-11 sm:h-12 sm:w-12 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition ${
                pin[i]
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                  : lockoutTime > 0
                  ? 'border-rose-950 bg-rose-950/10 text-slate-600'
                  : 'border-slate-800 bg-slate-950/30'
              }`}
            >
              {pin[i] ? '•' : ''}
            </div>
          ))}
        </div>

        {/* Error / Lockout Display */}
        {error && (
          <div data-testid="kiosk-pin-error" className="text-center py-1">
            <p className={`text-xs ${lockoutTime > 0 ? 'text-rose-500 font-bold' : 'text-rose-400'}`}>
              {error}
            </p>
            {lockoutTime > 0 && (
              <p className="text-2xl font-extrabold text-white mt-2 font-mono">
                {lockoutTime}s
              </p>
            )}
          </div>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto mt-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              id={`kiosk-keypad-btn-${num}`}
              data-testid={`kiosk-keypad-btn-${num}`}
              disabled={isLoading || lockoutTime > 0}
              onClick={() => handleKeyPress(num)}
              className="min-h-[48px] min-w-[48px] h-14 rounded-xl bg-slate-900 border border-slate-850 hover:bg-slate-800 text-lg font-semibold active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition flex items-center justify-center"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            id="kiosk-keypad-clear"
            data-testid="kiosk-keypad-clear"
            disabled={isLoading || lockoutTime > 0}
            onClick={handleClear}
            className="min-h-[48px] min-w-[48px] h-14 rounded-xl bg-slate-950 border border-slate-900 hover:bg-slate-900 text-xs font-semibold text-slate-400 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition flex items-center justify-center"
          >
            CLEAR
          </button>
          <button
            type="button"
            id="kiosk-keypad-btn-0"
            data-testid="kiosk-keypad-btn-0"
            disabled={isLoading || lockoutTime > 0}
            onClick={() => handleKeyPress('0')}
            className="min-h-[48px] min-w-[48px] h-14 rounded-xl bg-slate-900 border border-slate-850 hover:bg-slate-800 text-lg font-semibold active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition flex items-center justify-center"
          >
            0
          </button>
          <button
            type="button"
            id="kiosk-keypad-back"
            data-testid="kiosk-keypad-back"
            disabled={isLoading || lockoutTime > 0}
            onClick={handleBackspace}
            className="min-h-[48px] min-w-[48px] h-14 rounded-xl bg-slate-950 border border-slate-900 hover:bg-slate-900 text-xs font-semibold text-slate-400 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition flex items-center justify-center"
          >
            BACK
          </button>
        </div>

        {/* Cancel Button */}
        {onCancel && lockoutTime === 0 && (
          <button
            type="button"
            id="kiosk-pin-cancel-btn"
            data-testid="kiosk-pin-cancel-btn"
            onClick={onCancel}
            className="w-full mt-6 min-h-[48px] min-w-[48px] h-12 py-3 rounded-xl border border-slate-800 text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 transition flex items-center justify-center"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

export default KioskPinOverlay;
