import React, { useEffect, useRef, useState } from 'react';
import { useKioskPlayer } from '../context/KioskPlayerContext';
import { ShieldAlert, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { KioskPlayerHeader } from './KioskPlayerHeader';
import { KioskStepContainer } from './KioskStepContainer';
import { KioskActionFooter } from './KioskActionFooter';
import { KioskPinOverlay } from './KioskPinOverlay';
import { KioskRevokedScreen } from './KioskRevokedScreen';
import { FrontlineIdentifyModal } from './auth/FrontlineIdentifyModal';
import { SupervisorWitnessGateModal } from './auth/SupervisorWitnessGateModal';
import { PrivacyTimeoutModal } from './privacy/PrivacyTimeoutModal';
import { deviceIdentityService } from '../services/device-identity.service';
import { privacyResetService } from '../services/privacy-reset.service';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('kiosk');
  const {
    journey,
    currentStepIndex,
    selectedLanguage,
    isMuted,
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // K-EMP-003: Automatic Privacy Reset & Countdown Warning State
  const [isPrivacyWarningOpen, setIsPrivacyWarningOpen] = useState(false);
  const [privacyCountdownSeconds, setPrivacyCountdownSeconds] = useState(15);

  // Directional step transition animation ('forward' | 'backward')
  const [stepDirection, setStepDirection] = useState<'forward' | 'backward'>('forward');

  // Accessibility: High-contrast mode toggle
  const [highContrast, setHighContrast] = useState(false);

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

  // Frontline worker identification (DEF-008 / K-EMP-001)
  const [showIdentifyModal, setShowIdentifyModal] = useState(false);
  const [workerIdentified, setWorkerIdentified] = useState(false);
  const [, setEphemeralWorkerToken] = useState<string | null>(null);

  // Supervisor Witness Requirement & Gate State (DEF-009 / K-SUP-002)
  const [showSupervisorGateModal, setShowSupervisorGateModal] = useState(false);
  const [supervisorWitness, setSupervisorWitness] = useState<any | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completionCountdown, setCompletionCountdown] = useState(15);

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
    if (journey?.settings?.security?.protectionType === 'pin' && !isAdminPreview) {
      setShowPinOverlay(true);
    } else {
      if (onExit) onExit();
    }
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

  // Handle Audio Narration for active step / language
  useEffect(() => {
    if (!activeStep) return;

    const audioBlock = activeStep.blocks.find((b) => b.type === 'audio');
    const firstBlockWithAudio = activeStep.blocks.find(
      (b) => b.mediaReferences?.[selectedLanguage]?.audioUploadId
    );

    let audioUrl = '';
    if (audioBlock?.mediaReferences?.[selectedLanguage]?.embedUrl) {
      audioUrl = audioBlock.mediaReferences[selectedLanguage].embedUrl || '';
    } else if (firstBlockWithAudio?.mediaReferences?.[selectedLanguage]?.audioUploadId) {
      const uploadId = firstBlockWithAudio.mediaReferences[selectedLanguage].audioUploadId;
      audioUrl = `/api/v1/kiosk/uploads/${uploadId}`;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }

    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.muted = isMuted;
      audio.loop = false;

      audio.onended = () => {
        setPlayingAudio(false);
      };

      audioRef.current = audio;

      if (journey?.settings?.autoPlay) {
        audio
          .play()
          .then(() => setPlayingAudio(true))
          .catch((e) => console.warn('Autoplay audio blocked by browser policy:', e));
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [activeStep, selectedLanguage]);

  // Sync mute state with audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

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
    if (isCompleted && completionCountdown > 0) {
      timer = setTimeout(() => {
        setCompletionCountdown((prev) => prev - 1);
      }, 1000);
    } else if (isCompleted && completionCountdown <= 0) {
      setIsCompleted(false);
      setSupervisorWitness(null);
      handleResetJourney();
      if (onExit) onExit();
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isCompleted, completionCountdown, onExit]);

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
            className="mt-6 rounded-lg bg-slate-800 px-6 py-2 font-semibold text-white hover:bg-slate-700 transition min-h-[48px]"
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

          {/* Return / Exit Button & Countdown */}
          <div className="mt-8 space-y-3">
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
              className={`w-full min-h-[56px] px-6 py-3.5 rounded-2xl font-bold text-base transition active:scale-95 shadow-xl ${
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
        </div>
      </div>
    );
  }

  // Interaction mode determinations
  const isPpeStep =
    activeStep?.interaction?.type === 'ppe_checklist' || activeStep?.id === 'step-sop-01';
  const isYesNoStep = activeStep?.interaction?.type === 'yes_no';
  const isHoldStep = activeStep?.interaction?.type === 'hold_to_confirm';
  const totalSteps = journey.steps?.length || 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  // Next button visibility in footer
  const showNextInFooter = !isYesNoStep && !isLastStep;
  const showFinishInFooter = !isYesNoStep && isLastStep;
  const canGoNext = isPpeStep ? ppeSubmitted : true;

  return (
    <div
      ref={containerRef}
      id="kiosk-player-shell"
      data-testid="kiosk-player-shell"
      className={`flex h-screen w-full flex-col justify-between overflow-hidden select-none transition-colors ${
        highContrast ? 'bg-black text-white' : 'bg-slate-950 text-white font-sans'
      }`}
    >
      {/* 1. Modular Pinned Header */}
      <KioskPlayerHeader
        title={journey.title}
        currentStepIndex={currentStepIndex}
        totalSteps={totalSteps}
        languages={journey.languages}
        selectedLanguage={selectedLanguage}
        onLanguageChange={changeLanguage}
        isMuted={isMuted}
        onToggleMuted={toggleMuted}
        showSubtitles={showSubtitles}
        onToggleSubtitles={toggleSubtitles}
        highContrast={highContrast}
        onToggleHighContrast={() => setHighContrast((prev) => !prev)}
        canExit={
          isAdminPreview || journey?.settings?.security?.protectionType === 'pin' || Boolean(onExit)
        }
        onExit={handleExitClick}
        isAdminPreview={isAdminPreview}
      />

      {/* 2. Responsive Active Step Canvas with Directional Transitions */}
      <KioskStepContainer
        step={activeStep || null}
        stepIndex={currentStepIndex}
        direction={stepDirection}
        selectedLanguage={selectedLanguage}
        highContrast={highContrast}
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
      />

      {/* Administrative / Operator PIN Overlay */}
      {showPinOverlay && (
        <KioskPinOverlay
          journeyId={journeyId}
          onSuccess={() => {
            setShowPinOverlay(false);
            if (onExit) onExit();
          }}
          onCancel={() => setShowPinOverlay(false)}
        />
      )}

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
    </div>
  );
};

export default KioskPlayer;
