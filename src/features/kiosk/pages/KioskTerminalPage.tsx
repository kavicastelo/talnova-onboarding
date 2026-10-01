import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  RotateCcw,
  AlertCircle
} from 'lucide-react';
import { kioskService } from '../services/kiosk.service';
import { deviceIdentityService } from '../services/device-identity.service';
import { KioskDeviceManifest } from '../../../types/kiosk/device.types';
import { KioskPlayerProvider } from '../context/KioskPlayerContext';
import { KioskPlayer } from '../components/KioskPlayer';
import { KioskMaintenanceOverlay } from '../components/KioskMaintenanceOverlay';
import { KioskRevokedOverlay } from '../components/KioskRevokedOverlay';
import { KioskHomeScreen } from '../components/launcher/KioskHomeScreen';
import { EmergencyEvacuationOverlay } from '../components/emergency/EmergencyEvacuationOverlay';
import { emergencyService } from '../services/emergency.service';
import { KioskEmergency } from '../../../types/kiosk/emergency.types';

export const KioskTerminalPage: React.FC = () => {
  const { t } = useTranslation('kiosk');
  const { deviceId: routeDeviceId } = useParams<{ deviceId?: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manifest, setManifest] = useState<KioskDeviceManifest | null>(null);
  const [activeJourneyId, setActiveJourneyId] = useState<string | null>(null);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [isRevoked, setIsRevoked] = useState(() => deviceIdentityService.isRevoked());
  const [revocationMessage, setRevocationMessage] = useState<string | undefined>();
  const [activeEmergency, setActiveEmergency] = useState<KioskEmergency | null>(() => emergencyService.getActiveEmergency());

  // Listen for emergency broadcast and clear events (K-SEC-004)
  useEffect(() => {
    const orgId = manifest?.organizationId || deviceIdentityService.getStoredDevice()?.organizationId;
    if (orgId) {
      emergencyService.startStream(orgId);
    }

    const unsubscribe = emergencyService.subscribe((emergency) => {
      setActiveEmergency(emergency);
    });

    const handleEmergency = (e: any) => {
      if (e?.detail) {
        setActiveEmergency(e.detail);
      }
    };

    const handleCleared = () => {
      setActiveEmergency(null);
      // Dismiss overlay and resume home screen launcher
      setActiveJourneyId(null);
    };

    window.addEventListener('talnova:kiosk:emergency', handleEmergency);
    window.addEventListener('talnova:kiosk:emergency_cleared', handleCleared);

    return () => {
      unsubscribe();
      window.removeEventListener('talnova:kiosk:emergency', handleEmergency);
      window.removeEventListener('talnova:kiosk:emergency_cleared', handleCleared);
    };
  }, [manifest?.organizationId]);

  // Listen for instantaneous revocation events (DEF-005)
  useEffect(() => {
    const handleRevoked = (e: any) => {
      setIsRevoked(true);
      if (e?.detail?.message) {
        setRevocationMessage(e.detail.message);
      }
    };
    window.addEventListener('talnova:kiosk:device_revoked', handleRevoked);
    return () => {
      window.removeEventListener('talnova:kiosk:device_revoked', handleRevoked);
    };
  }, []);

  const fetchManifest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const targetId =
        routeDeviceId ||
        deviceIdentityService.getHardwareGuidSync() ||
        deviceIdentityService.getStoredDevice()?.deviceId ||
        undefined;

      const data = await kioskService.getDeviceManifest(targetId);
      setManifest(data);

      // Check device operational status from manifest
      if (data.device?.status === 'maintenance') {
        setIsMaintenance(true);
      } else if (
        data.device?.status === 'decommissioned' ||
        data.device?.status === 'suspended'
      ) {
        setIsRevoked(true);
      } else {
        setIsMaintenance(false);
      }

      // If autoplay mode with valid journeys, launch the top priority journey directly
      if (data.launchMode === 'autoplay' && data.journeys && data.journeys.length > 0) {
        setActiveJourneyId(data.journeys[0]._id);
      }
    } catch (err: any) {
      console.error('[KioskTerminalPage] Manifest fetch failed:', err);

      const status = err?.response?.status;
      const respData = err?.response?.data;
      const msg = respData?.message || err?.message || '';

      if (status === 403 || msg.toLowerCase().includes('decommissioned') || msg.toLowerCase().includes('revoked')) {
        setIsRevoked(true);
        setRevocationMessage(msg || 'Device enrollment revoked. Please contact your system administrator.');
      } else if (msg.toLowerCase().includes('maintenance')) {
        setIsMaintenance(true);
      } else if (status === 401 && !routeDeviceId) {
        // Unauthenticated or credentials lost; redirect to pair
        navigate('/kiosk/pair', { replace: true });
        return;
      } else {
        setError(msg || t('terminal.failedToLoadManifest', 'Failed to retrieve terminal manifest.'));
      }
    } finally {
      setLoading(false);
    }
  }, [routeDeviceId, navigate, t]);

  // Initial mount verification
  useEffect(() => {
    // 1. If not an MDM-fixed route, verify local pairing status
    if (!routeDeviceId) {
      if (deviceIdentityService.isRevoked()) {
        setIsRevoked(true);
        setLoading(false);
        return;
      }

      if (!deviceIdentityService.isPaired()) {
        // Redirect automatically to /kiosk/pair
        navigate('/kiosk/pair', { replace: true });
        return;
      }
    }

    // 2. Fetch manifest
    fetchManifest();
  }, [routeDeviceId, navigate, fetchManifest]);

  // 0. Active Emergency Evacuation Overlay (Highest Priority K-SEC-004)
  if (activeEmergency && activeEmergency.isActive) {
    return (
      <EmergencyEvacuationOverlay
        emergency={activeEmergency}
      />
    );
  }

  // 1. Revoked / Lockdown Screen
  if (isRevoked) {
    return (
      <KioskRevokedOverlay
        customMessage={revocationMessage}
        onReEnroll={() => {
          deviceIdentityService.clearRevocationStatus();
          deviceIdentityService.clearDeviceCredentials();
          navigate('/kiosk/pair', { replace: true });
        }}
      />
    );
  }

  // 2. Maintenance Screen
  if (isMaintenance) {
    return (
      <KioskMaintenanceOverlay
        device={manifest?.device}
        onRefresh={fetchManifest}
      />
    );
  }

  // 3. Player Shell (active journey playing)
  if (activeJourneyId) {
    return (
      <KioskPlayerProvider>
        <KioskPlayer
          journeyId={activeJourneyId}
          onExit={() => {
            setActiveJourneyId(null);
            // Refresh manifest to catch any assignment or status updates
            fetchManifest();
          }}
        />
      </KioskPlayerProvider>
    );
  }

  // 4. Sleek Loading Skeleton
  if (loading) {
    return (
      <div
        data-testid="terminal-loading-skeleton"
        className="flex min-h-screen w-full flex-col bg-slate-950 text-white select-none relative overflow-hidden"
      >
        {/* Ambient Top Glows */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-600/15 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -right-32 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

        {/* Skeleton Topbar */}
        <header className="h-18 px-6 lg:px-12 border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-xl flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 rounded-xl bg-slate-800 animate-pulse" />
            <div className="space-y-2">
              <div className="w-36 h-4 rounded bg-slate-800 animate-pulse" />
              <div className="w-24 h-3 rounded bg-slate-800/60 animate-pulse" />
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-24 h-7 rounded-full bg-slate-800 animate-pulse" />
            <div className="w-20 h-7 rounded-lg bg-slate-800 animate-pulse" />
          </div>
        </header>

        {/* Skeleton Content Body */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 space-y-8">
          <div className="space-y-3">
            <div className="w-64 h-8 rounded-lg bg-slate-800 animate-pulse" />
            <div className="w-96 h-4 rounded bg-slate-800/60 animate-pulse" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="h-64 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="w-12 h-5 rounded-full bg-slate-800 animate-pulse" />
                    <div className="w-16 h-5 rounded-full bg-slate-800 animate-pulse" />
                  </div>
                  <div className="w-48 h-6 rounded bg-slate-800 animate-pulse" />
                  <div className="w-full h-12 rounded bg-slate-800/50 animate-pulse" />
                </div>
                <div className="w-full h-12 rounded-xl bg-slate-800 animate-pulse" />
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // 5. Error State
  if (error || !manifest) {
    return (
      <div
        data-testid="terminal-error-view"
        className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-950 px-6 text-white text-center"
      >
        <div className="w-full max-w-md rounded-3xl border border-rose-900/40 bg-slate-900/60 p-8 backdrop-blur-2xl shadow-2xl space-y-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-400 mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-2">
              {t('terminal.manifestErrorTitle', 'Unable to Load Terminal Manifest')}
            </h2>
            <p className="text-sm text-slate-400">
              {error || t('terminal.manifestErrorDesc', 'Communication with the orchestration service failed.')}
            </p>
          </div>
          <div className="flex flex-col space-y-2.5">
            <button
              onClick={fetchManifest}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center justify-center space-x-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{t('terminal.retry', 'Retry Manifest Sync')}</span>
            </button>
            <button
              onClick={() => navigate('/kiosk/pair')}
              className="w-full py-2.5 px-4 rounded-xl font-medium text-xs text-slate-400 hover:text-white transition"
            >
              {t('terminal.pairAgain', 'Re-enroll Terminal')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 6. Multi-Journey Home Screen / Launcher
  return (
    <KioskHomeScreen
      manifest={manifest}
      onLaunchJourney={(journeyId) => setActiveJourneyId(journeyId)}
      onRefreshManifest={fetchManifest}
    />
  );
};

export default KioskTerminalPage;
