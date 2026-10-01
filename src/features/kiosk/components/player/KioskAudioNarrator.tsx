import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  AlertCircle
} from 'lucide-react';
import { KioskStep } from '../../../../types/kiosk/step.types';
import { getLanguageDisplayName, isRtlLanguage } from '../../constants/language.constants';

export interface ResolvedAudioSource {
  audioUrl: string | null;
  audioUploadId: string | null;
  language: string;
  isFallback: boolean;
  hasAudio: boolean;
}

/**
 * Resolves the appropriate audio narration source for a step:
 * 1. Checks target language in block mediaReferences / translation settings
 * 2. Falls back to default language audio if target language audio is absent
 * 3. Streams via /api/v1/kiosk/uploads/:id, direct URL, or offline blob
 */
export function resolveStepAudioSource(
  step: KioskStep | null,
  selectedLanguage: string,
  defaultLanguage = 'en'
): ResolvedAudioSource {
  if (!step || !step.blocks || step.blocks.length === 0) {
    return {
      audioUrl: null,
      audioUploadId: null,
      language: selectedLanguage,
      isFallback: false,
      hasAudio: false
    };
  }

  const findUploadIdInLang = (lang: string): string | null => {
    // 1. Search blocks for mediaReferences or block translations
    for (const block of step.blocks) {
      const mediaRef = block.mediaReferences?.[lang];
      const settingsTrans = (block.settings as any)?.translations?.[lang];
      const blockTrans = (block as any)?.translations?.[lang];

      const audioUploadId =
        mediaRef?.audioUploadId ||
        (typeof settingsTrans === 'object' ? settingsTrans?.audioUploadId : undefined) ||
        (typeof blockTrans === 'object' ? blockTrans?.audioUploadId : undefined) ||
        (mediaRef as any)?.uploadId ||
        (typeof settingsTrans === 'object' ? settingsTrans?.uploadId : undefined);

      if (audioUploadId) {
        return audioUploadId;
      }
    }

    // 2. Check top-level step translations or narration properties
    const stepNarration = (step as any)?.audioNarration?.[lang]?.audioUploadId ||
      (step as any)?.audioNarration?.[lang]?.uploadId ||
      (step as any)?.translations?.[lang]?.audioUploadId;

    if (stepNarration) {
      return stepNarration;
    }

    return null;
  };

  // Try selected language
  const targetUploadId = findUploadIdInLang(selectedLanguage);
  if (targetUploadId) {
    const audioUrl =
      targetUploadId.startsWith('http://') ||
      targetUploadId.startsWith('https://') ||
      targetUploadId.startsWith('blob:') ||
      targetUploadId.startsWith('data:')
        ? targetUploadId
        : `/api/v1/kiosk/uploads/${targetUploadId}`;

    return {
      audioUrl,
      audioUploadId: targetUploadId,
      language: selectedLanguage,
      isFallback: false,
      hasAudio: true
    };
  }

  // Fallback to default language if distinct
  if (selectedLanguage !== defaultLanguage) {
    const fallbackUploadId = findUploadIdInLang(defaultLanguage);
    if (fallbackUploadId) {
      const audioUrl =
        fallbackUploadId.startsWith('http://') ||
        fallbackUploadId.startsWith('https://') ||
        fallbackUploadId.startsWith('blob:') ||
        fallbackUploadId.startsWith('data:')
          ? fallbackUploadId
          : `/api/v1/kiosk/uploads/${fallbackUploadId}`;

      return {
        audioUrl,
        audioUploadId: fallbackUploadId,
        language: defaultLanguage,
        isFallback: true,
        hasAudio: true
      };
    }
  }

  return {
    audioUrl: null,
    audioUploadId: null,
    language: selectedLanguage,
    isFallback: false,
    hasAudio: false
  };
}

export interface KioskAudioNarratorProps {
  step: KioskStep | null;
  selectedLanguage: string;
  defaultLanguage?: string;
  autoPlay?: boolean;
  isMuted?: boolean;
  volume?: number; // 0.0 to 1.0
  onToggleMute?: () => void;
  onVolumeChange?: (vol: number) => void;
  onAudioStart?: (src: string, lang: string) => void;
  onAudioEnd?: () => void;
  onAudioError?: (err: any) => void;
  showWaveform?: boolean;
  showControls?: boolean;
  highContrast?: boolean;
  isRtl?: boolean;
  className?: string;
}

