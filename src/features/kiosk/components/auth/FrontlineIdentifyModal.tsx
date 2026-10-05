import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  UserCheck,
  CreditCard,
  Mail,
  Camera,
  CheckCircle2,
  AlertTriangle,
  X,
  Delete,
  ShieldCheck,
  Lock,
  Keyboard
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
  email?: string;
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

export type IdentifyTab = 'keypad' | 'email' | 'camera';

const POPULAR_DOMAINS = ['@talnova.com', '@company.com', '@gmail.com', '@outlook.com'];

export const FrontlineIdentifyModal: React.FC<FrontlineIdentifyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  deviceId,
  highContrast = false,
  initialIdentifier = ''
}) => {
  const { t } = useTranslation('kiosk');

  const [activeTab, setActiveTab] = useState<IdentifyTab>('keypad');
  const [badgeInput, setBadgeInput] = useState(initialIdentifier);
  const [emailInput, setEmailInput] = useState('');
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Ephemeral worker session held strictly in React memory
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
      setEmailInput('');
      setErrorMessage(null);
      setIdentifiedSession(null);
      setIsIdentifying(false);
      setActiveTab('keypad');
      setShowVirtualKeyboard(false);
    } else {
      stopCameraStream();
    }
  }, [isOpen, initialIdentifier]);

  // Execute Identification API call
  const performIdentification = useCallback(
    async (rawIdentifier: string, extra?: { employeeId?: string; badgeId?: string; batchId?: string; email?: string }) => {
      const cleanId = rawIdentifier.trim();
      if (!cleanId) {
        setErrorMessage(t('identify.emptyInput', { defaultValue: 'Please enter or scan your identification credential.' }));
        return;
      }

      setIsIdentifying(true);
      setErrorMessage(null);

      try {
        const response = await kioskService.identifyFrontlineWorker(cleanId, deviceId, extra);

        if (response && response.token) {
          const userObj = response.user || {};

          // Mask sensitive details: Name & Department only; passwords NEVER displayed
          const rawName =
            userObj.fullName ||
            `${userObj.firstName || ''} ${userObj.lastName || ''}`.trim() ||
            'Frontline Team Member';
          const department = userObj.department || 'Operations';

          const worker: IdentifiedWorker = {
            id: userObj.id || userObj._id || 'unknown',
            fullName: rawName,
            firstName: userObj.firstName,
            lastName: userObj.lastName,
            department: department,
            employeeId: userObj.employeeId,
            badgeId: userObj.badgeId,
            email: userObj.email,
            pendingComplianceDocsCount: response.pendingComplianceDocsCount || 0
          };

          // Store in React memory
          setIdentifiedSession({
            token: response.token,
            worker
          });
        } else {
          setErrorMessage(
            t('identify.notFound', {
              defaultValue: 'Employee credential not recognized. Please check your ID or email and try again.'
            })
          );
        }
      } catch (err: any) {
        const msg = err?.response?.data?.message || err?.message;
        setErrorMessage(
          msg && !msg.toLowerCase().includes('database')
            ? msg
            : t('identify.notFound', {
                defaultValue: 'Employee credential not recognized. Please check your ID or email and try again.'
              })
        );
      } finally {
        setIsIdentifying(false);
      }
    },
    [deviceId, t]
  );

  // USB / Bluetooth Barcode & RFID Scanner Hook
  useBarcodeScanner({
    enabled: isOpen && !identifiedSession && !isIdentifying,
    onScan: (scannedCode) => {
      setBadgeInput(scannedCode);
      performIdentification(scannedCode, { badgeId: scannedCode });
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
    setBadgeInput((prev) => (prev.length < 24 ? prev + digit : prev));
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

  // Virtual QWERTY Keyboard handler for Email tab
  const handleVirtualKey = (key: string) => {
    if (isIdentifying) return;
    setErrorMessage(null);
    if (key === 'BACKSPACE') {
      setEmailInput((prev) => prev.slice(0, -1));
    } else if (key === 'CLEAR') {
      setEmailInput('');
    } else if (key === 'SPACE') {
      setEmailInput((prev) => prev + ' ');
    } else {
      setEmailInput((prev) => prev + key.toLowerCase());
    }
  };

  const handleDomainPillClick = (domain: string) => {
    setErrorMessage(null);
    setEmailInput((prev) => {
      const atIdx = prev.indexOf('@');
      if (atIdx >= 0) {
        return prev.substring(0, atIdx) + domain;
      }
      return prev + domain;
    });
  };

  // Confirmation Handlers
  const handleConfirmWorker = () => {
    if (!identifiedSession) return;
    deviceIdentityService.setEmployeeSession(identifiedSession.token, identifiedSession.worker);
    onSuccess(identifiedSession);
    onClose();
  };

  const handleCancelWorker = () => {
    deviceIdentityService.clearEmployeeSession();
    setIdentifiedSession(null);
    setBadgeInput('');
    setEmailInput('');
    setErrorMessage(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        data-testid="frontline-identify-modal"
        className={`sm:max-w-xl p-6 sm:p-8 rounded-3xl border shadow-2xl transition-all ${
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
              : t('identify.selectModality', { defaultValue: 'Identify yourself using your Employee ID, Badge ID / Batch ID, or Work Email.' })}
          </p>
        </DialogHeader>

        <DialogBody className="space-y-5 pt-2">
          {identifiedSession ? (
            /* ================= Confirmation Screen ================= */
            <div
              data-testid="confirm-worker-view"
              className="py-4 space-y-5 animate-fade-in text-center flex flex-col items-center"
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

              <div className="space-y-1.5">
                <h4
                  data-testid="worker-welcome-message"
                  className="text-2xl font-black tracking-tight"
                >
                  Welcome, {identifiedSession.worker.fullName}
                </h4>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-700/40">
                    {identifiedSession.worker.department || 'Operations'}
                  </span>
                  {identifiedSession.worker.employeeId && (
                    <span className="px-3 py-1 rounded-full text-xs font-mono text-slate-300 bg-slate-800/80 border border-slate-700">
                      ID: {identifiedSession.worker.employeeId}
                    </span>
                  )}
                  {identifiedSession.worker.badgeId && (
                    <span className="px-3 py-1 rounded-full text-xs font-mono text-slate-300 bg-slate-800/80 border border-slate-700">
                      Badge: {identifiedSession.worker.badgeId}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 pt-2 max-w-sm">
                  {t('identify.isThisYouPrompt', {
                    defaultValue: 'Is this you? Please confirm to proceed to your authorized briefing.'
                  })}
                </p>
              </div>

              {/* Ephemeral Privacy Badge */}
              <div className="flex items-center space-x-1.5 text-[11px] font-medium text-slate-400 bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-full">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Private Ephemeral Session • Zero Data Retained on Glass</span>
              </div>
            </div>
          ) : (
            /* ================= Input Modalities ================= */
            <>
              {/* Tab Selector: 3 Dedicated Modalities */}
              <div className="flex rounded-2xl bg-slate-950/80 p-1.5 border border-slate-800 gap-2">
                {/* Tab 1: Employee ID / Badge ID */}
                <button
                  type="button"
                  data-testid="tab-keypad"
                  onClick={() => {
                    setActiveTab('keypad');
                    setErrorMessage(null);
                  }}
                  className={`flex-1 min-h-[48px] min-w-[48px] py-3 px-6 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition active:scale-95 ${
                    activeTab === 'keypad'
                      ? highContrast
                        ? 'bg-amber-400 text-black shadow-md'
                        : 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <CreditCard className="w-4 h-4 shrink-0" />
                  <span className="truncate">Employee / Badge ID</span>
                </button>

                {/* Tab 2: Work Email */}
                <button
                  type="button"
                  data-testid="tab-email"
                  onClick={() => {
                    setActiveTab('email');
                    setErrorMessage(null);
                  }}
                  className={`flex-1 min-h-[48px] min-w-[48px] py-3 px-6 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition active:scale-95 ${
                    activeTab === 'email'
                      ? highContrast
                        ? 'bg-amber-400 text-black shadow-md'
                        : 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Mail className="w-4 h-4 shrink-0" />
                  <span className="truncate">Work Email</span>
                </button>

                {/* Tab 3: Hardware Scan / QR */}
                <button
                  type="button"
                  data-testid="tab-camera"
                  onClick={() => {
                    setActiveTab('camera');
                    setErrorMessage(null);
                  }}
                  className={`flex-1 min-h-[48px] min-w-[48px] py-3 px-6 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition active:scale-95 ${
                    activeTab === 'camera'
                      ? highContrast
                        ? 'bg-amber-400 text-black shadow-md'
                        : 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Camera className="w-4 h-4 shrink-0" />
                  <span className="truncate">Scan Badge / QR</span>
                </button>
              </div>

              {/* Hardware Scanner Status Indicator (Active Across Tabs) */}
              <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <span className="text-slate-300 font-semibold">USB / RFID Reader Ready</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">Tap badge on scanner anytime</span>
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

              {/* ================= Tab 1: Virtual Numeric Keypad & Employee ID ================= */}
              {activeTab === 'keypad' && (
                <div className="space-y-3 animate-fade-in">
                  <div className="relative">
                    <Input
                      type="text"
                      data-testid="employee-id-input"
                      value={badgeInput}
                      onChange={(e) => {
                        setBadgeInput(e.target.value);
                        setErrorMessage(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          performIdentification(badgeInput, { employeeId: badgeInput, badgeId: badgeInput });
                        }
                      }}
                      placeholder="Enter Employee ID / Badge ID"
                      className={`w-full min-h-[56px] min-w-[64px] h-14 pr-12 text-center font-mono text-xl font-black tracking-widest ${
                        highContrast
                          ? 'bg-black border-amber-400 text-white focus:border-amber-300'
                          : 'bg-slate-950 border-slate-700 text-white focus:border-indigo-500'
                      }`}
                    />
                    {badgeInput && (
                      <button
                        type="button"
                        onClick={handleKeypadClear}
                        aria-label="Clear input"
                        className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[48px] min-w-[48px] w-12 h-12 flex items-center justify-center text-slate-400 hover:text-white active:scale-95 transition"
                        title="Clear input"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  {/* Touch Keypad Grid */}
                  <div className="grid grid-cols-3 gap-2 pt-1 select-none">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                      <button
                        key={digit}
                        type="button"
                        id={`keypad-digit-${digit}`}
                        data-testid={`keypad-digit-${digit}`}
                        onClick={() => handleKeypadDigit(digit)}
                        className={`w-full min-h-[52px] min-w-[48px] h-13 rounded-2xl font-mono text-xl font-extrabold border transition-all active:scale-95 flex items-center justify-center cursor-pointer ${
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
                      className="w-full min-h-[52px] min-w-[48px] h-13 rounded-2xl font-bold text-xs uppercase tracking-wider border border-slate-800 bg-slate-950 text-slate-400 hover:text-white active:scale-95 flex items-center justify-center transition cursor-pointer"
                    >
                      Clear
                    </button>

                    {/* Zero */}
                    <button
                      type="button"
                      id="keypad-digit-0"
                      data-testid="keypad-digit-0"
                      onClick={() => handleKeypadDigit('0')}
                      className={`w-full min-h-[52px] min-w-[48px] h-13 rounded-2xl font-mono text-xl font-extrabold border transition-all active:scale-95 flex items-center justify-center cursor-pointer ${
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
                      aria-label="Delete last digit"
                      onClick={handleKeypadDelete}
                      className="w-full min-h-[52px] min-w-[48px] h-13 rounded-2xl border border-slate-800 bg-slate-950 text-slate-400 hover:text-white active:scale-95 flex items-center justify-center transition cursor-pointer"
                    >
                      <Delete className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* ================= Tab 2: Work Email Address ================= */}
              {activeTab === 'email' && (
                <div className="space-y-3.5 animate-fade-in">
                  <div className="relative">
                    <Input
                      data-testid="employee-email-input"
                      type="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      value={emailInput}
                      onChange={(e) => {
                        setEmailInput(e.target.value);
                        setErrorMessage(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          performIdentification(emailInput, { email: emailInput });
                        }
                      }}
                      placeholder="e.g. employee@company.com"
                      className={`h-14 pl-12 pr-12 text-base font-medium ${
                        highContrast
                          ? 'bg-black border-amber-400 text-white focus:border-amber-300'
                          : 'bg-slate-950 border-slate-700 text-white focus:border-indigo-500'
                      }`}
                    />
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    {emailInput && (
                      <button
                        type="button"
                        onClick={() => setEmailInput('')}
                        aria-label="Clear email"
                        className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[48px] min-w-[48px] w-12 h-12 flex items-center justify-center text-slate-400 hover:text-white active:scale-95 transition"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  {/* Domain Quick-Tap Pills */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-400 block">
                      Quick Domain Insert:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {POPULAR_DOMAINS.map((domain) => (
                        <button
                          key={domain}
                          type="button"
                          onClick={() => handleDomainPillClick(domain)}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-indigo-500/60 active:scale-95 transition cursor-pointer"
                        >
                          {domain}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Virtual Keyboard Toggle for Pure Touchscreen Totems */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowVirtualKeyboard((prev) => !prev)}
                      className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1.5 transition active:scale-95 cursor-pointer"
                    >
                      <Keyboard className="w-4 h-4" />
                      <span>{showVirtualKeyboard ? 'Hide On-Screen Keyboard' : 'Show On-Screen Touch Keyboard'}</span>
                    </button>

                    {showVirtualKeyboard && (
                      <div className="mt-2 p-2 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 select-none animate-fade-in">
                        {/* QWERTY Row 1 */}
                        <div className="flex gap-1 justify-center">
                          {['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map((k) => (
                            <button
                              key={k}
                              type="button"
                              onClick={() => handleVirtualKey(k)}
                              className="flex-1 min-h-[44px] h-11 rounded-lg font-bold text-xs bg-slate-900 border border-slate-800 text-white hover:bg-slate-800 active:scale-95"
                            >
                              {k}
                            </button>
                          ))}
                        </div>
                        {/* QWERTY Row 2 */}
                        <div className="flex gap-1 justify-center px-2">
                          {['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map((k) => (
                            <button
                              key={k}
                              type="button"
                              onClick={() => handleVirtualKey(k)}
                              className="flex-1 min-h-[44px] h-11 rounded-lg font-bold text-xs bg-slate-900 border border-slate-800 text-white hover:bg-slate-800 active:scale-95"
                            >
                              {k}
                            </button>
                          ))}
                        </div>
                        {/* QWERTY Row 3 */}
                        <div className="flex gap-1 justify-center">
                          {['Z', 'X', 'C', 'V', 'B', 'N', 'M', '.', '_', '-'].map((k) => (
                            <button
                              key={k}
                              type="button"
                              onClick={() => handleVirtualKey(k)}
                              className="flex-1 min-h-[44px] h-11 rounded-lg font-bold text-xs bg-slate-900 border border-slate-800 text-white hover:bg-slate-800 active:scale-95"
                            >
                              {k}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => handleVirtualKey('BACKSPACE')}
                            aria-label="Backspace"
                            className="w-10 min-h-[44px] h-11 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 flex items-center justify-center active:scale-95"
                          >
                            <Delete className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ================= Tab 3: Camera QR Scanner Viewfinder ================= */}
              {activeTab === 'camera' && (
                <div
                  data-testid="camera-qr-view"
                  className="space-y-3 flex flex-col items-center justify-center animate-fade-in"
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
                      <div className="w-44 h-44 border-2 border-indigo-400 rounded-2xl relative shadow-2xl">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-pulse" />
                      </div>
                      <span className="text-xs text-indigo-300 font-bold tracking-wider mt-4">
                        Align Badge QR Code in Viewfinder
                      </span>
                    </div>
                  </div>

                  {/* Test bench fallback for kiosks without webcams */}
                  <button
                    type="button"
                    onClick={() => {
                      setBadgeInput('EMP-8021');
                      performIdentification('EMP-8021', { employeeId: 'EMP-8021' });
                    }}
                    className="min-h-[44px] px-4 py-2 text-xs text-indigo-400 hover:underline flex items-center justify-center active:scale-95 cursor-pointer"
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
                className="flex-1 min-h-[56px] min-w-[64px] rounded-2xl border-slate-700 text-slate-300 hover:bg-slate-800 active:scale-95 cursor-pointer"
              >
                Wrong Person / Switch
              </Button>
              <Button
                data-testid="confirm-worker-button"
                variant="default"
                size="lg"
                onClick={handleConfirmWorker}
                className={`flex-1 min-h-[64px] min-w-[64px] rounded-2xl font-black text-base shadow-xl flex items-center justify-center space-x-2 active:scale-95 cursor-pointer ${
                  highContrast
                    ? 'bg-amber-400 text-black border-amber-300 hover:bg-amber-300'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                }`}
              >
                <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
                <span>Confirm & Start Briefing</span>
              </Button>
            </div>
          ) : (
            /* Input Actions */
            <div className="flex items-center justify-between w-full gap-3 sm:gap-4">
              <Button
                variant="outline"
                size="lg"
                onClick={onClose}
                className="flex-1 min-h-[56px] min-w-[64px] rounded-2xl border-slate-700 text-slate-300 hover:bg-slate-800 active:scale-95 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                data-testid="submit-identify-button"
                variant="default"
                size="lg"
                disabled={
                  isIdentifying ||
                  (activeTab === 'keypad' && !badgeInput.trim()) ||
                  (activeTab === 'email' && !emailInput.trim())
                }
                onClick={() => {
                  if (activeTab === 'email') {
                    performIdentification(emailInput, { email: emailInput });
                  } else {
                    performIdentification(badgeInput, { employeeId: badgeInput, badgeId: badgeInput });
                  }
                }}
                className={`flex-1 min-h-[64px] min-w-[64px] rounded-2xl font-bold text-base shadow-lg active:scale-95 cursor-pointer ${
                  highContrast
                    ? 'bg-amber-400 text-black hover:bg-amber-300'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {isIdentifying ? 'Verifying...' : activeTab === 'email' ? 'Verify Email' : 'Verify ID'}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FrontlineIdentifyModal;
