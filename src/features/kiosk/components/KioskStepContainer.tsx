import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Hand,
  Check,
  Info,
  Volume2,
  Radio,
  ChevronDown,
  Clock
} from 'lucide-react';
import { KioskStep } from '../../../types/kiosk/step.types';
import { KioskBlock } from '../../../types/kiosk/block.types';
import { KnowledgeQuizEngine } from './interactions/KnowledgeQuizEngine';
import { normalizeCloudMediaUrl } from './builder/MediaAssetPicker';

import { antiTamperingService } from '../services/anti-tampering.service';
import { FontScale } from './accessibility/AccessibilityToolbar';
import { getLanguageDisplayName, isRtlLanguage } from '../constants/language.constants';

export interface KioskStepContainerProps {
  step: KioskStep | null;
  stepIndex: number;
  direction?: 'forward' | 'backward';
  selectedLanguage: string;
  defaultLanguage?: string;
  highContrast?: boolean;
  fontScale?: FontScale;
  videoCompleted?: boolean;
  onVideoComplete?: () => void;
  // Interaction handlers
  onYesNoSelection?: (response: boolean) => void;
  onHotspotClick?: (actionStepId: string, idx: number) => void;
  // Hold-to-confirm
  holdProgress?: number;
  onHoldStart?: () => void;
  onHoldEnd?: () => void;
  // PPE Checklist
  checkedPpe?: Set<string>;
  onTogglePpeItem?: (item: string) => void;
  onSelectAllPpe?: () => void;
  onSubmitPpe?: () => void;
  ppeSubmitted?: boolean;
  ppeResetCountdown?: number;
  ppeSubmitError?: string | null;
  // Quiz
  onQuizPass?: (score: number) => void;
  onQuizFail?: (score: number) => void;
  // Supervisor Gate
  isSupervisorWitnessed?: boolean;
  onOpenSupervisorGate?: () => void;
  supervisorWitnessData?: any;
  // Subtitles
  showSubtitles?: boolean;
  isRtl?: boolean;
  className?: string;
  // Phase 3 Dwell & Hazard compliance
  dwellSeconds?: number;
  isHazardAcknowledged?: boolean;
  onHazardAcknowledge?: () => void;
  videoWatchPercent?: number;
}

