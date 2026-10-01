import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Tv,
  MapPin,
  Clock,
  RotateCcw,
  Play,
  ShieldCheck,
  Search,
  X,
  UserCheck,
  Languages,
  Eye,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Layers,
  FileCheck,
  Wrench,
  PhoneCall
} from 'lucide-react';
import { KioskDeviceManifest } from '../../../../types/kiosk/device.types';
import { KioskJourney } from '../../../../types/kiosk/journey.types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '../../../../components/Dialog';
import { Button } from '../../../../components/Button';
import { FrontlineIdentifyModal } from '../auth/FrontlineIdentifyModal';
import { PrivacyTimeoutModal } from '../privacy/PrivacyTimeoutModal';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { privacyResetService } from '../../services/privacy-reset.service';
import { deviceIdentityService } from '../../services/device-identity.service';

export interface KioskHomeScreenProps {
  manifest: KioskDeviceManifest;
  onLaunchJourney: (journeyId: string) => void;
  onRefreshManifest?: () => void;
  className?: string;
}

export type CategoryFilterType = 'all' | 'safety' | 'compliance' | 'operations';

export const KioskHomeScreen: React.FC<KioskHomeScreenProps> = ({
  manifest,
  onLaunchJourney,
  onRefreshManifest,
  className = ''
}) => {
  const { t, i18n } = useTranslation(['kiosk', 'common']);

  // Real-time search with 150ms debounce
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilterType>('all');

  // Accessibility state
  const [highContrast, setHighContrast] = useState(false);
  const [largeFont, setLargeFont] = useState(false);

  // Modals state
  const [identifyModalOpen, setIdentifyModalOpen] = useState(false);
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [pendingJourneyId, setPendingJourneyId] = useState<string | null>(null);

  // Frontline worker identification state
  const [scannedInitialId, setScannedInitialId] = useState('');
  const [, setEphemeralToken] = useState<string | null>(null);
  const [identifiedWorker, setIdentifiedWorker] = useState<{ id: string; name: string; department: string } | null>(null);
  const [workerConfirmed, setWorkerConfirmed] = useState(false);

  // K-EMP-003: Privacy reset on Home Launcher if employee is identified but idle
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [privacySeconds, setPrivacySeconds] = useState(15);

  useEffect(() => {
    if (!workerConfirmed) return;

    privacyResetService.startMonitoring({
      idleTimeoutSeconds: 60,
      warningDurationSeconds: 15,
      onWarningStart: (remaining) => {
        setPrivacyModalOpen(true);
        setPrivacySeconds(remaining);
      },
      onWarningTick: (remaining) => {
        setPrivacySeconds(remaining);
      },
      onWarningDismissed: () => {
        setPrivacyModalOpen(false);
      },
      onTimeoutExpired: () => {
        setPrivacyModalOpen(false);
        setWorkerConfirmed(false);
        setIdentifiedWorker(null);
        setEphemeralToken(null);
        deviceIdentityService.clearEmployeeSession();
      }
    });

    return () => {
      privacyResetService.stopMonitoring();
    };
  }, [workerConfirmed]);

  // USB / Bluetooth Barcode & RFID Scanner on Home Screen (Acceptance Criteria 1)
  useBarcodeScanner({
    enabled: !identifyModalOpen && !emergencyModalOpen,
    onScan: (scannedCode) => {
      setScannedInitialId(scannedCode);
      setIdentifyModalOpen(true);
    }
  });

  // Live terminal clock
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // 150ms search debounce (Requirement 3)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Auto-refresh manifest every 5 minutes and on window focus (Requirement 4)
  useEffect(() => {
    if (!onRefreshManifest) return;

    // 5 minutes = 300,000 ms
    const autoRefreshInterval = setInterval(() => {
      onRefreshManifest();
    }, 5 * 60 * 1000);

    const handleWindowFocus = () => {
      onRefreshManifest();
    };

    window.addEventListener('focus', handleWindowFocus);

    return () => {
      clearInterval(autoRefreshInterval);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [onRefreshManifest]);

  // Helper to categorize journeys into 'safety' | 'compliance' | 'operations'
  const getJourneyCategory = useCallback((journey: any): 'safety' | 'compliance' | 'operations' => {
    if (journey.category) {
      const cat = String(journey.category).toLowerCase();
      if (cat.includes('safety') || cat.includes('hazard') || cat.includes('ppe')) return 'safety';
      if (cat.includes('comp') || cat.includes('policy') || cat.includes('conduct') || cat.includes('witness')) return 'compliance';
      if (cat.includes('oper') || cat.includes('logist') || cat.includes('dock') || cat.includes('work')) return 'operations';
    }
    const text = `${journey.title || ''} ${journey.description || ''}`.toLowerCase();
    if (
      text.includes('safe') ||
      text.includes('hazard') ||
      text.includes('fire') ||
      text.includes('evac') ||
      text.includes('ppe') ||
      text.includes('forklift')
    ) {
      return 'safety';
    }
    if (
      text.includes('complian') ||
      text.includes('code') ||
      text.includes('conduct') ||
      text.includes('policy') ||
      text.includes('privacy') ||
      text.includes('security') ||
      text.includes('witness')
    ) {
      return 'compliance';
    }
    return 'operations';
  }, []);

  const allJourneys = manifest.journeys || [];

  // Filtered journeys by category and search
  const filteredJourneys = useMemo(() => {
    return allJourneys.filter((j) => {
      // Category filter
      if (selectedCategory !== 'all') {
        const cat = getJourneyCategory(j);
        if (cat !== selectedCategory) return false;
      }

      // Search filter
      const q = debouncedSearch.trim().toLowerCase();
      if (!q) return true;
      const titleMatch = j.title?.toLowerCase().includes(q);
      const descMatch = j.description?.toLowerCase().includes(q);
      return Boolean(titleMatch || descMatch);
    });
  }, [allJourneys, selectedCategory, debouncedSearch, getJourneyCategory]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = { all: allJourneys.length, safety: 0, compliance: 0, operations: 0 };
    for (const j of allJourneys) {
      const cat = getJourneyCategory(j);
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [allJourneys, getJourneyCategory]);

  // Handle journey card click (Requirement 2)
  const handleJourneyCardClick = (journey: KioskJourney & { priority: number; isMandatory: boolean }) => {
    const requiresEmployeeId = Boolean(
      (journey as any).requireEmployeeId ||
      (journey as any).employeeRestricted ||
      (journey.settings as any)?.requireEmployeeId ||
      (journey.settings as any)?.requireAuth ||
      (journey.settings?.security?.protectionType as any) === 'employee_id'
    );

    if (requiresEmployeeId && !workerConfirmed) {
      setPendingJourneyId(journey._id);
      setIdentifyModalOpen(true);
    } else {
      onLaunchJourney(journey._id);
    }
  };

  const handleToggleLanguage = () => {
    const current = i18n.language || 'en';
    const next = current === 'en' ? 'si' : current === 'si' ? 'ta' : 'en';
    i18n.changeLanguage(next);
  };

  const device = manifest.device;
  const terminalName = device?.name || 'Frontline Terminal';
  const terminalLocation = device?.location || 'Operational Floor';

  return (
    <div
      data-testid="kiosk-home-launcher"
      className={`flex min-h-screen w-full flex-col select-none relative transition-colors duration-200 ${
        highContrast
          ? 'bg-black text-white'
          : 'bg-slate-950 text-white'
      } ${largeFont ? 'text-lg' : 'text-base'} ${className}`}
    >
      {/* Ambient Radial Highlights */}
      {!highContrast && (
        <>
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-600/15 blur-3xl pointer-events-none" />
          <div className="absolute top-1/3 -right-32 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
        </>
      )}

      {/* 1. PERSISTENT HEADER BAR */}
      <header
        className={`h-22 px-6 lg:px-12 border-b flex items-center justify-between sticky top-0 z-30 ${
          highContrast
            ? 'bg-black border-amber-400'
            : 'border-slate-800/80 bg-slate-900/60 backdrop-blur-xl'
        }`}
      >
        {/* Terminal Branding & Physical Location */}
        <div className="flex items-center space-x-4">
          <div
            className={`p-3 rounded-2xl ${
              highContrast
                ? 'bg-amber-400 text-black'
                : 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-400'
            }`}
          >
            <Tv className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1
                data-testid="terminal-title"
                className="text-base sm:text-lg font-bold tracking-tight"
              >
                {terminalName}
              </h1>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  highContrast
                    ? 'border-white text-white'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                Online
              </span>
            </div>
            <div
              data-testid="terminal-location"
              className="flex items-center space-x-1.5 text-xs text-slate-400 mt-0.5"
            >
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{terminalLocation}</span>
            </div>
          </div>
        </div>

        {/* Live Clock, Language Switcher, Accessibility & Manual Sync */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Live Clock */}
          <div className="hidden md:flex flex-col items-end text-right pr-2">
            <div className="flex items-center space-x-1.5 text-sm font-mono font-bold text-slate-200">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              {currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>

          {/* Language Switcher */}
          <button
            data-testid="language-switcher"
            onClick={handleToggleLanguage}
            title={t('launcher.changeLanguage', { defaultValue: 'Switch Language' })}
            className="h-10 px-3 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center space-x-1.5 transition active:scale-95"
          >
            <Languages className="w-4 h-4 text-indigo-400" />
            <span className="uppercase">{i18n.language || 'en'}</span>
          </button>

          {/* High Contrast Mode Toggle */}
          <button
            data-testid="toggle-high-contrast"
            onClick={() => setHighContrast(!highContrast)}
            title={t('launcher.toggleHighContrast', { defaultValue: 'Toggle High Contrast' })}
            className={`h-10 w-10 rounded-xl border flex items-center justify-center transition active:scale-95 ${
              highContrast
                ? 'bg-amber-400 border-amber-400 text-black'
                : 'border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300'
            }`}
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* Font Size Scale Toggle */}
          <button
            data-testid="toggle-font-scale"
            onClick={() => setLargeFont(!largeFont)}
            title={t('launcher.toggleFontScale', { defaultValue: 'Toggle Larger Font' })}
            className={`h-10 w-10 rounded-xl border flex items-center justify-center font-bold text-xs transition active:scale-95 ${
              largeFont
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300'
            }`}
          >
            A+
          </button>

          {/* Refresh / Sync Button */}
          {onRefreshManifest && (
            <button
              onClick={onRefreshManifest}
              title={t('launcher.sync', { defaultValue: 'Sync Assigned Journeys' })}
              className="h-10 w-10 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* 2. MAIN CATALOG WORKSPACE */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-6 relative z-10 flex flex-col">
        {/* Identified Worker Greeting Banner (if authenticated) */}
        {workerConfirmed && identifiedWorker && (
          <div className="p-4 rounded-2xl bg-indigo-950/60 border border-indigo-500/40 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-indigo-600 text-white">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-indigo-300 uppercase tracking-wider font-bold">Identified Frontline Worker</p>
                <p className="text-sm font-extrabold text-white">
                  {identifiedWorker.name} ({identifiedWorker.department})
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setWorkerConfirmed(false);
                setIdentifiedWorker(null);
              }}
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500"
            >
              Sign Out
            </button>
          </div>
        )}

        {/* Hero Section & Search / Filter Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t('launcher.portalBadge', { defaultValue: 'Interactive Safety & Induction Portal' })}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {t('launcher.portalHeadline', { defaultValue: 'Assigned Safety Journeys' })}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              {t('launcher.portalSubheadline', {
                defaultValue: 'Touch any card to begin interactive instructions, PPE verifications, or compliance checklists.'
              })}
            </p>
          </div>

          {/* Real-time Touch Search Input (150ms Debounced) */}
          <div className="w-full md:w-80 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              data-testid="touch-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('launcher.searchPlaceholder', { defaultValue: 'Search journeys by title or topic...' })}
              className={`w-full h-12 pl-10 pr-10 rounded-xl text-sm border focus:outline-hidden transition ${
                highContrast
                  ? 'bg-black border-white text-white focus:border-amber-400'
                  : 'bg-slate-900/80 border-slate-700 focus:border-indigo-500 text-white placeholder-slate-500'
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 border-b border-slate-800">
          {(
            [
              { key: 'all', label: 'All', icon: Layers, count: categoryCounts.all },
              { key: 'safety', label: 'Safety', icon: ShieldCheck, count: categoryCounts.safety },
              { key: 'compliance', label: 'Compliance', icon: FileCheck, count: categoryCounts.compliance },
              { key: 'operations', label: 'Operations', icon: Wrench, count: categoryCounts.operations }
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = selectedCategory === tab.key;

            return (
              <button
                key={tab.key}
                data-testid={`category-tab-${tab.key}`}
                onClick={() => setSelectedCategory(tab.key)}
                className={`h-11 px-4 rounded-xl text-xs font-bold transition flex items-center space-x-2 shrink-0 ${
                  isActive
                    ? highContrast
                      ? 'bg-amber-400 text-black'
                      : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? highContrast
                        ? 'bg-black text-amber-400 font-bold'
                        : 'bg-indigo-700 text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 3. ASSIGNED JOURNEY CARDS GRID */}
        {filteredJourneys.length === 0 ? (
          <div
            data-testid="terminal-empty-standby"
            className="flex-1 rounded-3xl border border-slate-800/80 bg-slate-900/40 p-12 text-center flex flex-col items-center justify-center space-y-4"
          >
            <Layers className="w-12 h-12 text-slate-600" />
            <h3 className="text-lg font-bold text-slate-200">
              {allJourneys.length === 0
                ? t('launcher.noJourneysTitle', { defaultValue: 'Terminal Standby Mode' })
                : debouncedSearch
                ? t('launcher.noSearchResultsTitle', { defaultValue: 'No journeys match your search' })
                : t('launcher.noCategoryJourneysTitle', { defaultValue: 'No Journeys In This Category' })}
            </h3>
            <p className="text-xs text-slate-400 max-w-md">
              {allJourneys.length === 0
                ? t('launcher.noJourneysDesc', {
                    defaultValue: 'No safety journeys are currently assigned or scheduled for this terminal.'
                  })
                : debouncedSearch
                ? t('launcher.noSearchResultsDesc', { defaultValue: 'Try searching for different terms or clear the search query.' })
                : t('launcher.noCategoryJourneysDesc', { defaultValue: 'No active safety curriculums found for this filter tab.' })}
            </p>
            {debouncedSearch && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-white transition"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredJourneys.map((journey, idx) => {
              const isMandatory = Boolean(journey.isMandatory);
              const priorityNum = idx + 1;
              const durationText = (journey as any).estimatedMinutes
                ? `${(journey as any).estimatedMinutes} min`
                : `${Math.max(2, (journey.steps?.length || 1) * 2)} min`;

              const requiresWitness = Boolean(
                journey.settings?.requireSupervisorWitness ||
                (journey.settings?.security?.protectionType as any) === 'pin' ||
                journey.steps?.some(
                  (s: any) => s.requireSupervisorWitness || s.interaction?.requireSupervisorWitness
                )
              );

              return (
                <div
                  key={journey._id}
                  data-testid={`journey-card-${journey._id}`}
                  className={`min-w-[280px] min-h-[200px] rounded-2xl border p-6 flex flex-col justify-between transition-all duration-200 group hover:-translate-y-1 ${
                    highContrast
                      ? 'bg-black border-white hover:border-amber-400'
                      : 'bg-slate-900/70 border-slate-800 hover:bg-slate-900 hover:border-indigo-500/50 shadow-xl'
                  }`}
                >
                  <div className="space-y-3.5">
                    {/* Top Row Badges: Priority, Duration, Mandatory, Witness */}
                    <div className="flex items-center justify-between flex-wrap gap-1.5">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[11px] font-mono font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 rounded-md">
                          #{priorityNum}
                        </span>
                        <span
                          data-testid={`journey-duration-${journey._id}`}
                          className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700"
                        >
                          <Clock className="w-3 h-3 mr-1 text-slate-400" />
                          {durationText}
                        </span>
                      </div>

                      {isMandatory && (
                        <span
                          data-testid={`mandatory-badge-${journey._id}`}
                          className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        >
                          <ShieldCheck className="w-3 h-3 mr-1 text-amber-400" />
                          {t('launcher.mandatory', { defaultValue: 'Required' })}
                        </span>
                      )}
                    </div>

                    {/* Witness requirement indicator if specified */}
                    {requiresWitness && (
                      <div
                        data-testid={`witness-badge-${journey._id}`}
                        className="inline-flex items-center space-x-1 text-[10px] font-bold text-purple-300 bg-purple-950/60 border border-purple-800/60 px-2 py-0.5 rounded"
                      >
                        <UserCheck className="w-3 h-3 text-purple-400" />
                        <span>Supervisor Witness Required</span>
                      </div>
                    )}

                    {/* Journey Title and Description */}
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-indigo-300 transition line-clamp-2">
                        {journey.title}
                      </h3>
                      {journey.description && (
                        <p className="text-xs text-slate-400 mt-1.5 line-clamp-3 leading-relaxed">
                          {journey.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Large Touch Target Launch Button */}
                  <div className="pt-5 mt-4 border-t border-slate-800/60">
                    <button
                      data-testid={`launch-journey-${journey._id}`}
                      onClick={() => handleJourneyCardClick(journey)}
                      className={`w-full min-h-[48px] py-3.5 px-4 rounded-xl font-bold text-sm shadow-lg active:scale-[0.98] transition flex items-center justify-center space-x-2 ${
                        highContrast
                          ? 'bg-amber-400 hover:bg-amber-300 text-black'
                          : 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-indigo-600/20'
                      }`}
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>{t('launcher.startJourney', { defaultValue: 'Start Journey' })}</span>
                      <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 4. FOOTER ACTIONS BAR */}
      <footer
        className={`py-4 px-6 lg:px-12 border-t flex flex-col sm:flex-row items-center justify-between gap-4 sticky bottom-0 z-20 ${
          highContrast
            ? 'bg-black border-amber-400'
            : 'border-slate-900 bg-slate-950/90 backdrop-blur-xl'
        }`}
      >
        <div className="flex items-center space-x-3 text-xs text-slate-500 font-mono">
          <span>GUID: {manifest.deviceId}</span>
          <span>•</span>
          <span>Curriculum Count: {filteredJourneys.length}</span>
        </div>

        {/* Footer Action Triggers */}
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          {/* Identify as Employee Button (Requirement Scope & Acceptance Criteria 2) */}
          {identifiedWorker ? (
            <div
              data-testid="identified-worker-badge"
              className="flex-1 sm:flex-initial h-12 px-4 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 border border-emerald-500/40 bg-emerald-950/40 text-emerald-300"
            >
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>{identifiedWorker.name} ({identifiedWorker.department})</span>
            </div>
          ) : (
            <button
              data-testid="identify-employee-button"
              onClick={() => {
                setPendingJourneyId(null);
                setIdentifyModalOpen(true);
              }}
              className={`flex-1 sm:flex-initial h-12 px-5 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 border transition active:scale-95 ${
                highContrast
                  ? 'bg-black border-white text-white hover:border-amber-400'
                  : 'bg-slate-900 border-indigo-500/40 text-indigo-300 hover:bg-indigo-950/40 hover:text-white'
              }`}
            >
              <UserCheck className="w-4 h-4 text-indigo-400" />
              <span>{t('launcher.identifyAsEmployee', { defaultValue: 'Identify as Employee' })}</span>
            </button>
          )}

          {/* Emergency Protocol Button (Requirement Scope) */}
          <button
            data-testid="emergency-protocol-button"
            onClick={() => setEmergencyModalOpen(true)}
            className="flex-1 sm:flex-initial h-12 px-5 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 flex items-center justify-center space-x-2 transition active:scale-95"
          >
            <AlertTriangle className="w-4 h-4 text-rose-100" />
            <span>{t('launcher.emergencyProtocol', { defaultValue: 'Emergency Protocol' })}</span>
          </button>
        </div>
      </footer>

      {/* 5. FRONTLINE WORKER IDENTIFICATION MODAL (DEF-008, K-EMP-001) */}
      <FrontlineIdentifyModal
        isOpen={identifyModalOpen}
        onClose={() => {
          setIdentifyModalOpen(false);
          setPendingJourneyId(null);
          setScannedInitialId('');
        }}
        onSuccess={({ token, worker }) => {
          setEphemeralToken(token);
          setIdentifiedWorker({
            id: worker.id,
            name: worker.fullName,
            department: worker.department || 'Operations'
          });
          setWorkerConfirmed(true);
          setIdentifyModalOpen(false);

          if (pendingJourneyId) {
            const target = pendingJourneyId;
            setPendingJourneyId(null);
            onLaunchJourney(target);
          }
        }}
        deviceId={manifest.deviceId}
        highContrast={highContrast}
        initialIdentifier={scannedInitialId}
      />

      {/* 6. EMERGENCY PROTOCOL MODAL */}
      <Dialog open={emergencyModalOpen} onOpenChange={setEmergencyModalOpen}>
        <DialogContent
          data-testid="emergency-protocol-modal"
          className="sm:max-w-lg bg-slate-900 border border-rose-900/60 text-white p-6 rounded-3xl"
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-rose-400 flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              <span>{t('emergency.title', { defaultValue: 'Facility Emergency Protocols' })}</span>
            </DialogTitle>
          </DialogHeader>

          <DialogBody className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/40 space-y-2">
              <h5 className="font-bold text-rose-300 text-sm flex items-center space-x-1.5">
                <PhoneCall className="w-4 h-4" />
                <span>Emergency Hotlines</span>
              </h5>
              <div className="grid grid-cols-2 gap-2 text-slate-300">
                <div>
                  <span className="text-slate-500 block">External Dispatch:</span>
                  <span className="font-mono font-bold text-white text-sm">911</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Plant Security Control:</span>
                  <span className="font-mono font-bold text-white text-sm">Ext. 5555</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-slate-300">
              <p>
                <strong>Evacuation Assembly:</strong> Proceed immediately through Exit Doors East to <em>Evacuation Assembly Zone B (North Pavilion)</em>.
              </p>
              <p>
                <strong>First Aid Station:</strong> Located at <em>Safety Hub 2 (Gate B Corridors)</em> equipped with AED and eye wash stations.
              </p>
              <p>
                <strong>Emergency Stop:</strong> Pull any red e-stop latch located at conveyor intersections in case of machinery hazard.
              </p>
            </div>
          </DialogBody>

          <DialogFooter className="border-t border-slate-800 pt-3">
            <Button
              data-testid="close-emergency-modal"
              variant="outline"
              size="sm"
              onClick={() => setEmergencyModalOpen(false)}
              className="border-slate-700 text-slate-300"
            >
              Close Emergency Guide
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Automatic Privacy Reset Warning Modal on Launcher */}
      <PrivacyTimeoutModal
        isOpen={privacyModalOpen}
        remainingSeconds={privacySeconds}
        onStay={() => privacyResetService.dismissWarning()}
        onExit={() => privacyResetService.executePrivacyWipe()}
      />
    </div>
  );
};

export default KioskHomeScreen;
