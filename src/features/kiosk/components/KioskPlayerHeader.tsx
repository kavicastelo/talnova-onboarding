import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Volume2,
  VolumeX,
  Languages,
  LogOut,
  Sparkles
} from 'lucide-react';
import { AccessibilityToolbar, FontScale } from './accessibility/AccessibilityToolbar';
import { LanguageSelectorModal } from './localization/LanguageSelectorModal';
import { isRtlLanguage } from '../constants/language.constants';

export interface KioskPlayerHeaderProps {
  title: string;
  currentStepIndex: number;
  totalSteps: number;
  languages?: readonly string[];
  selectedLanguage: string;
  onLanguageChange?: (lang: string) => void;
  isMuted: boolean;
  onToggleMuted: () => void;
  volume?: number;
  onVolumeChange?: (vol: number) => void;
  autoPlay?: boolean;
  onToggleAutoPlay?: () => void;
  showSubtitles: boolean;
  onToggleSubtitles: () => void;
  highContrast?: boolean;
  onToggleHighContrast?: () => void;
  fontScale?: FontScale;
  onFontScaleChange?: (scale: FontScale) => void;
  canExit?: boolean;
  onExit?: () => void;
  isAdminPreview?: boolean;
  isRtl?: boolean;
  className?: string;
}

export const KioskPlayerHeader: React.FC<KioskPlayerHeaderProps> = ({
  title,
  currentStepIndex,
  totalSteps,
  languages = ['en'],
  selectedLanguage,
  onLanguageChange,
  isMuted,
  onToggleMuted,
  volume = 0.8,
  onVolumeChange,
  autoPlay = true,
  onToggleAutoPlay,
  showSubtitles,
  onToggleSubtitles,
  highContrast = false,
  onToggleHighContrast,
  fontScale = 100,
  onFontScaleChange,
  canExit = false,
  onExit,
  isAdminPreview = false,
  isRtl,
  className = ''
}) => {
  const { t } = useTranslation('kiosk');
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);

  const isRtlMode = isRtl ?? isRtlLanguage(selectedLanguage);

  const progressPercent = totalSteps > 0
    ? Math.min(Math.round(((currentStepIndex + 1) / totalSteps) * 100), 100)
    : 0;

  return (
    <header
      data-testid="kiosk-player-header"
      role="banner"
      dir={isRtlMode ? 'rtl' : 'ltr'}
      data-dir={isRtlMode ? 'rtl' : 'ltr'}
      data-rtl={isRtlMode ? 'true' : 'false'}
      aria-label={t('player.headerLabel', { defaultValue: 'Kiosk Terminal Header' })}
      className={`sticky top-0 z-30 w-full border-b transition-colors select-none ${
        highContrast
          ? 'high-contrast-mode bg-black border-amber-400 text-white'
          : 'bg-slate-950/85 border-slate-900 text-white backdrop-blur-md'
      } ${className}`}
    >
      {/* Primary Top Bar */}
      <div className="h-16 px-4 sm:px-8 lg:px-12 flex items-center justify-between gap-4">
        {/* Left: Brand Badge & Journey Title */}
        <div className="flex items-center space-x-3 min-w-0">
          <div
            className={`hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
              highContrast
                ? 'bg-amber-400 text-black border border-amber-300'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>{t('player.kioskMode', { defaultValue: 'Kiosk Mode' })}</span>
          </div>

          <h1
            id="kiosk-journey-title"
            data-testid="kiosk-player-title"
            title={title}
            className="text-base sm:text-lg font-bold tracking-tight truncate max-w-xs sm:max-w-md text-white"
          >
            {title}
          </h1>
        </div>

        {/* Right: Accessibility Controls & Exit Trigger */}
        <div className="flex items-center space-x-2.5 sm:space-x-3 shrink-0">
          {/* Universal Accessibility Toolbar (K-ACC-002) */}
          <AccessibilityToolbar
            highContrast={highContrast}
            onToggleHighContrast={onToggleHighContrast || (() => {})}
            contrastBtnTestId="toggle-contrast-btn"
            fontScale={fontScale}
            onFontScaleChange={onFontScaleChange}
            showSubtitles={showSubtitles}
            onToggleSubtitles={onToggleSubtitles}
            showSubtitlesToggle={true}
          />

          {/* Audio Volume & Mute Controls (K-LOC-003) */}
          <div
            data-testid="player-volume-control"
            className={`flex items-center space-x-1 rtl:space-x-reverse rounded-xl border p-0.5 ${
              highContrast
                ? 'bg-black border-white'
                : 'bg-slate-900/60 border-slate-800'
            }`}
          >
            {/* Audio Volume Mute Toggle */}
            <button
              type="button"
              id="kiosk-toggle-mute-btn"
              data-testid="toggle-mute-btn"
              onClick={onToggleMuted}
              title={isMuted ? t('player.unmute', { defaultValue: 'Unmute Audio' }) : t('player.mute', { defaultValue: 'Mute Audio' })}
              className={`min-h-[48px] min-w-[48px] w-12 h-12 rounded-lg text-xs transition active:scale-95 flex items-center justify-center ${
                isMuted
                  ? 'bg-rose-500/20 text-rose-400'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>

            {/* Volume Slider (0-100%) */}
            {onVolumeChange && (
              <div className="hidden sm:flex items-center space-x-2 rtl:space-x-reverse px-2">
                <input
                  type="range"
                  id="kiosk-volume-slider"
                  data-testid="volume-slider"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : Math.round(volume * 100)}
                  onChange={(e) => {
                    const nextVal = parseInt(e.target.value, 10) / 100;
                    onVolumeChange(nextVal);
                  }}
                  aria-label={t('player.volumeSlider', { defaultValue: 'Volume level' })}
                  title={`${Math.round((isMuted ? 0 : volume) * 100)}%`}
                  className="w-16 sm:w-20 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <span
                  data-testid="volume-percentage"
                  className="text-[11px] font-mono font-semibold text-slate-300 w-8 text-right rtl:text-left"
                >
                  {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
                </span>
              </div>
            )}
          </div>

          {/* Autoplay Setting Toggle (K-LOC-003) */}
          {onToggleAutoPlay && (
            <button
              type="button"
              id="kiosk-toggle-autoplay-btn"
              data-testid="toggle-autoplay-btn"
              onClick={onToggleAutoPlay}
              title={autoPlay ? t('player.autoplayOn', { defaultValue: 'Narration Autoplay: ON' }) : t('player.autoplayOff', { defaultValue: 'Narration Autoplay: OFF' })}
              className={`hidden md:flex min-h-[48px] px-3 h-12 rounded-xl border text-xs font-bold transition active:scale-95 items-center space-x-1.5 rtl:space-x-reverse ${
                autoPlay
                  ? highContrast
                    ? 'bg-amber-400 text-black border-amber-300'
                    : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400'
              }`}
            >
              <span>{t('player.auto', { defaultValue: 'Auto' })}</span>
              <span className={`w-2 h-2 rounded-full ${autoPlay ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            </button>
          )}

          {/* Multi-Language Modal Trigger (K-LOC-001) - Visible on tablet/mobile screens */}
          {onLanguageChange && (
            <button
              type="button"
              id="kiosk-language-modal-btn"
              data-testid="player-language-modal-btn"
              onClick={() => setIsLanguageModalOpen(true)}
              title={t('player.switchLanguage', { defaultValue: 'Switch Language' })}
              className={`flex xl:hidden min-h-[48px] min-w-[48px] h-12 px-3.5 rounded-xl border text-xs font-bold items-center justify-center space-x-1.5 transition active:scale-95 ${
                highContrast
                  ? 'bg-black border-white text-white hover:border-amber-400'
                  : 'bg-slate-900/80 border-slate-700 hover:bg-slate-800 text-slate-200'
              }`}
            >
              <Languages className="w-4 h-4 text-emerald-400" />
              <span className="uppercase">{selectedLanguage}</span>
            </button>
          )}

          {/* Inline Quick Language Switcher Pills - Visible on wide screens */}
          {languages && languages.length > 1 && onLanguageChange && (
            <div
              data-testid="player-language-switcher"
              className="hidden xl:flex items-center space-x-2 bg-slate-900/80 border border-slate-800 rounded-xl p-1"
            >
              <Languages className="w-4 h-4 text-slate-400 ms-1.5 me-0.5 hidden sm:inline" />
              {languages.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  id={`lang-btn-${lang}`}
                  data-testid={`lang-btn-${lang}`}
                  onClick={() => onLanguageChange(lang)}
                  className={`min-h-[48px] min-w-[48px] px-3.5 py-2.5 rounded-lg text-xs font-bold transition uppercase active:scale-95 flex items-center justify-center ${
                    selectedLanguage === lang
                      ? highContrast
                        ? 'bg-amber-400 text-black'
                        : 'bg-emerald-500 text-slate-950 shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          )}

          {/* Exit Option */}
          {(canExit || isAdminPreview) && onExit && (
            <button
              type="button"
              id="kiosk-btn-exit"
              data-testid="kiosk-btn-exit"
              onClick={onExit}
              className={`min-h-[48px] min-w-[48px] h-12 px-3 sm:px-4 rounded-xl font-bold text-xs border transition flex items-center space-x-2 active:scale-95 ${
                highContrast
                  ? 'bg-black border-white text-white hover:border-amber-400'
                  : 'bg-rose-950/40 border-rose-900/60 text-rose-300 hover:bg-rose-900/60 hover:text-white'
              }`}
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{isAdminPreview ? t('player.exitPreview', { defaultValue: 'Exit Preview' }) : t('player.exit', { defaultValue: 'Exit' })}</span>
            </button>
          )}
        </div>
      </div>

      {/* Step Progress Bar with Visual Feedback (RTL-aware fill direction) */}
      <div
        className="w-full bg-slate-900/60 h-1.5 relative overflow-hidden"
        dir={isRtlMode ? 'rtl' : 'ltr'}
        data-dir={isRtlMode ? 'rtl' : 'ltr'}
      >
        <div
          data-testid="kiosk-progress-bar"
          data-rtl={isRtlMode ? 'true' : 'false'}
          className={`h-full transition-all duration-300 ease-out ${
            isRtlMode ? 'float-right' : 'float-left'
          } ${
            highContrast ? 'bg-amber-400' : 'bg-emerald-500'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Multi-Language Selector Modal (K-LOC-001) */}
      <LanguageSelectorModal
        isOpen={isLanguageModalOpen}
        onClose={() => setIsLanguageModalOpen(false)}
        selectedLanguage={selectedLanguage}
        onSelectLanguage={(lang) => {
          onLanguageChange?.(lang);
        }}
        supportedLanguages={languages}
        highContrast={highContrast}
      />
    </header>
  );
};

export default KioskPlayerHeader;
