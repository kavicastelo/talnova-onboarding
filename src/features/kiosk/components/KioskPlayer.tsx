import React, { useEffect, useRef, useState } from 'react';
import { useKioskPlayer } from '../context/KioskPlayerContext';
import { ShieldAlert, ShieldCheck, CheckCircle2, Award, Printer, QrCode, X } from 'lucide-react';
import QRCode from 'qrcode';
import { KioskPlayerHeader } from './KioskPlayerHeader';
import { KioskStepContainer } from './KioskStepContainer';
import { KioskActionFooter } from './KioskActionFooter';
import { KioskPinOverlay } from './KioskPinOverlay';
import { KioskRevokedScreen } from './KioskRevokedScreen';
import { KioskAudioNarrator } from './player/KioskAudioNarrator';
import { FrontlineIdentifyModal } from './auth/FrontlineIdentifyModal';
import { SupervisorWitnessGateModal } from './auth/SupervisorWitnessGateModal';
import { PrivacyTimeoutModal } from './privacy/PrivacyTimeoutModal';
import { deviceIdentityService } from '../services/device-identity.service';
import { privacyResetService } from '../services/privacy-reset.service';
import { kioskLockdownService } from '../services/kiosk-lockdown.service';
import { KioskReenterModal } from './lockdown/KioskReenterModal';
import { EmergencyEvacuationOverlay } from './emergency/EmergencyEvacuationOverlay';
import { emergencyService } from '../services/emergency.service';
import { KioskEmergency } from '../../../types/kiosk/emergency.types';
import { useAntiTamperingGuard } from '../hooks/useAntiTamperingGuard';
import { useTranslation } from 'react-i18next';
import { FontScale } from './accessibility/AccessibilityToolbar';
import { KioskLiveAnnouncer } from './accessibility/KioskLiveAnnouncer';
import { useKioskKeyboardNavigation } from '../hooks/useKioskKeyboardNavigation';
import { isRtlLanguage } from '../constants/language.constants';
import { KioskMaintenanceOverlay } from './KioskMaintenanceOverlay';
import { kioskCommandExecutorService } from '../services/kiosk-command-executor.service';

export interface KioskPlayerProps {
  journeyId: string;
  signedParams?: {
    o: string;
    exp: string;
    sig: string;
  };
  onExit?: () => void;
  isAdminPreview?: boolean;
}

