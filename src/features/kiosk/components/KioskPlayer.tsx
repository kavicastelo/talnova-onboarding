import React, { useEffect, useRef, useState } from 'react';
import { useKioskPlayer } from '../context/KioskPlayerContext';
import { 
  Volume2, VolumeX, Type, Languages, AlertTriangle, ShieldAlert,
  ArrowRight, ArrowLeft, RotateCcw, CheckCircle2, Hand
} from 'lucide-react';
import { KioskBlock } from '../../../types/kiosk/block.types';
import { KioskPinOverlay } from './KioskPinOverlay';

interface KioskPlayerProps {
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
    abortSession
  } = useKioskPlayer();

  const containerRef = useRef<HTMLDivElement>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Hold-to-confirm interaction state
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [showPinOverlay, setShowPinOverlay] = useState(false);

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
        // Reset back to start step
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

  // Get active step details
  const activeStep = journey?.steps[currentStepIndex];

  // Handle Audio Narration for active step / language
  useEffect(() => {
    if (!activeStep) return;
    
    // Find audio references in the step blocks
    const audioBlock = activeStep.blocks.find(b => b.type === 'audio');
    const firstBlockWithAudio = activeStep.blocks.find(b => b.mediaReferences?.[selectedLanguage]?.audioUploadId);
    
    let audioUrl = '';
    if (audioBlock?.mediaReferences?.[selectedLanguage]?.embedUrl) {
      audioUrl = audioBlock.mediaReferences[selectedLanguage].embedUrl || '';
    } else if (firstBlockWithAudio?.mediaReferences?.[selectedLanguage]?.audioUploadId) {
      // Presume S3 path or asset route
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
        audio.play()
          .then(() => setPlayingAudio(true))
          .catch(e => console.warn('Autoplay audio blocked by browser policy:', e));
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

  if (isLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-950 text-white">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        <p className="mt-4 text-lg font-medium text-slate-300">Loading Kiosk Screen...</p>
      </div>
    );
  }

  if (error || !journey) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-950 px-6 text-center text-white">
        <ShieldAlert className="h-16 w-16 text-rose-500 animate-pulse" />
        <h2 className="mt-4 text-2xl font-bold text-slate-100">Kiosk Access Error</h2>
        <p className="mt-2 max-w-md text-slate-400">{error || 'Unable to load Kiosk content.'}</p>
        {(isAdminPreview || journey?.settings?.security?.protectionType === 'pin') && (
          <button 
            onClick={handleExitClick}
            className="mt-6 rounded-lg bg-slate-800 px-6 py-2 font-semibold text-white hover:bg-slate-700 transition"
          >
            {isAdminPreview ? 'Exit Preview' : 'Exit'}
          </button>
        )}
      </div>
    );
  }

  // --- Interaction Event Handlers ---

  const handleYesNoSelection = (response: boolean) => {
    if (!activeStep?.interaction) return;
    recordInteraction(response ? 'yes' : 'no');
    
    const targetStepId = response 
      ? activeStep.interaction.correctStepId 
      : activeStep.interaction.incorrectStepId;
      
    if (targetStepId) {
      const idx = journey.steps.findIndex(s => s.id === targetStepId);
      if (idx !== -1) {
        setStepIndex(idx);
      }
    }
  };

  const handleHotspotClick = (actionStepId: string, idx: number) => {
    recordInteraction(`hotspot_${idx + 1}`);
    const stepIdx = journey.steps.findIndex(s => s.id === actionStepId);
    if (stepIdx !== -1) {
      setStepIndex(stepIdx);
    }
  };

  // Hold-to-confirm press/release handlers
  const handleHoldStart = () => {
    if (!activeStep?.interaction) return;
    recordInteraction('hold_start');
    
    const duration = activeStep.interaction.holdDurationMs || 2000;
    const intervalTime = 50; // Update progress bar every 50ms
    const totalSteps = duration / intervalTime;
    let currentStep = 0;

    holdIntervalRef.current = setInterval(() => {
      currentStep++;
      const progress = Math.min((currentStep / totalSteps) * 100, 100);
      setHoldProgress(progress);
    }, intervalTime);

    holdTimerRef.current = setTimeout(() => {
      clearInterval(holdIntervalRef.current!);
      setHoldProgress(100);
      recordInteraction('hold_complete');
      
      // Advance step
      if (currentStepIndex === journey.steps.length - 1) {
        completeSession();
        // Loop back to start
        setStepIndex(0);
        startSession();
      } else {
        nextStep();
      }
    }, duration);
  };

  const handleHoldEnd = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    setHoldProgress(0);
  };

  const handleResetJourney = () => {
    recordInteraction('reset');
    abortSession(activeStep?.id || 'unknown');
    setStepIndex(0);
    startSession();
  };

  const renderContentBlock = (block: KioskBlock) => {
    const ref = block.mediaReferences?.[selectedLanguage] || block.mediaReferences?.['en'];
    if (!ref) return null;

    switch (block.type) {
      case 'text':
        return (
          <p 
            key={block.id}
            className={`text-slate-200 leading-relaxed font-light ${
              block.settings?.size === 'large' ? 'text-3xl' : 
              block.settings?.size === 'small' ? 'text-lg' : 'text-xl'
            } ${block.settings?.contrastMode ? 'bg-black/40 p-4 rounded-lg' : ''}`}
          >
            {ref.textValue}
          </p>
        );

      case 'image':
        const imageUrl = ref.embedUrl || (ref.uploadId ? `/api/v1/kiosk/uploads/${ref.uploadId}` : '');
        return (
          <div key={block.id} className="relative overflow-hidden rounded-xl bg-slate-900 border border-slate-800">
            {imageUrl ? (
              <img 
                src={imageUrl} 
                alt="Kiosk Instruction Media" 
                className="max-h-[60vh] w-full object-contain"
              />
            ) : (
              <div className="flex h-64 w-full items-center justify-center text-slate-600">
                Media Missing
              </div>
            )}
          </div>
        );

      case 'video':
        const videoUrl = ref.embedUrl || (ref.uploadId ? `/api/v1/kiosk/uploads/${ref.uploadId}` : '');
        return (
          <div key={block.id} className="aspect-video w-full overflow-hidden rounded-xl bg-black border border-slate-900">
            {videoUrl ? (
              <video 
                src={videoUrl}
                autoPlay={block.settings?.autoplay}
                loop={block.settings?.loop}
                controls
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-64 w-full items-center justify-center text-slate-600">
                Media Missing
              </div>
            )}
          </div>
        );

      case 'icon':
        return (
          <div key={block.id} className="flex justify-center p-4">
            <div className={`p-6 rounded-full bg-slate-900 border-2 ${
              block.settings?.theme === 'danger' ? 'text-rose-500 border-rose-500/30' :
              block.settings?.theme === 'warning' ? 'text-amber-500 border-amber-500/30' :
              block.settings?.theme === 'mandatory' ? 'text-sky-500 border-sky-500/30' : 'text-emerald-500 border-emerald-500/30'
            }`}>
              <AlertTriangle className={`w-16 h-16`} />
            </div>
          </div>
        );

      case 'animation':
        return (
          <div key={block.id} className="flex justify-center rounded-xl bg-slate-900/50 p-6 border border-slate-800">
            <div className="h-32 w-32 animate-bounce rounded-full bg-emerald-500/20 border-2 border-emerald-500/60 flex items-center justify-center">
              <span className="text-emerald-400 font-semibold text-lg">Animation</span>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div 
      ref={containerRef}
      className="flex h-screen w-full flex-col justify-between bg-slate-950 text-white font-sans overflow-hidden select-none"
    >
      {/* 1. TOP HEADER STATUS BAR */}
      <header className="flex items-center justify-between border-b border-slate-900 bg-slate-950/70 p-6 backdrop-blur-md z-10">
        <div className="flex items-center space-x-4">
          <div className="rounded-md bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-400 border border-emerald-500/20">
            Kiosk Mode
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 max-w-sm truncate">
            {journey.title}
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          {/* Subtitle toggle */}
          <button 
            onClick={toggleSubtitles}
            className={`p-3 rounded-lg border transition ${
              showSubtitles 
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' 
                : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:bg-slate-850'
            }`}
          >
            <Type className="h-5 w-5" />
          </button>

          {/* Mute audio control */}
          <button 
            onClick={toggleMuted}
            className={`p-3 rounded-lg border transition ${
              isMuted 
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-400' 
                : 'border-slate-800 bg-slate-900/50 text-slate-300 hover:bg-slate-850'
            }`}
          >
            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>

          {/* Language Selector */}
          {journey.languages && journey.languages.length > 1 && (
            <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
              <Languages className="h-4 w-4 text-slate-400 mx-2" />
              {journey.languages.map((lang) => (
                <button
                  key={lang}
                  onClick={() => changeLanguage(lang)}
                  className={`px-3 py-1.5 rounded-md font-semibold text-sm transition ${
                    selectedLanguage === lang 
                      ? 'bg-emerald-500 text-slate-950 shadow-md' 
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
          )}

          {/* Exit option */}
          {(isAdminPreview || journey?.settings?.security?.protectionType === 'pin') && (
            <button
              onClick={handleExitClick}
              className="rounded-lg bg-rose-950/40 border border-rose-950 px-4 py-2 text-sm font-semibold text-rose-400 hover:bg-rose-900 hover:text-rose-100 transition"
            >
              Exit
            </button>
          )}
        </div>
      </header>

      {/* 2. BODY CONTENT PANEL */}
      <main className="relative flex-1 overflow-y-auto px-12 py-10 flex flex-col items-center justify-center max-w-5xl mx-auto w-full">
        {activeStep ? (
          <div className="w-full space-y-8 animate-fade-in">
            {/* Step specific warning template */}
            {(activeStep.type === 'emergency_step' || activeStep.type === 'warning_step') && (
              <div className={`flex items-start space-x-4 border rounded-xl p-6 ${
                activeStep.type === 'emergency_step' 
                  ? 'bg-rose-950/20 border-rose-500/30 text-rose-400 animate-pulse'
                  : 'bg-amber-950/20 border-amber-500/30 text-amber-400'
              }`}>
                {activeStep.type === 'emergency_step' ? (
                  <ShieldAlert className="w-8 h-8 shrink-0 text-rose-500" />
                ) : (
                  <AlertTriangle className="w-8 h-8 shrink-0 text-amber-500" />
                )}
                <div>
                  <h3 className="text-xl font-bold uppercase tracking-wide">
                    {activeStep.type === 'emergency_step' ? 'Emergency Protocol' : 'Attention Required'}
                  </h3>
                  <p className="mt-1 font-light opacity-90 text-lg">
                    Please read and confirm the following instruction carefully before advancing.
                  </p>
                </div>
              </div>
            )}

            {/* Step title */}
            <h2 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">
              {activeStep.title}
            </h2>

            {/* Render blocks */}
            <div className="grid gap-6 md:grid-cols-1">
              {activeStep.blocks.map(renderContentBlock)}
            </div>

            {/* INTERACTION OVERLAYS */}
            <div className="mt-10 pt-6 border-t border-slate-900 flex justify-center">
              
              {/* Interaction: Yes/No Branching */}
              {activeStep.interaction?.type === 'yes_no' && (
                <div className="flex space-x-6 w-full max-w-md">
                  <button
                    onClick={() => handleYesNoSelection(true)}
                    className="flex-1 rounded-xl bg-emerald-500 p-5 text-xl font-bold text-slate-950 hover:bg-emerald-400 active:scale-95 transition shadow-lg shadow-emerald-500/10 flex items-center justify-center space-x-2"
                  >
                    <CheckCircle2 className="w-6 h-6" />
                    <span>YES</span>
                  </button>
                  <button
                    onClick={() => handleYesNoSelection(false)}
                    className="flex-1 rounded-xl bg-slate-900 border border-slate-800 p-5 text-xl font-bold text-rose-500 hover:bg-slate-850 active:scale-95 transition flex items-center justify-center space-x-2"
                  >
                    <AlertTriangle className="w-6 h-6" />
                    <span>NO</span>
                  </button>
                </div>
              )}

              {/* Interaction: Circular Hold to Confirm */}
              {activeStep.interaction?.type === 'hold_to_confirm' && (
                <div className="flex flex-col items-center space-y-4">
                  <button
                    onMouseDown={handleHoldStart}
                    onMouseUp={handleHoldEnd}
                    onMouseLeave={handleHoldEnd}
                    onTouchStart={handleHoldStart}
                    onTouchEnd={handleHoldEnd}
                    className="relative h-24 w-24 rounded-full bg-slate-900 border border-slate-850 hover:border-emerald-500/40 flex items-center justify-center active:scale-95 transition cursor-pointer"
                  >
                    {/* SVG circular progress ring */}
                    <svg className="absolute inset-0 h-full w-full -rotate-90">
                      <circle
                        cx="48"
                        cy="48"
                        r="42"
                        className="stroke-slate-800"
                        strokeWidth="4"
                        fill="transparent"
                      />
                      <circle
                        cx="48"
                        cy="48"
                        r="42"
                        className="stroke-emerald-500 transition-all duration-75"
                        strokeWidth="4"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 42}
                        strokeDashoffset={2 * Math.PI * 42 * (1 - holdProgress / 100)}
                      />
                    </svg>
                    <Hand className="h-8 w-8 text-emerald-400 animate-pulse" />
                  </button>
                  <span className="text-slate-400 font-light text-sm tracking-widest uppercase">
                    Press & Hold to Confirm
                  </span>
                </div>
              )}

              {/* Interaction: Hotspots Overlay */}
              {activeStep.interaction?.type === 'hotspot' && (
                <div className="absolute inset-0 pointer-events-none z-20">
                  {(activeStep.interaction.hotspots || []).map((hs, hsIdx) => (
                    <button
                      key={hsIdx}
                      onClick={() => handleHotspotClick(hs.actionStepId, hsIdx)}
                      style={{
                        position: 'absolute',
                        left: `${hs.x}%`,
                        top: `${hs.y}%`,
                        width: `${hs.radius * 2}%`,
                        height: `${hs.radius * 2}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                      className="pointer-events-auto rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 hover:bg-emerald-500/20 hover:border-emerald-400 transition animate-pulse cursor-pointer shadow-lg shadow-emerald-500/20"
                      title="Interactive Hotspot"
                    />
                  ))}
                </div>
              )}

            </div>
          </div>
        ) : (
          <p className="text-slate-500">No content available for this step.</p>
        )}
      </main>

      {/* 3. SUBTITLES & CAPTIONS DISPLAY OVERLAY */}
      {showSubtitles && activeStep && (
        <div className="px-12 py-4 flex justify-center text-center">
          {activeStep.blocks.map(b => {
            const ref = b.mediaReferences?.[selectedLanguage] || b.mediaReferences?.['en'];
            if (b.type === 'text' || !ref?.textValue) return null;
            return (
              <div key={b.id} className="max-w-2xl bg-black/75 border border-slate-900 rounded-lg px-6 py-3 text-slate-100 text-lg font-light tracking-wide shadow-md">
                {ref.textValue}
              </div>
            );
          })}
        </div>
      )}

      {/* 4. BOTTOM NAVIGATION CONTROLS */}
      <footer className="flex items-center justify-between border-t border-slate-900 bg-slate-950/70 p-6 backdrop-blur-md z-10">
        <div className="flex items-center space-x-3">
          <button
            onClick={handleResetJourney}
            className="flex items-center space-x-2 rounded-lg bg-slate-900 border border-slate-800 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-850 transition"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Restart</span>
          </button>
        </div>

        {/* Informational pagination index */}
        <div className="text-sm font-light text-slate-400 tracking-wider">
          Screen <span className="text-white font-semibold">{currentStepIndex + 1}</span> of <span className="text-slate-300">{journey.steps?.length || 0}</span>
        </div>

        <div className="flex items-center space-x-3">
          {/* Back Button */}
          {currentStepIndex > 0 && activeStep?.interaction?.type !== 'yes_no' && (
            <button
              onClick={prevStep}
              className="flex items-center space-x-2 rounded-lg bg-slate-900 border border-slate-850 px-5 py-3 font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back</span>
            </button>
          )}

          {/* Next Button */}
          {currentStepIndex < (journey.steps?.length || 0) - 1 && 
           activeStep?.interaction?.type !== 'yes_no' && 
           activeStep?.interaction?.type !== 'hold_to_confirm' && (
            <button
              onClick={nextStep}
              className="flex items-center space-x-2 rounded-lg bg-emerald-500 px-6 py-3 font-bold text-slate-950 hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/10 transition"
            >
              <span>Next</span>
              <ArrowRight className="h-5 w-5" />
            </button>
          )}

          {/* Complete Button (Only visible on last slide for standard steps) */}
          {currentStepIndex === (journey.steps?.length || 0) - 1 && 
           activeStep?.interaction?.type !== 'yes_no' && 
           activeStep?.interaction?.type !== 'hold_to_confirm' && (
            <button
              onClick={() => {
                completeSession();
                handleResetJourney();
              }}
              className="flex items-center space-x-2 rounded-lg bg-emerald-500 px-6 py-3 font-bold text-slate-950 hover:bg-emerald-400 transition"
            >
              <CheckCircle2 className="h-5 w-5" />
              <span>Finish</span>
            </button>
          )}
        </div>
      </footer>

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
