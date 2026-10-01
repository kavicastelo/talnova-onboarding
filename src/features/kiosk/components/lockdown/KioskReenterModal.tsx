import React from 'react';
import { useTranslation } from 'react-i18next';
import { Maximize2, ShieldAlert, Touchpad } from 'lucide-react';
import { kioskLockdownService } from '../../services/kiosk-lockdown.service';

export interface KioskReenterModalProps {
  isOpen: boolean;
  onReenter?: () => void;
  highContrast?: boolean;
}

export const KioskReenterModal: React.FC<KioskReenterModalProps> = ({
  isOpen,
  onReenter,
  highContrast = false
}) => {
  const { t } = useTranslation('kiosk');

  if (!isOpen) return null;

  const handleAction = async () => {
    if (onReenter) {
      onReenter();
    } else {
      await kioskLockdownService.requestFullscreen();
    }
  };

  return (
    <div
      id="kiosk-reenter-modal"
      data-testid="kiosk-reenter-modal"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="kiosk-reenter-title"
      aria-describedby="kiosk-reenter-desc"
      onClick={handleAction}
      className={`fixed inset-0 z-[120] flex flex-col items-center justify-center p-6 select-none cursor-pointer transition-colors backdrop-blur-xl ${
        highContrast
          ? 'bg-black text-white border-8 border-amber-400'
          : 'bg-slate-950/95 text-white'
      }`}
    >
      {/* Decorative ambient security glow */}
      {!highContrast && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl animate-pulse" />
          <div className="absolute top-1/3 left-1/3 w-64 h-64 rounded-full bg-cyan-500/5 blur-2xl" />
        </div>
      )}

      {/* Main Container Card */}
      <div
        className={`relative z-10 max-w-lg w-full flex flex-col items-center text-center p-8 sm:p-12 rounded-3xl transition border shadow-2xl ${
          highContrast
            ? 'bg-black border-4 border-white text-white'
            : 'bg-slate-900/80 border border-slate-800 shadow-emerald-500/10'
        }`}
      >
        {/* Security / Fullscreen Icon */}
        <div
          className={`mb-6 p-6 rounded-3xl flex items-center justify-center transition transform group-hover:scale-105 ${
            highContrast
              ? 'bg-amber-400 text-black border-2 border-white'
              : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/20'
          }`}
        >
          <Maximize2 className="w-16 h-16 animate-pulse" />
        </div>

        {/* Primary Prompt Heading */}
        <h2
          id="kiosk-reenter-title"
          data-testid="kiosk-reenter-title"
          className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3"
        >
          {t('lockdown.reenterTitle', {
            defaultValue: 'Touch screen to re-enter kiosk mode'
          })}
        </h2>

        {/* Informative Subtext */}
        <p
          id="kiosk-reenter-desc"
          className={`text-sm sm:text-base max-w-md mb-8 ${
            highContrast ? 'text-amber-200' : 'text-slate-400'
          }`}
        >
          {t('lockdown.reenterDescription', {
            defaultValue:
              'Fullscreen protection was paused. Tap anywhere on the display to resume locked terminal operations.'
          })}
        </p>

        {/* Action Button */}
        <button
          type="button"
          id="kiosk-reenter-btn"
          data-testid="kiosk-reenter-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleAction();
          }}
          className={`h-16 px-8 rounded-2xl text-base sm:text-lg font-bold flex items-center justify-center space-x-3 transition active:scale-95 shadow-xl ${
            highContrast
              ? 'bg-amber-400 text-black hover:bg-amber-300 border-2 border-white'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30 hover:shadow-emerald-500/50'
          }`}
        >
          <Touchpad className="w-6 h-6" />
          <span>
            {t('lockdown.reenterButton', {
              defaultValue: 'Resume Kiosk Mode'
            })}
          </span>
        </button>

        {/* Bottom Security Badge */}
        <div className="mt-8 flex items-center space-x-2 text-xs text-slate-500 font-medium">
          <ShieldAlert className="w-4 h-4 text-emerald-400" />
          <span>{t('lockdown.terminalSecured', { defaultValue: 'Frontline Terminal Lockdown Active' })}</span>
        </div>
      </div>
    </div>
  );
};

export default KioskReenterModal;
