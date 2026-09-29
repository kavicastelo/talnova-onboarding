import React from 'react';
import { ShieldAlert, AlertTriangle, Monitor, RotateCcw } from 'lucide-react';
import { deviceIdentityService } from '../services/device-identity.service';
import { useTranslation } from 'react-i18next';

interface KioskRevokedScreenProps {
  onReEnroll?: () => void;
  customMessage?: string;
}

export const KioskRevokedScreen: React.FC<KioskRevokedScreenProps> = ({
  onReEnroll,
  customMessage
}) => {
  const { t } = useTranslation('kiosk');
  const hardwareGuid = deviceIdentityService.getHardwareGuidSync() || 'UNKNOWN-HARDWARE-GUID';

  const handleReEnroll = () => {
    deviceIdentityService.clearRevocationStatus();
    deviceIdentityService.clearDeviceCredentials();
    if (onReEnroll) {
      onReEnroll();
    } else if (typeof window !== 'undefined') {
      window.location.href = '/kiosk/pair';
    }
  };

  return (
    <div
      data-testid="kiosk-revoked-lockdown"
      className="flex h-screen w-full flex-col items-center justify-center bg-slate-950 px-6 text-white select-none relative overflow-hidden"
    >
      {/* Red / Amber Security Warning Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-rose-600/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-amber-600/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg rounded-3xl border border-rose-900/40 bg-slate-900/60 p-10 backdrop-blur-2xl shadow-2xl relative z-10 text-center flex flex-col items-center">
        {/* Pulsing Shield Alert Icon */}
        <div className="relative mb-6">
          <div className="absolute -inset-2 rounded-full bg-rose-500/20 blur-lg animate-pulse" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-500 shadow-inner">
            <ShieldAlert className="h-10 w-10 animate-bounce" />
          </div>
        </div>

        {/* Lockdown Badge */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono font-bold uppercase tracking-wider mb-4">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Security Lockdown</span>
        </div>

        {/* Primary Required Header & Headline */}
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-3">
          {t('revoked.title', 'Terminal Revoked')}
        </h1>

        {/* Required String according to K-DEV-004 specification */}
        <p
          data-testid="revocation-message"
          className="text-base sm:text-lg font-medium text-rose-200/90 leading-relaxed mb-6"
        >
          {customMessage || t('revoked.message', 'Device enrollment revoked. Please contact your system administrator.')}
        </p>

        {/* Hardware Diagnostic Details */}
        <div className="w-full bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 text-left space-y-2 mb-8">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center space-x-1.5">
              <Monitor className="w-3.5 h-3.5 text-slate-500" />
              <span>Hardware GUID:</span>
            </span>
            <span className="font-mono text-slate-300 font-bold truncate max-w-[200px]" title={hardwareGuid}>
              {hardwareGuid}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Terminal Status:</span>
            <span className="font-semibold text-rose-400">Decommissioned / Revoked</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Timestamp:</span>
            <span className="font-mono text-slate-300">{new Date().toISOString()}</span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleReEnroll}
          data-testid="re-enroll-button"
          className="w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-slate-100 border border-slate-700/60 shadow-lg hover:shadow-slate-700/20 active:scale-[0.98] transition flex items-center justify-center space-x-2"
        >
          <RotateCcw className="w-4 h-4 text-slate-300" />
          <span>{t('revoked.reEnroll', 'Re-enroll Terminal')}</span>
        </button>
      </div>
    </div>
  );
};

export default KioskRevokedScreen;
