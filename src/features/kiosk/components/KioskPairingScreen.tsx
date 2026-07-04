import React, { useState, useEffect } from 'react';
import { ShieldCheck, Monitor, HelpCircle, ArrowRight, CheckCircle } from 'lucide-react';
import { kioskService } from '../services/kiosk.service';

interface KioskPairingScreenProps {
  onPairSuccess: (device: any, token: string) => void;
}

export const KioskPairingScreen: React.FC<KioskPairingScreenProps> = ({ onPairSuccess }) => {
  const [deviceId, setDeviceId] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [pairCode, setPairCode] = useState<string[]>([]);
  const [step, setStep] = useState<1 | 2>(1); // 1: Info & Config, 2: Enter Pairing Code
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Generate or retrieve persistent hardware device ID
  useEffect(() => {
    let storedId = localStorage.getItem('kiosk_device_id');
    if (!storedId) {
      storedId = 'kiosk-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
      localStorage.setItem('kiosk_device_id', storedId);
    }
    setDeviceId(storedId);
    
    // Set default name based on device info
    setName(localStorage.getItem('kiosk_device_name') || 'Kiosk Tablet ' + Math.random().toString(36).substring(2, 6).toUpperCase());
    setLocation(localStorage.getItem('kiosk_device_location') || 'Reception Lobby');
  }, []);

  const handleKeyPress = (num: string) => {
    if (pairCode.length < 6) {
      setPairCode([...pairCode, num]);
    }
    setError(null);
  };

  const handleBackspace = () => {
    setPairCode(pairCode.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPairCode([]);
    setError(null);
  };

  const handleStartPairing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !location.trim()) {
      setError('Please fill in both name and location.');
      return;
    }
    localStorage.setItem('kiosk_device_name', name);
    localStorage.setItem('kiosk_device_location', location);
    setStep(2);
    setError(null);
  };

  // Auto-submit when 6 digits are reached
  useEffect(() => {
    if (pairCode.length === 6) {
      const submitPairing = async () => {
        setIsLoading(true);
        setError(null);
        const codeString = pairCode.join('');
        try {
          const result = await kioskService.pairDevice({
            code: codeString,
            deviceId,
            name,
            location
          });
          
          setIsSuccess(true);
          // Wait 1.5s to show success state before triggering callback
          setTimeout(() => {
            onPairSuccess(result.device, result.token);
          }, 1500);
        } catch (err: any) {
          setError(err?.response?.data?.message || err?.message || 'Invalid or expired pairing code. Please try again.');
          setPairCode([]); // Clear code on failure
        } finally {
          setIsLoading(false);
        }
      };
      
      submitPairing();
    }
  }, [pairCode, deviceId, name, location, onPairSuccess]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-950 px-6 text-white select-none">
      <div className="w-full max-w-md rounded-2xl border border-slate-900 bg-slate-900/40 p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        
        {/* Glow Effects */}
        <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-sky-500/10 blur-3xl" />

        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
            <CheckCircle className="h-16 w-16 text-emerald-500 animate-bounce" />
            <h2 className="mt-4 text-2xl font-bold text-slate-100">Device Linked!</h2>
            <p className="mt-2 text-slate-400 text-sm">Initializing Kiosk secure workspace...</p>
          </div>
        ) : step === 1 ? (
          <form onSubmit={handleStartPairing} className="space-y-6">
            <div className="flex flex-col items-center text-center">
              <Monitor className="h-12 w-12 text-emerald-500 mb-3" />
              <h2 className="text-2xl font-bold text-slate-100">Setup Kiosk Device</h2>
              <p className="mt-2 text-sm text-slate-400">Specify this device's name and physical location inside your building.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Device Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm text-white focus:border-emerald-500 focus:outline-none transition"
                  placeholder="e.g. Factory Entrance Gate A"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Location / Zone
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm text-white focus:border-emerald-500 focus:outline-none transition"
                  placeholder="e.g. Ground Floor Main Lobby"
                  required
                />
              </div>

              <div className="rounded-lg bg-slate-950/50 border border-slate-900 p-3 text-[11px] text-slate-500 font-mono flex items-center justify-between">
                <span>HW ID: {deviceId.substring(0, 18)}...</span>
                <span className="text-slate-600">Locked</span>
              </div>
            </div>

            {error && <p className="text-xs text-rose-400 text-center">{error}</p>}

            <button
              type="submit"
              className="w-full rounded-lg bg-emerald-500 p-3 font-bold text-slate-950 hover:bg-emerald-400 transition flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/10 active:scale-95"
            >
              <span>Continue Setup</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col items-center text-center">
              <ShieldCheck className="h-12 w-12 text-emerald-500 mb-3" />
              <h2 className="text-2xl font-bold text-slate-100">Enter Pairing Code</h2>
              <p className="mt-2 text-sm text-slate-400">
                Type the 6-digit code displayed in your Admin Portal for <strong>{name}</strong>.
              </p>
            </div>

            {/* Code display boxes */}
            <div className="flex justify-between max-w-[280px] mx-auto py-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-11 w-9 rounded-lg border flex items-center justify-center text-xl font-bold transition-all ${
                    pairCode[i]
                      ? 'border-emerald-500 bg-emerald-500/5 text-emerald-400'
                      : i === pairCode.length
                      ? 'border-sky-500 animate-pulse bg-slate-950/50 text-white'
                      : 'border-slate-800 bg-slate-950/30 text-slate-500'
                  }`}
                >
                  {pairCode[i] || ''}
                </div>
              ))}
            </div>

            {error && <p className="text-xs text-rose-400 text-center">{error}</p>}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3 max-w-[300px] mx-auto pt-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  disabled={isLoading}
                  onClick={() => handleKeyPress(num)}
                  className="h-14 rounded-lg bg-slate-900/80 border border-slate-850 hover:bg-slate-800 text-lg font-semibold active:scale-95 transition"
                >
                  {num}
                </button>
              ))}
              <button
                disabled={isLoading}
                onClick={handleClear}
                className="h-14 rounded-lg bg-slate-950/50 border border-slate-900 hover:bg-slate-900 text-xs font-semibold tracking-wider text-slate-400 transition"
              >
                CLEAR
              </button>
              <button
                disabled={isLoading}
                onClick={() => handleKeyPress('0')}
                className="h-14 rounded-lg bg-slate-900/80 border border-slate-850 hover:bg-slate-800 text-lg font-semibold active:scale-95 transition"
              >
                0
              </button>
              <button
                disabled={isLoading}
                onClick={handleBackspace}
                className="h-14 rounded-lg bg-slate-950/50 border border-slate-900 hover:bg-slate-900 text-xs font-semibold tracking-wider text-slate-400 transition"
              >
                BACK
              </button>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-500 pt-2 border-t border-slate-900">
              <button onClick={() => setStep(1)} className="hover:text-slate-400 transition">
                Change details
              </button>
              <span className="flex items-center space-x-1">
                <HelpCircle className="h-3 w-3" />
                <span>Pairing mode</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
