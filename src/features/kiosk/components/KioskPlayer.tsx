import React, { useEffect, useRef, useState } from 'react';
import { useKioskPlayer } from '../context/KioskPlayerContext';
import { ShieldAlert } from 'lucide-react';
import { KioskPlayerHeader } from './KioskPlayerHeader';
import { KioskStepContainer } from './KioskStepContainer';
import { KioskActionFooter } from './KioskActionFooter';
import { KioskPinOverlay } from './KioskPinOverlay';
import { KioskRevokedScreen } from './KioskRevokedScreen';
import { deviceIdentityService } from '../services/device-identity.service';
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
    recordPpeCompliance
  } = useKioskPlayer();

  const containerRef = useRef<HTMLDivElement>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  const handleExitClick = () => {
    if (journey?.settings?.security?.protectionType === 'pin' && !isAdminPreview) {
      setShowPinOverlay(true);
    } else {
      if (onExit) onExit();
    }
  };

  // Load journey when ID changes
  useEffect(() => {
    loadJourney(journeyId, signedParams);
  }, [journeyId, signedParams]);

  // Start analytics session when journey is loaded
  useEffect(() => {
    if (journey) {
      startSession();
    }
  }, [journey]);

  // Handle Idle Timeout
  const resetIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (!journey) return;

    const idleSeconds = journey.settings?.idleTimeoutSeconds || 60;

    idleTimerRef.current = setTimeout(() => {
      console.log('Kiosk Idle Timeout triggered.');
      if (currentStepIndex > 0) {
        abortSession(journey.steps[currentStepIndex]?.id || 'unknown');
        setStepDirection('backward');
        setStepIndex(0);
        startSession();
      }
    }, idleSeconds * 1000);
  };

  useEffect(() => {
    const handleActivity = () => {
      resetIdleTimer();
    };

    const element = containerRef.current;
    if (element) {
      element.addEventListener('click', handleActivity);
      element.addEventListener('mousemove', handleActivity);
      element.addEventListener('touchstart', handleActivity);
    }

    resetIdleTimer();

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (element) {
        element.removeEventListener('click', handleActivity);
        element.removeEventListener('mousemove', handleActivity);
        element.removeEventListener('touchstart', handleActivity);
      }
    };
  }, [journey, currentStepIndex]);

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

  // Navigation handlers with directional animation
  const handleNextStep = () => {
    setStepDirection('forward');
    if (currentStepIndex === (journey?.steps?.length || 0) - 1) {
      completeSession();
      handleResetJourney();
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

  const handleFinish = () => {
    completeSession();
    handleResetJourney();
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
    </div>
  );
};

export default KioskPlayer;
