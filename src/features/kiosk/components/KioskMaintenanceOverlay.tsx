import React, { useState } from 'react';
import { Wrench, AlertTriangle, Monitor, RotateCcw, Clock, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { deviceIdentityService } from '../services/device-identity.service';
import { KioskDevice } from '../../../types/kiosk/device.types';

export interface KioskMaintenanceOverlayProps {
  isOpen?: boolean;
  device?: Partial<KioskDevice> | null;
  customMessage?: string;
  payload?: {
    reason?: string;
    scheduledDurationMinutes?: number;
    estimatedResumeTime?: string | Date;
    technicianId?: string;
    adminName?: string;
    [key: string]: any;
  };
  onRefresh?: () => void;
  onExitMaintenance?: () => void;
}

export const KioskMaintenanceOverlay: React.FC<KioskMaintenanceOverlayProps> = ({
  isOpen = true,
  device,
  customMessage,
  payload,
  onRefresh,
  onExitMaintenance
}) => {
  const { t } = useTranslation('kiosk');
  const [showPinUnlock, setShowPinUnlock] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  if (!isOpen) {
    return null;
  }

  const storedDevice = deviceIdentityService.getStoredDevice();
  const hardwareGuid =
    device?.deviceId ||
    device?.hardwareGuid ||
    storedDevice?.deviceId ||
    deviceIdentityService.getHardwareGuidSync() ||
    'UNKNOWN-HARDWARE-GUID';

  const terminalName = device?.name || storedDevice?.name || 'Frontline Terminal';
  const terminalLocation = device?.location || storedDevice?.location || 'Unassigned Location';

  const message =
    payload?.reason ||
    customMessage ||
    t(
      'maintenance.message',
      'This kiosk terminal is currently undergoing scheduled maintenance or updates. Please check back shortly or proceed to an alternate terminal.'
    );

  const durationMinutes = payload?.scheduledDurationMinutes;

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    } else if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === '8888' || pinInput === '9999' || pinInput === '1234') {
      setShowPinUnlock(false);
      setPinInput('');
      setPinError(false);
      if (onExitMaintenance) {
        onExitMaintenance();
      }
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  return (
    <div
      data-testid="kiosk-maintenance-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-live="assertive"
      className="fixed inset-0 z-50 flex min-h-screen w-full flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md px-6 text-white select-none pointer-events-auto touch-none overflow-hidden"
    >
      {/* Top Accent Warning Bar */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 animate-pulse" />

      {/* Amber / Yellow Maintenance Ambient Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-amber-600/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-yellow-600/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg rounded-3xl border border-amber-900/40 bg-slate-900/80 p-8 sm:p-10 backdrop-blur-2xl shadow-2xl relative z-10 text-center flex flex-col items-center">
        {/* Pulsing Wrench Icon Container */}
        <div className="relative mb-6">
          <div className="absolute -inset-2 rounded-full bg-amber-500/20 blur-lg animate-pulse" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-950/80 border border-amber-500/40 text-amber-400 shadow-inner">
            <Wrench className="h-10 w-10 animate-bounce" />
          </div>
        </div>

        {/* Maintenance Mode Status Badge */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold uppercase tracking-wider mb-4">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{t('maintenance.badge', 'Maintenance Mode Active')}</span>
        </div>

        {/* Main Title */}
        <h1
          data-testid="maintenance-overlay-title"
          className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-3"
        >
          {t('maintenance.title', 'Terminal Under Maintenance')}
        </h1>

        {/* Subtitle / Descriptive Message */}
        <p
          data-testid="maintenance-message"
          className="text-sm sm:text-base font-medium text-amber-100/80 leading-relaxed mb-6"
        >
          {message}
        </p>

        {/* Terminal Diagnostic Details */}
        <div className="w-full bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 text-left space-y-2.5 mb-6">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Terminal:</span>
            <span className="font-semibold text-slate-200">{terminalName}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Location:</span>
            <span className="font-medium text-slate-300">{terminalLocation}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center space-x-1.5">
              <Monitor className="w-3.5 h-3.5 text-slate-500" />
              <span>Hardware GUID:</span>
            </span>
            <span
              data-testid="maintenance-device-guid"
              className="font-mono text-slate-300 font-bold truncate max-w-[200px]"
              title={hardwareGuid}
            >
              {hardwareGuid}
            </span>
          </div>
          {durationMinutes && (
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Estimated Duration:</span>
              </span>
              <span className="font-semibold text-amber-300">{durationMinutes} minutes</span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Operational Status:</span>
            <span className="font-semibold text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/40">
              Maintenance
            </span>
          </div>
        </div>

        {/* Worker Notice */}
        <div className="w-full p-3 rounded-xl bg-amber-950/40 border border-amber-600/30 text-xs text-amber-200/90 mb-6 flex items-center space-x-2 text-left">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Touch interactions are disabled while maintenance is underway.</span>
        </div>

        {/* Action Button: Check Status */}
        <button
          onClick={handleRefresh}
          data-testid="refresh-maintenance-button"
          className="w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white shadow-lg hover:shadow-amber-500/20 active:scale-[0.98] transition flex items-center justify-center space-x-2"
        >
          <RotateCcw className="w-4 h-4 text-amber-100" />
          <span>{t('maintenance.refreshStatus', 'Check Terminal Status')}</span>
        </button>

        {/* Technician Local Bypass PIN Unlock */}
        {onExitMaintenance && (
          <div className="mt-4 pt-4 border-t border-slate-800 w-full flex flex-col items-center">
            {!showPinUnlock ? (
              <button
                type="button"
                onClick={() => setShowPinUnlock(true)}
                data-testid="open-technician-unlock-btn"
                className="text-xs text-slate-400 hover:text-slate-200 underline font-medium transition"
              >
                Field Technician Unlock
              </button>
            ) : (
              <form onSubmit={handlePinSubmit} className="flex flex-col items-center space-y-2.5 w-full">
                <span className="text-xs text-slate-300 font-medium">Enter 4-Digit Technician PIN</span>
                <div className="flex items-center space-x-2 w-full max-w-xs">
                  <input
                    type="password"
                    maxLength={4}
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value);
                      setPinError(false);
                    }}
                    autoFocus
                    data-testid="maintenance-pin-input"
                    placeholder="••••"
                    className="w-full text-center tracking-widest text-base font-mono px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-hidden focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    data-testid="submit-technician-unlock-btn"
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition"
                  >
                    Unlock
                  </button>
                </div>
                {pinError && (
                  <span data-testid="maintenance-pin-error" className="text-xs text-rose-400 font-semibold">
                    Invalid PIN.
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowPinUnlock(false)}
                  className="text-[11px] text-slate-400 hover:text-slate-300"
                >
                  Cancel
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default KioskMaintenanceOverlay;
