import React from 'react';
import { Wrench, AlertTriangle, Monitor, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { deviceIdentityService } from '../services/device-identity.service';
import { KioskDevice } from '../../../types/kiosk/device.types';

export interface KioskMaintenanceOverlayProps {
  device?: Partial<KioskDevice> | null;
  customMessage?: string;
  onRefresh?: () => void;
}

export const KioskMaintenanceOverlay: React.FC<KioskMaintenanceOverlayProps> = ({
  device,
  customMessage,
  onRefresh
}) => {
  const { t } = useTranslation('kiosk');
  const storedDevice = deviceIdentityService.getStoredDevice();
  const hardwareGuid =
    device?.deviceId ||
    device?.hardwareGuid ||
    storedDevice?.deviceId ||
    deviceIdentityService.getHardwareGuidSync() ||
    'UNKNOWN-HARDWARE-GUID';

  const terminalName = device?.name || storedDevice?.name || 'Frontline Terminal';
  const terminalLocation = device?.location || storedDevice?.location || 'Unassigned Location';

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    } else if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <div
      data-testid="kiosk-maintenance-overlay"
      className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-950 px-6 text-white select-none relative overflow-hidden"
    >
      {/* Amber / Yellow Maintenance Ambient Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-amber-600/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-yellow-600/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg rounded-3xl border border-amber-900/40 bg-slate-900/70 p-10 backdrop-blur-2xl shadow-2xl relative z-10 text-center flex flex-col items-center">
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
          <span>{t('maintenance.badge', 'Maintenance Mode')}</span>
        </div>

        {/* Main Title */}
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-3">
          {t('maintenance.title', 'Terminal Under Maintenance')}
        </h1>

        {/* Subtitle / Descriptive Message */}
        <p
          data-testid="maintenance-message"
          className="text-sm sm:text-base font-medium text-amber-100/80 leading-relaxed mb-6"
        >
          {customMessage ||
            t(
              'maintenance.message',
              'This kiosk terminal is currently undergoing scheduled maintenance or updates. Please check back shortly or proceed to an alternate terminal.'
            )}
        </p>

        {/* Terminal Diagnostic Details */}
        <div className="w-full bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 text-left space-y-2.5 mb-8">
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
            <span className="font-mono text-slate-300 font-bold truncate max-w-[200px]" title={hardwareGuid}>
              {hardwareGuid}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Operational Status:</span>
            <span className="font-semibold text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/40">
              Maintenance
            </span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleRefresh}
          data-testid="refresh-maintenance-button"
          className="w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white shadow-lg hover:shadow-amber-500/20 active:scale-[0.98] transition flex items-center justify-center space-x-2"
        >
          <RotateCcw className="w-4 h-4 text-amber-100" />
          <span>{t('maintenance.refreshStatus', 'Check Terminal Status')}</span>
        </button>
      </div>
    </div>
  );
};

export default KioskMaintenanceOverlay;
