import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Wrench,
  Battery,
  BatteryCharging,
  BatteryWarning,
  HardDrive,
  Wifi,
  RotateCcw,
  Zap,
  Trash2,
  Copy,
  Check,
  Clock,
  MapPin,
  Layers,
  AlertTriangle,
  Monitor
} from 'lucide-react';
import { KioskDevice } from '../../../../types/kiosk/device.types';
import { KioskJourney } from '../../../../types/kiosk/journey.types';
import { Badge } from '../../../../components/Badge';
import { Button } from '../../../../components/Button';
import { toast } from 'sonner';

export interface DeviceDetailDrawerProps {
  device: KioskDevice | null;
  isOpen: boolean;
  onClose: () => void;
  journeys?: KioskJourney[];
  onToggleMaintenance?: (deviceId: string, currentStatus: string) => Promise<void> | void;
  onDispatchCommand?: (deviceId: string, command: string) => Promise<void> | void;
  onRevokeDevice?: (deviceId: string, deviceName: string) => Promise<void> | void;
  onManageAssignments?: (device: KioskDevice) => void;
}

export function normalizeBatteryPercent(batteryLevel?: number): number | null {
  if (batteryLevel === undefined || batteryLevel === null || isNaN(batteryLevel)) return null;
  if (batteryLevel <= 1 && batteryLevel > 0) {
    return Math.round(batteryLevel * 100);
  }
  return Math.round(batteryLevel);
}

export function isLowBattery(batteryLevel?: number): boolean {
  const percent = normalizeBatteryPercent(batteryLevel);
  return percent !== null && percent < 20;
}

export function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return 'N/A';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

