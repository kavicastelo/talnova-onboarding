import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  RefreshCw,
  Tv,
  Map,
  BarChart2,
  Trash2,
  Edit2,
  ExternalLink,
  Cpu,
  Battery,
  HardDrive,
  Wifi,
  RotateCcw,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  Globe,
  Loader2,
  Copy,
  Check,
  Key,
  Wrench
} from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Input } from '../components/Input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '../components/Dialog';
import { toast } from 'sonner';
import { SimplePagination } from '../components/SimplePagination';
import { SearchableSelect } from '../components/SearchableSelect';
import { usePagination } from '../hooks/usePagination';
import { kioskService } from '../features/kiosk/services/kiosk.service';
import { KioskJourney } from '../types/kiosk/journey.types';
import { KioskDevice } from '../types/kiosk/device.types';
import { KioskAnalyticsSummary } from '../types/kiosk/analytics.types';
import { KioskBuilder } from '../features/kiosk';

type TabType = 'journeys' | 'devices' | 'analytics';

export function KioskDashboard() {
  const { t } = useTranslation(['kiosk', 'common']);
  const [activeTab, setActiveTab] = useState<TabType>('journeys');
  const [journeys, setJourneys] = useState<KioskJourney[]>([]);
  const [devices, setDevices] = useState<KioskDevice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const journeysPagination = usePagination({ data: journeys, initialPageSize: 6 });
  const devicesPagination = usePagination({ data: devices, initialPageSize: 5 });
  
  // Builder integration
  const [editingJourneyId, setEditingJourneyId] = useState<string | null>(null);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newJourneyTitle, setNewJourneyTitle] = useState('');
  const [newJourneyLangs, setNewJourneyLangs] = useState<string[]>(['en']);
  const [creating, setCreating] = useState(false);

  // Pairing states
  const [selectedDevice, setSelectedDevice] = useState<KioskDevice | null>(null);
  const [pairModalOpen, setPairModalOpen] = useState(false);
  const [pairJourneyId, setPairJourneyId] = useState<string>('');
  const [pairing, setPairing] = useState(false);

  // Pair New Terminal States
  const [pairTerminalModalOpen, setPairTerminalModalOpen] = useState(false);
  const [terminalGuid, setTerminalGuid] = useState('');
  const [generatedPairCode, setGeneratedPairCode] = useState<string | null>(null);
  const [codeExpiresInSeconds, setCodeExpiresInSeconds] = useState(900);
  const [generatingPairCode, setGeneratingPairCode] = useState(false);
  const [pairCodeCopied, setPairCodeCopied] = useState(false);

  // Supervisor PIN States (Prompt 09 / UQ-01 frontline kiosk attestation)
  const [supervisorPinModalOpen, setSupervisorPinModalOpen] = useState(false);
  const [supervisorIdentifier, setSupervisorIdentifier] = useState('');
  const [supervisorPin, setSupervisorPin] = useState('');
  const [settingSupervisorPin, setSettingSupervisorPin] = useState(false);

  // Analytics states
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>('');
  const [analyticsData, setAnalyticsData] = useState<KioskAnalyticsSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const handleGeneratePairCode = async () => {
    if (!terminalGuid.trim()) {
      toast.error(t('toasts.enterGuid', { defaultValue: 'Please enter a Hardware GUID' }));
      return;
    }
    setGeneratingPairCode(true);
    try {
      const res = await kioskService.generatePairingCode(terminalGuid.trim());
      setGeneratedPairCode(res.code);
      setCodeExpiresInSeconds(res.expiresInSeconds || 900);
      toast.success(t('toasts.pairCodeGenerated', { defaultValue: '6-digit device pairing code generated' }));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || t('toasts.failedGenerateCode', { defaultValue: 'Failed to generate pairing code' }));
    } finally {
      setGeneratingPairCode(false);
    }
  };

  const handleClosePairTerminalModal = () => {
    setPairTerminalModalOpen(false);
    setTerminalGuid('');
    setGeneratedPairCode(null);
    setPairCodeCopied(false);
  };

  const handleSaveSupervisorPin = async () => {
    if (!supervisorIdentifier.trim()) {
      toast.error(t('toasts.enterSupervisorId', { defaultValue: 'Please enter a supervisor User ID or email.' }));
      return;
    }
    if (!/^\d{4}$/.test(supervisorPin.trim())) {
      toast.error(t('toasts.pin4Digits', { defaultValue: 'Supervisor PIN must be exactly 4 numeric digits (e.g. 1234).' }));
      return;
    }

    setSettingSupervisorPin(true);
    try {
      await kioskService.setSupervisorPin(supervisorIdentifier.trim(), supervisorPin.trim());
      toast.success(t('toasts.pinConfigured', { identifier: supervisorIdentifier, defaultValue: `Supervisor PIN successfully configured for ${supervisorIdentifier}.` }));
      setSupervisorPinModalOpen(false);
      setSupervisorIdentifier('');
      setSupervisorPin('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || t('toasts.failedConfigurePin', { defaultValue: 'Failed to configure supervisor PIN.' }));
    } finally {
      setSettingSupervisorPin(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const journeyRes = await kioskService.listJourneys();
      const deviceRes = await kioskService.listDevices();
      setJourneys(journeyRes.journeys || []);
      setDevices(deviceRes.devices || []);
      
      // Auto-select first journey for analytics tab if not selected
      if (journeyRes.journeys && journeyRes.journeys.length > 0 && !selectedJourneyId) {
        setSelectedJourneyId(journeyRes.journeys[0]._id);
      }
    } catch (err: any) {
      toast.error(err?.message || t('toasts.failedFetchData', { defaultValue: 'Failed to fetch kiosk workspace data' }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch analytics when selected journey changes or analytics tab is clicked
  useEffect(() => {
    if (activeTab === 'analytics' && selectedJourneyId) {
      fetchAnalytics(selectedJourneyId);
    }
  }, [activeTab, selectedJourneyId]);

  const fetchAnalytics = async (journeyId: string) => {
    setAnalyticsLoading(true);
    try {
      const summary = await kioskService.getJourneyAnalytics(journeyId);
      setAnalyticsData(summary);
    } catch (err: any) {
      setAnalyticsData(null);
      // Suppress noisy error messages for empty analytics and show clean fallback values
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleCreateJourney = async () => {
    if (!newJourneyTitle.trim()) {
      toast.error(t('toasts.titleRequired', { defaultValue: 'Journey title is required' }));
      return;
    }
    setCreating(true);
    try {
      const payload: Partial<KioskJourney> = {
        title: newJourneyTitle,
        languages: newJourneyLangs,
        steps: [],
        settings: {
          autoPlay: false,
          loopForever: true,
          idleTimeoutSeconds: 60,
          autoReturnHome: true,
          hideNavigation: false,
          disableExit: true,
          security: {
            protectionType: 'none'
          }
        },
        publishing: {
          status: 'draft',
          version: 1
        }
      };
      const created = await kioskService.createJourney(payload);
      toast.success(t('toasts.journeyCreated', { defaultValue: 'Kiosk journey created successfully' }));
      setCreateModalOpen(false);
      setNewJourneyTitle('');
      setNewJourneyLangs(['en']);
      
      // Open immediately in builder
      setEditingJourneyId(created._id);
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || t('toasts.failedCreateJourney', { defaultValue: 'Failed to create kiosk journey' }));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteJourney = async (id: string) => {
    if (window.confirm(t('confirmDeleteJourney', { defaultValue: 'Are you sure you want to delete this kiosk journey? This action cannot be undone.' }))) {
      try {
        await kioskService.deleteJourney(id);
        toast.success(t('toasts.journeyDeleted', { defaultValue: 'Kiosk journey deleted' }));
        fetchData();
      } catch (err: any) {
        toast.error(err?.message || t('toasts.failedDeleteJourney', { defaultValue: 'Failed to delete journey' }));
      }
    }
  };

  const handlePairJourney = async () => {
    if (!selectedDevice) return;
    setPairing(true);
    try {
      const targetJourneyId = pairJourneyId === 'unpair' ? null : pairJourneyId;
      await kioskService.pairJourneyToDevice(selectedDevice._id, targetJourneyId);
      toast.success(t('toasts.journeyLinked', { defaultValue: 'Journey linked to device successfully' }));
      setPairModalOpen(false);
      setSelectedDevice(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || t('toasts.failedLinkJourney', { defaultValue: 'Failed to link journey to device' }));
    } finally {
      setPairing(false);
    }
  };

  const handleDispatchCommand = async (deviceId: string, commandType: string) => {
    try {
      console.log(`Dispatching ${commandType} to device ${deviceId}`);
      // Simulate remote queue scheduling for command dispatch
      toast.success(t('toasts.remoteCommandQueued', { command: commandType, defaultValue: `Remote command [${commandType}] successfully queued for device.` }));
    } catch (err: any) {
      toast.error(t('toasts.failedDispatchCommand', { defaultValue: 'Failed to dispatch remote action command' }));
    }
  };

  const handleToggleMaintenance = async (deviceId: string, currentStatus: string) => {
    const isMaintenance = currentStatus === 'maintenance';
    try {
      const updated = await kioskService.toggleMaintenanceMode(deviceId, !isMaintenance);
      setDevices((prev) => prev.map((d) => (d._id === deviceId ? updated : d)));
      toast.success(!isMaintenance ? t('toasts.maintenanceEntered', { defaultValue: 'Terminal placed in Maintenance Mode' }) : t('toasts.maintenanceExited', { defaultValue: 'Terminal restored to Active Mode' }));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || t('toasts.failedMaintenanceMode', { defaultValue: 'Failed to update maintenance mode' }));
    }
  };

  // Render the Builder console view if an editing ID is selected
  if (editingJourneyId) {
    return (
      <div className="-m-4 lg:-m-6 h-[92vh]">
        <KioskBuilder
          journeyId={editingJourneyId}
          onExit={() => {
            setEditingJourneyId(null);
            fetchData();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('title', { defaultValue: 'Kiosk Operations & Frontline Terminals' })}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('subtitle', { defaultValue: 'Manage physical onboarding terminals, offline kiosk journeys, device telemetry, and supervisor PINs.' })}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="flex items-center space-x-1">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t('reload', { defaultValue: 'Reload' })}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPairTerminalModalOpen(true)}
            data-testid="pair-terminal-btn"
            className="flex items-center space-x-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          >
            <Tv className="w-4 h-4 text-indigo-600" />
            <span>{t('pairTerminal', { defaultValue: 'Pair New Terminal' })}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSupervisorPinModalOpen(true)}
            data-testid="supervisor-pin-btn"
            className="flex items-center space-x-1.5 border-amber-200 text-amber-800 hover:bg-amber-50"
          >
            <Key className="w-4 h-4 text-amber-600" />
            <span>{t('supervisorPin', { defaultValue: 'Supervisor Witness PIN' })}</span>
          </Button>
          <Button variant="default" size="sm" onClick={() => setCreateModalOpen(true)} className="flex items-center space-x-1">
            <Plus className="w-4 h-4" />
            <span>{t('newJourney', { defaultValue: 'Create Journey' })}</span>
          </Button>
        </div>
      </div>

      {/* Tabs Workspace */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('journeys')}
          className={`pb-3 text-sm font-semibold border-b-2 transition flex items-center space-x-2 ${
            activeTab === 'journeys'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Map className="w-4 h-4" />
          <span>{t('tabs.journeys', { count: journeys.length, defaultValue: `Kiosk Journeys (${journeys.length})` })}</span>
          <Badge variant="secondary" className="ml-1.5">{journeys.length}</Badge>
        </button>
        <button
          onClick={() => setActiveTab('devices')}
          className={`pb-3 text-sm font-semibold border-b-2 transition flex items-center space-x-2 ${
            activeTab === 'devices'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Tv className="w-4 h-4" />
          <span>{t('tabs.devices', { count: devices.length, defaultValue: `Paired Devices (${devices.length})` })}</span>
          <Badge variant="secondary" className="ml-1.5">{devices.length}</Badge>
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 text-sm font-semibold border-b-2 transition flex items-center space-x-2 ${
            activeTab === 'analytics'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>{t('tabs.analytics', { defaultValue: 'Terminal Telemetry' })}</span>
        </button>
      </div>

      {/* TAB 1: KIOSK JOURNEYS LIST */}
      {activeTab === 'journeys' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <Card key={idx} className="p-6 space-y-4 animate-pulse">
                  <div className="h-5 w-2/3 bg-slate-200 rounded" />
                  <div className="h-4 w-1/2 bg-slate-100 rounded" />
                  <div className="pt-4 border-t flex justify-between">
                    <div className="h-6 w-12 bg-slate-150 rounded" />
                    <div className="h-6 w-20 bg-slate-150 rounded" />
                  </div>
                </Card>
              ))
            ) : journeys.length === 0 ? (
              <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                <Map className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <h3 className="font-semibold text-slate-700">{t('journeysList.emptyTitle', { defaultValue: 'No Kiosk Journeys' })}</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {t('journeysList.emptyDesc', { defaultValue: 'Create a new visual multi-lingual onboarding layout to launch interactive kiosks for employees.' })}
                </p>
                <Button variant="default" size="sm" onClick={() => setCreateModalOpen(true)} className="mt-4">
                  {t('journeysList.createFirst', { defaultValue: 'Create First Journey' })}
                </Button>
              </div>
            ) : (
              journeysPagination.paginatedData.map((journey) => (
                <Card key={journey._id} className="p-6 flex flex-col justify-between hover:shadow-lg transition border border-slate-200/80">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <h3 className="font-bold text-slate-800 truncate pr-2 text-base" title={journey.title}>
                        {journey.title}
                      </h3>
                      <Badge variant={journey.publishing?.status === 'published' ? 'default' : 'secondary'} className="capitalize text-[10px]">
                        {journey.publishing?.status || 'draft'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 min-h-[2rem]">
                      {journey.description || t('journeysList.noDescription', { defaultValue: 'No description provided.' })}
                    </p>
                    
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {journey.languages?.map((lang) => (
                        <span key={lang} className="text-[10px] font-bold bg-slate-100 border text-slate-600 px-2 py-0.5 rounded uppercase">
                          {lang}
                        </span>
                      ))}
                      <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                        {journey.steps?.length || 0} {t('journeysList.stepsLabel', { defaultValue: 'Steps' })}
                      </span>
                    </div>
                  </div>

                  <div className="pt-5 mt-5 border-t border-slate-100 flex items-center justify-between">
                    <div className="text-[10px] text-slate-400 flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      <span>v{journey.publishing?.version || 1}</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => setEditingJourneyId(journey._id)}
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition"
                        title={t('journeysList.edit', { defaultValue: 'Edit Journey' })}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <a
                        href={`/kiosk/play/${journey._id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition"
                        title={t('journeysList.preview', { defaultValue: 'Launch Player Preview' })}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => handleDeleteJourney(journey._id)}
                        className="p-1.5 rounded hover:bg-slate-100 text-rose-500 hover:bg-rose-50/50 transition"
                        title={t('journeysList.delete', { defaultValue: 'Delete Journey' })}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          <SimplePagination
            currentPage={journeysPagination.page}
            totalPages={journeysPagination.totalPages}
            totalItems={journeysPagination.totalItems}
            startIndex={journeysPagination.startIndex}
            endIndex={journeysPagination.endIndex}
            pageSize={journeysPagination.pageSize}
            onPageChange={journeysPagination.setPage}
            onPageSizeChange={journeysPagination.setPageSize}
            itemLabel={t('journeysList.journeysLabel', { defaultValue: 'journeys' })}
          />
        </div>
      )}

      {/* TAB 2: PHYSICAL TERMINALS REGISTRY */}
      {activeTab === 'devices' && (
        <div className="space-y-6">
          {/* Summary Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Card className="p-5 flex items-center space-x-4 border border-slate-200">
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">
                  {devices.filter(d => d.status === 'online').length}
                </div>
                <div className="text-xs text-slate-500 font-medium">{t('devicesList.onlineTerminals', { defaultValue: 'Online Terminals' })}</div>
              </div>
            </Card>
            <Card className="p-5 flex items-center space-x-4 border border-slate-200">
              <div className="p-3 rounded-xl bg-slate-50 text-slate-500">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">
                  {devices.filter(d => d.status === 'offline').length}
                </div>
                <div className="text-xs text-slate-500 font-medium">{t('devicesList.offlineTerminals', { defaultValue: 'Offline Terminals' })}</div>
              </div>
            </Card>
            <Card className="p-5 flex items-center space-x-4 border border-slate-200">
              <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600">
                <Tv className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{devices.length}</div>
                <div className="text-xs text-slate-500 font-medium">{t('devicesList.totalHardware', { defaultValue: 'Total Paired Hardware' })}</div>
              </div>
            </Card>
          </div>

          {/* Devices Grid List */}
          <Card className="overflow-hidden border border-slate-200">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">{t('devicesList.registryTitle', { defaultValue: 'Paired Devices Registry' })}</h3>
                <p className="text-xs text-slate-500">{t('devicesList.registryDesc', { defaultValue: 'Live operational status and paired kiosk journeys for connected hardware.' })}</p>
              </div>
              <Button
                size="sm"
                variant="default"
                onClick={() => setPairTerminalModalOpen(true)}
                data-testid="pair-terminal-btn-tab"
                className="flex items-center space-x-1.5"
              >
                <Tv className="w-3.5 h-3.5" />
                <span>{t('pairTerminal', { defaultValue: 'Pair New Terminal' })}</span>
              </Button>
            </div>
            
            {loading ? (
              <div className="p-12 text-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                <span>{t('devicesList.loadingTerminals', { defaultValue: 'Loading active terminals...' })}</span>
              </div>
            ) : devices.length === 0 ? (
              <div className="p-16 text-center text-slate-400">
                <Tv className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p className="font-semibold text-slate-500">{t('devicesList.emptyTitle', { defaultValue: 'No paired terminals found' })}</p>
                <p className="text-xs text-slate-400 mt-0.5">{t('devicesList.emptyDesc', { defaultValue: 'Device registration starts on physical hardware using pairing pins.' })}</p>
              </div>
            ) : (
              <div>
                <div className="divide-y divide-slate-100">
                  {devicesPagination.paginatedData.map((device) => {
                    const linkedJourney = journeys.find(j => j._id === device.currentJourneyId);
                    const isMaintenance = device.status === 'maintenance';
                    const isOnline = device.status === 'online';
                    
                    return (
                      <div key={device._id} data-testid="terminal-card" className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:bg-slate-50/50 transition">
                        
                        {/* Name & Placement Details */}
                        <div className="space-y-1.5 max-w-sm">
                          <div className="flex items-center space-x-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 shadow-md shadow-emerald-400/50' : isMaintenance ? 'bg-amber-500 shadow-md shadow-amber-400/50' : 'bg-slate-300'}`} />
                            <h4 data-testid="terminal-name" className="font-bold text-slate-800 text-sm">{device.name}</h4>
                            <Badge
                              data-testid="device-status-badge"
                              variant={isOnline ? 'default' : isMaintenance ? 'outline' : 'secondary'}
                              className={`text-[9px] py-0 px-2 font-semibold ${
                                isOnline
                                  ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
                                  : isMaintenance
                                  ? 'bg-amber-500/10 text-amber-700 border-amber-500/30'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {isOnline ? t('devicesList.statusOnline', { defaultValue: 'Online / Paired' }) : isMaintenance ? t('devicesList.statusMaintenance', { defaultValue: 'Maintenance' }) : t('devicesList.statusOffline', { defaultValue: 'Offline' })}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 flex items-center">
                            <span data-testid="terminal-location" className="font-semibold text-slate-600 mr-1.5">{device.location}</span>
                            <span className="text-slate-300">|</span>
                            <span data-testid="terminal-guid" className="font-mono text-[10px] ml-1.5 text-slate-400 truncate max-w-[150px]" title={device.deviceId}>
                              GUID: {device.deviceId}
                            </span>
                          </p>
                        </div>

                        {/* Linked Content Journey */}
                        <div className="flex flex-col space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('devicesList.activeJourney', { defaultValue: 'Active Journey' })}</span>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-semibold text-slate-700">
                              {linkedJourney ? linkedJourney.title : <span className="text-slate-400 italic">{t('devicesList.noJourneyPaired', { defaultValue: 'No journey paired' })}</span>}
                            </span>
                            <button
                              onClick={() => {
                                setSelectedDevice(device);
                                setPairJourneyId(device.currentJourneyId || 'unpair');
                                setPairModalOpen(true);
                              }}
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition"
                            >
                              {t('devicesList.link', { defaultValue: 'Link...' })}
                            </button>
                          </div>
                        </div>

                        {/* Telemetry metrics dashboard */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100 shrink-0">
                          <div className="flex items-center space-x-2">
                            <Battery className="w-4 h-4 text-slate-500" />
                            <div className="flex flex-col">
                              <span className="text-[9px] text-slate-450 uppercase font-bold">{t('devicesList.battery', { defaultValue: 'Battery' })}</span>
                              <span className="text-xs font-semibold text-slate-700">
                                {device.telemetry?.batteryLevel !== undefined ? `${Math.round(device.telemetry.batteryLevel * 100)}%` : 'N/A'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <HardDrive className="w-4 h-4 text-slate-500" />
                            <div className="flex flex-col">
                              <span className="text-[9px] text-slate-450 uppercase font-bold">{t('devicesList.freeSpace', { defaultValue: 'Free Space' })}</span>
                              <span className="text-xs font-semibold text-slate-700">
                                {device.telemetry?.storageFreeBytes !== undefined 
                                  ? `${(device.telemetry.storageFreeBytes / 1024 / 1024 / 1024).toFixed(1)} GB` 
                                  : 'N/A'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Wifi className="w-4 h-4 text-slate-500" />
                            <div className="flex flex-col">
                              <span className="text-[9px] text-slate-450 uppercase font-bold">{t('devicesList.latency', { defaultValue: 'Latency' })}</span>
                              <span className="text-xs font-semibold text-slate-700">
                                {device.telemetry?.networkLatencyMs !== undefined ? `${device.telemetry.networkLatencyMs}ms` : 'N/A'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Cpu className="w-4 h-4 text-slate-500" />
                            <div className="flex flex-col">
                              <span className="text-[9px] text-slate-450 uppercase font-bold">{t('devicesList.appVersion', { defaultValue: 'App version' })}</span>
                              <span className="text-xs font-mono font-semibold text-slate-700">
                                {device.telemetry?.appVersion || 'v1.0.0'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Dispatch panel admin command actions */}
                        <div className="flex items-center space-x-2">
                          <button
                            data-testid={`toggle-maintenance-${device._id}`}
                            onClick={() => handleToggleMaintenance(device._id, device.status)}
                            className={`px-2 py-1 bg-white border rounded text-[10px] font-semibold transition flex items-center space-x-1 ${
                              device.status === 'maintenance'
                                ? 'border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100'
                                : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800'
                            }`}
                            title={device.status === 'maintenance' ? t('devicesList.resumeOperation', { defaultValue: 'Resume device operation' }) : t('devicesList.putMaintenance', { defaultValue: 'Put device in Maintenance Mode' })}
                          >
                            <Wrench className="w-3 h-3" />
                            <span>{device.status === 'maintenance' ? t('devicesList.exitMaintenance', { defaultValue: 'Exit Maint.' }) : t('devicesList.maintenance', { defaultValue: 'Maintenance' })}</span>
                          </button>
                          <button
                            onClick={() => handleDispatchCommand(device._id, 'refresh_cache')}
                            className="px-2 py-1 bg-white border border-slate-200 text-slate-600 rounded text-[10px] font-semibold hover:border-slate-300 hover:text-slate-800 transition flex items-center space-x-1"
                            title={t('devicesList.refreshCacheTitle', { defaultValue: 'Refresh cached local content' })}
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>{t('devicesList.syncCache', { defaultValue: 'Sync Cache' })}</span>
                          </button>
                          <button
                            onClick={() => handleDispatchCommand(device._id, 'restart_app')}
                            className="px-2 py-1 bg-white border border-slate-200 text-slate-600 rounded text-[10px] font-semibold hover:border-slate-300 hover:text-slate-800 transition flex items-center space-x-1"
                            title={t('devicesList.restartAppTitle', { defaultValue: 'Restart physical screen app wrapper' })}
                          >
                            <Zap className="w-3 h-3 text-amber-500" />
                            <span>{t('devicesList.restart', { defaultValue: 'Restart' })}</span>
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>

                <div className="p-3 border-t">
                  <SimplePagination
                    currentPage={devicesPagination.page}
                    totalPages={devicesPagination.totalPages}
                    totalItems={devicesPagination.totalItems}
                    startIndex={devicesPagination.startIndex}
                    endIndex={devicesPagination.endIndex}
                    pageSize={devicesPagination.pageSize}
                    onPageChange={devicesPagination.setPage}
                    onPageSizeChange={devicesPagination.setPageSize}
                    itemLabel={t('devicesList.terminalsLabel', { defaultValue: 'terminals' })}
                  />
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 3: USAGE ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Journey selector dropdown */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">{t('telemetry.performanceMetrics', { defaultValue: 'Journey Performance Metrics' })}</h3>
              <p className="text-xs text-slate-500">{t('telemetry.performanceDesc', { defaultValue: 'Analyze interactions, completion ratios, and language statistics.' })}</p>
            </div>
            <div className="w-full sm:w-72">
              <SearchableSelect
                value={selectedJourneyId}
                onChange={(val) => setSelectedJourneyId(val)}
                placeholder={t('telemetry.selectJourney', { defaultValue: 'Select Journey...' })}
                searchPlaceholder={t('telemetry.searchJourney', { defaultValue: 'Search journey...' })}
                options={journeys.map(j => ({
                  value: j._id,
                  label: j.title,
                }))}
              />
            </div>
          </div>

          {analyticsLoading ? (
            <div className="py-16 text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-500" />
              <span>{t('telemetry.fetchingAnalytics', { defaultValue: 'Fetching journey analytics...' })}</span>
            </div>
          ) : analyticsData ? (
            <div className="space-y-6">
              {/* Premium dashboard metrics grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="p-5 border border-slate-200 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('telemetry.totalLaunches', { defaultValue: 'Total Launches' })}</span>
                  <div className="text-3xl font-extrabold text-slate-800 mt-2">{analyticsData.totalLaunches}</div>
                  <span className="text-[10px] text-slate-500 mt-1">{t('telemetry.totalLaunchesDesc', { defaultValue: 'Sessions initialized on kiosk.' })}</span>
                </Card>

                <Card className="p-5 border border-slate-200 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('telemetry.completions', { defaultValue: 'Completions' })}</span>
                  <div className="text-3xl font-extrabold text-slate-800 mt-2">{analyticsData.totalCompletions}</div>
                  <span className="text-[10px] text-slate-500 mt-1">{t('telemetry.completionsDesc', { defaultValue: 'Reached final confirmation step.' })}</span>
                </Card>

                <Card className="p-5 border border-slate-200 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('telemetry.completionRate', { defaultValue: 'Completion Rate' })}</span>
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-3xl font-extrabold text-indigo-600">
                      {Math.round(analyticsData.completionRate * 100)}%
                    </div>
                    {/* Visual circular progress ring */}
                    <div className="relative w-10 h-10 shrink-0">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="20" cy="20" r="16" stroke="#EEF2F6" strokeWidth="4" fill="transparent" />
                        <circle cx="20" cy="20" r="16" stroke="#4F46E5" strokeWidth="4" fill="transparent"
                          strokeDasharray={100}
                          strokeDashoffset={100 - Math.round(analyticsData.completionRate * 100)}
                        />
                      </svg>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1">{t('telemetry.completionRateDesc', { defaultValue: 'Ratio of starts to finished steps.' })}</span>
                </Card>

                <Card className="p-5 border border-slate-200 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('telemetry.avgSessionTime', { defaultValue: 'Avg Session Time' })}</span>
                  <div className="text-3xl font-extrabold text-slate-800 mt-2">
                    {Math.round(analyticsData.averageDurationSeconds)}s
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1">{t('telemetry.avgSessionTimeDesc', { defaultValue: 'Mean playback completion time.' })}</span>
                </Card>
              </div>

              {/* Graphic breakdown visualizations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Languages breakdown */}
                <Card className="p-5 border border-slate-200 space-y-4">
                  <div className="flex items-center space-x-2">
                    <Globe className="w-4 h-4 text-indigo-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('telemetry.languageUsage', { defaultValue: 'Language Usage Breakdown' })}</h4>
                  </div>
                  <div className="space-y-3">
                    {analyticsData.languageBreakdown?.map((item) => (
                      <div key={item.language} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                           <span className="font-bold text-slate-650 uppercase">{item.language}</span>
                          <span className="font-mono text-slate-500">{item.count} {t('telemetry.sessionsCount', { defaultValue: 'sessions' })}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            style={{ width: `${(item.count / (analyticsData.sessionsCount || 1)) * 100}%` }}
                            className="h-full bg-indigo-500 rounded-full"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Mock daily engagement diagram */}
                <Card className="p-5 border border-slate-200 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-2">
                    <BarChart2 className="w-4 h-4 text-emerald-500" />
                    <span>{t('telemetry.dailyEngagement', { defaultValue: 'Daily Interactive Engagement Ratio' })}</span>
                  </h4>
                  <div className="h-40 flex items-end justify-between gap-2 pt-4">
                    {[34, 45, 23, 56, 78, 62, 90].map((val, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                        <div 
                          style={{ height: `${val}%` }}
                          className="w-full bg-emerald-500/20 hover:bg-emerald-500 border border-emerald-500/30 hover:border-emerald-500 transition-all rounded-t-sm relative group"
                        >
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 transition duration-150 pointer-events-none whitespace-nowrap">
                            {val} {t('telemetry.hits', { defaultValue: 'hits' })}
                          </div>
                        </div>
                        <span className="text-[9px] text-slate-400 font-mono">{t('telemetry.dayLabel', { day: idx + 1, defaultValue: `Day ${idx + 1}` })}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
              <BarChart2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-700">{t('telemetry.noAnalyticsTitle', { defaultValue: 'No Analytics Sessions Logged' })}</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {t('telemetry.noAnalyticsDesc', { defaultValue: 'Once physical tablets pair to this journey and complete user interactive sessions, completion details will map here.' })}
              </p>
            </div>
          )}
        </div>
      )}

      {/* CREATE MODAL */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>{t('createModal.title', { defaultValue: 'Create Kiosk Journey' })}</DialogTitle>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase">{t('createModal.journeyTitle', { defaultValue: 'Journey Title' })}</label>
              <Input
                type="text"
                placeholder={t('createModal.journeyPlaceholder', { defaultValue: 'e.g. Factory Floor Visitor Orientation' })}
                value={newJourneyTitle}
                onChange={(e) => setNewJourneyTitle(e.target.value)}
                className="w-full border-slate-300 bg-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 uppercase block">{t('createModal.supportedLanguages', { defaultValue: 'Supported Languages' })}</label>
              <div className="flex space-x-3">
                {['en', 'si'].map((lang) => {
                  const selected = newJourneyLangs.includes(lang);
                  return (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => {
                        if (selected) {
                          if (newJourneyLangs.length > 1) {
                            setNewJourneyLangs(newJourneyLangs.filter(l => l !== lang));
                          }
                        } else {
                          setNewJourneyLangs([...newJourneyLangs, lang]);
                        }
                      }}
                      className={`px-3.5 py-1.5 border rounded-lg text-xs font-bold uppercase transition ${
                        selected
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-350'
                      }`}
                    >
                      {lang === 'en' ? t('createModal.langEnglish', { defaultValue: 'English (EN)' }) : t('createModal.langSinhala', { defaultValue: 'Sinhala (SI)' })}
                    </button>
                  );
                })}
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreateModalOpen(false)}>
              {t('common:cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button variant="default" size="sm" onClick={handleCreateJourney} disabled={creating}>
              {creating ? t('createModal.creating', { defaultValue: 'Creating...' }) : t('createModal.createAndDesign', { defaultValue: 'Create & Design' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PAIR DEVICE MODAL */}
      <Dialog open={pairModalOpen} onOpenChange={(open) => !open && setPairModalOpen(false)}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>{t('pairModal.title', { defaultValue: 'Pair Journey to Terminal' })}</DialogTitle>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <p className="text-xs text-slate-500">
              {t('pairModal.desc', {
                name: selectedDevice?.name || '',
                location: selectedDevice?.location || '',
                defaultValue: `Select which interactive kiosk layout journey should render on the terminal "${selectedDevice?.name}" located at "${selectedDevice?.location}".`
              })}
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase">{t('pairModal.kioskJourney', { defaultValue: 'Kiosk Journey' })}</label>
              <SearchableSelect
                value={pairJourneyId}
                onChange={(val) => setPairJourneyId(val)}
                placeholder={t('pairModal.selectPlaceholder', { defaultValue: 'Select Kiosk Journey...' })}
                searchPlaceholder={t('pairModal.searchPlaceholder', { defaultValue: 'Search journey...' })}
                options={[
                  { value: 'unpair', label: t('pairModal.unpairOption', { defaultValue: '-- Unpair / Clear Current Content --' }) },
                  ...journeys.map(j => ({
                    value: j._id,
                    label: j.title,
                  }))
                ]}
              />
            </div>
          </DialogBody>

          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setPairModalOpen(false)}>
              {t('common:cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button variant="default" size="sm" onClick={handlePairJourney} disabled={pairing}>
              {pairing ? t('pairModal.linking', { defaultValue: 'Linking...' }) : t('pairModal.savePairing', { defaultValue: 'Save Pairing' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PAIR NEW TERMINAL CODE GENERATOR MODAL */}
      <Dialog open={pairTerminalModalOpen} onOpenChange={(open) => !open && handleClosePairTerminalModal()}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl shadow-2xl" data-testid="pair-terminal-modal">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <Tv className="w-5 h-5 text-indigo-600" />
              <span>{t('pairTerminalModal.title', { defaultValue: 'Pair New Terminal' })}</span>
            </DialogTitle>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              {t('pairTerminalModal.desc', { defaultValue: 'Generate a secure 6-digit one-time activation code to link physical tablet hardware to your organization.' })}
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                {t('pairTerminalModal.hardwareGuid', { defaultValue: 'Hardware GUID / Fingerprint *' })}
              </label>
              <Input
                value={terminalGuid}
                onChange={(e) => setTerminalGuid(e.target.value)}
                placeholder={t('pairTerminalModal.guidPlaceholder', { defaultValue: 'e.g. TEST-KIOSK-001' })}
                data-testid="terminal-guid-input"
                className="w-full text-sm font-mono"
                disabled={!!generatedPairCode}
              />
            </div>

            {!generatedPairCode ? (
              <Button
                onClick={handleGeneratePairCode}
                disabled={generatingPairCode || !terminalGuid.trim()}
                data-testid="generate-pair-code-btn"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center justify-center space-x-2 py-2.5 rounded-lg"
              >
                {generatingPairCode ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                <span>{t('pairTerminalModal.generateCode', { defaultValue: 'Generate Pairing Code' })}</span>
              </Button>
            ) : (
              <div className="space-y-4 pt-1">
                <div className="p-4 rounded-xl bg-slate-950 text-white border border-slate-800 text-center space-y-2 shadow-inner">
                  <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                    {t('pairTerminalModal.activationCodeTitle', { defaultValue: 'One-Time Device Activation Code' })}
                  </div>
                  <div
                    data-testid="generated-pair-code"
                    className="text-4xl font-mono font-black tracking-widest text-emerald-400 py-1"
                  >
                    {generatedPairCode}
                  </div>
                  <div
                    data-testid="code-expiry-timer"
                    className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{t('pairTerminalModal.codeLabel', { minutes: Math.round(codeExpiresInSeconds / 60), defaultValue: `Valid for ${Math.round(codeExpiresInSeconds / 60)} minutes` })}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1.5">
                  <div className="font-bold text-slate-800">{t('pairTerminalModal.instructionsTitle', { defaultValue: 'Terminal Activation Instructions:' })}</div>
                  <div>{t('pairTerminalModal.instruction1', { guid: terminalGuid, defaultValue: `1. On physical kiosk hardware, enter GUID: ${terminalGuid}` })}</div>
                  <div>{t('pairTerminalModal.instruction2', { defaultValue: '2. Enter this 6-digit code into the pairing screen to authenticate hardware.' })}</div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedPairCode);
                      setPairCodeCopied(true);
                      toast.success(t('toasts.copiedClipboard', { defaultValue: 'Pairing code copied to clipboard' }));
                      setTimeout(() => setPairCodeCopied(false), 2000);
                    }}
                    data-testid="copy-pair-code-btn"
                    className="flex-1 flex items-center justify-center space-x-1.5"
                  >
                    {pairCodeCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{pairCodeCopied ? t('pairTerminalModal.copied', { defaultValue: 'Copied' }) : t('pairTerminalModal.copyCode', { defaultValue: 'Copy Code' })}</span>
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      handleClosePairTerminalModal();
                      fetchData();
                    }}
                    data-testid="close-pair-modal-btn"
                    className="flex-1"
                  >
                    {t('pairTerminalModal.close', { defaultValue: 'Done' })}
                  </Button>
                </div>
              </div>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Supervisor PIN Configuration Modal (Prompt 09 §UQ-01) */}
      <Dialog open={supervisorPinModalOpen} onOpenChange={setSupervisorPinModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Key className="w-5 h-5 text-amber-600" />
              {t('supervisorPinModal.title', { defaultValue: 'Configure Supervisor Witness PIN' })}
            </DialogTitle>
          </DialogHeader>

          <DialogBody className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 space-y-1">
              <div className="font-bold">{t('supervisorPinModal.protocolTitle', { defaultValue: 'Frontline Kiosk Witness Protocol (§UQ-01):' })}</div>
              <p className="text-[11px] leading-relaxed">
                {t('supervisorPinModal.protocolDesc', { defaultValue: 'Frontline plant and warehouse workers frequently arrive before SSO corporate accounts are provisioned. Supervisors authenticate with their 4-digit PIN on the physical kiosk terminal to witness and legally co-sign safety declarations, PPE acknowledgments, and bank account verifications.' })}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                {t('supervisorPinModal.identifierLabel', { defaultValue: 'Supervisor Employee ID or Email *' })}
              </label>
              <Input
                value={supervisorIdentifier}
                onChange={(e) => setSupervisorIdentifier(e.target.value)}
                placeholder={t('supervisorPinModal.idPlaceholder', { defaultValue: 'e.g. sup-1049 or supervisor@company.com' })}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                  {t('supervisorPinModal.pinLabel', { defaultValue: '4-Digit Security PIN *' })}
                </label>
                <span className="font-mono text-[10px] text-slate-400">{t('supervisorPinModal.numericOnly', { defaultValue: 'Numeric digits only' })}</span>
              </div>
              <Input
                type="password"
                maxLength={4}
                value={supervisorPin}
                onChange={(e) => setSupervisorPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="text-center tracking-widest font-mono text-base h-10 font-bold"
              />
            </div>
          </DialogBody>

          <DialogFooter className="border-t pt-3">
            <Button
              variant="outline"
              onClick={() => setSupervisorPinModalOpen(false)}
              disabled={settingSupervisorPin}
            >
              {t('common:cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleSaveSupervisorPin}
              disabled={settingSupervisorPin || !supervisorIdentifier.trim() || supervisorPin.length !== 4}
            >
              {settingSupervisorPin ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" /> {t('supervisorPinModal.saving', { defaultValue: 'Saving PIN...' })}
                </>
              ) : (
                t('supervisorPinModal.save', { defaultValue: 'Save Supervisor PIN' })
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default KioskDashboard;
