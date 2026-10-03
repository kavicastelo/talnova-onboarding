import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  Smartphone,
  Monitor,
  Tablet,
  Maximize2,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Globe,
  Hand,
  Check,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Activity
} from 'lucide-react';
import { KioskJourney } from '../../../../types/kiosk/journey.types';
import { KioskStep } from '../../../../types/kiosk/step.types';
import { isRtlLanguage } from '../../constants/language.constants';

export type AspectRatioMode = '16:9' | '9:16' | '4:3' | 'full';

export interface JourneySimulatorProps {
  journey: Partial<KioskJourney>;
  initialStepIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  initialAspectRatio?: AspectRatioMode;
  initialLanguage?: string;
  className?: string;
}

interface LanguageOption {
  code: string;
  name: string;
  autonym: string;
  dir: 'ltr' | 'rtl';
  flag: string;
}

const SIMULATOR_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', autonym: 'English', dir: 'ltr', flag: '🇬🇧' },
  { code: 'es', name: 'Spanish', autonym: 'Español', dir: 'ltr', flag: '🇪🇸' },
  { code: 'fr', name: 'French', autonym: 'Français', dir: 'ltr', flag: '🇫🇷' },
  { code: 'de', name: 'German', autonym: 'Deutsch', dir: 'ltr', flag: '🇩🇪' },
  { code: 'ar', name: 'Arabic', autonym: 'العربية', dir: 'rtl', flag: '🇸🇦' }
];

const DEFAULT_PPE_ITEMS = [
  'Hard Hat',
  'Safety Glasses',
  'High-Vis Vest',
  'Steel-Toe Boots',
  'Gloves'
];