export function DeviceDetailDrawer({
  device,
  isOpen,
  onClose,
  journeys = [],
  onToggleMaintenance,
  onDispatchCommand,
  onRevokeDevice,
  onManageAssignments
}: DeviceDetailDrawerProps) {
  const { t } = useTranslation(['kiosk', 'common']);
  const [copiedGuid, setCopiedGuid] = useState(false);

  if (!isOpen || !device) {
    return null;
  }

  const isOnline = device.status === 'online';
  const isMaintenance = device.status === 'maintenance';
  const batteryPercent = normalizeBatteryPercent(device.telemetry?.batteryLevel);
  const lowBattery = isLowBattery(device.telemetry?.batteryLevel);
  const isCharging = device.telemetry?.isCharging ?? false;

  const storageUsed = device.telemetry?.storageUsedBytes;
  const storageTotal = device.telemetry?.storageTotalBytes;
  const storageFree = device.telemetry?.storageFreeBytes;
  const storagePercent =
    storageUsed !== undefined && storageTotal && storageTotal > 0
      ? Math.min(100, Math.round((storageUsed / storageTotal) * 100))
      : null;

  const latency = device.telemetry?.networkLatencyMs;
  const latencyQuality =
    latency !== undefined
      ? latency < 50
        ? { text: 'Optimal', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
        : latency < 150
        ? { text: 'Good', color: 'text-blue-700 bg-blue-50 border-blue-200' }
        : { text: 'Elevated', color: 'text-amber-700 bg-amber-50 border-amber-200' }
      : null;

  const handleCopyGuid = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(device.deviceId || device.hardwareGuid);
      setCopiedGuid(true);
      toast.success(t('toasts.guidCopied', { defaultValue: 'Hardware GUID copied to clipboard' }));
      setTimeout(() => setCopiedGuid(false), 2000);
    }
  };

  return (
    <div
      data-testid="device-detail-drawer"
      className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end transition-opacity"
      aria-labelledby="drawer-title"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
        data-testid="drawer-content"
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  isOnline
                    ? 'bg-emerald-500 shadow-md shadow-emerald-400/50'
                    : isMaintenance
                    ? 'bg-amber-500 shadow-md shadow-amber-400/50'
                    : 'bg-slate-300'
                }`}
              />
              <h2 id="drawer-title" data-testid="drawer-device-name" className="text-lg font-bold text-slate-900">
                {device.name}
              </h2>
              <Badge
                data-testid="drawer-status-badge"
                variant={isOnline ? 'default' : isMaintenance ? 'outline' : 'secondary'}
                className={`text-xs py-0.5 px-2.5 font-semibold ${
                  isOnline
                    ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
                    : isMaintenance
                    ? 'bg-amber-500/10 text-amber-700 border-amber-500/30'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {isOnline
                  ? t('devicesList.statusOnline', { defaultValue: 'Online' })
                  : isMaintenance
                  ? t('devicesList.statusMaintenance', { defaultValue: 'Maintenance' })
                  : t('devicesList.statusOffline', { defaultValue: 'Offline' })}
              </Badge>
              {lowBattery && (
                <Badge
                  data-testid="low-battery-badge"
                  className="bg-rose-500/10 text-rose-700 border-rose-500/30 text-[10px] font-bold flex items-center space-x-1"
                >
                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                  <span>{t('fleet.lowBatteryBadge', { defaultValue: 'Low Battery (<20%)' })}</span>
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 flex items-center space-x-2">
              <span className="flex items-center">
                <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />
                <span data-testid="drawer-location">{device.location}</span>
              </span>
              {device.deviceType && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="capitalize text-slate-600 font-medium">
                    {device.deviceType.replace(/_/g, ' ')}
                  </span>
                </>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            data-testid="close-drawer-btn"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Action Ribbon */}
          <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
            {onToggleMaintenance && (
              <Button
                size="sm"
                variant={isMaintenance ? 'default' : 'outline'}
                onClick={() => onToggleMaintenance(device._id, device.status)}
                data-testid="drawer-toggle-maintenance-btn"
                className={`text-xs flex items-center space-x-1.5 ${
                  isMaintenance ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>{isMaintenance ? 'Exit Maintenance' : 'Enter Maintenance'}</span>
              </Button>
            )}

            {onDispatchCommand && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDispatchCommand(device._id, 'refresh_cache')}
                  data-testid="drawer-sync-cache-btn"
                  className="text-xs flex items-center space-x-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Sync Cache</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDispatchCommand(device._id, 'restart_app')}
                  data-testid="drawer-restart-app-btn"
                  className="text-xs flex items-center space-x-1.5"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Restart App</span>
                </Button>
              </>
            )}

            {onRevokeDevice && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRevokeDevice(device._id, device.name)}
                data-testid="drawer-revoke-device-btn"
                className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-300 ml-auto flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Revoke Device</span>
              </Button>
            )}
          </div>

          {/* Section 1: Hardware Identity & Security Anchors */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {t('fleet.deviceIdentity', { defaultValue: 'Device Identity & Cryptographic Anchors' })}
            </h3>
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
              <div>
                <span className="text-[11px] text-slate-400 font-medium">
                  {t('fleet.hardwareGuid', { defaultValue: 'Hardware GUID (Fingerprint)' })}
                </span>
                <div className="flex items-center space-x-2 mt-0.5">
                  <span
                    data-testid="drawer-hardware-guid"
                    className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded border border-slate-200 select-all break-all"
                  >
                    {device.deviceId || device.hardwareGuid}
                  </span>
                  <button
                    onClick={handleCopyGuid}
                    data-testid="copy-guid-btn"
                    className="p-1 text-slate-400 hover:text-slate-600 transition"
                    title="Copy GUID"
                  >
                    {copiedGuid ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-[11px] text-slate-400 font-medium">{t('fleet.location', { defaultValue: 'Physical Location' })}</span>
                  <p className="text-xs font-semibold text-slate-700">{device.location}</p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 font-medium">{t('fleet.ipAddress', { defaultValue: 'IP Address' })}</span>
                  <p className="text-xs font-mono font-semibold text-slate-700">{device.ipAddress || 'DHCP / Auto'}</p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 font-medium">{t('fleet.pairedDate', { defaultValue: 'Paired Date' })}</span>
                  <p className="text-xs font-semibold text-slate-700">
                    {device.pairedAt ? new Date(device.pairedAt).toLocaleDateString() : 'Active'}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 font-medium">{t('fleet.lastSeen', { defaultValue: 'Last Heartbeat' })}</span>
                  <p className="text-xs font-semibold text-slate-700 flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>
                      {device.lastSeen
                        ? new Date(device.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Never'}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Hardware Telemetry & Health Metrics */}
          <div className="space-y-3" data-testid="drawer-telemetry-section">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {t('fleet.telemetryTitle', { defaultValue: 'Real-time Telemetry & Health' })}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              {/* Battery Card */}
              <div
                data-testid="telemetry-battery-card"
                className={`p-4 rounded-xl border transition ${
                  lowBattery
                    ? 'border-rose-300 bg-rose-50/50'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">{t('devicesList.battery', { defaultValue: 'Battery' })}</span>
                  {isCharging ? (
                    <BatteryCharging className="w-4 h-4 text-emerald-600 animate-pulse" />
                  ) : lowBattery ? (
                    <BatteryWarning className="w-4 h-4 text-rose-600" />
                  ) : (
                    <Battery className="w-4 h-4 text-slate-600" />
                  )}
                </div>
                <div className="flex items-baseline space-x-2">
                  <span data-testid="battery-percentage" className="text-xl font-bold text-slate-800">
                    {batteryPercent !== null ? `${batteryPercent}%` : 'N/A'}
                  </span>
                  {isCharging && (
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      Charging
                    </span>
                  )}
                </div>
                {/* Visual Battery Bar */}
                {batteryPercent !== null && (
                  <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        batteryPercent < 20 ? 'bg-rose-500' : batteryPercent < 50 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${batteryPercent}%` }}
                    />
                  </div>
                )}
                {lowBattery && (
                  <p className="text-[10px] text-rose-600 font-semibold mt-1.5">
                    Critical: Connect terminal to AC power
                  </p>
                )}
              </div>

              {/* Latency Card */}
              <div data-testid="telemetry-latency-card" className="p-4 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">{t('devicesList.latency', { defaultValue: 'Ping Latency' })}</span>
                  <Wifi className="w-4 h-4 text-slate-600" />
                </div>
                <div className="flex items-baseline space-x-2">
                  <span data-testid="latency-value" className="text-xl font-bold text-slate-800">
                    {latency !== undefined ? `${latency} ms` : 'N/A'}
                  </span>
                  {latencyQuality && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${latencyQuality.color}`}>
                      {latencyQuality.text}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Round-trip to API server</p>
              </div>

              {/* Storage Card */}
              <div data-testid="telemetry-storage-card" className="p-4 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">{t('fleet.storage', { defaultValue: 'Storage' })}</span>
                  <HardDrive className="w-4 h-4 text-slate-600" />
                </div>
                <span data-testid="storage-value" className="text-sm font-bold text-slate-800">
                  {storageFree !== undefined ? `${formatBytes(storageFree)} Free` : 'N/A'}
                </span>
                {storagePercent !== null && (
                  <>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          storagePercent > 90 ? 'bg-rose-500' : 'bg-indigo-500'
                        }`}
                        style={{ width: `${storagePercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                      <span>{storagePercent}% Used</span>
                      <span>Total {formatBytes(storageTotal)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Display / Screen Card */}
              <div data-testid="telemetry-screen-card" className="p-4 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">{t('fleet.display', { defaultValue: 'Display' })}</span>
                  <Monitor className="w-4 h-4 text-slate-600" />
                </div>
                <div className="space-y-0.5">
                  <p data-testid="screen-resolution" className="text-sm font-bold text-slate-800">
                    {device.telemetry?.screenResolution || '1920x1080'}
                  </p>
                  <p className="text-[10px] capitalize text-slate-500 font-medium">
                    {device.telemetry?.orientation || 'Landscape'}
                  </p>
                </div>
              </div>
            </div>

            {/* Diagnostic Software Specs */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Client Application Version:</span>
              <span className="font-mono font-semibold text-slate-800">
                {device.telemetry?.appVersion || 'v1.0.0'} (Manifest v{device.currentContentVersion || 1})
              </span>
            </div>
          </div>

          {/* Section 3: Assigned Journeys */}
          <div className="space-y-3" data-testid="drawer-assignments-section">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {t('devicesList.assignedJourneys', { defaultValue: 'Assigned Journeys' })}
                {device.assignments && device.assignments.length > 0 && ` (${device.assignments.length})`}
              </h3>
              {onManageAssignments && (
                <button
                  onClick={() => onManageAssignments(device)}
                  data-testid="drawer-manage-assignments-btn"
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition"
                >
                  {t('devicesList.manageAssignments', { defaultValue: 'Manage Assignments...' })}
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden">
              {device.assignments && device.assignments.length > 0 ? (
                device.assignments.map((assignment: any, idx: number) => {
                  const jId = (assignment.journeyId?._id || assignment.journeyId || '').toString();
                  const journey = journeys.find((j) => j._id === jId);
                  const title = journey?.title || assignment.journeyTitle || assignment.title || `Journey #${idx + 1}`;

                  return (
                    <div
                      key={assignment._id || idx}
                      className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{title}</p>
                          <p className="text-[10px] text-slate-400">
                            Priority Order: {assignment.priority ?? idx + 1}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {assignment.isMandatory && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]">
                            Mandatory
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-[10px]">
                          Active
                        </Badge>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-slate-400">
                  <Layers className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                  <p className="text-xs font-medium text-slate-500">
                    {t('devicesList.noJourneyPaired', { defaultValue: 'No journeys assigned to this terminal.' })}
                  </p>
                  {onManageAssignments && (
                    <button
                      onClick={() => onManageAssignments(device)}
                      className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      + Assign Journeys Now
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Terminal status synced with central registry
          </span>
          <Button variant="default" size="sm" onClick={onClose} data-testid="drawer-close-btn">
            Close Detail View
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DeviceDetailDrawer;