export const KioskStepContainer: React.FC<KioskStepContainerProps> = ({
  step,
  stepIndex,
  direction = 'forward',
  selectedLanguage,
  defaultLanguage = 'en',
  highContrast = false,
  fontScale = 100,
  videoCompleted = false,
  onVideoComplete,
  onYesNoSelection,
  onHotspotClick,
  holdProgress = 0,
  onHoldStart,
  onHoldEnd,
  checkedPpe = new Set(),
  onTogglePpeItem,
  onSelectAllPpe,
  onSubmitPpe,
  ppeSubmitted = false,
  ppeResetCountdown = 10,
  ppeSubmitError = null,
  onQuizPass,
  onQuizFail,
  isSupervisorWitnessed = false,
  onOpenSupervisorGate,
  supervisorWitnessData,
  showSubtitles = false,
  isRtl,
  className = '',
  dwellSeconds: propsDwellSeconds,
  isHazardAcknowledged: propsHazardAcknowledged,
  onHazardAcknowledge,
  videoWatchPercent: videoWatchPercentProp
}) => {
  const { t } = useTranslation('kiosk');
  const isRtlMode = isRtl ?? isRtlLanguage(selectedLanguage);

  const mainRef = useRef<HTMLElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const isEmergency = step?.type === 'emergency_step';
  const isWarning = step?.type === 'warning_step';

  const configuredDwell = (
    propsDwellSeconds !== undefined
      ? propsDwellSeconds
      : (step as any)?.dwellSeconds ??
        (step as any)?.settings?.dwellSeconds ??
        (step as any)?.warningConfig?.dwellSeconds ??
        (step as any)?.emergencyConfig?.dwellSeconds ??
        ((isWarning || isEmergency) ? 3 : 0)
  );

  const [dwellRemaining, setDwellRemaining] = useState<number>(configuredDwell);
  const [internalVideoWatchPercent, setInternalVideoWatchPercent] = useState<number>(0);
  const [internalHazardAcknowledged, setInternalHazardAcknowledged] = useState(false);

  const isDwellActive = dwellRemaining > 0;
  const isHazardAck = propsHazardAcknowledged ?? internalHazardAcknowledged;
  const currentVideoPct = videoWatchPercentProp ?? internalVideoWatchPercent;

  useEffect(() => {
    if (!step) return;
    const initialDwell = (
      propsDwellSeconds !== undefined
        ? propsDwellSeconds
        : (step as any)?.dwellSeconds ??
          (step as any)?.settings?.dwellSeconds ??
          (step as any)?.warningConfig?.dwellSeconds ??
          (step as any)?.emergencyConfig?.dwellSeconds ??
          ((isWarning || isEmergency) ? 3 : 0)
    );
    setDwellRemaining(initialDwell);
    setInternalVideoWatchPercent(0);
    setInternalHazardAcknowledged(false);

    if (initialDwell <= 0) return;

    const timer = setInterval(() => {
      setDwellRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [step?.id, isWarning, isEmergency, propsDwellSeconds]);

  if (!step) {
    return (
      <div
        data-testid="kiosk-step-container"
        className="flex-1 flex items-center justify-center p-8 text-center"
      >
        <p className="text-slate-500">{t('player.noContentAvailable', { defaultValue: 'No content available for this step.' })}</p>
      </div>
    );
  }

  // Resolve localized text, uploadId, embedUrl, audioUploadId for a block and language
  const resolveBlockLangData = (b: KioskBlock, lang: string) => {
    const mediaRef = b.mediaReferences?.[lang];
    const settingsTrans = (b.settings as any)?.translations?.[lang];
    const settingsText =
      typeof settingsTrans === 'string'
        ? settingsTrans
        : typeof settingsTrans === 'object'
          ? settingsTrans?.textValue
          : undefined;

    const blockTrans = (b as any).translations?.[lang];
    const blockText =
      typeof blockTrans === 'string'
        ? blockTrans
        : typeof blockTrans === 'object'
          ? blockTrans?.textValue
          : undefined;

    const textValue =
      mediaRef?.textValue ??
      settingsText ??
      blockText ??
      (b as any).textValue ??
      (b as any).content ??
      (b as any).text;
    const uploadId =
      mediaRef?.uploadId ??
      (typeof settingsTrans === 'object' ? settingsTrans?.uploadId : undefined) ??
      (typeof blockTrans === 'object' ? blockTrans?.uploadId : undefined);
    const embedUrl =
      mediaRef?.embedUrl ??
      (typeof settingsTrans === 'object' ? settingsTrans?.embedUrl : undefined) ??
      (typeof blockTrans === 'object' ? blockTrans?.embedUrl : undefined);
    const audioUploadId =
      mediaRef?.audioUploadId ??
      (typeof settingsTrans === 'object' ? settingsTrans?.audioUploadId : undefined) ??
      (typeof blockTrans === 'object' ? blockTrans?.audioUploadId : undefined);

    const hasContent = Boolean(
      (textValue !== undefined && textValue !== null && textValue !== '') ||
      uploadId ||
      embedUrl ||
      audioUploadId
    );

    return {
      hasContent,
      textValue,
      uploadId,
      embedUrl,
      audioUploadId,
    };
  };

  const renderContentBlock = (block: KioskBlock) => {
    const targetData = resolveBlockLangData(block, selectedLanguage);
    const defaultData = resolveBlockLangData(block, defaultLanguage);

    const isFallback =
      selectedLanguage !== defaultLanguage &&
      !targetData.hasContent &&
      defaultData.hasContent;

    const ref = isFallback
      ? defaultData
      : targetData.hasContent
        ? targetData
        : defaultData;

    if (!ref.hasContent && !ref.textValue && !ref.uploadId && !ref.embedUrl) {
      return null;
    }

    const fallbackNotice = isFallback ? (
      <div
        data-testid={`translation-fallback-notice-${block.id}`}
        role="status"
        aria-live="polite"
        className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300 mb-2"
      >
        <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>
          {t('player.untranslatedFallbackNotice', {
            defaultValue: `Translation unavailable for ${getLanguageDisplayName(selectedLanguage)}. Displaying ${getLanguageDisplayName(defaultLanguage)} default.`,
            selectedLang: getLanguageDisplayName(selectedLanguage),
            defaultLang: getLanguageDisplayName(defaultLanguage)
          })}
        </span>
      </div>
    ) : null;

    let content: React.ReactNode = null;

    switch (block.type) {
      case 'text': {
        const rawContent = ref.textValue || '';
        const sanitizedContent = antiTamperingService.sanitizeHtml(rawContent);
        const hasHtmlTags = /<[a-z][\s\S]*>/i.test(sanitizedContent);

        content = hasHtmlTags ? (
          <div
            key={block.id}
            data-testid={`kiosk-block-text-${block.id}`}
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
            className={`leading-relaxed font-normal break-words ${block.settings?.size === 'large'
                ? 'text-2xl sm:text-3xl'
                : block.settings?.size === 'small'
                  ? 'text-base sm:text-lg'
                  : 'text-lg sm:text-xl'
              } ${highContrast
                ? 'text-white bg-black/60 p-4 rounded-xl border border-white/20'
                : block.settings?.contrastMode
                  ? 'text-slate-100 bg-black/40 p-4 rounded-xl'
                  : 'text-slate-200'
              }`}
          />
        ) : (
          <p
            key={block.id}
            data-testid={`kiosk-block-text-${block.id}`}
            className={`leading-relaxed font-normal break-words ${block.settings?.size === 'large'
                ? 'text-2xl sm:text-3xl'
                : block.settings?.size === 'small'
                  ? 'text-base sm:text-lg'
                  : 'text-lg sm:text-xl'
              } ${highContrast
                ? 'text-white bg-black/60 p-4 rounded-xl border border-white/20'
                : block.settings?.contrastMode
                  ? 'text-slate-100 bg-black/40 p-4 rounded-xl'
                  : 'text-slate-200'
              }`}
          >
            {sanitizedContent}
          </p>
        );
        break;
      }

      case 'image': {
        const rawImageUrl = ref.embedUrl || (ref.uploadId ? `/api/v1/kiosk/uploads/${ref.uploadId}` : '');
        const normalizedImageUrl = rawImageUrl ? normalizeCloudMediaUrl(rawImageUrl, 'image').embedUrl : '';
        content = (
          <div
            key={block.id}
            data-testid="kiosk-image-block"
            className={`relative overflow-hidden rounded-2xl border flex items-center justify-center ${highContrast
                ? 'border-white bg-black'
                : 'border-slate-800 bg-slate-900/60'
              }`}
          >
            {normalizedImageUrl ? (
              <img
                src={normalizedImageUrl}
                alt={step.title || 'Instructional Step Visual'}
                className="max-h-[48vh] w-full object-contain p-2"
              />
            ) : (
              <div className="flex h-64 w-full items-center justify-center text-slate-600 font-mono text-sm">
                Visual Reference Asset
              </div>
            )}
          </div>
        );
        break;
      }
      case 'video': {
        const rawVideoUrl = ref.embedUrl || (ref.uploadId ? `/api/v1/kiosk/uploads/${ref.uploadId}` : '');
        const { embedUrl: normalizedVideoUrl, provider } = rawVideoUrl
          ? normalizeCloudMediaUrl(rawVideoUrl, 'video')
          : { embedUrl: '', provider: 'none' };

        const isEmbed =
          provider === 'youtube' ||
          provider === 'vimeo' ||
          provider === 'loom' ||
          normalizedVideoUrl.includes('/embed') ||
          normalizedVideoUrl.includes('/preview') ||
          normalizedVideoUrl.includes('player.vimeo.com');

        const watchThreshold = (block.settings as any)?.watchThresholdPercent ?? (step.type === 'video_step' ? 90 : 0);
        const isThresholdSatisfied = videoCompleted || (watchThreshold > 0 && currentVideoPct >= watchThreshold);

        content = (
          <div
            key={block.id}
            data-testid="kiosk-video-block"
            className="aspect-video w-full max-h-[50vh] overflow-hidden rounded-2xl bg-black border border-slate-900 relative shadow-2xl flex flex-col justify-center items-center"
          >
            {/* Video Watch Threshold Progress Badge */}
            {watchThreshold > 0 && (
              <div
                data-testid="video-watch-progress"
                className={`absolute top-4 left-4 z-10 px-3.5 py-1.5 rounded-xl text-xs font-bold border shadow-lg backdrop-blur-md flex items-center space-x-2 ${
                  isThresholdSatisfied
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                    : 'bg-black/80 text-amber-300 border-amber-500/40'
                }`}
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {isThresholdSatisfied
                    ? t('player.videoThresholdSatisfied', {
                        defaultValue: `Watched: ${Math.max(currentVideoPct, watchThreshold)}% / Required: ${watchThreshold}% (Threshold Met)`,
                        pct: Math.max(currentVideoPct, watchThreshold),
                        required: watchThreshold
                      })
                    : t('player.videoWatchProgress', {
                        defaultValue: `Watched: ${currentVideoPct}% / Required: ${watchThreshold}%`,
                        pct: currentVideoPct,
                        required: watchThreshold
                      })}
                </span>
              </div>
            )}

            {isEmbed ? (
              <iframe
                id="sop-video-embed"
                data-testid="sop-video-embed"
                src={normalizedVideoUrl}
                title={step.title || 'Instructional Video Guide'}
                className="w-full h-full border-0 rounded-2xl"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <video
                id="sop-video-player"
                data-testid="sop-video-player"
                src={normalizedVideoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'}
                autoPlay={block.settings?.autoplay}
                loop={block.settings?.loop}
                controls
                playsInline
                onEnded={onVideoComplete}
                onTimeUpdate={(e) => {
                  const vid = e.currentTarget;
                  if (vid.duration && vid.duration > 0) {
                    const pct = Math.round((vid.currentTime / vid.duration) * 100);
                    setInternalVideoWatchPercent(pct);
                    if (watchThreshold > 0 && pct >= watchThreshold && !videoCompleted && onVideoComplete) {
                      onVideoComplete();
                    }
                  }
                }}
                className="h-full w-full object-contain"
              />
            )}
            {!videoCompleted && onVideoComplete && (
              <button
                id="sop-video-complete-btn"
                data-testid="sop-video-complete-btn"
                type="button"
                onClick={onVideoComplete}
                className="absolute bottom-4 right-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-5 py-2.5 rounded-xl font-bold text-sm min-h-[48px] min-w-[48px] shadow-lg flex items-center space-x-2 cursor-pointer z-10 active:scale-95 transition"
              >
                <span>{t('player.videoFinished', { defaultValue: 'Confirm Video Watched' })}</span>
                <CheckCircle2 className="w-5 h-5 shrink-0" />
              </button>
            )}
          </div>
        );
        break;
      }
      case 'audio': {
        const rawAudioUrl = ref.embedUrl || (ref.uploadId ? `/api/v1/kiosk/uploads/${ref.uploadId}` : '');
        const normalizedAudioUrl = rawAudioUrl ? normalizeCloudMediaUrl(rawAudioUrl, 'audio').embedUrl : '';
        content = (
          <div
            key={block.id}
            data-testid="kiosk-audio-block"
            className="w-full p-6 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl flex flex-col space-y-4"
          >
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Volume2 className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">
                  {t('player.audioBriefing', { defaultValue: 'Audio Briefing Station' })}
                </h4>
                <p className="text-xs text-slate-400">
                  {t('player.listenInstruction', { defaultValue: 'Listen carefully to spoken safety guidelines before proceeding.' })}
                </p>
              </div>
            </div>
            {normalizedAudioUrl ? (
              <audio
                controls
                data-testid="kiosk-audio-player"
                src={normalizedAudioUrl}
                className="w-full mt-2"
                autoPlay={block.settings?.autoplay ?? true}
              />
            ) : (
              <div className="text-center py-4 text-slate-500 text-xs font-mono">
                No audio clip attached for this language.
              </div>
            )}
          </div>
        );
        break;
      }

      case 'icon': {
        content = (
          <div key={block.id} className="flex justify-center p-4">
            <div
              className={`p-6 rounded-full border-2 ${block.settings?.theme === 'danger'
                  ? 'text-rose-500 border-rose-500/30 bg-rose-950/20'
                  : block.settings?.theme === 'warning'
                    ? 'text-amber-500 border-amber-500/30 bg-amber-950/20'
                    : block.settings?.theme === 'mandatory'
                      ? 'text-sky-500 border-sky-500/30 bg-sky-950/20'
                      : 'text-emerald-500 border-emerald-500/30 bg-emerald-950/20'
                }`}
            >
              <AlertTriangle className="w-16 h-16" />
            </div>
          </div>
        );
        break;
      }

      case 'animation': {
        content = (
          <div
            key={block.id}
            className="flex justify-center rounded-2xl bg-slate-900/50 p-8 border border-slate-800"
          >
            <div className="h-32 w-32 animate-bounce rounded-full bg-emerald-500/20 border-2 border-emerald-500/60 flex items-center justify-center">
              <span className="text-emerald-400 font-semibold text-lg">{t('player.animation', { defaultValue: 'Animated Demonstration' })}</span>
            </div>
          </div>
        );
        break;
      }

      default:
        return null;
    }

    return (
      <div key={block.id} className="w-full space-y-2">
        {fallbackNotice}
        {content}
      </div>
    );
  };

  const translatedTitle =
    (step as any).translations?.[selectedLanguage]?.title ||
    (step as any).settings?.translations?.[selectedLanguage]?.title ||
    step.title;

  const checkScrollOverflow = useCallback(() => {
    if (!mainRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = mainRef.current;
    const hasOverflow = scrollHeight > clientHeight + 24;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 32;
    setCanScrollDown(hasOverflow && !isNearBottom);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(checkScrollOverflow, 120);
    const el = mainRef.current;
    if (!el) return () => clearTimeout(timeout);
    el.addEventListener('scroll', checkScrollOverflow, { passive: true });
    window.addEventListener('resize', checkScrollOverflow);
    return () => {
      clearTimeout(timeout);
      el.removeEventListener('scroll', checkScrollOverflow);
      window.removeEventListener('resize', checkScrollOverflow);
    };
  }, [checkScrollOverflow, stepIndex, step]);

  const handleScrollDown = () => {
    if (!mainRef.current) return;
    mainRef.current.scrollBy({ top: 320, behavior: 'smooth' });
  };

  return (
    <main
      ref={mainRef}
      data-testid="kiosk-step-container"
      data-step-index={stepIndex}
      data-direction={direction}
      data-font-scale={fontScale}
      dir={isRtlMode ? 'rtl' : 'ltr'}
      data-dir={isRtlMode ? 'rtl' : 'ltr'}
      data-rtl={isRtlMode ? 'true' : 'false'}
      role="main"
      aria-label={translatedTitle || t('player.stepCanvas', { defaultValue: 'Instructional Step Canvas' })}
      className={`relative flex-1 overflow-y-auto overflow-x-hidden max-w-full w-full flex flex-col justify-start px-4 sm:px-8 lg:px-12 py-6 pb-28 sm:pb-36 transition-all duration-300 ease-out break-words scrollbar-thin scrollbar-thumb-slate-700 hover:scrollbar-thumb-slate-600 active:scrollbar-thumb-emerald-500 ${isRtlMode
          ? direction === 'forward'
            ? 'animate-slide-in-left'
            : 'animate-slide-in-right'
          : direction === 'forward'
            ? 'animate-slide-in-right'
            : 'animate-slide-in-left'
        } ${className}`}
    >
      <div className="w-full max-w-5xl mx-auto space-y-6 flex-1 flex flex-col justify-start my-auto min-w-0 break-words">
        {/* Step-specific OSHA warning standard or emergency protocol banner */}
        {isWarning && (() => {
          const titleMatch = step.title?.match(/^\[(DANGER|WARNING|CAUTION|NOTICE)\]/i);
          const titleHazard = titleMatch ? titleMatch[1].toLowerCase() : null;
          const hazardLevel = (
            (step as any).warningConfig?.hazardLevel ||
            titleHazard ||
            (step as any).settings?.hazardLevel ||
            (step as any).interaction?.hazardLevel ||
            'warning'
          ).toLowerCase();
          const configs: Record<string, { label: string; desc: string; border: string; iconColor: string }> = {
            danger: {
              label: 'DANGER: IMMEDIATE CRITICAL HAZARD',
              desc: 'Hazardous situation which, if not avoided, will result in death or permanent serious injury.',
              border: 'border-rose-500 bg-rose-950/40 text-rose-200',
              iconColor: 'text-rose-400'
            },
            warning: {
              label: 'Attention / Hazard Warning',
              desc: 'Follow safe handling guidelines. Hazardous situation which, if not avoided, could result in serious injury or equipment damage.',
              border: 'border-amber-500 bg-amber-950/40 text-amber-200',
              iconColor: 'text-amber-400'
            },
            caution: {
              label: 'CAUTION: PRECAUTIONARY NOTICE',
              desc: 'Hazardous situation which, if not avoided, could result in minor or moderate physical injury.',
              border: 'border-yellow-500 bg-yellow-950/40 text-yellow-200',
              iconColor: 'text-yellow-400'
            },
            notice: {
              label: 'NOTICE: MANDATORY FACILITY POLICY',
              desc: 'Important plant policy and operational procedures not related to personal physical injury.',
              border: 'border-sky-500 bg-sky-950/40 text-sky-200',
              iconColor: 'text-sky-400'
            }
          };
          const cfg = configs[hazardLevel] || configs.warning;
          const warningConfig = (step as any).warningConfig;
          const signalWord = warningConfig?.signalWord || hazardLevel.toUpperCase();
          const hazardStatement = warningConfig?.hazardStatement;
          const precautionaryStatement = warningConfig?.precautionaryStatement;
          const symbolCode = warningConfig?.symbolCode;
          const oshaCategory = warningConfig?.oshaCategory;
          const complianceStandard = (step as any).settings?.complianceStandard || warningConfig?.complianceStandard || 'OSHA 1910.145';

          return (
            <div
              data-testid="osha-hazard-banner"
              data-hazard-level={hazardLevel}
              className={`flex items-start space-x-4 border-2 rounded-2xl p-6 shadow-xl ${cfg.border}`}
            >
              <AlertTriangle className={`w-8 h-8 shrink-0 ${cfg.iconColor}`} />
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded font-black text-sm uppercase ${hazardLevel === 'danger'
                        ? 'bg-rose-600 text-white'
                        : hazardLevel === 'caution'
                          ? 'bg-amber-500 text-slate-950'
                          : hazardLevel === 'notice'
                            ? 'bg-sky-600 text-white'
                            : 'bg-amber-600 text-white'
                      }`}
                  >
                    {signalWord}
                  </span>
                  <h3 className="text-xl font-black uppercase tracking-wider">{cfg.label}</h3>

                  {/* Dwell Timer Status Chip */}
                  <div className="ml-auto">
                    {isDwellActive ? (
                      <div
                        data-testid="hazard-dwell-timer"
                        className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
                      >
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>{t('player.reviewHazardCountdown', { defaultValue: `Review Hazard (${dwellRemaining}s)`, seconds: dwellRemaining })}</span>
                      </div>
                    ) : (
                      <div
                        data-testid="hazard-dwell-cleared"
                        className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{t('player.hazardReviewed', { defaultValue: 'Hazard Reviewed' })}</span>
                      </div>
                    )}
                  </div>
                </div>
                {hazardStatement && (
                  <p className="text-base font-bold text-white pt-1">{hazardStatement}</p>
                )}
                <p className="text-sm opacity-90">{precautionaryStatement || cfg.desc}</p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {symbolCode && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase bg-white/10 text-white border border-white/20">
                      {symbolCode}
                    </span>
                  )}
                  {oshaCategory && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase bg-white/10 text-white border border-white/20">
                      {`Category: ${oshaCategory}`}
                    </span>
                  )}
                  {complianceStandard && (
                    <span className="text-[11px] font-mono opacity-80">
                      {`Standard Reference: ${complianceStandard}`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {isEmergency && (() => {
          const emergencyConfig = (step as any).emergencyConfig || (step as any).settings || {};
          const musterPoint = emergencyConfig.musterPoint || (step as any).settings?.musterPoint || step.interaction?.incorrectStepId;
          const evacuationRoute = emergencyConfig.evacuationRoute || (step as any).settings?.evacuationRoute;
          const emergencyContact = emergencyConfig.emergencyContact || emergencyConfig.dispatchChannel || (step as any).settings?.dispatchChannel || step.interaction?.correctStepId;

          return (
            <div
              data-testid="emergency-step-container"
              className="flex flex-col space-y-4 border-2 border-rose-500 bg-rose-950/50 text-rose-200 rounded-2xl p-6 shadow-2xl animate-pulse"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start space-x-4">
                  <ShieldAlert className="w-9 h-9 shrink-0 text-rose-400" />
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-wider text-white">Emergency Safety Protocol Active</h3>
                    <p className="text-sm opacity-90 mt-0.5">Immediate action required. Immediate evacuation and life-safety guidelines. Observe muster locations.</p>
                  </div>
                </div>
                <div className="shrink-0">
                  {isDwellActive ? (
                    <div
                      data-testid="hazard-dwell-timer"
                      className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
                    >
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>{t('player.reviewHazardCountdown', { defaultValue: `Review Hazard (${dwellRemaining}s)`, seconds: dwellRemaining })}</span>
                    </div>
                  ) : (
                    <div
                      data-testid="hazard-dwell-cleared"
                      className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{t('player.hazardReviewed', { defaultValue: 'Hazard Reviewed' })}</span>
                    </div>
                  )}
                </div>
              </div>
              {(musterPoint || evacuationRoute || emergencyContact) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-rose-500/30">
                  {musterPoint && (
                    <div className="flex items-center space-x-2 text-xs font-bold text-rose-300">
                      <span className="px-2 py-0.5 rounded bg-rose-500/30 font-extrabold uppercase">Designated Muster Point</span>
                      <span>{musterPoint}</span>
                    </div>
                  )}
                  {evacuationRoute && (
                    <div className="sm:col-span-2 text-xs text-rose-200 font-semibold bg-rose-900/30 p-2.5 rounded-lg border border-rose-500/20">
                      <span className="font-bold uppercase tracking-wider block text-[10px] text-rose-400 mb-1">Evacuation Route</span>
                      <span>{evacuationRoute}</span>
                    </div>
                  )}
                  {emergencyContact && (
                    <div className="flex items-center space-x-2 text-xs font-bold text-rose-300">
                      <Radio className="w-3.5 h-3.5" />
                      <span>{emergencyContact}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Supervisor Witness On-Canvas Attestation Card */}
        {(step.type === 'supervisor_gate' || step.requireSupervisorWitness) && (() => {
          const witnessConfig = (step as any).witnessConfig || {};
          const requiredRole = witnessConfig.supervisorRole || (step as any).settings?.supervisorRole || 'Lead Operations Supervisor';

          return (
            <div
              data-testid="supervisor-gate-card"
              className={`p-6 rounded-2xl border transition-all ${isSupervisorWitnessed
                  ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                  : 'bg-indigo-950/40 border-indigo-500/50 text-indigo-200 shadow-xl'
                }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start space-x-3.5">
                  <div
                    className={`p-3 rounded-xl border ${isSupervisorWitnessed
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30 animate-pulse'
                      }`}
                  >
                    {isSupervisorWitnessed ? (
                      <ShieldCheck className="w-7 h-7" />
                    ) : (
                      <ShieldAlert className="w-7 h-7" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-lg font-black tracking-tight text-white flex items-center space-x-2">
                      <span data-testid="supervisor-witness-title">
                        {isSupervisorWitnessed ? 'Supervisor Witness Verified' : 'Supervisor Witness Required'}
                      </span>
                      {isSupervisorWitnessed ? (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950">
                          Authorized
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 border border-indigo-500/40">
                          {requiredRole}
                        </span>
                      )}
                    </h4>
                    <p data-testid="supervisor-witness-desc" className="text-xs text-slate-300 mt-1 max-w-xl">
                      {isSupervisorWitnessed
                        ? `Attestation Authorized & Logged. Checkpoint cleared by supervisor ${supervisorWitnessData?.fullName ||
                        supervisorWitnessData?.name ||
                        'Authorized Lead'
                        }${supervisorWitnessData?.role ? ` (${supervisorWitnessData.role})` : ''}.${
                          supervisorWitnessData?.timestamp || supervisorWitnessData?.verifiedAt
                            ? ` Verified: ${supervisorWitnessData.timestamp || supervisorWitnessData.verifiedAt}.`
                            : ''
                        }`
                        : `Pending Supervisor Authorization. Awaiting Supervisor Co-Signature. A designated ${requiredRole} must witness this checkpoint and enter their 4-digit PIN.`}
                    </p>
                  </div>
                </div>
                {!isSupervisorWitnessed && onOpenSupervisorGate && (
                  <button
                    type="button"
                    data-testid="supervisor-signoff-btn"
                    onClick={onOpenSupervisorGate}
                    className="min-h-[56px] min-w-[48px] px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm transition active:scale-95 shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>Supervisor Sign-Off</span>
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* Step Title */}
        {translatedTitle && (
          <div className="space-y-1">
            <h2
              data-testid="kiosk-step-title"
              className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white"
            >
              {translatedTitle}
            </h2>
          </div>
        )}

        {/* Media & Content Blocks */}
        {step.blocks && step.blocks.length > 0 && (
          <div className="space-y-6 w-full">
            {step.blocks.map(renderContentBlock)}
          </div>
        )}

        {/* Step Interactive Actions Area */}
        <div className="pt-2">
          {/* Interaction: Yes / No Decision */}
          {step.interaction?.type === 'yes_no' && onYesNoSelection && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-4">
              <button
                type="button"
                data-testid="yes-btn"
                disabled={isDwellActive}
                onClick={() => !isDwellActive && onYesNoSelection(true)}
                className={`w-full sm:w-60 min-h-[64px] min-w-[64px] rounded-2xl font-extrabold text-xl shadow-xl flex items-center justify-center space-x-2 transition focus-visible:outline-4 focus-visible:outline-sky-500 focus-visible:ring-4 focus-visible:ring-sky-500/30 ${
                  isDwellActive
                    ? 'bg-emerald-800/40 text-emerald-200/50 cursor-not-allowed opacity-50'
                    : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white cursor-pointer'
                }`}
              >
                <Check className="w-6 h-6 stroke-[3]" />
                <span>Yes / Confirmed</span>
                {isDwellActive && (
                  <span className="text-xs bg-black/40 px-2 py-0.5 rounded font-mono ml-1">
                    ({dwellRemaining}s)
                  </span>
                )}
              </button>
              <button
                type="button"
                data-testid="no-btn"
                disabled={isDwellActive}
                onClick={() => !isDwellActive && onYesNoSelection(false)}
                className={`w-full sm:w-60 min-h-[64px] min-w-[64px] rounded-2xl font-extrabold text-xl shadow-xl flex items-center justify-center space-x-2 transition focus-visible:outline-4 focus-visible:outline-sky-500 focus-visible:ring-4 focus-visible:ring-sky-500/30 ${
                  isDwellActive
                    ? 'bg-rose-800/40 text-rose-200/50 cursor-not-allowed opacity-50'
                    : 'bg-rose-600 hover:bg-rose-500 active:scale-95 text-white cursor-pointer'
                }`}
              >
                <span>No / Unsafe</span>
              </button>
            </div>
          )}

          {/* Interaction: Circular Hold-to-Confirm */}
          {(step.type === 'interactive_confirmation' || step.interaction?.type === 'hold_to_confirm') && (
            <div className="flex flex-col items-center justify-center space-y-4 py-4">
              <button
                type="button"
                data-testid="hold-to-confirm-btn"
                disabled={isDwellActive}
                onMouseDown={!isDwellActive ? onHoldStart : undefined}
                onMouseUp={!isDwellActive ? onHoldEnd : undefined}
                onMouseLeave={!isDwellActive ? onHoldEnd : undefined}
                onTouchStart={!isDwellActive ? onHoldStart : undefined}
                onTouchEnd={!isDwellActive ? onHoldEnd : undefined}
                className={`relative h-28 w-28 min-h-[64px] min-w-[64px] rounded-full border-2 flex items-center justify-center transition shadow-2xl focus-visible:outline-4 focus-visible:outline-sky-500 focus-visible:ring-4 focus-visible:ring-sky-500/30 ${
                  isDwellActive
                    ? 'bg-slate-900 border-slate-800 opacity-50 cursor-not-allowed'
                    : 'bg-slate-900 border-slate-800 hover:border-emerald-500/50 active:scale-95 cursor-pointer'
                }`}
              >
                {/* SVG circular progress ring */}
                <svg className="absolute inset-0 h-full w-full -rotate-90">
                  <circle
                    cx="56"
                    cy="56"
                    r="48"
                    className="stroke-slate-800"
                    strokeWidth="5"
                    fill="transparent"
                  />
                  <circle
                    cx="56"
                    cy="56"
                    r="48"
                    className="stroke-emerald-400 transition-all duration-75"
                    strokeWidth="5"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 48}
                    strokeDashoffset={2 * Math.PI * 48 * (1 - holdProgress / 100)}
                  />
                </svg>
                <Hand className="h-10 w-10 text-emerald-400 animate-pulse" />
              </button>
              <span className="text-slate-400 font-bold text-xs tracking-widest uppercase">
                Touch & Hold to Confirm {isDwellActive && `(${dwellRemaining}s)`}
              </span>
            </div>
          )}

          {/* Interaction: PPE Checklist */}
          {(step.type === 'ppe_checklist' || step.interaction?.type === 'ppe_checklist') && (
            <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h4 className="text-base font-bold text-white flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span>Mandatory PPE Verification Checklist</span>
                </h4>
                {onSelectAllPpe && (
                  <button
                    type="button"
                    onClick={onSelectAllPpe}
                    className="min-h-[48px] min-w-[48px] px-3 py-2 rounded-lg text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center justify-center active:scale-95 transition"
                  >
                    Select All
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {(step.interaction?.ppeItems || ['Hard Hat', 'Safety Glasses', 'High-Vis Vest', 'Steel Toe Boots', 'Gloves']).map(
                  (item: string) => {
                    const isChecked = checkedPpe.has(item);
                    const itemId = item.toLowerCase().replace(/[^a-z0-9]/g, '-');
                    return (
                      <button
                        key={item}
                        type="button"
                        id={`ppe-check-${itemId}`}
                        data-testid={`ppe-check-${itemId}`}
                        onClick={() => onTogglePpeItem?.(item)}
                        className={`min-h-[52px] min-w-[48px] p-3.5 rounded-xl border text-left flex items-center justify-between font-semibold text-sm transition active:scale-98 ${isChecked
                            ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200'
                            : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                      >
                        <span>{item}</span>
                        <div
                          className={`w-6 h-6 rounded-md border flex items-center justify-center ${isChecked
                              ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                              : 'border-slate-700 bg-slate-900'
                            }`}
                        >
                          {isChecked && <Check className="w-4 h-4 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  }
                )}
              </div>

              {onSubmitPpe && !ppeSubmitted && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    id="ppe-confirm-btn"
                    data-testid="ppe-confirm-btn"
                    onClick={onSubmitPpe}
                    className="min-h-[64px] min-w-[64px] px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-base transition active:scale-95 shadow-xl flex items-center justify-center focus-visible:outline-4 focus-visible:outline-sky-500 focus-visible:ring-4 focus-visible:ring-sky-500/30"
                  >
                    Verify & Record PPE Compliance
                  </button>
                </div>
              )}

              {ppeSubmitted && (
                <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>PPE compliance verified and recorded. Auto-reset in {ppeResetCountdown}s.</span>
                </div>
              )}

              {ppeSubmitError && (
                <p className="text-xs text-rose-400 font-semibold">{ppeSubmitError}</p>
              )}
            </div>
          )}

          {/* Interaction: Hotspots Overlay */}
          {step.interaction?.type === 'hotspot' && onHotspotClick && (
            <div className="absolute inset-0 pointer-events-none z-20">
              {(step.interaction.hotspots || []).map((hs, hsIdx) => (
                <button
                  key={hsIdx}
                  type="button"
                  onClick={() => onHotspotClick(hs.actionStepId, hsIdx)}
                  style={{
                    position: 'absolute',
                    left: `${hs.x}%`,
                    top: `${hs.y}%`,
                    width: `${hs.radius * 2}%`,
                    height: `${hs.radius * 2}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                  className="pointer-events-auto rounded-full bg-emerald-500/20 border-2 border-emerald-400 hover:bg-emerald-500/40 transition animate-pulse cursor-pointer shadow-lg shadow-emerald-500/25"
                  title="Interactive Hotspot"
                />
              ))}
            </div>
          )}

          {/* Interaction: Knowledge Check Quiz */}
          {(step.type === 'knowledge_quiz' || step.interaction?.type === 'quiz' || Boolean(step.interaction?.quiz || step.quiz)) && (
            <div className="w-full pt-4">
              <KnowledgeQuizEngine
                quiz={(step.interaction?.quiz || step.quiz)!}
                onPass={onQuizPass || (() => { })}
                onFail={onQuizFail}
                highContrast={highContrast}
              />
            </div>
          )}

          {/* Hazard Acknowledgment Action for warning_step / emergency_step without custom decision configs */}
          {(isWarning || isEmergency) &&
            (!step.interaction ||
              step.interaction.type === 'none' ||
              (step.interaction as any).type === 'tap_to_continue' ||
              (step.interaction as any).type === 'acknowledgment') && (
              <div className="flex justify-center py-4">
                <button
                  type="button"
                  id="acknowledge-hazard-btn"
                  data-testid="acknowledge-hazard-btn"
                  disabled={isDwellActive || isHazardAck}
                  onClick={() => {
                    setInternalHazardAcknowledged(true);
                    onHazardAcknowledge?.();
                  }}
                  className={`w-full sm:w-auto min-h-[56px] min-w-[48px] px-8 py-3.5 rounded-2xl font-black text-base shadow-xl flex items-center justify-center space-x-2.5 transition active:scale-95 cursor-pointer focus-visible:outline-4 focus-visible:outline-sky-500 ${
                    isDwellActive
                      ? 'bg-slate-800 text-slate-400 border border-slate-700 opacity-60 cursor-not-allowed'
                      : isHazardAck
                        ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                  }`}
                >
                  {isHazardAck ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <span>{t('player.hazardAcknowledged', { defaultValue: 'Hazard Acknowledged' })}</span>
                    </>
                  ) : isDwellActive ? (
                    <>
                      <Clock className="w-5 h-5 text-amber-400 animate-spin shrink-0" />
                      <span>{t('player.reviewHazard', { defaultValue: `Review Hazard (${dwellRemaining}s)`, seconds: dwellRemaining })}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      <span>{t('player.acknowledgeHazardAction', { defaultValue: 'Acknowledge Hazard & Proceed' })}</span>
                    </>
                  )}
                </button>
              </div>
            )}
        </div>
      </div>

      {/* Subtitles & Captions Overlay (pinned at bottom of step canvas) */}
      {showSubtitles && (
        <div className="w-full max-w-2xl mx-auto pt-4 flex justify-center text-center">
          {step.blocks.map((b) => {
            const targetData = resolveBlockLangData(b, selectedLanguage);
            const ref = targetData.hasContent ? targetData : resolveBlockLangData(b, defaultLanguage);
            if (b.type === 'text' || !ref?.textValue) return null;
            return (
              <div
                key={b.id}
                className="w-full bg-black/85 border border-slate-800 rounded-xl px-6 py-3 text-slate-100 text-base sm:text-lg font-light tracking-wide shadow-2xl"
              >
                {ref.textValue}
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Touch Scroll Indicator when content extends beneath the fold */}
      {canScrollDown && (
        <div
          data-testid="kiosk-scroll-cue"
          className="sticky bottom-4 left-1/2 z-30 pointer-events-auto flex justify-center py-2"
        >
          <button
            type="button"
            data-testid="kiosk-scroll-down-btn"
            onClick={handleScrollDown}
            className={`min-h-[48px] px-5 py-2.5 rounded-full border shadow-2xl flex items-center space-x-2 text-xs font-bold transition active:scale-95 animate-bounce cursor-pointer ${highContrast
                ? 'bg-amber-400 text-black border-2 border-amber-300 shadow-amber-400/20'
                : 'bg-slate-900/95 border-emerald-500/50 text-emerald-300 hover:bg-slate-800 shadow-emerald-500/20'
              }`}
          >
            <ChevronDown className="w-4 h-4 stroke-[3]" />
            <span>{t('player.scrollForMore', { defaultValue: 'Scroll for more' })}</span>
          </button>
        </div>
      )}
    </main>
  );
};

export default KioskStepContainer;
