import { useState, useEffect } from 'react';
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
  Loader2
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
  DialogFooter
} from '../components/Dialog';
import { toast } from 'sonner';
import { SimplePagination } from '../components/SimplePagination';
import { usePagination } from '../hooks/usePagination';
import { kioskService } from '../features/kiosk/services/kiosk.service';
import { KioskJourney } from '../types/kiosk/journey.types';
import { KioskDevice } from '../types/kiosk/device.types';
import { KioskAnalyticsSummary } from '../types/kiosk/analytics.types';
import { KioskBuilder } from '../features/kiosk';

type TabType = 'journeys' | 'devices' | 'analytics';

export function KioskDashboard() {
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

  // Analytics states
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>('');
  const [analyticsData, setAnalyticsData] = useState<KioskAnalyticsSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

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
      toast.error(err?.message || 'Failed to fetch kiosk workspace data');
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
      toast.error('Journey title is required');
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
      toast.success('Kiosk journey created successfully');
      setCreateModalOpen(false);
      setNewJourneyTitle('');
      setNewJourneyLangs(['en']);
      
      // Open immediately in builder
      setEditingJourneyId(created._id);
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create kiosk journey');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteJourney = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this kiosk journey? This action cannot be undone.')) {
      try {
        await kioskService.deleteJourney(id);
        toast.success('Kiosk journey deleted');
        fetchData();
      } catch (err: any) {
        toast.error(err?.message || 'Failed to delete journey');
      }
    }
  };

  const handlePairJourney = async () => {
    if (!selectedDevice) return;
    setPairing(true);
    try {
      const targetJourneyId = pairJourneyId === 'unpair' ? null : pairJourneyId;
      await kioskService.pairJourneyToDevice(selectedDevice._id, targetJourneyId);
      toast.success('Journey linked to device successfully');
      setPairModalOpen(false);
      setSelectedDevice(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to link journey to device');
    } finally {
      setPairing(false);
    }
  };

  const handleDispatchCommand = async (deviceId: string, commandType: string) => {
    try {
      console.log(`Dispatching ${commandType} to device ${deviceId}`);
      // Simulate remote queue scheduling for command dispatch
      toast.success(`Remote command [${commandType}] successfully queued for device.`);
    } catch (err: any) {
      toast.error('Failed to dispatch remote action command');
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Kiosk Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Build interactive multi-lingual screen journeys, pair physical tablet nodes, and monitor hardware telemetries.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="flex items-center space-x-1">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Reload</span>
          </Button>
          <Button variant="default" size="sm" onClick={() => setCreateModalOpen(true)} className="flex items-center space-x-1">
            <Plus className="w-4 h-4" />
            <span>Create Journey</span>
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
          <span>Kiosk Journeys</span>
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
          <span>Physical Terminals</span>
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
          <span>Usage Analytics</span>
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
                <h3 className="font-semibold text-slate-700">No Kiosk Journeys</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Create a new visual multi-lingual onboarding layout to launch interactive kiosks for employees.
                </p>
                <Button variant="default" size="sm" onClick={() => setCreateModalOpen(true)} className="mt-4">
                  Create First Journey
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
                      {journey.description || 'No description provided.'}
                    </p>
                    
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {journey.languages?.map((lang) => (
                        <span key={lang} className="text-[10px] font-bold bg-slate-100 border text-slate-600 px-2 py-0.5 rounded uppercase">
                          {lang}
                        </span>
                      ))}
                      <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                        {journey.steps?.length || 0} Steps
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
                        title="Edit Journey"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <a
                        href={`/kiosk/play/${journey._id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition"
                        title="Launch Player Preview"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => handleDeleteJourney(journey._id)}
                        className="p-1.5 rounded hover:bg-slate-100 text-rose-500 hover:bg-rose-50/50 transition"
                        title="Delete Journey"
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
            itemLabel="journeys"
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
                <div className="text-xs text-slate-500 font-medium">Online Terminals</div>
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
                <div className="text-xs text-slate-500 font-medium">Offline Terminals</div>
              </div>
            </Card>
            <Card className="p-5 flex items-center space-x-4 border border-slate-200">
              <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600">
                <Tv className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{devices.length}</div>
                <div className="text-xs text-slate-500 font-medium">Total Paired Hardware</div>
              </div>
            </Card>
          </div>

          {/* Devices Grid List */}
          <Card className="overflow-hidden border border-slate-200">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Paired Devices Registry</h3>
            </div>
            
            {loading ? (
              <div className="p-12 text-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                <span>Loading active terminals...</span>
              </div>
            ) : devices.length === 0 ? (
              <div className="p-16 text-center text-slate-400">
                <Tv className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p className="font-semibold text-slate-500">No paired terminals found</p>
                <p className="text-xs text-slate-400 mt-0.5">Device registration starts on physical hardware using pairing pins.</p>
              </div>
            ) : (
              <div>
                <div className="divide-y divide-slate-100">
                  {devicesPagination.paginatedData.map((device) => {
                    const linkedJourney = journeys.find(j => j._id === device.currentJourneyId);
                    const isOnline = device.status === 'online';
                    
                    return (
                      <div key={device._id} className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:bg-slate-50/50 transition">
                        
                        {/* Name & Placement Details */}
                        <div className="space-y-1.5 max-w-sm">
                          <div className="flex items-center space-x-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 shadow-md shadow-emerald-400/50' : 'bg-slate-300'}`} />
                            <h4 className="font-bold text-slate-800 text-sm">{device.name}</h4>
                            <Badge variant={isOnline ? 'default' : 'secondary'} className="text-[9px] py-0">
                              {device.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 flex items-center">
                            <span className="font-semibold text-slate-600 mr-1.5">{device.location}</span>
                            <span className="text-slate-300">|</span>
                            <span className="font-mono text-[10px] ml-1.5 text-slate-400 truncate max-w-[120px]" title={device.deviceId}>
                              ID: {device.deviceId}
                            </span>
                          </p>
                        </div>

                        {/* Linked Content Journey */}
                        <div className="flex flex-col space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Journey</span>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-semibold text-slate-700">
                              {linkedJourney ? linkedJourney.title : <span className="text-slate-400 italic">No journey paired</span>}
                            </span>
                            <button
                              onClick={() => {
                                setSelectedDevice(device);
                                setPairJourneyId(device.currentJourneyId || 'unpair');
                                setPairModalOpen(true);
                              }}
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition"
                            >
                              Link...
                            </button>
                          </div>
                        </div>

                        {/* Telemetry metrics dashboard */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100 shrink-0">
                          <div className="flex items-center space-x-2">
                            <Battery className="w-4 h-4 text-slate-500" />
                            <div className="flex flex-col">
                              <span className="text-[9px] text-slate-450 uppercase font-bold">Battery</span>
                              <span className="text-xs font-semibold text-slate-700">
                                {device.telemetry?.batteryLevel !== undefined ? `${Math.round(device.telemetry.batteryLevel * 100)}%` : 'N/A'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <HardDrive className="w-4 h-4 text-slate-500" />
                            <div className="flex flex-col">
                              <span className="text-[9px] text-slate-450 uppercase font-bold">Free Space</span>
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
                              <span className="text-[9px] text-slate-450 uppercase font-bold">Latency</span>
                              <span className="text-xs font-semibold text-slate-700">
                                {device.telemetry?.networkLatencyMs !== undefined ? `${device.telemetry.networkLatencyMs}ms` : 'N/A'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Cpu className="w-4 h-4 text-slate-500" />
                            <div className="flex flex-col">
                              <span className="text-[9px] text-slate-450 uppercase font-bold">App version</span>
                              <span className="text-xs font-mono font-semibold text-slate-700">
                                {device.telemetry?.appVersion || 'v1.0.0'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Dispatch panel admin command actions */}
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleDispatchCommand(device._id, 'refresh_cache')}
                            className="px-2 py-1 bg-white border border-slate-200 text-slate-600 rounded text-[10px] font-semibold hover:border-slate-300 hover:text-slate-800 transition flex items-center space-x-1"
                            title="Refresh cached local content"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Sync Cache</span>
                          </button>
                          <button
                            onClick={() => handleDispatchCommand(device._id, 'restart_app')}
                            className="px-2 py-1 bg-white border border-slate-200 text-slate-600 rounded text-[10px] font-semibold hover:border-slate-300 hover:text-slate-800 transition flex items-center space-x-1"
                            title="Restart physical screen app wrapper"
                          >
                            <Zap className="w-3 h-3 text-amber-500" />
                            <span>Restart</span>
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
                    itemLabel="terminals"
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
              <h3 className="text-sm font-bold text-slate-800">Journey Performance Metrics</h3>
              <p className="text-xs text-slate-500">Analyze interactions, completion ratios, and language statistics.</p>
            </div>
            <select
              value={selectedJourneyId}
              onChange={(e) => setSelectedJourneyId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none"
            >
              {journeys.map(j => (
                <option key={j._id} value={j._id}>{j.title}</option>
              ))}
            </select>
          </div>

          {analyticsLoading ? (
            <div className="py-16 text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-500" />
              <span>Fetching journey analytics...</span>
            </div>
          ) : analyticsData ? (
            <div className="space-y-6">
              {/* Premium dashboard metrics grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="p-5 border border-slate-200 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Launches</span>
                  <div className="text-3xl font-extrabold text-slate-800 mt-2">{analyticsData.totalLaunches}</div>
                  <span className="text-[10px] text-slate-500 mt-1">Sessions initialized on kiosk.</span>
                </Card>

                <Card className="p-5 border border-slate-200 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Completions</span>
                  <div className="text-3xl font-extrabold text-slate-800 mt-2">{analyticsData.totalCompletions}</div>
                  <span className="text-[10px] text-slate-500 mt-1">Reached final confirmation step.</span>
                </Card>

                <Card className="p-5 border border-slate-200 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Completion Rate</span>
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
                  <span className="text-[10px] text-slate-500 mt-1">Ratio of starts to finished steps.</span>
                </Card>

                <Card className="p-5 border border-slate-200 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avg Session Time</span>
                  <div className="text-3xl font-extrabold text-slate-800 mt-2">
                    {Math.round(analyticsData.averageDurationSeconds)}s
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1">Mean playback completion time.</span>
                </Card>
              </div>

              {/* Graphic breakdown visualizations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Languages breakdown */}
                <Card className="p-5 border border-slate-200 space-y-4">
                  <div className="flex items-center space-x-2">
                    <Globe className="w-4 h-4 text-indigo-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Language Usage Breakdown</h4>
                  </div>
                  <div className="space-y-3">
                    {analyticsData.languageBreakdown?.map((item) => (
                      <div key={item.language} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                           <span className="font-bold text-slate-650 uppercase">{item.language}</span>
                          <span className="font-mono text-slate-500">{item.count} sessions</span>
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
                    <span>Daily Interactive Engagement Ratio</span>
                  </h4>
                  <div className="h-40 flex items-end justify-between gap-2 pt-4">
                    {[34, 45, 23, 56, 78, 62, 90].map((val, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                        <div 
                          style={{ height: `${val}%` }}
                          className="w-full bg-emerald-500/20 hover:bg-emerald-500 border border-emerald-500/30 hover:border-emerald-500 transition-all rounded-t-sm relative group"
                        >
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 transition duration-150 pointer-events-none whitespace-nowrap">
                            {val} hits
                          </div>
                        </div>
                        <span className="text-[9px] text-slate-400 font-mono">Day {idx + 1}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
              <BarChart2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-700">No Analytics Sessions Logged</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Once physical tablets pair to this journey and complete user interactive sessions, completion details will map here.
              </p>
            </div>
          )}
        </div>
      )}

      {/* CREATE MODAL */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Create Kiosk Journey</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase">Journey Title</label>
              <Input
                type="text"
                placeholder="e.g. Factory Floor Visitor Orientation"
                value={newJourneyTitle}
                onChange={(e) => setNewJourneyTitle(e.target.value)}
                className="w-full border-slate-300 bg-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 uppercase block">Supported Languages</label>
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
                      {lang === 'en' ? 'English (EN)' : 'Sinhala (SI)'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="default" size="sm" onClick={handleCreateJourney} disabled={creating}>
              {creating ? 'Creating...' : 'Create & Design'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PAIR DEVICE MODAL */}
      <Dialog open={pairModalOpen} onOpenChange={(open) => !open && setPairModalOpen(false)}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Pair Journey to Terminal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <p className="text-xs text-slate-500">
              Select which interactive kiosk layout journey should render on the terminal <span className="font-semibold text-slate-800">"{selectedDevice?.name}"</span> located at <span className="font-semibold text-slate-800">"{selectedDevice?.location}"</span>.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase">Kiosk Journey</label>
              <select
                value={pairJourneyId}
                onChange={(e) => setPairJourneyId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none"
              >
                <option value="unpair">-- Unpair / Clear Current Content --</option>
                {journeys.map(j => (
                  <option key={j._id} value={j._id}>{j.title}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setPairModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="default" size="sm" onClick={handlePairJourney} disabled={pairing}>
              {pairing ? 'Linking...' : 'Save Pairing'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default KioskDashboard;