export const KioskPlayer: React.FC<KioskPlayerProps> = ({
  journeyId,
  signedParams,
  onExit,
  isAdminPreview = false
}) => {
  const { t, i18n } = useTranslation('kiosk');
  const {
    journey,
    currentStepIndex,
    selectedLanguage,
    isMuted,
    volume,
    showSubtitles,
    isLoading,
    error,
    loadJourney,
    setStepIndex,
    nextStep,
    prevStep,
    changeLanguage,
    setPlayingAudio,
    toggleMuted,
    setVolume,
    toggleSubtitles,
    startSession,
    recordInteraction,
    completeSession,
    abortSession,
    timeoutSession,
    activeSession,
    recordPpeCompliance
  } = useKioskPlayer();

  const containerRef = useRef<HTMLDivElement>(null);

  // K-EMP-003: Automatic Privacy Reset & Countdown Warning State
  const [isPrivacyWarningOpen, setIsPrivacyWarningOpen] = useState(false);
  const [privacyCountdownSeconds, setPrivacyCountdownSeconds] = useState(15);

  // Directional step transition animation ('forward' | 'backward')
  const [stepDirection, setStepDirection] = useState<'forward' | 'backward'>('forward');

  // K-LOC-002: Dynamic Right-To-Left (RTL) Layout Engine
  const isRtl = isRtlLanguage(selectedLanguage);

  // K-LOC-003: Autoplay Narration Setting
  const [autoPlayNarration, setAutoPlayNarration] = useState<boolean>(() => {
    return journey?.settings?.autoPlay ?? true;
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
      document.documentElement.lang = selectedLanguage;
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.documentElement.dir = 'ltr';
      }
    };
  }, [isRtl, selectedLanguage]);

  // Accessibility: High-contrast mode toggle & dynamic font scaling (ADR-010 / K-ACC-002)
  const [highContrast, setHighContrast] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('kiosk_high_contrast') === 'true';
    }
    return false;
  });
  const [fontScale, setFontScale] = useState<FontScale>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kiosk_font_scale');
      return (saved ? parseInt(saved, 10) : 100) as FontScale;
    }
    return 100;
  });

  const handleToggleHighContrast = () => {
    setHighContrast((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('kiosk_high_contrast', String(next));
      }
      return next;
    });
  };

  const handleFontScaleChange = (scale: FontScale) => {
    setFontScale(scale);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kiosk_font_scale', String(scale));
    }
  };

  // Hold-to-confirm interaction state
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // PPE Checklist State
  const [videoCompleted, setVideoCompleted] = useState(false);
  const [checkedPpe, setCheckedPpe] = useState<Set<string>>(new Set());
  const [ppeSubmitted, setPpeSubmitted] = useState(false);
  const [ppeResetCountdown, setPpeResetCountdown] = useState(10);
  const [ppeSubmitError, setPpeSubmitError] = useState<string | null>(null);

  // Security overlays & revocation
  const [showPinOverlay, setShowPinOverlay] = useState(false);
  const [isRevoked, setIsRevoked] = useState(() => deviceIdentityService.isRevoked());
  const [revocationMessage, setRevocationMessage] = useState<string | undefined>();
  const [activeEmergency, setActiveEmergency] = useState<KioskEmergency | null>(() => emergencyService.getActiveEmergency());

  // K-SEC-004: Emergency Kiosk Mode Override & Broadcast Propagation
  useEffect(() => {
    const unsubscribe = emergencyService.subscribe((emergency) => {
      setActiveEmergency(emergency);
      if (emergency && emergency.isActive) {
        setPlayingAudio(false);
        if (typeof document !== 'undefined') {
          document.querySelectorAll('audio').forEach((a) => a.pause());
        }
      }
    });

    const handleEmergency = (e: any) => {
      if (e?.detail) {
        setActiveEmergency(e.detail);
        setPlayingAudio(false);
        if (typeof document !== 'undefined') {
          document.querySelectorAll('audio').forEach((a) => a.pause());
        }
      }
    };

    const handleCleared = () => {
      setActiveEmergency(null);
      if (onExit) {
        onExit(); // Acceptance criteria: resume home screen launcher
      }
    };

    window.addEventListener('talnova:kiosk:emergency', handleEmergency);
    window.addEventListener('talnova:kiosk:emergency_cleared', handleCleared);

    return () => {
      unsubscribe();
      window.removeEventListener('talnova:kiosk:emergency', handleEmergency);
      window.removeEventListener('talnova:kiosk:emergency_cleared', handleCleared);
    };
  }, [onExit]);

  // Instantaneous device revocation event listener (DEF-005 / K-DEV-004)
  useEffect(() => {
    const handleRevoked = (e: any) => {
      setIsRevoked(true);
      if (e?.detail?.message) {
        setRevocationMessage(e.detail.message);
      }
    };
    window.addEventListener('talnova:kiosk:device_revoked', handleRevoked);
    return () => {
      window.removeEventListener('talnova:kiosk:device_revoked', handleRevoked);
    };
  }, []);

  // K-DEV-007: Remote Operational Commands & Fullscreen Maintenance Overlay
  const [isMaintenanceActive, setIsMaintenanceActive] = useState<boolean>(() =>
    kioskCommandExecutorService.isInMaintenance()
  );
  const [maintenancePayload, setMaintenancePayload] = useState<any>(() =>
    kioskCommandExecutorService.getMaintenanceDetails().payload
  );

  useEffect(() => {
    const unsubMaintenance = kioskCommandExecutorService.onMaintenanceChange((active, payload) => {
      setIsMaintenanceActive(active);
      setMaintenancePayload(payload || null);
    });

    const unsubManifest = kioskCommandExecutorService.onManifestReload(() => {
      if (journeyId) {
        loadJourney(journeyId);
      }
    });

    const handleEnterMaintenance = (e: any) => {
      setIsMaintenanceActive(true);
      setMaintenancePayload(e?.detail?.payload || null);
    };

    const handleExitMaintenance = () => {
      setIsMaintenanceActive(false);
      setMaintenancePayload(null);
    };

    const handleManifestReload = () => {
      if (journeyId) {
        loadJourney(journeyId);
      }
    };

    window.addEventListener('kiosk:enter-maintenance', handleEnterMaintenance);
    window.addEventListener('kiosk:exit-maintenance', handleExitMaintenance);
    window.addEventListener('kiosk:manifest-reload', handleManifestReload);

    return () => {
      unsubMaintenance();
      unsubManifest();
      window.removeEventListener('kiosk:enter-maintenance', handleEnterMaintenance);
      window.removeEventListener('kiosk:exit-maintenance', handleExitMaintenance);
      window.removeEventListener('kiosk:manifest-reload', handleManifestReload);
    };
  }, [journeyId, loadJourney]);

  // Frontline worker identification (DEF-008 / K-EMP-001)
  const [showIdentifyModal, setShowIdentifyModal] = useState(false);
  const [workerIdentified, setWorkerIdentified] = useState(false);
  const [, setEphemeralWorkerToken] = useState<string | null>(null);

  // K-SEC-002: Browser Kiosk Lockdown & Fullscreen Enforcement
  const [isReenterPromptVisible, setIsReenterPromptVisible] = useState(false);

  useEffect(() => {
    if (isAdminPreview) return;

    kioskLockdownService.startLockdown({
      autoPromptReenter: true,
      onStateChange: (state) => {
        setIsReenterPromptVisible(state.isReenterPromptVisible);
      }
    });

    const unsubscribe = kioskLockdownService.subscribe((state) => {
      setIsReenterPromptVisible(state.isReenterPromptVisible);
    });

    return () => {
      unsubscribe();
      kioskLockdownService.stopLockdown();
    };
  }, [isAdminPreview]);

  // Supervisor Witness Requirement & Gate State (DEF-009 / K-SUP-002)
  const [showSupervisorGateModal, setShowSupervisorGateModal] = useState(false);
  const [supervisorWitness, setSupervisorWitness] = useState<any | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completionCountdown, setCompletionCountdown] = useState(15);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [completionQrDataUrl, setCompletionQrDataUrl] = useState<string>('');

  // Generate scannable QR code data URL for completion screen
  useEffect(() => {
    if (isCompleted) {
      const certId = activeSession?._id || 'unknown';
      const verifyUrl = `${window.location.origin}/verify/cert/${certId}`;
      QRCode.toDataURL(verifyUrl, { margin: 1, width: 220 })
        .then((url) => setCompletionQrDataUrl(url))
        .catch((err) => console.warn('Failed generating QR code for completion screen:', err));
    }
  }, [isCompleted, activeSession?._id]);

  // Trigger frontline worker identification if journey requires it
  useEffect(() => {
    if (journey) {
      const isEmployeeRestricted = Boolean(
        (journey as any).requireEmployeeId ||
        (journey as any).employeeRestricted ||
        (journey.settings as any)?.requireEmployeeId ||
        (journey.settings as any)?.requireAuth ||
        (journey.settings?.security?.protectionType as any) === 'employee_id'
      );
      if (isEmployeeRestricted && !workerIdentified && !isAdminPreview) {
        setShowIdentifyModal(true);
      }
    }
  }, [journey, workerIdentified, isAdminPreview]);

  const handleExitClick = () => {
    if (isAdminPreview) {
      if (onExit) onExit();
      return;
    }
    // K-SEC-002: Require 6-digit Exit PIN to leave kiosk mode
    setShowPinOverlay(true);
  };

  // Load journey when ID changes and reset completion state
  useEffect(() => {
    loadJourney(journeyId, signedParams);
    setShowSupervisorGateModal(false);
    setSupervisorWitness(null);
    setIsCompleted(false);
  }, [journeyId, signedParams]);

  // Start analytics session when journey is loaded
  useEffect(() => {
    if (journey) {
      startSession();
    }
  }, [journey]);

  // K-EMP-003: Handle Idle Timeout & Automatic Privacy Reset
  useEffect(() => {
    if (!journey) return;

    const idleSeconds = journey.settings?.idleTimeoutSeconds || 60;

    privacyResetService.startMonitoring({
      idleTimeoutSeconds: idleSeconds,
      warningDurationSeconds: 15,
      targetElement: containerRef.current || (typeof window !== 'undefined' ? window : null),
      activeSessionId: () => activeSession?._id || null,
      currentStepId: () => journey.steps[currentStepIndex]?.id || null,
      onWarningStart: (remaining) => {
        setIsPrivacyWarningOpen(true);
        setPrivacyCountdownSeconds(remaining);
      },
      onWarningTick: (remaining) => {
        setPrivacyCountdownSeconds(remaining);
      },
      onWarningDismissed: () => {
        setIsPrivacyWarningOpen(false);
      },
      onTimeoutExpired: async () => {
        setIsPrivacyWarningOpen(false);
        const currentStep = journey.steps[currentStepIndex]?.id;
        await timeoutSession(currentStep, 'Idle timeout exceeded (Automatic Privacy Reset)');
      },
      onNavigateHome: () => {
        if (onExit) {
          onExit();
        } else if (typeof window !== 'undefined' && window.location) {
          window.location.href = '/kiosk/terminal';
        }
      }
    });

    return () => {
      privacyResetService.stopMonitoring();
    };
  }, [journey, currentStepIndex, activeSession, onExit]);

  const handlePrivacyStay = () => {
    privacyResetService.dismissWarning();
  };

  const handlePrivacyExitNow = async () => {
    await privacyResetService.executePrivacyWipe();
  };

  // Active step details
  const activeStep = journey?.steps[currentStepIndex];

  const handleLanguageChange = (lang: string) => {
    changeLanguage(lang);
    i18n.changeLanguage(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('talnova_lang', lang);
    }
  };

  // Supervisor Witness Requirement calculation (DEF-009 / K-SUP-002)
  const isSupervisorWitnessRequired = Boolean(
    (journey?.settings as any)?.supervisor_witness_required ||
    (journey?.settings as any)?.requireSupervisorWitness ||
    (journey?.settings?.security?.protectionType as string) === 'supervisor' ||
    (activeStep as any)?.supervisor_witness_required ||
    activeStep?.requireSupervisorWitness ||
    (activeStep?.interaction as any)?.supervisor_witness_required ||
    activeStep?.interaction?.requireSupervisorWitness ||
    (activeStep?.interaction?.type as any) === 'supervisor_witness' ||
    (activeStep as any)?.type === 'supervisor_witness'
  );

  // Completion screen countdown effect (auto-resets after 15 seconds)
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isCompleted && !showCertificateModal && completionCountdown > 0) {
      timer = setTimeout(() => {
        setCompletionCountdown((prev) => prev - 1);
      }, 1000);
    } else if (isCompleted && !showCertificateModal && completionCountdown <= 0) {
      setIsCompleted(false);
      setSupervisorWitness(null);
      handleResetJourney();
      if (onExit) onExit();
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isCompleted, showCertificateModal, completionCountdown, onExit]);

  // Supervisor witness verification success callback
  const handleSupervisorWitnessSuccess = async (witnessData: {
    verified: boolean;
    supervisor: any;
    witnessToken?: string;
    session?: any;
  }) => {
    setSupervisorWitness(witnessData.supervisor);
    setShowSupervisorGateModal(false);
    await completeSession();
    setIsCompleted(true);
    setCompletionCountdown(15);
  };

  // Intercept Finish button click (DEF-009 / K-SUP-002)
  const handleFinish = async () => {
    if (isSupervisorWitnessRequired && !supervisorWitness) {
      setShowSupervisorGateModal(true);
      return;
    }

    await completeSession();
    setIsCompleted(true);
    setCompletionCountdown(15);
  };

  // Navigation handlers with directional animation
  const handleNextStep = () => {
    setStepDirection('forward');
    if (currentStepIndex === (journey?.steps?.length || 0) - 1) {
      handleFinish();
    } else {
      nextStep();
    }
  };

  const handlePrevStep = () => {
    setStepDirection('backward');
    prevStep();
  };

  const handleResetJourney = () => {
    recordInteraction('reset');
    abortSession(activeStep?.id || 'unknown');
    setStepDirection('backward');
    setStepIndex(0);
    startSession();
  };

  // PPE Step effect
  useEffect(() => {
    if (!activeStep) return;
    const hasVideo = activeStep.blocks.some((b) => b.type === 'video');
    setVideoCompleted(!hasVideo);
    setCheckedPpe(new Set());
    setPpeSubmitted(false);
    setPpeResetCountdown(10);
    setPpeSubmitError(null);
  }, [activeStep?.id]);

  // PPE Auto-reset 10s countdown
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (ppeSubmitted && ppeResetCountdown > 0) {
      timer = setTimeout(() => {
        setPpeResetCountdown((prev) => prev - 1);
      }, 1000);
    } else if (ppeSubmitted && ppeResetCountdown <= 0) {
      handleResetJourney();
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [ppeSubmitted, ppeResetCountdown]);

  const handlePpeConfirm = async () => {
    const requiredItems =
      activeStep?.interaction?.ppeItems && activeStep.interaction.ppeItems.length > 0
        ? activeStep.interaction.ppeItems
        : ['Hard Hat', 'Safety Glasses', 'Steel-Toe Boots'];
    const allChecked = requiredItems.every((item) => checkedPpe.has(item));
    if (!allChecked) {
      setPpeSubmitError('All mandatory PPE gear must be checked and confirmed before entry.');
      return;
    }
    setPpeSubmitError(null);
    try {
      await recordPpeCompliance(activeStep?.id || 'step-sop-01', Array.from(checkedPpe));
      setPpeSubmitted(true);
      setPpeResetCountdown(10);
    } catch (err: any) {
      console.error('Failed to record PPE compliance', err);
      setPpeSubmitted(true);
      setPpeResetCountdown(10);
    }
  };

  // Yes / No branching handler
  const handleYesNoSelection = (response: boolean) => {
    if (!activeStep?.interaction) return;
    recordInteraction(response ? 'yes' : 'no');

    const targetStepId = response
      ? activeStep.interaction.correctStepId
      : activeStep.interaction.incorrectStepId;

    if (targetStepId && journey) {
      const idx = journey.steps.findIndex((s) => s.id === targetStepId);
      if (idx !== -1) {
        setStepDirection(idx > currentStepIndex ? 'forward' : 'backward');
        setStepIndex(idx);
      }
    }
  };

  // Hotspot click handler
  const handleHotspotClick = (actionStepId: string, idx: number) => {
    recordInteraction(`hotspot_${idx + 1}`);
    if (journey) {
      const stepIdx = journey.steps.findIndex((s) => s.id === actionStepId);
      if (stepIdx !== -1) {
        setStepDirection(stepIdx > currentStepIndex ? 'forward' : 'backward');
        setStepIndex(stepIdx);
      }
    }
  };

  // Hold-to-confirm handlers
  const handleHoldStart = () => {
    if (!activeStep?.interaction) return;
    recordInteraction('hold_start');

    const duration = activeStep.interaction.holdDurationMs || 2000;
    const intervalTime = 50;
    const totalTicks = duration / intervalTime;
    let currentTick = 0;

    holdIntervalRef.current = setInterval(() => {
      currentTick++;
      const progress = Math.min((currentTick / totalTicks) * 100, 100);
      setHoldProgress(progress);
    }, intervalTime);

    holdTimerRef.current = setTimeout(() => {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
      setHoldProgress(100);
      recordInteraction('hold_complete');

      if (journey && currentStepIndex === journey.steps.length - 1) {
        completeSession();
        setStepDirection('backward');
        setStepIndex(0);
        startSession();
      } else {
        handleNextStep();
      }
    }, duration);
  };

  const handleHoldEnd = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    setHoldProgress(0);
  };

  // Interaction mode determinations
  const isPpeStep =
    activeStep?.interaction?.type === 'ppe_checklist' || activeStep?.id === 'step-sop-01';
  const isYesNoStep = activeStep?.interaction?.type === 'yes_no';
  const isHoldStep = activeStep?.interaction?.type === 'hold_to_confirm';
  const totalSteps = journey?.steps?.length || 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  // Next button visibility in footer
  const showNextInFooter = !isYesNoStep && !isLastStep;
  const showFinishInFooter = !isYesNoStep && isLastStep;
  const canGoNext = isPpeStep ? ppeSubmitted : true;

  // K-ACC-003: Screen Reader ARIA & Keyboard Navigation
  const [tamperingDetected, setTamperingDetected] = useState(false);

  // K-SEC-003: Client-Side Anti-Tampering DOM Guard
  useAntiTamperingGuard({
    containerRef,
    canProgress: canGoNext,
    onTamperDetected: (event) => {
      console.warn('[KioskSecurity] Unauthorized DOM mutation detected on progression button:', event);
      setTamperingDetected(true);
    },
    onResetStepState: () => {
      if (isPpeStep) {
        setPpeSubmitted(false);
        setCheckedPpe(new Set());
      }
      setHoldProgress(0);
      setVideoCompleted(false);
    },
    enabled: !isAdminPreview && !isRevoked && !isLoading && !error && Boolean(journey) && !isCompleted
  });

  const isAnyModalOpen =
    showPinOverlay ||
    showIdentifyModal ||
    showSupervisorGateModal ||
    isPrivacyWarningOpen ||
    isReenterPromptVisible;

  const handleCancelActiveModal = () => {
    if (showPinOverlay) {
      setShowPinOverlay(false);
    } else if (showIdentifyModal) {
      setShowIdentifyModal(false);
      if (!workerIdentified && onExit) onExit();
    } else if (showSupervisorGateModal) {
      setShowSupervisorGateModal(false);
    } else if (isPrivacyWarningOpen) {
      handlePrivacyStay();
    }
  };

  useKioskKeyboardNavigation({
    enabled: !isRevoked && !isLoading && !error && Boolean(journey) && !isCompleted,
    canGoNext: canGoNext,
    canGoBack: currentStepIndex > 0 && !isYesNoStep,
    onNext: () => {
      if (isLastStep) {
        handleFinish();
      } else {
        handleNextStep();
      }
    },
    onPrev: handlePrevStep,
    onYesNo: isYesNoStep ? handleYesNoSelection : undefined,
    onCancelModal: handleCancelActiveModal,
    isModalOpen: isAnyModalOpen
  });

  // Revocation state
  if (isRevoked) {
    return (
      <KioskRevokedScreen
        customMessage={revocationMessage}
        onReEnroll={() => {
          setIsRevoked(false);
          deviceIdentityService.clearRevocationStatus();
          window.location.href = '/kiosk/pair';
        }}
      />
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-950 text-white">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        <p className="mt-4 text-lg font-medium text-slate-300">
          {t('player.loadingScreen', { defaultValue: 'Loading Kiosk Screen...' })}
        </p>
      </div>
    );
  }

  // Error state
  if (error || !journey) {
    return (
      <div
        id="kiosk-error-container"
        className="flex h-screen w-full flex-col items-center justify-center bg-slate-950 px-6 text-center text-white"
      >
        <ShieldAlert className="h-16 w-16 text-rose-500 animate-pulse" />
        <h2 id="kiosk-error-heading" className="mt-4 text-2xl font-bold text-slate-100">
          {t('player.accessError', { defaultValue: 'Kiosk Access Error' })}
        </h2>
        <p id="kiosk-error-message" className="mt-2 max-w-md text-slate-400">
          {error || t('player.unableToLoad', { defaultValue: 'Unable to load Kiosk content.' })}
        </p>
        {(isAdminPreview || journey?.settings?.security?.protectionType === 'pin' || onExit) && (
          <button
            id="kiosk-error-exit-btn"
            onClick={handleExitClick}
            className="mt-6 rounded-xl bg-slate-800 px-6 py-3 font-semibold text-white hover:bg-slate-700 active:scale-95 transition min-h-[48px] min-w-[48px] inline-flex items-center justify-center"
          >
            {isAdminPreview
              ? t('player.exitPreview', { defaultValue: 'Exit Preview' })
              : t('player.exit', { defaultValue: 'Exit' })}
          </button>
        )}
      </div>
    );
  }

  // Completion Confirmation Screen (DEF-009 / K-SUP-002)
  if (isCompleted) {
    const identifiedEmployee = deviceIdentityService.getEmployeeUser?.();
    const workerName =
      identifiedEmployee?.fullName ||
      (identifiedEmployee?.firstName && identifiedEmployee?.lastName
        ? `${identifiedEmployee.firstName} ${identifiedEmployee.lastName}`
        : null);

    return (
      <div
        id="kiosk-completion-screen"
        data-testid="kiosk-completion-screen"
        className={`flex h-screen w-full flex-col items-center justify-center p-6 text-center select-none transition-colors ${
          highContrast ? 'bg-black text-white' : 'bg-slate-950 text-white'
        }`}
      >
        <div
          className={`relative max-w-lg w-full rounded-3xl border p-8 shadow-2xl overflow-hidden ${
            highContrast
              ? 'bg-black border-2 border-amber-400 text-white'
              : 'bg-slate-900/90 border-slate-800 text-white backdrop-blur-md'
          }`}
        >
          {/* Success Icon */}
          <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 shadow-xl shadow-emerald-500/20 mb-6">
            <ShieldCheck className="w-10 h-10 stroke-[2.5]" />
          </div>

          <h2
            id="completion-screen-title"
            data-testid="completion-screen-title"
            className="text-2xl sm:text-3xl font-extrabold tracking-tight"
          >
            {t('player.completedTitle', { defaultValue: 'Briefing Successfully Completed' })}
          </h2>

          <p className="mt-2 text-sm sm:text-base text-slate-300 font-medium">
            {journey?.title || 'Safety Briefing'}
          </p>

          {workerName && (
            <div className="mt-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs sm:text-sm text-slate-300">
              <span className="text-slate-400">{t('player.worker', { defaultValue: 'Worker' })}: </span>
              <strong className="text-white font-semibold">{workerName}</strong>
            </div>
          )}

          {/* Supervisor Witness Attestation Banner */}
          {supervisorWitness && (
            <div
              id="supervisor-attestation-badge"
              data-testid="supervisor-attestation-badge"
              className="mt-4 p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 text-left text-xs sm:text-sm space-y-1.5"
            >
              <div className="flex items-center space-x-2 text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{t('supervisor.attestationVerified', { defaultValue: 'Supervisor Attestation Verified' })}</span>
              </div>
              <div className="text-slate-200">
                <span className="text-slate-400">{t('supervisor.witnessedBy', { defaultValue: 'Witnessed by' })}: </span>
                <strong
                  id="completion-supervisor-name"
                  data-testid="completion-supervisor-name"
                  className="text-white font-semibold"
                >
                  {supervisorWitness.fullName || supervisorWitness.name || supervisorWitness.email}
                </strong>
                {supervisorWitness.role && (
                  <span className="text-slate-400 text-xs ml-1.5 capitalize">({supervisorWitness.role})</span>
                )}
              </div>
              <p className="text-[11px] text-emerald-300/80">
                {t('supervisor.auditFactRecorded', {
                  defaultValue: 'Official dual-custody audit fact logged in immutable ledger.'
                })}
              </p>
            </div>
          )}

          {/* Embedded Scannable QR Code */}
          <div
            id="completion-qr-container"
            data-testid="completion-qr-container"
            className="mt-5 p-4 rounded-2xl bg-white text-slate-900 shadow-lg flex flex-col items-center justify-center space-y-2 border border-slate-200"
          >
            {completionQrDataUrl ? (
              <img
                id="kiosk-completion-qr-code"
                data-testid="kiosk-completion-qr-code"
                src={completionQrDataUrl}
                alt="Scan to verify certificate"
                className="w-32 h-32 object-contain"
              />
            ) : (
              <div className="w-32 h-32 flex items-center justify-center bg-slate-100 rounded-xl">
                <QrCode className="w-16 h-16 text-slate-700 animate-pulse" />
              </div>
            )}
            <div className="text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">
                {t('player.scannableQrCode', { defaultValue: 'Scannable Compliance QR Code' })}
              </span>
              <p className="text-[10px] text-slate-500">
                {t('player.qrScanHelp', { defaultValue: 'Scan at turnstile or safety checkpoint to verify authenticity' })}
              </p>
            </div>
          </div>

          {/* Action Buttons & Countdown */}
          <div className="mt-6 space-y-3">
            <button
              type="button"
              id="view-certificate-btn"
              data-testid="view-certificate-btn"
              onClick={() => setShowCertificateModal(true)}
              className="w-full min-h-[56px] px-6 py-3.5 rounded-2xl font-bold text-base transition active:scale-95 shadow-lg flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <Award className="w-5 h-5 text-indigo-200" />
              <span>{t('player.viewPrintCertificate', { defaultValue: 'View / Print Certificate' })}</span>
            </button>

            <button
              type="button"
              id="completion-exit-btn"
              data-testid="completion-exit-btn"
              onClick={() => {
                setIsCompleted(false);
                setSupervisorWitness(null);
                handleResetJourney();
                if (onExit) onExit();
              }}
              className={`w-full min-h-[56px] px-6 py-3.5 rounded-2xl font-black text-base transition active:scale-95 shadow-xl flex items-center justify-center ${
                highContrast
                  ? 'bg-amber-400 text-black border-2 border-amber-300 hover:bg-amber-300'
                  : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/25'
              }`}
            >
              {t('player.returnHome', { defaultValue: 'Finish & Return Home' })}
            </button>

            <p className="text-xs text-slate-500 font-medium">
              {t('player.autoResetIn', {
                defaultValue: `Terminal resets automatically in ${completionCountdown}s`,
                seconds: completionCountdown
              })}
            </p>
          </div>

          {/* Printable Certificate Modal */}
          {showCertificateModal && (
            <div
              id="certificate-modal"
              data-testid="certificate-modal"
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
            >
              <div className="relative w-full max-w-3xl rounded-3xl bg-white text-slate-900 shadow-2xl p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-2 text-indigo-600 font-bold text-lg">
                    <Award className="w-6 h-6" />
                    <span>Official Completion Certificate</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id="print-certificate-modal-btn"
                      data-testid="print-certificate-modal-btn"
                      onClick={() => window.print()}
                      className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs flex items-center gap-1.5 hover:bg-indigo-500 transition"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print Certificate</span>
                    </button>
                    <button
                      type="button"
                      id="close-certificate-modal-btn"
                      data-testid="close-certificate-modal-btn"
                      onClick={() => setShowCertificateModal(false)}
                      className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Certificate Printable Area */}
                <div className="border-4 border-double border-slate-300 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-slate-50 via-white to-blue-50 text-center space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>VERIFIED AUTHENTIC</span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-black uppercase text-slate-900 tracking-tight">
                    Certificate of Safety Completion
                  </h3>

                  <p className="text-xs text-slate-500 uppercase tracking-wider">This certifies that</p>
                  <h4 className="text-2xl sm:text-3xl font-extrabold text-indigo-600">
                    {workerName || 'Frontline Worker'}
                  </h4>
                  <p className="text-xs font-mono text-slate-600 font-semibold">
                    EMPLOYEE ID: {identifiedEmployee?.employment?.employeeId || identifiedEmployee?.badgeId || identifiedEmployee?.id || 'EMP-VERIFIED'}
                  </p>

                  <div className="my-3 py-2 border-y border-slate-200">
                    <p className="text-xs text-slate-500">has successfully verified proficiency in:</p>
                    <p className="text-base sm:text-lg font-bold text-slate-800 mt-0.5">
                      {journey?.title || 'Safety & Compliance Briefing'}
                    </p>
                    <p className="text-xs text-emerald-600 font-medium">
                      Version Snapshot #{(journey?.publishing as any)?.version || 1}
                    </p>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left text-[11px] bg-slate-100/70 p-3 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-slate-400 block font-semibold text-[9px] uppercase">COMPLETION</span>
                      <span className="font-semibold text-slate-800">{new Date().toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold text-[9px] uppercase">DURATION</span>
                      <span className="font-semibold text-slate-800">{activeSession?.durationSeconds ? `${activeSession.durationSeconds}s` : 'Verified'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold text-[9px] uppercase">HARDWARE GUID</span>
                      <span className="font-mono text-[9px] text-slate-700 truncate block">
                        {deviceIdentityService.getHardwareGuidSync() || 'HW-TERMINAL-01'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold text-[9px] uppercase">LOCATION</span>
                      <span className="text-slate-800 truncate block">
                        {deviceIdentityService.getStoredDevice()?.location || 'Gate Turnstile'}
                      </span>
                    </div>
                  </div>

                  {/* Supervisor Witness block if present */}
                  {supervisorWitness && (
                    <div className="text-left text-xs bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-emerald-900">
                      <span className="font-bold text-[10px] uppercase tracking-wider block text-emerald-700">Supervisor Co-Signature Attestation</span>
                      <span>Witnessed by: <strong>{supervisorWitness.fullName || supervisorWitness.name}</strong> ({supervisorWitness.role || 'Supervisor'})</span>
                    </div>
                  )}

                  {/* QR Code and Checksum */}
                  <div className="flex flex-col sm:flex-row items-center justify-between pt-2 gap-4">
                    {completionQrDataUrl && (
                      <div className="flex items-center gap-3">
                        <img src={completionQrDataUrl} alt="QR Code" className="w-20 h-20 border rounded-lg p-1 bg-white" />
                        <div className="text-left text-[11px] text-slate-500">
                          <span className="font-bold text-slate-700 block">Scannable Verification QR</span>
                          <span>Scan for external regulatory compliance audit</span>
                        </div>
                      </div>
                    )}
                    <div className="text-right text-[10px] text-slate-500 font-mono max-w-xs break-all">
                      <span className="text-[9px] font-semibold text-slate-400 uppercase block">Verification Checksum</span>
                      {activeSession?.verificationChecksum || 'VERIFIED-SHA256-AUTHENTIC'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      id="kiosk-player-shell"
      data-testid="kiosk-player-shell"
      dir={isRtl ? 'rtl' : 'ltr'}
      data-dir={isRtl ? 'rtl' : 'ltr'}
      data-rtl={isRtl ? 'true' : 'false'}
      data-font-scale={fontScale}
      style={{ '--kiosk-font-scale': fontScale / 100 } as React.CSSProperties}
      className={`flex h-screen w-full flex-col justify-between overflow-hidden select-none transition-colors ${
        highContrast ? 'high-contrast-mode bg-black text-white' : 'bg-slate-950 text-white font-sans'
      } kiosk-font-scale-${fontScale}`}
    >
      {/* Universal Screen Reader ARIA Live Region Architecture (K-ACC-003) */}
      <KioskLiveAnnouncer
        currentStepIndex={currentStepIndex}
        totalSteps={totalSteps}
        stepTitle={activeStep?.title || ''}
        isEmergency={Boolean(activeEmergency && activeEmergency.isActive) || activeStep?.type === 'emergency_step'}
        isWarning={activeStep?.type === 'warning_step'}
        emergencyTitle={activeEmergency?.title}
        tamperingDetected={tamperingDetected}
      />

      {/* 1. Modular Pinned Header */}
      <KioskPlayerHeader
        title={journey.title}
        currentStepIndex={currentStepIndex}
        totalSteps={totalSteps}
        languages={journey.languages}
        selectedLanguage={selectedLanguage}
        onLanguageChange={handleLanguageChange}
        isMuted={isMuted}
        onToggleMuted={toggleMuted}
        volume={volume}
        onVolumeChange={setVolume}
        autoPlay={autoPlayNarration}
        onToggleAutoPlay={() => setAutoPlayNarration((prev) => !prev)}
        showSubtitles={showSubtitles}
        onToggleSubtitles={toggleSubtitles}
        highContrast={highContrast}
        onToggleHighContrast={handleToggleHighContrast}
        fontScale={fontScale}
        onFontScaleChange={handleFontScaleChange}
        canExit={
          isAdminPreview || journey?.settings?.security?.protectionType === 'pin' || Boolean(onExit)
        }
        onExit={handleExitClick}
        isAdminPreview={isAdminPreview}
        isRtl={isRtl}
      />

      {/* Synchronized Localized Audio Narration (K-LOC-003) */}
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-8 lg:px-12 pt-2 shrink-0">
        <KioskAudioNarrator
          step={activeStep || null}
          selectedLanguage={selectedLanguage}
          defaultLanguage={(journey as any)?.defaultLanguage || journey?.languages?.[0] || 'en'}
          autoPlay={autoPlayNarration}
          isMuted={isMuted}
          volume={volume}
          onToggleMute={toggleMuted}
          onVolumeChange={setVolume}
          onAudioStart={() => setPlayingAudio(true)}
          onAudioEnd={() => setPlayingAudio(false)}
          highContrast={highContrast}
          isRtl={isRtl}
        />
      </div>

      {/* 2. Responsive Active Step Canvas with Directional Transitions */}
      <KioskStepContainer
        step={activeStep || null}
        stepIndex={currentStepIndex}
        direction={stepDirection}
        selectedLanguage={selectedLanguage}
        defaultLanguage={(journey as any)?.defaultLanguage || journey?.languages?.[0] || 'en'}
        highContrast={highContrast}
        fontScale={fontScale}
        videoCompleted={videoCompleted}
        onVideoComplete={() => setVideoCompleted(true)}
        onYesNoSelection={handleYesNoSelection}
        onHotspotClick={handleHotspotClick}
        holdProgress={holdProgress}
        onHoldStart={handleHoldStart}
        onHoldEnd={handleHoldEnd}
        checkedPpe={checkedPpe}
        onTogglePpeItem={(item) => {
          const nextSet = new Set(checkedPpe);
          if (nextSet.has(item)) {
            nextSet.delete(item);
          } else {
            nextSet.add(item);
            recordInteraction(`ppe_check_${item.toLowerCase().replace(/[^a-z0-9]/g, '-')}`);
          }
          setCheckedPpe(nextSet);
        }}
        onSelectAllPpe={() => {
          const required =
            activeStep?.interaction?.ppeItems || [
              'Hard Hat',
              'Safety Glasses',
              'High-Vis Vest',
              'Steel Toe Boots',
              'Gloves'
            ];
          setCheckedPpe(new Set(required));
        }}
        onSubmitPpe={handlePpeConfirm}
        ppeSubmitted={ppeSubmitted}
        ppeResetCountdown={ppeResetCountdown}
        ppeSubmitError={ppeSubmitError}
        showSubtitles={showSubtitles}
        isRtl={isRtl}
      />

      {/* 3. Fixed Bottom Action Footer Pinned to 96px */}
      <KioskActionFooter
        currentStepIndex={currentStepIndex}
        totalSteps={totalSteps}
        canGoBack={currentStepIndex > 0 && !isYesNoStep}
        canGoNext={canGoNext}
        isLastStep={isLastStep}
        onPrev={handlePrevStep}
        onNext={handleNextStep}
        onRestart={handleResetJourney}
        onFinish={handleFinish}
        finishButtonLabel={
          isSupervisorWitnessRequired && !supervisorWitness
            ? t('supervisor.finishWitnessRequired', { defaultValue: 'Finish (Witness Required)' })
            : undefined
        }
        highContrast={highContrast}
        showBack={currentStepIndex > 0 && !isYesNoStep}
        showNext={showNextInFooter}
        showFinish={showFinishInFooter}
        isHoldToConfirm={isHoldStep}
        holdProgress={holdProgress}
        onHoldStart={handleHoldStart}
        onHoldEnd={handleHoldEnd}
        isRtl={isRtl}
        selectedLanguage={selectedLanguage}
      />

      {/* Administrative / Operator Exit PIN Overlay (K-SEC-002: 6-digit Exit PIN) */}
      {showPinOverlay && (
        <KioskPinOverlay
          journeyId={journeyId}
          pinLength={6}
          expectedPin={journey?.settings?.security?.pinCode}
          title={t('lockdown.exitPinTitle', { defaultValue: 'Enter Exit PIN' })}
          description={t('lockdown.exitPinDescription', {
            defaultValue: 'Administrative Exit. Enter 6-digit Exit PIN to leave kiosk mode.'
          })}
          onSuccess={() => {
            setShowPinOverlay(false);
            if (onExit) onExit();
          }}
          onCancel={() => setShowPinOverlay(false)}
        />
      )}

      {/* Fullscreen Kiosk Lockdown Re-enter Modal (K-SEC-002) */}
      <KioskReenterModal
        isOpen={isReenterPromptVisible}
        highContrast={highContrast}
        onReenter={async () => {
          await kioskLockdownService.requestFullscreen(containerRef.current || (typeof document !== 'undefined' ? document.documentElement : null));
        }}
      />

      {/* Frontline Worker Identification Modal (DEF-008 / K-EMP-001) */}
      <FrontlineIdentifyModal
        isOpen={showIdentifyModal}
        onClose={() => {
          setShowIdentifyModal(false);
          if (!workerIdentified && onExit) {
            onExit();
          }
        }}
        onSuccess={({ token, worker }) => {
          deviceIdentityService.setEmployeeSession(token, worker);
          setEphemeralWorkerToken(token);
          setWorkerIdentified(true);
          setShowIdentifyModal(false);
          startSession();
        }}
        highContrast={highContrast}
      />

      {/* Automatic Privacy Reset 15s Countdown Warning Modal (K-EMP-003) */}
      <PrivacyTimeoutModal
        isOpen={isPrivacyWarningOpen}
        remainingSeconds={privacyCountdownSeconds}
        onStay={handlePrivacyStay}
        onExit={handlePrivacyExitNow}
      />

      {/* Supervisor Witness Attestation Completion Gate Modal (DEF-009 / K-SUP-002) */}
      <SupervisorWitnessGateModal
        isOpen={showSupervisorGateModal}
        sessionId={activeSession?._id}
        workerName={
          deviceIdentityService.getEmployeeUser?.()?.fullName ||
          (deviceIdentityService.getEmployeeUser?.()?.firstName && deviceIdentityService.getEmployeeUser?.()?.lastName
            ? `${deviceIdentityService.getEmployeeUser?.()?.firstName} ${deviceIdentityService.getEmployeeUser?.()?.lastName}`
            : undefined)
        }
        journeyTitle={journey.title}
        onClose={() => setShowSupervisorGateModal(false)}
        onSuccess={handleSupervisorWitnessSuccess}
        highContrast={highContrast}
      />

      {/* Remote Operational Command Maintenance Overlay (K-DEV-007) */}
      <KioskMaintenanceOverlay
        isOpen={isMaintenanceActive}
        payload={maintenancePayload}
        onExitMaintenance={() => {
          kioskCommandExecutorService.setMaintenance(false);
          setIsMaintenanceActive(false);
        }}
      />

      {/* Emergency Evacuation Overlay (Highest Priority K-SEC-004) */}
      {activeEmergency && activeEmergency.isActive && (
        <EmergencyEvacuationOverlay
          emergency={activeEmergency}
        />
      )}
    </div>
  );
};

export default KioskPlayer;
