import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Type, ZoomIn } from 'lucide-react';

export type FontScale = 100 | 125 | 150 | 200;

export const HIGH_CONTRAST_PALETTE = {
  background: '#000000',
  foreground: '#ffffff',
  accent: '#fbbf24', // Amber-400
  border: '#fbbf24',
  activeIndicator: '#f59e0b' // Amber-500
} as const;

export const WCAG_AAA_NORMAL_TEXT_THRESHOLD = 7.0;
export const WCAG_AA_NORMAL_TEXT_THRESHOLD = 4.5;

/**
 * Converts a 3 or 6-digit hex color string to RGB tuple.
 */
export function hexToRgb(hex: string): [number, number, number] {
  const cleanHex = hex.replace(/^#/, '');
  let fullHex = cleanHex;
  if (cleanHex.length === 3) {
    fullHex = cleanHex.split('').map((c) => c + c).join('');
  }
  const num = parseInt(fullHex, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Calculates sRGB relative luminance per WCAG 2.2 specifications.
 * Accepts hex string ('#ffffff'), RGB array ([255, 255, 255]), or individual r, g, b numbers.
 */
export function calculateLuminance(
  rOrColor: number | string | [number, number, number],
  g?: number,
  b?: number
): number {
  let red: number, green: number, blue: number;
  if (typeof rOrColor === 'string') {
    [red, green, blue] = hexToRgb(rOrColor);
  } else if (Array.isArray(rOrColor)) {
    [red, green, blue] = rOrColor;
  } else {
    red = rOrColor;
    green = g ?? 0;
    blue = b ?? 0;
  }

  const [rs, gs, bs] = [red, green, blue].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculates WCAG contrast ratio between two colors (returns 1 to 21).
 * Accepts hex strings or RGB tuples.
 */
export function calculateContrastRatio(
  color1: [number, number, number] | string,
  color2: [number, number, number] | string
): number {
  const l1 = calculateLuminance(color1);
  const l2 = calculateLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export interface AccessibilityToolbarProps {
  highContrast: boolean;
  onToggleHighContrast: () => void;
  contrastBtnTestId?: string;
  fontScale?: FontScale;
  onFontScaleChange?: (scale: FontScale) => void;
  showSubtitles?: boolean;
  onToggleSubtitles?: () => void;
  showSubtitlesToggle?: boolean;
  showQuickZoomButtons?: boolean;
  className?: string;
}

export const AccessibilityToolbar: React.FC<AccessibilityToolbarProps> = ({
  highContrast,
  onToggleHighContrast,
  contrastBtnTestId,
  fontScale = 100,
  onFontScaleChange,
  showSubtitles = false,
  onToggleSubtitles,
  showSubtitlesToggle = true,
  showQuickZoomButtons = true,
  className = ''
}) => {
  const { t } = useTranslation('kiosk');

  // Sync high-contrast class and CSS variables to the DOM
  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (highContrast) {
      document.documentElement.classList.add('high-contrast-mode');
      document.body.classList.add('high-contrast-mode');
    } else {
      document.documentElement.classList.remove('high-contrast-mode');
      document.body.classList.remove('high-contrast-mode');
    }

    return () => {
      document.documentElement.classList.remove('high-contrast-mode');
      document.body.classList.remove('high-contrast-mode');
    };
  }, [highContrast]);

  // Sync font scale CSS variable and data-attribute to the DOM
  useEffect(() => {
    if (typeof document === 'undefined') return;

    document.documentElement.style.setProperty('--kiosk-font-scale', `${fontScale / 100}`);
    document.documentElement.setAttribute('data-font-scale', `${fontScale}`);
    document.body.setAttribute('data-font-scale', `${fontScale}`);

    // Update classes
    [100, 125, 150, 200].forEach((scale) => {
      document.documentElement.classList.remove(`kiosk-font-scale-${scale}`);
      document.body.classList.remove(`kiosk-font-scale-${scale}`);
    });
    document.documentElement.classList.add(`kiosk-font-scale-${fontScale}`);
    document.body.classList.add(`kiosk-font-scale-${fontScale}`);
  }, [fontScale]);

  // Stepper cycle: 100 -> 125 -> 150 -> 200 -> 100
  const handleCycleFontScale = () => {
    if (!onFontScaleChange) return;
    const scales: FontScale[] = [100, 125, 150, 200];
    const currentIndex = scales.indexOf(fontScale);
    const nextIndex = (currentIndex + 1) % scales.length;
    onFontScaleChange(scales[nextIndex]);
  };

  return (
    <nav
      id="kiosk-accessibility-toolbar"
      data-testid="kiosk-accessibility-toolbar"
      role="navigation"
      aria-label={t('accessibility.toolbarLabel', { defaultValue: 'Universal Accessibility Controls' })}
      className={`flex items-center gap-2.5 sm:gap-3 ${className}`}
    >
      {/* 1. Closed Caption / Subtitles Toggle */}
      {showSubtitlesToggle && onToggleSubtitles && (
        <button
          type="button"
          id="kiosk-toggle-subtitles"
          data-testid="toggle-subtitles-btn"
          aria-label={t('player.toggleSubtitles', { defaultValue: 'Toggle Subtitles' })}
          aria-pressed={showSubtitles}
          onClick={onToggleSubtitles}
          title={t('player.toggleSubtitles', { defaultValue: 'Closed Captions / Subtitles' })}
          className={`min-h-[48px] min-w-[48px] w-12 h-12 rounded-xl border text-xs transition active:scale-95 flex items-center justify-center focus-visible:outline-4 focus-visible:outline-sky-500 focus-visible:ring-4 focus-visible:ring-sky-500/30 ${
            showSubtitles
              ? highContrast
                ? 'bg-amber-400 text-black border-amber-400 shadow-md'
                : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
              : highContrast
              ? 'bg-black border-neutral-700 text-white hover:border-amber-400'
              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Type className="w-5 h-5" />
        </button>
      )}

      {/* 2. High Contrast Mode Toggle (WCAG AAA Ratio > 7:1; Amber/Black > 12:1) */}
      <button
        type="button"
        id={contrastBtnTestId || "kiosk-toggle-contrast"}
        data-testid={contrastBtnTestId || "toggle-high-contrast"}
        data-high-contrast-toggle="true"
        aria-label={t('player.toggleHighContrast', { defaultValue: 'Toggle High Contrast Mode' })}
        aria-pressed={highContrast}
        onClick={onToggleHighContrast}
        title={
          highContrast
            ? t('accessibility.disableHighContrast', { defaultValue: 'Disable High Contrast' })
            : t('accessibility.enableHighContrast', { defaultValue: 'Enable High Contrast (WCAG AAA)' })
        }
        className={`min-h-[48px] min-w-[48px] w-12 h-12 rounded-xl border flex items-center justify-center transition active:scale-95 focus-visible:outline-4 focus-visible:outline-sky-500 focus-visible:ring-4 focus-visible:ring-sky-500/30 ${
          highContrast
            ? 'bg-amber-400 text-black border-2 border-amber-300 shadow-lg shadow-amber-400/20'
            : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
        }`}
      >
        <Eye className="w-5 h-5" />
      </button>

      {/* 3. Text Size Zoom Controls */}
      {onFontScaleChange && (
        <div
          data-testid="zoom-controls-group"
          className="flex items-center gap-1.5 sm:gap-2 bg-slate-900/80 border border-slate-800 rounded-xl p-1"
        >
          {/* Quick Direct Buttons: 100%, 125%, 150%, 200% on wide viewports */}
          {showQuickZoomButtons && (
            <div className="hidden xl:flex items-center gap-1.5" data-testid="quick-zoom-buttons">
              {([100, 125, 150, 200] as const).map((scale) => {
                const isSelected = fontScale === scale;
                return (
                  <button
                    key={scale}
                    type="button"
                    id={`zoom-btn-${scale}`}
                    data-testid={`zoom-${scale}`}
                    aria-label={`Set text size to ${scale}%`}
                    aria-pressed={isSelected}
                    onClick={() => onFontScaleChange(scale)}
                    className={`min-h-[48px] min-w-[48px] px-2.5 py-2 rounded-lg font-bold text-xs transition active:scale-95 flex items-center justify-center focus-visible:outline-4 focus-visible:outline-sky-500 focus-visible:ring-4 focus-visible:ring-sky-500/30 ${
                      isSelected
                        ? highContrast
                          ? 'bg-amber-400 text-black border-2 border-amber-300 font-black'
                          : 'bg-indigo-600 text-white shadow-md'
                        : highContrast
                        ? 'text-white hover:bg-neutral-900 hover:text-amber-300'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {scale}%
                  </button>
                );
              })}
            </div>
          )}

          {/* Stepper Cycle Button on compact/tablet viewports */}
          <button
            type="button"
            id="toggle-font-scale"
            data-testid="toggle-font-scale"
            aria-label={`Cycle text size, current ${fontScale}%`}
            onClick={handleCycleFontScale}
            title={t('launcher.toggleFontScale', { defaultValue: 'Toggle Larger Font' })}
            className={`flex xl:hidden min-h-[48px] min-w-[48px] px-3 py-2 rounded-lg font-bold text-xs items-center space-x-1.5 transition active:scale-95 focus-visible:outline-4 focus-visible:outline-sky-500 focus-visible:ring-4 focus-visible:ring-sky-500/30 ${
              fontScale > 100
                ? highContrast
                  ? 'bg-amber-400 text-black font-black'
                  : 'bg-indigo-600 text-white'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ZoomIn className="w-4 h-4" />
            <span>{fontScale}%</span>
          </button>
        </div>
      )}
    </nav>
  );
};

export default AccessibilityToolbar;