export const JourneySimulator: React.FC<JourneySimulatorProps> = ({
  journey,
  initialStepIndex = 0,
  isOpen,
  onClose,
  initialAspectRatio = '9:16',
  initialLanguage = 'en',
  className = ''
}) => {
  const steps: KioskStep[] = useMemo(() => {
    if (journey.steps && journey.steps.length > 0) {
      return journey.steps as KioskStep[];
    }
    // Fallback demo step if journey is empty
    return [
      {
        id: 'demo-step-1',
        type: 'info_step',
        title: 'Safety Briefing Overview',
        order: 1,
        blocks: [
          {
            id: 'b-1',
            type: 'text',
            order: 1,
            settings: { size: 'medium', contrastMode: false },
            mediaReferences: {
              en: { textValue: 'Welcome to the facility. Review mandatory safety rules before proceeding.' }
            }
          } as unknown as any
        ],
        interaction: { type: 'tap_to_continue' }
      } as unknown as KioskStep
    ];
  }, [journey.steps]);

  // Current simulation state
  const [currentStepIndex, setCurrentStepIndex] = useState(
    Math.min(Math.max(0, initialStepIndex), Math.max(0, steps.length - 1))
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatioMode>(initialAspectRatio);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(initialLanguage);
  const [showDebugOverlay, setShowDebugOverlay] = useState<boolean>(true);
  const [touchIndicatorActive, setTouchIndicatorActive] = useState<boolean>(true);

  // Active step
  const activeStep = steps[currentStepIndex] || steps[0];
  const isRtl = isRtlLanguage(selectedLanguage);

  // Dwell timer state
  const [dwellElapsedSeconds, setDwellElapsedSeconds] = useState<number>(0);
  const requiredDwellSeconds = useMemo(() => {
    if (activeStep.type === 'warning_step' || activeStep.type === 'emergency_step') {
      return 3;
    }
    return (activeStep as any).dwellTimeSeconds || 0;
  }, [activeStep]);
  const isDwellSatisfied = dwellElapsedSeconds >= requiredDwellSeconds;

  // Touch hold state
  const holdDurationMs = useMemo(() => {
    return activeStep.interaction?.holdDurationMs || 3000;
  }, [activeStep]);

  const [isHolding, setIsHolding] = useState<boolean>(false);
  const [holdProgress, setHoldProgress] = useState<number>(0);
  const [isHoldCompleted, setIsHoldCompleted] = useState<boolean>(false);
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const holdStartRef = useRef<number>(0);

  // PPE checklist state
  const requiredPpeItems = useMemo(() => {
    return activeStep.interaction?.ppeItems || DEFAULT_PPE_ITEMS;
  }, [activeStep]);
  const [checkedPpe, setCheckedPpe] = useState<Set<string>>(new Set());
  const [isPpeConfirmed, setIsPpeConfirmed] = useState<boolean>(false);
  const isAllPpeChecked = requiredPpeItems.length > 0 && requiredPpeItems.every(i => checkedPpe.has(i));

  // Touch visual cursor position
  const [touchPos, setTouchPos] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false
  });

  // Step reset on transition
  useEffect(() => {
    setDwellElapsedSeconds(0);
    setHoldProgress(0);
    setIsHolding(false);
    setIsHoldCompleted(false);
    setCheckedPpe(new Set());
    setIsPpeConfirmed(false);
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  }, [currentStepIndex, activeStep.id]);

  // Dwell timer ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setDwellElapsedSeconds(prev => Math.round((prev + 0.1) * 10) / 10);
    }, 100);
    return () => clearInterval(timer);
  }, [currentStepIndex]);

  // Hold-to-confirm handlers
  const handleHoldStart = useCallback((e?: React.SyntheticEvent) => {
    if (isHoldCompleted) return;
    if (e && 'preventDefault' in e && e.type === 'touchstart') {
      // Prevent default on mobile touch
    }
    setIsHolding(true);
    holdStartRef.current = Date.now();

    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
    }

    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - holdStartRef.current;
      const progress = Math.min((elapsed / holdDurationMs) * 100, 100);
      setHoldProgress(progress);

      if (progress >= 100) {
        if (holdIntervalRef.current) {
          clearInterval(holdIntervalRef.current);
          holdIntervalRef.current = null;
        }
        setIsHolding(false);
        setIsHoldCompleted(true);
      }
    }, 20);
  }, [isHoldCompleted, holdDurationMs]);

  const handleHoldEnd = useCallback(() => {
    if (isHoldCompleted) return;
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setIsHolding(false);
    setHoldProgress(0);
  }, [isHoldCompleted]);

  // Cleanup hold timer on unmount
  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) {
        clearInterval(holdIntervalRef.current);
      }
    };
  }, []);

  // PPE toggle
  const togglePpeItem = (item: string) => {
    setCheckedPpe(prev => {
      const next = new Set(prev);
      if (next.has(item)) {
        next.delete(item);
      } else {
        next.add(item);
      }
      return next;
    });
  };

  const handleSelectAllPpe = () => {
    setCheckedPpe(new Set(requiredPpeItems));
  };

  const handleConfirmPpe = () => {
    if (isAllPpeChecked) {
      setIsPpeConfirmed(true);
    }
  };

  // Progression check
  const isInteractiveHoldStep =
    activeStep.type === 'interactive_confirmation' ||
    activeStep.interaction?.type === 'hold_to_confirm';

  const isPpeStep = activeStep.interaction?.type === 'ppe_checklist';

  const canGoNext = useMemo(() => {
    if (!isDwellSatisfied) return false;
    if (isInteractiveHoldStep && !isHoldCompleted) return false;
    if (isPpeStep && !isPpeConfirmed) return false;
    return true;
  }, [isDwellSatisfied, isInteractiveHoldStep, isHoldCompleted, isPpeStep, isPpeConfirmed]);

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1 && canGoNext) {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleRestart = () => {
    setCurrentStepIndex(0);
  };

  // Touch simulation on screen glass
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!touchIndicatorActive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTouchPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      visible: true
    });
  };

  const handlePointerUp = () => {
    setTouchPos(prev => ({ ...prev, visible: false }));
  };

  // Frame dimension styling based on aspect ratio
  const frameDimensions = useMemo(() => {
    switch (aspectRatio) {
      case '9:16':
        return {
          wrapper: 'max-w-[400px] h-[720px] aspect-[9/16] w-full',
          title: '9:16 Portrait (Totem)',
          isPortrait: true
        };
      case '16:9':
        return {
          wrapper: 'max-w-[960px] h-[540px] aspect-[16/9] w-full',
          title: '16:9 Landscape (Kiosk)',
          isPortrait: false
        };
      case '4:3':
        return {
          wrapper: 'max-w-[700px] h-[525px] aspect-[4/3] w-full',
          title: '4:3 Tablet (Industrial)',
          isPortrait: false
        };
      case 'full':
      default:
        return {
          wrapper: 'w-full h-full max-w-[1200px]',
          title: 'Full Viewport',
          isPortrait: false
        };
    }
  }, [aspectRatio]);

  // Localized preview text helper
  const localizedTitle = useMemo(() => {
    if (selectedLanguage === 'es') return `[ES] ${activeStep.title}`;
    if (selectedLanguage === 'fr') return `[FR] ${activeStep.title}`;
    if (selectedLanguage === 'de') return `[DE] ${activeStep.title}`;
    if (selectedLanguage === 'ar') return `[AR] ${activeStep.title}`;
    return activeStep.title;
  }, [activeStep.title, selectedLanguage]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="journey-simulator-modal"
      className={`fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md text-slate-100 font-sans select-none overflow-hidden ${className}`}
    >
      {/* ------------------------------------------------------------------- */}
      {/* TOP CONTROL TOOLBAR: Aspect Ratio, Language, Hardware Controls     */}
      {/* ------------------------------------------------------------------- */}
      <header className="h-16 border-b border-slate-900 bg-slate-950/90 px-6 flex items-center justify-between shrink-0 shadow-lg">
        {/* Left: Branding & Aspect Ratio Picker */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              <Smartphone className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Hardware QA Simulator</h2>
              <p className="text-[10px] text-slate-400 font-mono">
                {journey.title || 'Untitled Journey'} &bull; {frameDimensions.title}
              </p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800" />

          {/* Aspect Ratio Selector */}
          <div className="flex items-center space-x-1 bg-slate-900/80 p-1 rounded-xl border border-slate-850">
            <button
              type="button"
              data-testid="aspect-ratio-16-9"
              onClick={() => setAspectRatio('16:9')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                aspectRatio === '16:9'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>16:9 Landscape</span>
            </button>

            <button
              type="button"
              data-testid="aspect-ratio-9-16"
              onClick={() => setAspectRatio('9:16')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                aspectRatio === '9:16'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>9:16 Portrait</span>
            </button>

            <button
              type="button"
              data-testid="aspect-ratio-4-3"
              onClick={() => setAspectRatio('4:3')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                aspectRatio === '4:3'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Tablet className="w-3.5 h-3.5" />
              <span>4:3 Tablet</span>
            </button>

            <button
              type="button"
              data-testid="aspect-ratio-full"
              onClick={() => setAspectRatio('full')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                aspectRatio === 'full'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Full Screen</span>
            </button>
          </div>
        </div>

        {/* Right: Language Toolbar, Debug Toggle, Close */}
        <div className="flex items-center space-x-4">
          {/* Quick Language Toggle Toolbar */}
          <div className="flex items-center space-x-1 bg-slate-900/80 p-1 rounded-xl border border-slate-850">
            <Globe className="w-3.5 h-3.5 text-slate-500 ml-2 mr-1" />
            {SIMULATOR_LANGUAGES.map(lang => (
              <button
                key={lang.code}
                type="button"
                data-testid={`lang-toggle-${lang.code}`}
                onClick={() => setSelectedLanguage(lang.code)}
                className={`px-2 py-1 rounded-md text-xs font-mono font-bold transition flex items-center space-x-1 ${
                  selectedLanguage === lang.code
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title={`${lang.name} (${lang.autonym})`}
              >
                <span>{lang.flag}</span>
                <span className="uppercase">{lang.code}</span>
              </button>
            ))}
          </div>

          {/* Toggle Touch Indicator */}
          <button
            type="button"
            data-testid="toggle-touch-indicator"
            onClick={() => setTouchIndicatorActive(!touchIndicatorActive)}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition ${
              touchIndicatorActive
                ? 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                : 'bg-slate-900 border-slate-850 text-slate-500 hover:text-slate-300'
            }`}
            title="Toggle capacitive touch finger cursor emulation"
          >
            <Hand className="w-4 h-4" />
          </button>

          {/* Toggle Debug Overlay */}
          <button
            type="button"
            data-testid="toggle-debug-overlay"
            onClick={() => setShowDebugOverlay(!showDebugOverlay)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition ${
              showDebugOverlay
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                : 'bg-slate-900 border-slate-850 text-slate-500 hover:text-slate-300'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Debug Overlay</span>
          </button>

          <button
            type="button"
            data-testid="close-simulator-btn"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 border border-slate-850 text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------------- */}
      {/* MAIN VIEWPORT: Frame Emulation & Interactive Screen Glass           */}
      {/* ------------------------------------------------------------------- */}
      <main className="flex-1 overflow-auto flex items-center justify-center p-6 relative bg-gradient-to-b from-slate-950 to-slate-900">
        {/* Aspect Ratio Constraint Box */}
        <div
          data-testid="simulator-frame"
          data-aspect-ratio={aspectRatio}
          className={`relative transition-all duration-300 flex flex-col ${frameDimensions.wrapper}`}
        >
          {/* Hardware Totem Bezel Styling */}
          <div
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            className={`relative flex-1 flex flex-col bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden rounded-3xl ${
              aspectRatio === '9:16' ? 'ring-8 ring-slate-900/90 shadow-2xl shadow-indigo-950/40' : 'ring-4 ring-slate-900'
            }`}
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            {/* Top Bezel Speaker & Camera Notch (Physical Totem Emulation) */}
            <div className="h-6 w-full bg-slate-950 border-b border-slate-900 flex items-center justify-center relative shrink-0">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-slate-800" />
                <span className="w-12 h-1 bg-slate-850 rounded-full" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70" />
              </div>
            </div>

            {/* Simulated Touch Feedback Cursor Indicator */}
            {touchIndicatorActive && touchPos.visible && (
              <div
                data-testid="touch-indicator"
                style={{ left: touchPos.x, top: touchPos.y }}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border-2 border-sky-400/80 bg-sky-400/20 backdrop-blur-xs animate-ping"
              />
            )}

            {/* Screen Header Bar */}
            <div className="px-6 py-3 border-b border-slate-900 bg-slate-950/80 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2 truncate">
                <span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[11px] font-mono font-bold">
                  {currentStepIndex + 1}/{steps.length}
                </span>
                <span className="text-xs font-semibold text-slate-300 truncate">{localizedTitle}</span>
              </div>
              <div className="flex items-center space-x-2">
                {requiredDwellSeconds > 0 && (
                  <span
                    data-testid="dwell-indicator"
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center space-x-1 ${
                      isDwellSatisfied
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    <span>{isDwellSatisfied ? 'Dwell OK' : `${(requiredDwellSeconds - dwellElapsedSeconds).toFixed(1)}s`}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Warning / Emergency Template Banner */}
            {(activeStep.type === 'warning_step' || activeStep.type === 'emergency_step') && (
              <div
                className={`p-3 border-b text-xs font-bold uppercase tracking-wider flex items-center space-x-2 shrink-0 ${
                  activeStep.type === 'emergency_step'
                    ? 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                    : 'bg-amber-950/40 border-amber-500/30 text-amber-300'
                }`}
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{activeStep.type === 'emergency_step' ? 'Critical Emergency Briefing' : 'Safety Hazard Warning'}</span>
              </div>
            )}

            {/* Step Body Content Area */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">{localizedTitle}</h1>

                {/* Blocks Rendering */}
                {activeStep.blocks?.map((block, idx) => (
                  <div
                    key={block.id || idx}
                    className="p-4 rounded-2xl bg-slate-900/60 border border-slate-850/80 text-sm text-slate-300 leading-relaxed shadow-sm"
                  >
                    <p>
                      {(block.settings as any)?.text ||
                        block.mediaReferences?.[selectedLanguage]?.textValue ||
                        (block.mediaReferences as any)?.en?.textValue ||
                        'Standard briefing slide instructions and procedural guidance.'}
                    </p>
                  </div>
                ))}

                {/* PPE Checklist Interaction Component */}
                {isPpeStep && (
                  <div
                    data-testid="simulator-ppe-interaction"
                    className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4 shadow-inner"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                        <h3 className="text-sm font-bold text-white">Mandatory PPE Checklist</h3>
                      </div>
                      <button
                        type="button"
                        data-testid="ppe-select-all-btn"
                        onClick={handleSelectAllPpe}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                      >
                        Select All
                      </button>
                    </div>

                    <div className="space-y-2">
                      {requiredPpeItems.map(item => {
                        const isChecked = checkedPpe.has(item);
                        return (
                          <div
                            key={item}
                            data-testid={`ppe-item-${item}`}
                            onClick={() => togglePpeItem(item)}
                            className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                              isChecked
                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                                : 'bg-slate-950/60 border-slate-850 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            <span className="text-sm font-medium">{item}</span>
                            <div
                              className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                                isChecked ? 'bg-emerald-500 border-emerald-400 text-slate-950' : 'border-slate-700'
                              }`}
                            >
                              {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      data-testid="confirm-ppe-btn"
                      disabled={!isAllPpeChecked || isPpeConfirmed}
                      onClick={handleConfirmPpe}
                      className={`w-full py-3 rounded-xl font-bold text-sm transition flex items-center justify-center space-x-2 ${
                        isPpeConfirmed
                          ? 'bg-emerald-500 text-slate-950 cursor-default'
                          : isAllPpeChecked
                          ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isPpeConfirmed ? 'PPE Verified' : 'Confirm PPE Compliance'}</span>
                    </button>
                  </div>
                )}

                {/* Interactive Touch Hold Target */}
                {isInteractiveHoldStep && (
                  <div
                    data-testid="simulator-hold-interaction"
                    className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col items-center justify-center space-y-4"
                  >
                    <p className="text-xs text-slate-400 font-medium text-center">
                      Touch & Hold continuously for {(holdDurationMs / 1000).toFixed(1)}s to verify understanding
                    </p>

                    <div className="relative flex items-center justify-center">
                      {/* Circular Progress Ring */}
                      <svg
                        data-testid="hold-progress-ring"
                        width="110"
                        height="110"
                        className="transform -rotate-90 pointer-events-none"
                      >
                        <circle
                          cx="55"
                          cy="55"
                          r="46"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="transparent"
                          className="text-slate-800"
                        />
                        <circle
                          cx="55"
                          cy="55"
                          r="46"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="transparent"
                          strokeDasharray={289}
                          strokeDashoffset={289 - (289 * holdProgress) / 100}
                          strokeLinecap="round"
                          className={`transition-all duration-75 ${
                            isHoldCompleted
                              ? 'text-emerald-400'
                              : isHolding
                              ? 'text-indigo-400'
                              : 'text-slate-700'
                          }`}
                        />
                      </svg>

                      {/* Interactive Button */}
                      <button
                        type="button"
                        id="kiosk-btn-hold"
                        data-testid="hold-to-confirm-btn"
                        data-hold-completed={isHoldCompleted ? 'true' : 'false'}
                        onMouseDown={handleHoldStart}
                        onMouseUp={handleHoldEnd}
                        onMouseLeave={handleHoldEnd}
                        onTouchStart={handleHoldStart}
                        onTouchEnd={handleHoldEnd}
                        className={`absolute w-20 h-20 rounded-full flex flex-col items-center justify-center transition select-none ${
                          isHoldCompleted
                            ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30'
                            : isHolding
                            ? 'bg-indigo-600 text-white scale-95 shadow-lg shadow-indigo-600/40'
                            : 'bg-slate-850 hover:bg-slate-800 text-slate-200'
                        }`}
                      >
                        {isHoldCompleted ? (
                          <CheckCircle2 className="w-8 h-8" />
                        ) : (
                          <>
                            <Hand className={`w-6 h-6 ${isHolding ? 'animate-bounce' : ''}`} />
                            <span className="text-[10px] font-mono font-bold mt-1">
                              {Math.round(holdProgress)}%
                            </span>
                          </>
                        )}
                      </button>
                    </div>

                    <span
                      data-testid="hold-status-text"
                      className="text-xs font-mono text-slate-400"
                    >
                      {isHoldCompleted
                        ? 'Confirmation Satisfied'
                        : isHolding
                        ? `Holding... ${(holdProgress).toFixed(0)}%`
                        : 'Press and hold button'}
                    </span>
                  </div>
                )}
              </div>

              {/* ----------------------------------------------------------------- */}
              {/* NAVIGATION FOOTER (Adapts to Bottom Thumb Zone in 9:16 Portrait)  */}
              {/* ----------------------------------------------------------------- */}
              <div
                data-testid={aspectRatio === '9:16' ? 'bottom-thumb-zone' : 'simulator-navigation'}
                className={`pt-4 border-t border-slate-900 flex items-center justify-between gap-3 ${
                  aspectRatio === '9:16' ? 'flex-col sm:flex-row pb-2' : ''
                }`}
              >
                <button
                  type="button"
                  data-testid="simulator-prev-btn"
                  onClick={handlePrev}
                  disabled={currentStepIndex === 0}
                  className={`px-4 py-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition ${
                    aspectRatio === '9:16' ? 'min-h-[56px] w-full sm:w-auto min-w-[120px]' : ''
                  } ${
                    currentStepIndex === 0
                      ? 'border-slate-900 bg-slate-950 text-slate-700 cursor-not-allowed'
                      : 'border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <button
                    type="button"
                    data-testid="simulator-restart-btn"
                    onClick={handleRestart}
                    className="p-3 rounded-xl border border-slate-900 bg-slate-950 text-slate-500 hover:text-slate-300 transition"
                    title="Restart journey simulation"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    data-testid="simulator-next-btn"
                    onClick={handleNext}
                    disabled={!canGoNext || currentStepIndex === steps.length - 1}
                    className={`flex-1 sm:flex-initial px-6 py-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition ${
                      aspectRatio === '9:16' ? 'min-h-[56px] min-w-[160px]' : ''
                    } ${
                      !canGoNext
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                        : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'
                    }`}
                  >
                    <span>{currentStepIndex === steps.length - 1 ? 'Completed' : 'Continue'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Totem Stand Base Indicator (9:16 only) */}
            {aspectRatio === '9:16' && (
              <div className="h-3 w-full bg-slate-900 border-t border-slate-800 flex items-center justify-center shrink-0">
                <div className="w-16 h-1 bg-slate-700 rounded-full" />
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------------- */}
        {/* INTERACTIVE DEBUG OVERLAY: Active Step ID, Blocks, Dwell Timer      */}
        {/* ------------------------------------------------------------------- */}
        {showDebugOverlay && (
          <aside
            data-testid="debug-overlay"
            className="absolute bottom-6 right-6 w-80 bg-slate-950/95 border border-slate-800 rounded-2xl p-4 shadow-2xl backdrop-blur-md space-y-3 z-30 font-mono text-xs"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-850">
              <div className="flex items-center space-x-2 text-indigo-400 font-bold">
                <Activity className="w-4 h-4" />
                <span className="uppercase text-[11px] tracking-wider">QA Debug Telemetry</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                v1.0.0
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-500">Active Step ID:</span>
                <span data-testid="debug-step-id" className="font-bold text-white truncate max-w-[150px]">
                  {activeStep.id}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-500">Step Index:</span>
                <span data-testid="debug-step-index">
                  {`${currentStepIndex + 1} of ${steps.length}`}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-500">Step Type:</span>
                <span data-testid="debug-step-type" className="text-amber-300">
                  {activeStep.type}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-500">Block Count:</span>
                <span data-testid="debug-block-count" className="font-bold text-sky-400">
                  {activeStep.blocks?.length || 0}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-500">Dwell Timer:</span>
                <span
                  data-testid="debug-dwell-timer"
                  className={isDwellSatisfied ? 'text-emerald-400' : 'text-amber-400 font-bold'}
                >
                  {`${dwellElapsedSeconds.toFixed(1)}s / ${requiredDwellSeconds}s (${isDwellSatisfied ? 'Satisfied' : 'Locked'})`}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-500">Aspect Ratio:</span>
                <span data-testid="debug-aspect-ratio" className="text-indigo-300">
                  {`${aspectRatio} (${frameDimensions.title})`}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-500">Language (DIR):</span>
                <span data-testid="debug-language">
                  {`${selectedLanguage.toUpperCase()} [${isRtl ? 'RTL' : 'LTR'}]`}
                </span>
              </div>

              {isInteractiveHoldStep && (
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-500">Hold Progress:</span>
                  <span
                    data-testid="debug-hold-state"
                    className={isHoldCompleted ? 'text-emerald-400 font-bold' : 'text-slate-300'}
                  >
                    {isHoldCompleted ? 'Completed (100%)' : `${Math.round(holdProgress)}%`}
                  </span>
                </div>
              )}
            </div>

            {/* Quick Step Jump Control */}
            <div className="pt-2 border-t border-slate-850">
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
                Jump To Step
              </label>
              <select
                data-testid="debug-step-select"
                value={currentStepIndex}
                onChange={e => setCurrentStepIndex(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
              >
                {steps.map((s, idx) => (
                  <option key={s.id} value={idx}>
                    {idx + 1}. {s.title} ({s.type})
                  </option>
                ))}
              </select>
            </div>
          </aside>
        )}
      </main>
    </div>
  );
};

export default JourneySimulator;
