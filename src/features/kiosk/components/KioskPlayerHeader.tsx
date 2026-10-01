import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Volume2,
  VolumeX,
  Languages,
  LogOut,
  Sparkles
} from 'lucide-react';
import { AccessibilityToolbar, FontScale } from './accessibility/AccessibilityToolbar';

export interface KioskPlayerHeaderProps {
  title: string;
  currentStepIndex: number;
  totalSteps: number;
  languages?: readonly string[];
  selectedLanguage: string;
  onLanguageChange?: (lang: string) => void;
  isMuted: boolean;
  onToggleMuted: () => void;
  showSubtitles: boolean;
  onToggleSubtitles: () => void;
  highContrast?: boolean;
  onToggleHighContrast?: () => void;
  fontScale?: FontScale;
  onFontScaleChange?: (scale: FontScale) => void;
  canExit?: boolean;
  onExit?: () => void;
  isAdminPreview?: boolean;
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
  showSubtitles,
  onToggleSubtitles,
  highContrast = false,
  onToggleHighContrast,
  fontScale = 100,
  onFontScaleChange,
  canExit = false,
  onExit,
  isAdminPreview = false,
  className = ''
}) => {
  const { t } = useTranslation('kiosk');

  const progressPercent = totalSteps > 0
    ? Math.min(Math.round(((currentStepIndex + 1) / totalSteps) * 100), 100)
    : 0;

  return (
    <header
      data-testid="kiosk-player-header"
      role="banner"
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

          {/* Audio Volume Mute Toggle */}
          <button
            type="button"
            data-testid="toggle-mute-btn"
            onClick={onToggleMuted}
            title={isMuted ? t('player.unmute', { defaultValue: 'Unmute Audio' }) : t('player.mute', { defaultValue: 'Mute Audio' })}
            className={`min-h-[48px] min-w-[48px] w-12 h-12 rounded-xl border text-xs transition active:scale-95 flex items-center justify-center ${
              isMuted
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850'
            }`}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          {/* Language Switcher */}
          {languages && languages.length > 1 && onLanguageChange && (
            <div
              data-testid="player-language-switcher"
              className="flex items-center space-x-2 bg-slate-900/80 border border-slate-800 rounded-xl p-1"
            >
              <Languages className="w-4 h-4 text-slate-400 ml-1.5 mr-0.5 hidden sm:inline" />
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
              className={`min-h-[48px] min-w-[48px] h-12 px-4 rounded-xl font-bold text-xs border transition flex items-center space-x-2 active:scale-95 ${
                highContrast
                  ? 'bg-black border-white text-white hover:border-amber-400'
                  : 'bg-rose-950/40 border-rose-900/60 text-rose-300 hover:bg-rose-900/60 hover:text-white'
              }`}
            >
              <LogOut className="w-4 h-4" />
              <span>{isAdminPreview ? t('player.exitPreview', { defaultValue: 'Exit Preview' }) : t('player.exit', { defaultValue: 'Exit' })}</span>
            </button>
          )}
        </div>
      </div>

      {/* Step Progress Bar with Visual Feedback */}
      <div className="w-full bg-slate-900/60 h-1.5 relative overflow-hidden">
        <div
          data-testid="kiosk-progress-bar"
          className={`h-full transition-all duration-300 ease-out ${
            highContrast ? 'bg-amber-400' : 'bg-emerald-500'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </header>
  );
};

export default KioskPlayerHeader;
