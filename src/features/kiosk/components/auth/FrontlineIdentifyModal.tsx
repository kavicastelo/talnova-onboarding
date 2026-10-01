import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  UserCheck,
  CreditCard,
  Camera,
  CheckCircle2,
  AlertTriangle,
  X,
  Delete,
  ShieldCheck,
  Lock
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '../../../../components/Dialog';
import { Button } from '../../../../components/Button';
import { Input } from '../../../../components/Input';
import { kioskService } from '../../services/kiosk.service';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { deviceIdentityService } from '../../services/device-identity.service';

export interface IdentifiedWorker {
  id: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  employeeId?: string;
  badgeId?: string;
  pendingComplianceDocsCount?: number;
}

export interface FrontlineIdentifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (sessionData: { token: string; worker: IdentifiedWorker }) => void;
  deviceId?: string;
  organizationId?: string;
  highContrast?: boolean;
  initialIdentifier?: string;
}

export const FrontlineIdentifyModal: React.FC<FrontlineIdentifyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  deviceId,
  highContrast = false,
  initialIdentifier = ''
}) => {
  const { t } = useTranslation('kiosk');

  const [activeTab, setActiveTab] = useState<'keypad' | 'camera'>('keypad');
  const [badgeInput, setBadgeInput] = useState(initialIdentifier);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Ephemeral worker session held strictly in React memory (never localStorage)
  const [identifiedSession, setIdentifiedSession] = useState<{
    token: string;
    worker: IdentifiedWorker;
  } | null>(null);

  // Camera video stream ref
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setBadgeInput(initialIdentifier);
      setErrorMessage(null);
      setIdentifiedSession(null);
      setIsIdentifying(false);
      setActiveTab('keypad');
    } else {
      stopCameraStream();
    }
  }, [isOpen, initialIdentifier]);

  // Execute Identification API call
  const performIdentification = useCallback(
    async (rawIdentifier: string) => {
      const cleanId = rawIdentifier.trim();
      if (!cleanId) {
        setErrorMessage(t('identify.emptyInput', { defaultValue: 'Please scan a badge or enter an employee number.' }));
        return;
      }

      setIsIdentifying(true);
      setErrorMessage(null);

      try {
        const response = await kioskService.identifyFrontlineWorker(cleanId, deviceId);

        if (response && response.token) {
          const userObj = response.user || {};

          // Mask sensitive details: Name & Department only; National ID & passwords NEVER displayed
          const rawName = userObj.fullName || `${userObj.firstName || ''} ${userObj.lastName || ''}`.trim() || 'Frontline Team Member';
          const department = userObj.department || 'Operations';

          const worker: IdentifiedWorker = {
            id: userObj.id || userObj._id || 'unknown',
            fullName: rawName,
            firstName: userObj.firstName,
            lastName: userObj.lastName,
            department: department,
            employeeId: userObj.employeeId,
            badgeId: userObj.badgeId,
            pendingComplianceDocsCount: response.pendingComplianceDocsCount || 0
          };

          // Store in React memory only
          setIdentifiedSession({
            token: response.token,
            worker
          });
        } else {
          setErrorMessage(
            t('identify.notFound', {
              defaultValue: 'Badge ID not recognized. Please re-scan or enter your employee number.'
            })
          );
        }
      } catch (err: any) {
        // Polite user-facing error message without leaking internal database or system details
        setErrorMessage(
          t('identify.notFound', {
            defaultValue: 'Badge ID not recognized. Please re-scan or enter your employee number.'
          })
        );
      } finally {
        setIsIdentifying(false);
      }
    },
    [deviceId, t]
  );

  // 1. USB / Bluetooth Barcode & RFID Scanner Hook
  useBarcodeScanner({
    enabled: isOpen && !identifiedSession && !isIdentifying,
    onScan: (scannedCode) => {
      setBadgeInput(scannedCode);
      performIdentification(scannedCode);
    }
  });

  // Camera stream controls
  const startCameraStream = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }
    } catch {
      // Camera not available on this terminal hardware
    }
  };

  const stopCameraStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'camera' && !identifiedSession) {
      startCameraStream();
    } else {
      stopCameraStream();
    }
    return () => stopCameraStream();
  }, [isOpen, activeTab, identifiedSession]);

  // Keypad Handlers
  const handleKeypadDigit = (digit: string) => {
    if (isIdentifying) return;
    setBadgeInput((prev) => (prev.length < 16 ? prev + digit : prev));
    setErrorMessage(null);
  };

  const handleKeypadDelete = () => {
    if (isIdentifying) return;
    setBadgeInput((prev) => prev.slice(0, -1));
    setErrorMessage(null);
  };

  const handleKeypadClear = () => {
    if (isIdentifying) return;
    setBadgeInput('');
    setErrorMessage(null);
  };

  // Confirmation Handlers
  const handleConfirmWorker = () => {
    if (!identifiedSession) return;
    // Issue token and pass to parent in ephemeral memory (K-EMP-001, K-EMP-002)
    deviceIdentityService.setEmployeeSession(identifiedSession.token, identifiedSession.worker);
    onSuccess(identifiedSession);
    onClose();
  };

  const handleCancelWorker = () => {
    deviceIdentityService.clearEmployeeSession();
    setIdentifiedSession(null);
    setBadgeInput('');
    setErrorMessage(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        data-testid="frontline-identify-modal"
        className={`sm:max-w-lg p-6 sm:p-8 rounded-3xl border shadow-2xl transition-all ${
          highContrast
            ? 'bg-black border-2 border-amber-400 text-white'
            : 'bg-slate-900 border-slate-800 text-white'
        }`}
      >
        {/* Header */}
        <DialogHeader className="border-b border-slate-800 pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-black tracking-tight flex items-center space-x-2.5">
              <UserCheck className={`w-6 h-6 ${highContrast ? 'text-amber-400' : 'text-indigo-400'}`} />
              <span>{t('identify.title', { defaultValue: 'Frontline Worker Identification' })}</span>
            </DialogTitle>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {identifiedSession
              ? t('identify.confirmIdentity', { defaultValue: 'Verify your profile before commencing briefing.' })
              : t('identify.selectModality', { defaultValue: 'Scan badge, enter employee number, or scan QR code.' })}
          </p>
        </DialogHeader>

        <DialogBody className="space-y-5 pt-2">
          {identifiedSession ? (
            /* ================= Confirmation Screen ================= */
            <div
              data-testid="confirm-worker-view"
              className="py-2 space-y-5 animate-fade-in text-center flex flex-col items-center"
            >
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center border-2 ${
                  highContrast
                    ? 'bg-amber-400 text-black border-amber-300'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                }`}
              >
                <ShieldCheck className="w-10 h-10 stroke-[2.5]" />
              </div>

              <div className="space-y-1">
                <h4
                  data-testid="worker-welcome-message"
                  className="text-2xl font-black tracking-tight"
                >
                  Welcome, {identifiedSession.worker.fullName}
                </h4>
                <p className="text-sm font-semibold text-indigo-400">
                  {identifiedSession.worker.department}
                </p>
                <p className="text-xs text-slate-400 pt-2 max-w-sm">
                  {t('identify.isThisYouPrompt', {
                    defaultValue: 'Is this you? Please confirm to start your authenticated training session.'
                  })}
                </p>
              </div>

              {/* Privacy badge */}
              <div className="flex items-center space-x-1.5 text-[11px] font-medium text-slate-400 bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-full">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ephemeral Session Active • Private Terminal Mode</span>
              </div>
            </div>
          ) : (
            /* ================= Input Modalities ================= */
            <>
              {/* Tab Selector: Keypad & Badge vs Camera QR */}
              <div className="flex rounded-2xl bg-slate-950/80 p-1 border border-slate-800 gap-2">
                <button
                  type="button"
                  data-testid="tab-keypad"
                  onClick={() => setActiveTab('keypad')}
                  className={`flex-1 min-h-[48px] min-w-[48px] py-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition active:scale-95 ${
                    activeTab === 'keypad'
                      ? highContrast
                        ? 'bg-amber-400 text-black shadow-md'
                        : 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Badge Scan / Keypad</span>
                </button>
                <button
                  type="button"
                  data-testid="tab-camera"
                  onClick={() => setActiveTab('camera')}
                  className={`flex-1 min-h-[48px] min-w-[48px] py-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition active:scale-95 ${
                    activeTab === 'camera'
                      ? highContrast
                        ? 'bg-amber-400 text-black shadow-md'
                        : 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  <span>Scan QR Code</span>
                </button>
              </div>

              {/* Scanner Status Indicator */}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <span className="text-slate-300 font-semibold">USB / RFID Reader Ready</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">Scan card anytime</span>
              </div>

              {activeTab === 'keypad' ? (
                /* Tab 1: Virtual Numeric Keypad */
                <div className="space-y-3">
                  {/* Badge / ID Input Display */}
                  <div className="relative">
                    <Input
                      data-testid="employee-id-input"
                      value={badgeInput}
                      onChange={(e) => {
                        setBadgeInput(e.target.value);
                        setErrorMessage(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          performIdentification(badgeInput);
                        }
                      }}
                      placeholder="Badge ID / Employee #"
                      className={`h-14 pr-12 text-center font-mono text-xl font-black tracking-widest ${
                        highContrast
                          ? 'bg-black border-amber-400 text-white focus:border-amber-300'
                          : 'bg-slate-950 border-slate-700 text-white focus:border-indigo-500'
                      }`}
                    />
                    {badgeInput && (
                      <button
                        type="button"
                        onClick={handleKeypadClear}
                        className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[48px] min-w-[48px] w-12 h-12 flex items-center justify-center text-slate-400 hover:text-white active:scale-95 transition"
                        title="Clear input"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  {/* Error Message */}
                  {errorMessage && (
                    <div
                      data-testid="identify-error-message"
                      className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center space-x-2 animate-fade-in"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Touch Keypad Grid */}
                  <div className="grid grid-cols-3 gap-2.5 pt-1 select-none">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                      <button
                        key={digit}
                        type="button"
                        id={`keypad-digit-${digit}`}
                        data-testid={`keypad-digit-${digit}`}
                        onClick={() => handleKeypadDigit(digit)}
                        className={`min-h-[48px] min-w-[48px] h-14 rounded-2xl font-mono text-xl font-extrabold border transition-all active:scale-95 flex items-center justify-center cursor-pointer ${
                          highContrast
                            ? 'bg-black border-neutral-700 text-white hover:border-amber-400 hover:bg-neutral-900'
                            : 'bg-slate-950 border-slate-800 text-white hover:bg-slate-850 hover:border-slate-700'
                        }`}
                      >
                        {digit}
                      </button>
                    ))}

                    {/* Clear Button */}
                    <button
                      type="button"
                      id="keypad-clear"
                      data-testid="keypad-clear"
                      onClick={handleKeypadClear}
                      className="min-h-[48px] min-w-[48px] h-14 rounded-2xl font-bold text-xs uppercase tracking-wider border border-slate-800 bg-slate-950 text-slate-400 hover:text-white active:scale-95 flex items-center justify-center transition"
                    >
                      Clear
                    </button>

                    {/* Zero */}
                    <button
                      type="button"
                      id="keypad-digit-0"
                      data-testid="keypad-digit-0"
                      onClick={() => handleKeypadDigit('0')}
                      className={`min-h-[48px] min-w-[48px] h-14 rounded-2xl font-mono text-xl font-extrabold border transition-all active:scale-95 flex items-center justify-center cursor-pointer ${
                        highContrast
                          ? 'bg-black border-neutral-700 text-white hover:border-amber-400 hover:bg-neutral-900'
                          : 'bg-slate-950 border-slate-800 text-white hover:bg-slate-850 hover:border-slate-700'
                      }`}
                    >
                      0
                    </button>

                    {/* Backspace Button */}
                    <button
                      type="button"
                      id="keypad-delete"
                      data-testid="keypad-delete"
                      onClick={handleKeypadDelete}
                      className="min-h-[48px] min-w-[48px] h-14 rounded-2xl border border-slate-800 bg-slate-950 text-slate-400 hover:text-white active:scale-95 flex items-center justify-center transition"
                    >
                      <Delete className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Tab 2: Camera QR Scanner Viewfinder */
                <div
                  data-testid="camera-qr-view"
                  className="space-y-3 flex flex-col items-center justify-center"
                >
                  <div className="relative w-full aspect-video rounded-2xl overflow-hidden border-2 border-dashed border-indigo-500/50 bg-slate-950 flex items-center justify-center">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />

                    {/* Scanning beam animation overlay */}
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-8">
                      <div className="w-48 h-48 border-2 border-indigo-400 rounded-2xl relative shadow-2xl">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-pulse" />
                      </div>
                      <span className="text-xs text-indigo-300 font-bold tracking-wider mt-4">
                        Align Badge QR Code in Viewfinder
                      </span>
                    </div>
                  </div>

                  {/* QR test fallback helper button for kiosks without webcams */}
                  <button
                    type="button"
                    onClick={() => {
                      setBadgeInput('EMP-8021');
                      performIdentification('EMP-8021');
                    }}
                    className="min-h-[48px] min-w-[48px] px-3 py-2 text-xs text-indigo-400 hover:underline flex items-center justify-center active:scale-95"
                  >
                    Simulate QR Scan (Test Bench)
                  </button>
                </div>
              )}
            </>
          )}
        </DialogBody>

        <DialogFooter className="border-t border-slate-800 pt-4 flex items-center justify-between gap-3 sm:gap-4">
          {identifiedSession ? (
            /* Confirmation Actions */
            <div className="flex items-center justify-between w-full gap-3 sm:gap-4">
              <Button
                data-testid="cancel-worker-button"
                variant="outline"
                size="lg"
                onClick={handleCancelWorker}
                className="flex-1 min-h-[56px] min-w-[64px] rounded-2xl border-slate-700 text-slate-300 hover:bg-slate-800 active:scale-95"
              >
                Wrong Person / Cancel
              </Button>
              <Button
                data-testid="confirm-worker-button"
                variant="default"
                size="lg"
                onClick={handleConfirmWorker}
                className={`flex-1 min-h-[64px] min-w-[64px] rounded-2xl font-black text-base shadow-xl flex items-center justify-center space-x-2 active:scale-95 ${
                  highContrast
                    ? 'bg-amber-400 text-black border-amber-300 hover:bg-amber-300'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                }`}
              >
                <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
                <span>Confirm & Start</span>
              </Button>
            </div>
          ) : (
            /* Input Actions */
            <div className="flex items-center justify-between w-full gap-3 sm:gap-4">
              <Button
                variant="outline"
                size="lg"
                onClick={onClose}
                className="flex-1 min-h-[56px] min-w-[64px] rounded-2xl border-slate-700 text-slate-300 hover:bg-slate-800 active:scale-95"
              >
                Cancel
              </Button>
              <Button
                data-testid="submit-identify-button"
                variant="default"
                size="lg"
                disabled={isIdentifying || !badgeInput.trim()}
                onClick={() => performIdentification(badgeInput)}
                className={`flex-1 min-h-[64px] min-w-[64px] rounded-2xl font-bold text-base shadow-lg active:scale-95 ${
                  highContrast
                    ? 'bg-amber-400 text-black hover:bg-amber-300'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {isIdentifying ? 'Verifying...' : 'Verify ID'}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FrontlineIdentifyModal;
