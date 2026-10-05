import React, { useState, useEffect } from 'react';
import { ShieldCheck, Monitor, HelpCircle, ArrowRight, CheckCircle, Copy, Check, ChevronLeft } from 'lucide-react';
import { kioskService } from '../services/kiosk.service';
import { deviceIdentityService } from '../services/device-identity.service';
import { mdmEnrollmentService } from '../services/mdm-enrollment.service';
import { KioskRevokedScreen } from './KioskRevokedScreen';
import { useTranslation } from 'react-i18next';

interface KioskPairingScreenProps {
  onPairSuccess: (device: any, token: string) => void;
}

export const KioskPairingScreen: React.FC<KioskPairingScreenProps> = ({ onPairSuccess }) => {
  const { t } = useTranslation('kiosk');
  const [deviceId, setDeviceId] = useState(() => deviceIdentityService.getHardwareGuidSync() || '');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [pairCode, setPairCode] = useState<string[]>([]);
  const [step, setStep] = useState<1 | 2>(1); // 1: Info & Config, 2: Enter Pairing Code
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [copiedGuid, setCopiedGuid] = useState(false);
  const [isRevoked, setIsRevoked] = useState(() => deviceIdentityService.isRevoked());
  const [revocationMessage, setRevocationMessage] = useState<string | undefined>();
  const [isEditingGuid, setIsEditingGuid] = useState(false);
  const [customGuidInput, setCustomGuidInput] = useState('');

  const handleCopyGuid = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const target = deviceId || deviceIdentityService.getHardwareGuidSync() || '';
    if (!target) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(target);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      // Fallback for non-secure contexts or permission restrictions
      const textarea = document.createElement('textarea');
      textarea.value = target;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedGuid(true);
    setTimeout(() => setCopiedGuid(false), 2000);
  };

  // Listen to instantaneous device revocation events
  useEffect(() => {
    const handleRevocation = (event: any) => {
      setIsRevoked(true);
      if (event?.detail?.message) {
        setRevocationMessage(event.detail.message);
      }
    };

    window.addEventListener('talnova:kiosk:device_revoked', handleRevocation);
    return () => {
      window.removeEventListener('talnova:kiosk:device_revoked', handleRevocation);
    };
  }, []);

  // Retrieve or generate persistent cryptographic hardware GUID
  useEffect(() => {
    let isMounted = true;
    deviceIdentityService.getOrCreateHardwareGuid().then((guid) => {
      if (isMounted) {
        setDeviceId(guid);
      }
    });
    
    // Set default name based on device info
    const storedName = localStorage.getItem('kiosk_device_name');
    const defaultSuffix = deviceIdentityService.getHardwareGuidSync()?.substring(0, 4).toUpperCase() || 'TERM';
    setName(storedName || 'Kiosk Tablet ' + defaultSuffix);
    setLocation(localStorage.getItem('kiosk_device_location') || 'Reception Lobby');

    return () => {
      isMounted = false;
    };
  }, []);

  // Zero-Touch MDM Auto-Enrollment (K-ENT-002)
  useEffect(() => {
    if (mdmEnrollmentService.hasMdmConfig()) {
      setIsLoading(true);
      mdmEnrollmentService
        .enrollDevice()
        .then((res) => {
          if (res.success && res.enrolled && res.device && res.token) {
            setIsSuccess(true);
            setTimeout(() => {
              onPairSuccess(res.device, res.token!);
            }, 600);
          } else {
            setIsLoading(false);
          }
        })
        .catch(() => {
          setIsLoading(false);
        });
    }
  }, [onPairSuccess]);

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
          const effectiveDeviceId =
            deviceId ||
            deviceIdentityService.getHardwareGuidSync() ||
            (await deviceIdentityService.getOrCreateHardwareGuid());

          const result = await kioskService.pairDevice({
            code: codeString,
            deviceId: effectiveDeviceId,
            name,
            location
          });
          
          deviceIdentityService.setDeviceCredentials(result.device, result.token);
          setIsSuccess(true);
          // Wait 1.5s to show success state before triggering callback
          setTimeout(() => {
            onPairSuccess(result.device, result.token);
          }, 1500);
        } catch (err: any) {
          const respData = err?.response?.data || {};
          const serverMessage = respData.message || respData.error?.message || err?.message;
          const isMismatch =
            respData.code === 'DEVICE_MISMATCH' ||
            respData.error === 'DEVICE_MISMATCH' ||
            respData.error?.code === 'DEVICE_MISMATCH' ||
            serverMessage?.includes('different hardware GUID') ||
            serverMessage?.includes('hardware GUID');

          const expectedGuid =
            respData.expectedGuid ||
            respData.details?.expectedGuid ||
            (() => {
              const match = serverMessage?.match(/hardware GUID "([^"]+)"/i);
              return match ? match[1] : null;
            })();

          // Seamless auto-alignment: If code was generated for a specific GUID / Asset Tag,
          // align this terminal's hardware GUID and immediately finalize pairing
          if (isMismatch && expectedGuid && expectedGuid !== deviceId) {
            try {
              deviceIdentityService.setCustomHardwareGuid(expectedGuid);
              setDeviceId(expectedGuid);
              const retryResult = await kioskService.pairDevice({
                code: codeString,
                deviceId: expectedGuid,
                name,
                location
              });
              deviceIdentityService.setDeviceCredentials(retryResult.device, retryResult.token);
              setIsSuccess(true);
              setTimeout(() => {
                onPairSuccess(retryResult.device, retryResult.token);
              }, 1500);
              return;
            } catch (retryErr: any) {
              const retryMsg = retryErr?.response?.data?.message || retryErr?.message;
              setError(retryMsg || 'Hardware GUID mismatch.');
              setPairCode([]);
              return;
            }
          }

          if (isMismatch) {
            setError(serverMessage || 'Hardware GUID mismatch.');
          } else {
            setError(serverMessage || t('pairing.invalidOrExpired', 'Invalid or expired pairing code. Please try again.'));
          }
          setPairCode([]); // Clear code on failure
        } finally {
          setIsLoading(false);
        }
      };
      
      submitPairing();
    }
  }, [pairCode, deviceId, name, location, onPairSuccess]);

  if (isRevoked) {
    return (
      <KioskRevokedScreen
        customMessage={revocationMessage}
        onReEnroll={() => {
          setIsRevoked(false);
          deviceIdentityService.clearRevocationStatus();
          setStep(1);
          setPairCode([]);
        }}
      />
    );
  }

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-950 px-6 text-white select-none">
      <div className="w-full max-w-md rounded-2xl border border-slate-900 bg-slate-900/40 p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        
        {/* Glow Effects */}
        <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-sky-500/10 blur-3xl" />

        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
            <CheckCircle className="h-16 w-16 text-emerald-500 animate-bounce" />
            <h2 className="mt-4 text-2xl font-bold text-slate-100">{t('pairing.deviceLinked', 'Device Linked!')}</h2>
            <p className="mt-2 text-slate-400 text-sm">{t('pairing.initializingWorkspace', 'Initializing Kiosk secure workspace...')}</p>
          </div>
        ) : step === 1 ? (
          <form onSubmit={handleStartPairing} className="space-y-6">
            <div className="flex flex-col items-center text-center">
              <Monitor className="h-12 w-12 text-emerald-500 mb-3" />
              <h2 className="text-2xl font-bold text-slate-100">{t('pairing.setupDevice', 'Setup Kiosk Device')}</h2>
              <p className="mt-2 text-sm text-slate-400">{t('pairing.setupSubtitle', "Specify this device's name and physical location inside your building.")}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  {t('pairing.deviceName', 'Device Name')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full min-h-[48px] h-12 rounded-xl border border-slate-800 bg-slate-950/50 px-4 text-sm text-white focus:border-emerald-500 focus:outline-none transition"
                  placeholder={t('pairing.deviceNamePlaceholder', 'e.g. Factory Entrance Gate A')}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  {t('pairing.locationZone', 'Location / Zone')}
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full min-h-[48px] h-12 rounded-xl border border-slate-800 bg-slate-950/50 px-4 text-sm text-white focus:border-emerald-500 focus:outline-none transition"
                  placeholder={t('pairing.locationPlaceholder', 'e.g. Ground Floor Main Lobby')}
                  required
                />
              </div>

              <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3 text-xs text-slate-400 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {t('pairing.hardwareGuid', 'Terminal Hardware GUID')}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomGuidInput(deviceId);
                        setIsEditingGuid(!isEditingGuid);
                      }}
                      className="min-h-[48px] min-w-[48px] px-3 py-3 text-[10px] text-sky-400 hover:text-sky-300 font-medium underline flex items-center justify-center cursor-pointer"
                    >
                      {isEditingGuid ? 'Cancel' : 'Custom Asset Tag'}
                    </button>
                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {t('pairing.ready', 'Ready')}
                    </span>
                  </div>
                </div>

                {isEditingGuid ? (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={customGuidInput}
                      onChange={(e) => setCustomGuidInput(e.target.value)}
                      placeholder="e.g. KIOSK-01 or Asset Tag"
                      className="flex-1 min-h-[48px] font-mono text-xs bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-sky-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const trimmed = customGuidInput.trim();
                        if (trimmed) {
                          deviceIdentityService.setCustomHardwareGuid(trimmed);
                          setDeviceId(trimmed);
                          setIsEditingGuid(false);
                        }
                      }}
                      className="min-h-[48px] min-w-[48px] px-4 py-3 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg shrink-0 flex items-center justify-center cursor-pointer"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span data-testid="kiosk-hardware-guid-display" className="font-mono text-[11px] text-slate-200 select-all break-all">
                      {deviceId || 'Detecting hardware...'}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyGuid}
                      data-testid="copy-guid-btn"
                      className="min-h-[48px] min-w-[48px] p-2.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition shrink-0 flex items-center justify-center gap-1 text-[11px] cursor-pointer"
                      title="Copy Hardware GUID"
                    >
                      {copiedGuid ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-semibold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {error && <p className="text-xs text-rose-400 text-center">{error}</p>}

            <button
              type="submit"
              className="w-full min-h-[64px] min-w-[64px] rounded-xl bg-emerald-500 p-4 font-black text-base text-slate-950 hover:bg-emerald-400 transition flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/10 active:scale-95"
            >
              <span>{t('pairing.continueSetup', 'Continue Setup')}</span>
              <ArrowRight className="h-5 w-5" />
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setPairCode([]);
                  setError(null);
                }}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>{t('pairing.backToInfo', 'Back')}</span>
              </button>
              <span className="font-mono text-[10px] text-slate-500">
                HW: {deviceId ? `${deviceId.substring(0, 8)}...${deviceId.substring(deviceId.length - 4)}` : ''}
              </span>
            </div>

            <div className="flex flex-col items-center text-center">
              <ShieldCheck className="h-12 w-12 text-emerald-500 mb-3" />
              <h2 className="text-2xl font-bold text-slate-100">{t('pairing.enterPairingCode', 'Enter Pairing Code')}</h2>
              <p className="mt-2 text-sm text-slate-400">
                {t('pairing.typeCodeDesc', { name, defaultValue: 'Type the 6-digit code displayed in your Admin Portal for {{name}}.' })}
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

            {error && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900/60 text-xs text-rose-300 space-y-2">
                <p className="leading-relaxed font-medium">{error}</p>
                {(() => {
                  const match = error.match(/hardware GUID "([^"]+)"/i);
                  const expected = match ? match[1] : null;
                  if (!expected) return null;
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        deviceIdentityService.setCustomHardwareGuid(expected);
                        setDeviceId(expected);
                        setError(null);
                        setPairCode([]);
                      }}
                      className="w-full py-2 px-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-semibold text-xs transition text-center"
                    >
                      Align Terminal ID to "{expected}" &amp; Retry
                    </button>
                  );
                })()}
              </div>
            )}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3 max-w-[300px] mx-auto pt-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  disabled={isLoading}
                  onClick={() => handleKeyPress(num)}
                  className="min-h-[48px] min-w-[48px] h-14 rounded-xl bg-slate-900/80 border border-slate-850 hover:bg-slate-800 text-lg font-semibold active:scale-95 transition flex items-center justify-center"
                >
                  {num}
                </button>
              ))}
              <button
                disabled={isLoading}
                onClick={handleClear}
                className="min-h-[48px] min-w-[48px] h-14 rounded-xl bg-slate-950/50 border border-slate-900 hover:bg-slate-900 text-xs font-semibold tracking-wider text-slate-400 active:scale-95 transition flex items-center justify-center"
              >
                {t('pairing.clear', 'CLEAR')}
              </button>
              <button
                disabled={isLoading}
                onClick={() => handleKeyPress('0')}
                className="min-h-[48px] min-w-[48px] h-14 rounded-xl bg-slate-900/80 border border-slate-850 hover:bg-slate-800 text-lg font-semibold active:scale-95 transition flex items-center justify-center"
              >
                0
              </button>
              <button
                disabled={isLoading}
                onClick={handleBackspace}
                className="min-h-[48px] min-w-[48px] h-14 rounded-xl bg-slate-950/50 border border-slate-900 hover:bg-slate-900 text-xs font-semibold tracking-wider text-slate-400 active:scale-95 transition flex items-center justify-center"
              >
                {t('pairing.back', 'BACK')}
              </button>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-500 pt-2 border-t border-slate-900">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="min-h-[48px] min-w-[48px] px-3 py-2 rounded-lg hover:text-slate-300 active:scale-95 transition flex items-center justify-center"
              >
                {t('pairing.changeDetails', 'Change details')}
              </button>
              <span className="flex items-center space-x-1">
                <HelpCircle className="h-3 w-3" />
                <span>{t('pairing.pairingMode', 'Pairing mode')}</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
