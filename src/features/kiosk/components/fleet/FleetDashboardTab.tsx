import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Tv,
  CheckCircle2,
  XCircle,
  Wrench,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Battery,
  BatteryCharging,
  BatteryWarning,
  HardDrive,
  Wifi,
  Cpu,
  Trash2,
  ChevronRight,
  Loader2,
  X
} from 'lucide-react';
import { KioskDevice } from '../../../../types/kiosk/device.types';
import { KioskJourney } from '../../../../types/kiosk/journey.types';
import { Card } from '../../../../components/Card';
import { Button } from '../../../../components/Button';
import { Badge } from '../../../../components/Badge';
import { SimplePagination } from '../../../../components/SimplePagination';
import { DeviceDetailDrawer, normalizeBatteryPercent, isLowBattery, formatBytes } from './DeviceDetailDrawer';

export interface FleetDashboardTabProps {
  devices: KioskDevice[];
  journeys: KioskJourney[];
  loading?: boolean;
  onRefreshFleet: () => Promise<void> | void;
  onPairTerminal: () => void;
  onToggleMaintenance: (deviceId: string, currentStatus: string) => Promise<void> | void;
  onDispatchCommand: (deviceId: string, command: string) => Promise<void> | void;
  onRevokeDevice: (deviceId: string, deviceName: string) => Promise<void> | void;
  onManageAssignments: (device: KioskDevice) => void;
}

