import React, { useState, useEffect } from 'react';
import { Timer, Lock } from 'lucide-react';
import { kioskService } from '../services/kiosk.service';

interface KioskPinOverlayProps {
  journeyId: string;
  onSuccess: () => void;
  onCancel?: () => void;
}

export const KioskPinOverlay: React.FC<KioskPinOverlayProps> = ({
  journeyId,
  onSuccess,
  onCancel
}) => {
  const [pin, setPin] = useState<string[]>([]);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0); // in seconds
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  const handleKeyPress = (num: string) => {
    if (lockoutTime > 0) return;
    if (pin.length < 4) {
      setPin([...pin, num]);
    }
    setError(null);
  };

  const handleBackspace = () => {
    if (lockoutTime > 0) return;
    setPin(pin.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    if (lockoutTime > 0) return;
    setPin([]);
    setError(null);
  };

  // Submit and verify when 4 digits are entered
  useEffect(() => {
    if (pin.length === 4) {
      const submitPin = async () => {
        setIsLoading(true);
        setError(null);
        const pinString = pin.join('');
        
        try {
          const isValid = await kioskService.verifyPin(journeyId, pinString);
          if (isValid) {
            onSuccess();
          } else {
            handleFailure();
          }
        } catch (err: any) {
          handleFailure();
        } finally {
          setIsLoading(false);
        }
      };

      submitPin();
    }
  }, [pin, journeyId, onSuccess]);

  const handleFailure = () => {
    const nextFailed = failedAttempts + 1;
    setFailedAttempts(nextFailed);
    setPin([]); // Clear PIN

    if (nextFailed >= 5) {
      setLockoutTime(60); // 1-minute lockout
      setError('Too many failed attempts. Keypad locked for 60 seconds.');
    } else {
      setError(`Incorrect PIN. ${5 - nextFailed} attempts remaining.`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-md text-white select-none">
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
          
          <h2 className="text-xl font-bold">
            {lockoutTime > 0 ? 'Security Lockout' : 'Enter Security PIN'}
          </h2>
          <p className="text-xs text-slate-400 max-w-xs">
            {lockoutTime > 0 
              ? `Please wait until the security timer expires before retrying.`
              : 'Private Kiosk. Enter your 4-digit organizational PIN code.'}
          </p>
        </div>

        {/* PIN slots display */}
        <div className="flex justify-center space-x-4 my-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={`h-12 w-12 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition ${
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
          <div className="text-center py-1">
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
              disabled={isLoading || lockoutTime > 0}
              onClick={() => handleKeyPress(num)}
              className="h-14 rounded-xl bg-slate-900 border border-slate-850 hover:bg-slate-800 text-lg font-semibold active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition"
            >
              {num}
            </button>
          ))}
          <button
            disabled={isLoading || lockoutTime > 0}
            onClick={handleClear}
            className="h-14 rounded-xl bg-slate-950 border border-slate-900 hover:bg-slate-900 text-xs font-semibold text-slate-400 disabled:opacity-30 disabled:pointer-events-none transition"
          >
            CLEAR
          </button>
          <button
            disabled={isLoading || lockoutTime > 0}
            onClick={() => handleKeyPress('0')}
            className="h-14 rounded-xl bg-slate-900 border border-slate-850 hover:bg-slate-800 text-lg font-semibold active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition"
          >
            0
          </button>
          <button
            disabled={isLoading || lockoutTime > 0}
            onClick={handleBackspace}
            className="h-14 rounded-xl bg-slate-950 border border-slate-900 hover:bg-slate-900 text-xs font-semibold text-slate-400 disabled:opacity-30 disabled:pointer-events-none transition"
          >
            BACK
          </button>
        </div>

        {/* Cancel Button */}
        {onCancel && lockoutTime === 0 && (
          <button
            onClick={onCancel}
            className="w-full mt-6 py-2.5 rounded-lg border border-slate-800 text-sm font-semibold text-slate-400 hover:text-white hover:bg-slate-900 transition"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};