export const KioskAudioNarrator: React.FC<KioskAudioNarratorProps> = ({
  step,
  selectedLanguage,
  defaultLanguage = 'en',
  autoPlay = true,
  isMuted = false,
  volume = 0.8,
  onToggleMute,
  onVolumeChange,
  onAudioStart,
  onAudioEnd,
  onAudioError,
  showWaveform = true,
  showControls = true,
  highContrast = false,
  isRtl,
  className = ''
}) => {
  const { t } = useTranslation('kiosk');
  const isRtlMode = isRtl ?? isRtlLanguage(selectedLanguage);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const resolvedSource = resolveStepAudioSource(step, selectedLanguage, defaultLanguage);

  // Playback control functions
  const playAudio = useCallback(() => {
    if (!audioRef.current || !resolvedSource.audioUrl) return;

    if (isMuted) {
      onToggleMute?.();
    }

    setPlaybackError(null);
    audioRef.current
      .play()
      .then(() => {
        setIsPlaying(true);
        onAudioStart?.(resolvedSource.audioUrl!, resolvedSource.language);
      })
      .catch((err) => {
        console.warn('Playback error or user gesture required:', err);
        setIsPlaying(false);
        setPlaybackError('Tap Play to listen');
        onAudioError?.(err);
      });
  }, [resolvedSource.audioUrl, resolvedSource.language, isMuted, onToggleMute, onAudioStart, onAudioError]);

  const pauseAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pauseAudio();
    } else {
      playAudio();
    }
  }, [isPlaying, pauseAudio, playAudio]);

  const restartAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      playAudio();
    }
  }, [playAudio]);

  // Synchronize Audio element when audio source, step, or language changes
  useEffect(() => {
    // Reset any previous audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }

    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackError(null);

    if (!resolvedSource.audioUrl) {
      return;
    }

    const audio = new Audio(resolvedSource.audioUrl);
    audio.loop = false;
    audio.muted = isMuted;
    audio.volume = isMuted ? 0 : Math.max(0, Math.min(1, volume));

    audio.onloadedmetadata = () => {
      setDuration(audio.duration || 0);
    };

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.onended = () => {
      setIsPlaying(false);
      onAudioEnd?.();
    };

    audio.onerror = (e) => {
      console.warn('Audio narration resource load error:', e);
      setIsPlaying(false);
      setPlaybackError('Narration audio unavailable');
      onAudioError?.(e);
    };

    audioRef.current = audio;

    // Acceptance Criteria 1: Autoplay upon advancing/loading if not muted
    if (autoPlay && !isMuted) {
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
          onAudioStart?.(resolvedSource.audioUrl!, resolvedSource.language);
        })
        .catch((e) => {
          console.warn('Autoplay audio blocked or pending gesture:', e);
          setIsPlaying(false);
        });
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, [resolvedSource.audioUrl, resolvedSource.language, autoPlay]);

  // Acceptance Criteria 2: When muted, audio stops immediately and reflects muted state
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
      if (isMuted) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [isMuted]);

  // Synchronize volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : Math.max(0, Math.min(1, volume));
    }
  }, [volume, isMuted]);

  // Audio progress ratio (0 to 100)
  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  if (!resolvedSource.hasAudio) {
    return null;
  }

  const langDisplayName = getLanguageDisplayName(resolvedSource.language);

  return (
    <div
      id="kiosk-audio-narrator"
      data-testid="kiosk-audio-narrator"
      role="region"
      aria-label={t('player.audioNarration', { defaultValue: 'Audio Narration' })}
      dir={isRtlMode ? 'rtl' : 'ltr'}
      className={`rounded-2xl border transition-all duration-200 select-none ${
        highContrast
          ? 'bg-black border-2 border-amber-400 text-white shadow-xl'
          : 'bg-slate-900/90 border-slate-800 text-slate-100 backdrop-blur-md shadow-2xl'
      } ${className}`}
    >
      <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
        {/* Left: Waveform & Language Status */}
        <div className="flex items-center space-x-3 rtl:space-x-reverse min-w-0 w-full sm:w-auto">
          {/* Animated Audio Waveform */}
          {showWaveform && (
            <div
              data-testid="audio-waveform"
              data-playing={isPlaying && !isMuted ? 'true' : 'false'}
              title={isPlaying && !isMuted ? 'Audio playing' : 'Audio paused'}
              className="flex items-center space-x-1 rtl:space-x-reverse h-8 px-2.5 py-1 rounded-xl bg-slate-950/60 border border-slate-800 shrink-0"
            >
              {[12, 22, 16, 26, 18, 14].map((height, idx) => {
                const active = isPlaying && !isMuted;
                const dynamicHeight = active ? height : 6;
                return (
                  <span
                    key={idx}
                    className={`w-1 rounded-full transition-all duration-150 ${
                      highContrast
                        ? 'bg-amber-400'
                        : active
                        ? 'bg-emerald-400 animate-pulse'
                        : 'bg-slate-600'
                    }`}
                    style={{
                      height: `${dynamicHeight}px`,
                      animationDelay: `${idx * 120}ms`,
                      animationDuration: '600ms'
                    }}
                  />
                );
              })}
            </div>
          )}

          {/* Language Status Badge */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <span
                data-testid="audio-language-badge"
                className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                  highContrast
                    ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}
              >
                {langDisplayName}
              </span>

              {resolvedSource.isFallback && (
                <span
                  data-testid="audio-fallback-badge"
                  className="text-[11px] text-amber-400 flex items-center space-x-1 rtl:space-x-reverse"
                  title="Audio narration fallback to default language"
                >
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{t('player.audioFallbackNotice', { defaultValue: 'Default Language' })}</span>
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 truncate mt-0.5">
              {playbackError || (isPlaying ? t('player.narrating', { defaultValue: 'Playing spoken instructions...' }) : t('player.audioPaused', { defaultValue: 'Narration paused' }))}
            </p>
          </div>
        </div>

        {/* Right: Audio Playback Controls */}
        {showControls && (
          <div className="flex items-center space-x-2 rtl:space-x-reverse shrink-0">
            {/* Restart Audio */}
            <button
              type="button"
              data-testid="audio-restart-btn"
              onClick={restartAudio}
              title={t('player.restartAudio', { defaultValue: 'Restart Narration' })}
              className={`min-h-[48px] min-w-[48px] h-12 w-12 rounded-xl border flex items-center justify-center transition active:scale-95 ${
                highContrast
                  ? 'bg-black border-white text-white hover:border-amber-400'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-750'
              }`}
            >
              <RotateCcw className={`w-4 h-4 ${isRtlMode ? '-scale-x-100' : ''}`} />
            </button>

            {/* Play / Pause Toggle */}
            <button
              type="button"
              id="kiosk-audio-play-pause-btn"
              data-testid="audio-play-pause-btn"
              onClick={togglePlayPause}
              title={isPlaying ? t('player.pauseAudio', { defaultValue: 'Pause Narration' }) : t('player.playAudio', { defaultValue: 'Play Narration' })}
              className={`min-h-[48px] min-w-[48px] h-12 px-4 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition active:scale-95 ${
                highContrast
                  ? 'bg-amber-400 text-black border-2 border-amber-300 shadow-md'
                  : isPlaying
                  ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20'
              }`}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>{t('player.pause', { defaultValue: 'Pause' })}</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>{t('player.play', { defaultValue: 'Play' })}</span>
                </>
              )}
            </button>

            {/* Instant Mute Toggle Button */}
            {onToggleMute && (
              <button
                type="button"
                data-testid="audio-mute-btn"
                onClick={onToggleMute}
                title={isMuted ? t('player.unmute', { defaultValue: 'Unmute' }) : t('player.mute', { defaultValue: 'Mute' })}
                className={`min-h-[48px] min-w-[48px] h-12 w-12 rounded-xl border flex items-center justify-center transition active:scale-95 ${
                  isMuted
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                    : highContrast
                    ? 'bg-black border-white text-white'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            )}

            {/* Optional volume slider if onVolumeChange is provided */}
            {onVolumeChange && (
              <div className="hidden lg:flex items-center space-x-1.5 rtl:space-x-reverse px-1">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : Math.round(volume * 100)}
                  onChange={(e) => onVolumeChange(parseInt(e.target.value, 10) / 100)}
                  data-testid="narrator-volume-slider"
                  aria-label="Narration Volume"
                  className="w-16 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scrubber Progress Bar (RTL-aware progression) */}
      <div
        data-testid="audio-scrubber"
        dir={isRtlMode ? 'rtl' : 'ltr'}
        className="w-full h-1.5 bg-slate-950/80 relative overflow-hidden rounded-b-2xl"
      >
        <div
          data-testid="audio-scrubber-fill"
          className={`h-full transition-all duration-150 ${
            isRtlMode ? 'float-right' : 'float-left'
          } ${highContrast ? 'bg-amber-400' : 'bg-emerald-500'}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};

export default KioskAudioNarrator;