export function FleetDashboardTab({
  devices,
  journeys,
  loading = false,
  onRefreshFleet,
  onPairTerminal,
  onToggleMaintenance,
  onDispatchCommand,
  onRevokeDevice,
  onManageAssignments
}: FleetDashboardTabProps) {
  const { t } = useTranslation(['kiosk', 'common']);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [deviceTypeFilter, setDeviceTypeFilter] = useState<string>('all');

  // Detail Drawer State
  const [selectedDevice, setSelectedDevice] = useState<KioskDevice | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Derive unique sites/locations
  const uniqueSites = useMemo(() => {
    const sites = new Set<string>();
    devices.forEach((d) => {
      if (d.location) sites.add(d.location);
    });
    return Array.from(sites);
  }, [devices]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const total = devices.length;
    const online = devices.filter((d) => d.status === 'online').length;
    const offline = devices.filter((d) => d.status === 'offline').length;
    const maintenance = devices.filter((d) => d.status === 'maintenance').length;
    const lowBatteryCount = devices.filter((d) => isLowBattery(d.telemetry?.batteryLevel)).length;

    return { total, online, offline, maintenance, lowBatteryCount };
  }, [devices]);

  // Filtered Devices
  const filteredDevices = useMemo(() => {
    return devices.filter((device) => {
      // 1. Search filter (Name, GUID / Device ID, Location)
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchesName = device.name?.toLowerCase().includes(query);
        const matchesGuid = (device.deviceId || device.hardwareGuid)?.toLowerCase().includes(query);
        const matchesLocation = device.location?.toLowerCase().includes(query);
        if (!matchesName && !matchesGuid && !matchesLocation) {
          return false;
        }
      }

      // 2. Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'low_battery') {
          if (!isLowBattery(device.telemetry?.batteryLevel)) return false;
        } else if (device.status !== statusFilter) {
          return false;
        }
      }

      // 3. Site filter
      if (siteFilter !== 'all') {
        if (device.location !== siteFilter) return false;
      }

      // 4. Device Type filter
      if (deviceTypeFilter !== 'all') {
        if (device.deviceType !== deviceTypeFilter) return false;
      }

      return true;
    });
  }, [devices, searchTerm, statusFilter, siteFilter, deviceTypeFilter]);

  // Paginated Data
  const totalItems = filteredDevices.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedDevices = filteredDevices.slice(startIndex, endIndex);

  const handleOpenDrawer = (device: KioskDevice) => {
    setSelectedDevice(device);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedDevice(null);
  };

  return (
    <div className="space-y-6" data-testid="fleet-dashboard-tab">
      {/* 1. Summary Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" data-testid="fleet-summary-cards">
        {/* Total Fleet */}
        <Card
          data-testid="metric-total-fleet"
          onClick={() => {
            setStatusFilter('all');
            setCurrentPage(1);
          }}
          className="p-5 flex items-center space-x-4 border border-slate-200 cursor-pointer hover:border-indigo-300 transition"
        >
          <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600">
            <Tv className="w-6 h-6" />
          </div>
          <div>
            <div data-testid="total-fleet-count" className="text-2xl font-bold text-slate-800">
              {summaryMetrics.total}
            </div>
            <div className="text-xs text-slate-500 font-medium">
              {t('fleet.totalFleet', { defaultValue: 'Total Fleet' })}
            </div>
          </div>
        </Card>

        {/* Online (Green) */}
        <Card
          data-testid="metric-online"
          onClick={() => {
            setStatusFilter('online');
            setCurrentPage(1);
          }}
          className="p-5 flex items-center space-x-4 border border-slate-200 cursor-pointer hover:border-emerald-300 transition"
        >
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div data-testid="online-count" className="text-2xl font-bold text-slate-800">
              {summaryMetrics.online}
            </div>
            <div className="text-xs text-slate-500 font-medium">
              {t('devicesList.onlineTerminals', { defaultValue: 'Online' })}
            </div>
          </div>
        </Card>

        {/* Offline (Red) */}
        <Card
          data-testid="metric-offline"
          onClick={() => {
            setStatusFilter('offline');
            setCurrentPage(1);
          }}
          className="p-5 flex items-center space-x-4 border border-slate-200 cursor-pointer hover:border-rose-300 transition"
        >
          <div className="p-3 rounded-xl bg-rose-50 text-rose-600">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <div data-testid="offline-count" className="text-2xl font-bold text-slate-800">
              {summaryMetrics.offline}
            </div>
            <div className="text-xs text-slate-500 font-medium">
              {t('devicesList.offlineTerminals', { defaultValue: 'Offline' })}
            </div>
          </div>
        </Card>

        {/* Maintenance (Amber) */}
        <Card
          data-testid="metric-maintenance"
          onClick={() => {
            setStatusFilter('maintenance');
            setCurrentPage(1);
          }}
          className="p-5 flex items-center space-x-4 border border-slate-200 cursor-pointer hover:border-amber-300 transition"
        >
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <div data-testid="maintenance-count" className="text-2xl font-bold text-slate-800">
              {summaryMetrics.maintenance}
            </div>
            <div className="text-xs text-slate-500 font-medium">
              {t('devicesList.maintenance', { defaultValue: 'Maintenance' })}
            </div>
          </div>
        </Card>

        {/* Low Battery Warning (<20%) */}
        <Card
          data-testid="metric-low-battery"
          onClick={() => {
            setStatusFilter('low_battery');
            setCurrentPage(1);
          }}
          className={`p-5 flex items-center space-x-4 border cursor-pointer transition ${
            summaryMetrics.lowBatteryCount > 0
              ? 'border-rose-300 bg-rose-50/40 hover:bg-rose-50'
              : 'border-slate-200 hover:border-rose-200'
          }`}
        >
          <div
            className={`p-3 rounded-xl ${
              summaryMetrics.lowBatteryCount > 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'
            }`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div data-testid="low-battery-count" className="text-2xl font-bold text-slate-800">
              {summaryMetrics.lowBatteryCount}
            </div>
            <div className="text-xs text-slate-500 font-medium">
              {t('fleet.lowBatteryWarning', { defaultValue: 'Low Battery (<20%)' })}
            </div>
          </div>
        </Card>
      </div>

      {/* 2. Toolbar & Filter Controls */}
      <Card className="p-4 border border-slate-200 bg-white space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={t('fleet.searchPlaceholder', {
                defaultValue: 'Search by device name, GUID, or location...'
              })}
              data-testid="fleet-search-input"
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onRefreshFleet}
              data-testid="refresh-fleet-btn"
              disabled={loading}
              className="flex items-center space-x-1.5 text-xs text-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{t('fleet.refreshFleet', { defaultValue: 'Refresh Fleet' })}</span>
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={onPairTerminal}
              data-testid="pair-terminal-btn"
              className="flex items-center space-x-1.5 text-xs shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('pairTerminal', { defaultValue: 'Pair Terminal' })}</span>
            </Button>
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center space-x-1.5 text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-semibold text-slate-600">Filters:</span>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            data-testid="status-filter-select"
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium text-xs focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="maintenance">Maintenance</option>
            <option value="low_battery">Low Battery (&lt;20%)</option>
          </select>

          {/* Site Filter */}
          <select
            value={siteFilter}
            onChange={(e) => {
              setSiteFilter(e.target.value);
              setCurrentPage(1);
            }}
            data-testid="site-filter-select"
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium text-xs focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Sites / Locations</option>
            {uniqueSites.map((site) => (
              <option key={site} value={site}>
                {site}
              </option>
            ))}
          </select>

          {/* Device Type Filter */}
          <select
            value={deviceTypeFilter}
            onChange={(e) => {
              setDeviceTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            data-testid="device-type-filter-select"
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium text-xs focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Terminal Types</option>
            <option value="wall_mount">Wall Mount</option>
            <option value="countertop_tablet">Countertop Tablet</option>
            <option value="floor_standing">Floor Standing</option>
            <option value="desktop_terminal">Desktop Terminal</option>
            <option value="rugged_handheld">Rugged Handheld</option>
          </select>

          {/* Reset Filters */}
          {(statusFilter !== 'all' || siteFilter !== 'all' || deviceTypeFilter !== 'all' || searchTerm) && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setSiteFilter('all');
                setDeviceTypeFilter('all');
                setSearchTerm('');
                setCurrentPage(1);
              }}
              data-testid="reset-filters-btn"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
            >
              Reset Filters
            </button>
          )}

          <div className="ml-auto text-slate-400 text-xs">
            Showing {filteredDevices.length} of {devices.length} terminals
          </div>
        </div>
      </Card>

      {/* 3. Devices Registry Table */}
      <Card className="overflow-hidden border border-slate-200 bg-white">
        {loading ? (
          <div className="p-16 text-center text-slate-400" data-testid="fleet-loading">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-500" />
            <p className="text-sm font-medium text-slate-600">
              {t('devicesList.loadingTerminals', { defaultValue: 'Loading fleet status...' })}
            </p>
          </div>
        ) : filteredDevices.length === 0 ? (
          <div className="p-16 text-center text-slate-400" data-testid="fleet-empty">
            <Tv className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p className="font-semibold text-slate-600 text-sm">
              {t('devicesList.emptyTitle', { defaultValue: 'No matching terminals found' })}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Try adjusting your search criteria or register a new terminal.
            </p>
            <Button
              size="sm"
              variant="default"
              onClick={onPairTerminal}
              className="mt-4"
            >
              Pair New Terminal
            </Button>
          </div>
        ) : (
          <div>
            <div className="divide-y divide-slate-100">
              {paginatedDevices.map((device) => {
                const isOnline = device.status === 'online';
                const isMaintenance = device.status === 'maintenance';
                const batteryPercent = normalizeBatteryPercent(device.telemetry?.batteryLevel);
                const lowBattery = isLowBattery(device.telemetry?.batteryLevel);
                const isCharging = device.telemetry?.isCharging ?? false;
                const latency = device.telemetry?.networkLatencyMs;
                const storageFree = device.telemetry?.storageFreeBytes;

                return (
                  <div
                    key={device._id}
                    data-testid="terminal-row"
                    onClick={() => handleOpenDrawer(device)}
                    className="p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-5 hover:bg-slate-50/70 transition cursor-pointer group"
                  >
                    {/* Device Status & Name */}
                    <div className="space-y-1.5 min-w-[260px] max-w-sm">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isOnline
                              ? 'bg-emerald-500 shadow-md shadow-emerald-400/50'
                              : isMaintenance
                              ? 'bg-amber-500 shadow-md shadow-amber-400/50'
                              : 'bg-slate-300'
                          }`}
                        />
                        <h4
                          data-testid="terminal-name"
                          className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition"
                        >
                          {device.name}
                        </h4>
                        <Badge
                          data-testid="device-status-badge"
                          variant={isOnline ? 'default' : isMaintenance ? 'outline' : 'secondary'}
                          className={`text-[10px] py-0 px-2 font-semibold ${
                            isOnline
                              ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
                              : isMaintenance
                              ? 'bg-amber-500/10 text-amber-700 border-amber-500/30'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isOnline ? 'Online' : isMaintenance ? 'Maintenance' : 'Offline'}
                        </Badge>
                        {lowBattery && (
                          <Badge
                            data-testid="low-battery-badge"
                            className="bg-rose-500/10 text-rose-700 border-rose-500/30 text-[9px] font-bold flex items-center space-x-1"
                          >
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>Low Battery (&lt;20%)</span>
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 flex items-center flex-wrap gap-x-1.5">
                        <span data-testid="terminal-location" className="font-semibold text-slate-600">
                          {device.location}
                        </span>
                        <span className="text-slate-300">|</span>
                        <span
                          data-testid="terminal-guid"
                          className="font-mono text-[10px] text-slate-400 truncate max-w-[150px]"
                          title={device.deviceId || device.hardwareGuid}
                        >
                          GUID: {device.deviceId || device.hardwareGuid}
                        </span>
                      </p>
                    </div>

                    {/* Hardware Health Metrics (Battery, Storage, Latency) */}
                    <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100 shrink-0">
                      {/* Visual Battery Indicator */}
                      <div
                        data-testid="terminal-battery-indicator"
                        className={`flex items-center space-x-1.5 px-2 py-1 rounded-lg border text-xs font-semibold ${
                          lowBattery
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        {isCharging ? (
                          <BatteryCharging className="w-4 h-4 text-emerald-600 animate-pulse" />
                        ) : lowBattery ? (
                          <BatteryWarning className="w-4 h-4 text-rose-600" />
                        ) : (
                          <Battery className="w-4 h-4 text-slate-500" />
                        )}
                        <span data-testid="battery-display">
                          {batteryPercent !== null ? `${batteryPercent}%` : 'N/A'}
                        </span>
                      </div>

                      {/* Network Latency */}
                      <div className="flex items-center space-x-1.5 px-2 py-1 bg-white rounded-lg border border-slate-200 text-xs font-semibold text-slate-700">
                        <Wifi className="w-3.5 h-3.5 text-slate-400" />
                        <span data-testid="latency-display">{latency !== undefined ? `${latency}ms` : 'N/A'}</span>
                      </div>

                      {/* Free Storage */}
                      <div className="flex items-center space-x-1.5 px-2 py-1 bg-white rounded-lg border border-slate-200 text-xs font-semibold text-slate-700">
                        <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                        <span>{storageFree !== undefined ? formatBytes(storageFree) : 'N/A'}</span>
                      </div>

                      {/* App Version */}
                      <div className="flex items-center space-x-1.5 px-2 py-1 bg-white rounded-lg border border-slate-200 text-xs font-mono text-slate-600">
                        <Cpu className="w-3.5 h-3.5 text-slate-400" />
                        <span>{device.telemetry?.appVersion || 'v1.0.0'}</span>
                      </div>
                    </div>

                    {/* Assigned Content Journeys */}
                    <div className="flex flex-col space-y-1 min-w-[180px] max-w-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {t('devicesList.assignedJourneys', { defaultValue: 'Assigned Journeys' })}
                        {device.assignments && device.assignments.length > 0 && ` (${device.assignments.length})`}
                      </span>
                      <div className="flex flex-wrap gap-1 items-center">
                        {device.assignments && device.assignments.length > 0 ? (
                          device.assignments.slice(0, 2).map((a: any, idx: number) => {
                            const jId = (a.journeyId?._id || a.journeyId || '').toString();
                            const journey = journeys.find((j) => j._id === jId);
                            const title = journey?.title || a.journeyTitle || a.title || `Journey #${idx + 1}`;
                            return (
                              <span
                                key={a._id || idx}
                                className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 truncate max-w-[130px]"
                              >
                                #{idx + 1} {title}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-xs text-slate-400 italic">No journeys assigned</span>
                        )}
                        {device.assignments && device.assignments.length > 2 && (
                          <span className="text-[10px] text-slate-400 font-semibold">
                            +{device.assignments.length - 2} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions and Detail Opener */}
                    <div
                      className="flex items-center space-x-2"
                      onClick={(e) => e.stopPropagation()} // Prevent row click when pressing buttons
                    >
                      <button
                        data-testid={`inspect-device-${device._id}`}
                        onClick={() => handleOpenDrawer(device)}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:border-indigo-300 hover:text-indigo-600 transition flex items-center space-x-1"
                        title="Open terminal diagnostic view"
                      >
                        <span>Inspect</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition" />
                      </button>

                      <button
                        data-testid={`toggle-maintenance-${device._id}`}
                        onClick={() => onToggleMaintenance(device._id, device.status)}
                        className={`px-2 py-1.5 bg-white border rounded-lg text-xs font-semibold transition flex items-center space-x-1 ${
                          isMaintenance
                            ? 'border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                        title={isMaintenance ? 'Resume operation' : 'Enter maintenance mode'}
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>{isMaintenance ? 'Exit' : 'Maint.'}</span>
                      </button>

                      <button
                        data-testid={`revoke-device-${device._id}`}
                        onClick={() => onRevokeDevice(device._id, device.name)}
                        className="p-1.5 bg-white border border-rose-200 text-rose-600 rounded-lg text-xs font-semibold hover:bg-rose-50 transition"
                        title="Revoke device registration"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <SimplePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                startIndex={startIndex}
                endIndex={endIndex}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                itemLabel={t('devicesList.terminalsLabel', { defaultValue: 'terminals' })}
              />
            </div>
          </div>
        )}
      </Card>

      {/* 4. Slide-over Device Detail Drawer */}
      <DeviceDetailDrawer
        device={selectedDevice}
        isOpen={drawerOpen}
        onClose={handleCloseDrawer}
        journeys={journeys}
        onToggleMaintenance={onToggleMaintenance}
        onDispatchCommand={onDispatchCommand}
        onRevokeDevice={onRevokeDevice}
        onManageAssignments={onManageAssignments}
      />
    </div>
  );
}

export default FleetDashboardTab;
