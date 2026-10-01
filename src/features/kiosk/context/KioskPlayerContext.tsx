import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { KioskJourney } from '../../../types/kiosk/journey.types';
import { KioskAnalytics, KioskUserInteraction, KioskSessionMetrics } from '../../../types/kiosk/analytics.types';
import { KioskSession, KioskSessionStatus } from '../../../types/kiosk/session.types';
import { kioskService } from '../services/kiosk.service';
import { deviceIdentityService } from '../services/device-identity.service';

export interface KioskPlayerContextProps {
  journey: KioskJourney | null;
  currentStepIndex: number;
  selectedLanguage: string;
  isPlayingAudio: boolean;
  isMuted: boolean;
  showSubtitles: boolean;
  isLoading: boolean;
  error: string | null;
  offlineQueueCount: number;
  
  // K-EMP-002: Formal Backend KioskSession State Machine
  activeSession: KioskSession | null;
  sessionStatus: KioskSessionStatus | 'idle';
  
  loadJourney: (journeyId: string, signedParams?: { o: string; exp: string; sig: string }) => Promise<void>;
  setStepIndex: (index: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  changeLanguage: (lang: string) => void;
  setPlayingAudio: (playing: boolean) => void;
  toggleMuted: () => void;
  toggleSubtitles: () => void;
  
  signedParams?: { o: string; exp: string; sig: string };
  recordPpeCompliance: (stepId: string, itemsChecked: string[]) => Promise<void>;

  // Session triggers & state machine
  startSession: (options?: { journeyVersionId?: string; versionNumber?: number }) => Promise<KioskSession | null>;
  recordInteraction: (elementClicked: string) => void;
  completeSession: (completionData?: {
    quizScore?: number;
    ppeItemsVerified?: string[];
    verificationChecksum?: string;
  }) => Promise<void>;
  abortSession: (abortedStepId: string, reason?: string) => Promise<void>;
  timeoutSession: (abortedStepId?: string, reason?: string) => Promise<void>;
  syncOfflineAnalytics: () => Promise<void>;
}

export interface KioskPlayerProviderProps {
  children: React.ReactNode;
  initialJourney?: KioskJourney | null;
  initialStepIndex?: number;
  initialSession?: KioskSession | null;
  initialStatus?: KioskSessionStatus | 'idle';
}

const KioskPlayerContext = createContext<KioskPlayerContextProps | undefined>(undefined);

export const KioskPlayerProvider: React.FC<KioskPlayerProviderProps> = ({
  children,
  initialJourney = null,
  initialStepIndex = 0,
  initialSession = null,
  initialStatus = 'idle'
}) => {
  const [journey, setJourney] = useState<KioskJourney | null>(initialJourney);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(initialStepIndex);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    initialJourney?.languages?.[0] || 'en'
  );
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showSubtitles, setShowSubtitles] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);
  const [signedParamsState, setSignedParamsState] = useState<{ o: string; exp: string; sig: string } | undefined>(undefined);

  // K-EMP-002: Backend KioskSession entity and lifecycle status
  const [activeSession, setActiveSession] = useState<KioskSession | null>(initialSession);
  const [sessionStatus, setSessionStatus] = useState<KioskSessionStatus | 'idle'>(initialStatus);

  // Internal tracking refs for high-frequency events and avoiding stale closures
  const activeSessionIdRef = useRef<string | null>(initialSession?._id || null);
  const completedStepIdsRef = useRef<Set<string>>(new Set(initialSession?.completedStepIds || []));
  const lastProgressUpdateRef = useRef<number>(0);
  const sessionStartTimeRef = useRef<number>(Date.now());
  const currentStepIndexRef = useRef<number>(initialStepIndex);

  // Synchronize currentStepIndexRef
  useEffect(() => {
    currentStepIndexRef.current = currentStepIndex;
  }, [currentStepIndex]);

  const activeAnalyticsRef = useRef<{
    journeyId: string;
    journeyVersion: number;
    languageUsed: string;
    startTime: number;
    interactions: KioskUserInteraction[];
  } | null>(null);

  // Load initial offline queue from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('kiosk_offline_analytics');
      if (stored) {
        setOfflineQueue(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Failed to load offline analytics queue from storage', err);
    }
  }, []);

  // Sync state offlineQueue with localStorage
  const saveOfflineQueue = (newQueue: any[]) => {
    setOfflineQueue(newQueue);
    try {
      localStorage.setItem('kiosk_offline_analytics', JSON.stringify(newQueue));
    } catch (err) {
      console.error('Failed to write offline analytics queue to storage', err);
    }
  };

  const loadJourney = async (journeyId: string, signedParams?: { o: string; exp: string; sig: string }) => {
    setIsLoading(true);
    setError(null);
    setSignedParamsState(signedParams);
    try {
      let data: KioskJourney;
      if (signedParams) {
        data = await kioskService.getPublicPlaybackJourney(journeyId, signedParams);
      } else {
        data = await kioskService.getJourney(journeyId);
      }
      setJourney(data);
      setCurrentStepIndex(0);
      
      // Auto-select first available language
      if (data.languages && data.languages.length > 0) {
        setSelectedLanguage(data.languages[0]);
      } else {
        setSelectedLanguage('en');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load kiosk journey');
      setJourney(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to send throttled step progress updates to backend (Requirement 4)
  const sendProgressUpdate = async (nextStepId: string, completedStepId?: string, force = false) => {
    if (completedStepId) {
      completedStepIdsRef.current.add(completedStepId);
    }

    const sessionId = activeSessionIdRef.current;
    if (!sessionId) return;

    const now = Date.now();
    const timeSinceLast = now - lastProgressUpdateRef.current;

    // Requirement 4: Throttle progress updates to step change boundaries or minimum 10-second intervals
    if (!force && timeSinceLast < 10000 && !completedStepId) {
      return;
    }

    lastProgressUpdateRef.current = now;
    const durationSeconds = Math.max(0, Math.round((now - sessionStartTimeRef.current) / 1000));

    try {
      const updated = await kioskService.updateSessionProgress(sessionId, {
        currentStepId: nextStepId,
        completedStepId,
        completedStepIds: Array.from(completedStepIdsRef.current),
        durationSeconds
      });
      setActiveSession(updated);
      setSessionStatus(updated.status);
    } catch (err) {
      console.warn('Failed to update session progress:', err);
    }
  };

  const setStepIndex = (index: number) => {
    if (!journey) return;
    if (index >= 0 && index < journey.steps.length) {
      const currentIndex = currentStepIndexRef.current;
      const prevStepId = journey.steps[currentIndex]?.id;
      const targetStepId = journey.steps[index]?.id;
      currentStepIndexRef.current = index;
      setCurrentStepIndex(index);
      setIsPlayingAudio(false); // Reset audio state for new step

      if (index > currentIndex && prevStepId && targetStepId) {
        sendProgressUpdate(targetStepId, prevStepId, true);
      } else if (targetStepId) {
        sendProgressUpdate(targetStepId, undefined, true);
      }
    }
  };

  const nextStep = () => {
    if (!journey) return;
    const currentIndex = currentStepIndexRef.current;
    if (currentIndex < journey.steps.length - 1) {
      const prevStepId = journey.steps[currentIndex]?.id;
      const nextIndex = currentIndex + 1;
      const nextStepId = journey.steps[nextIndex]?.id || 'unknown';

      currentStepIndexRef.current = nextIndex;
      recordInteraction('next');
      setCurrentStepIndex(nextIndex);
      setIsPlayingAudio(false);

      // Acceptance Criteria 2: Step 1 is recorded in completedStepIds on server
      sendProgressUpdate(nextStepId, prevStepId, true);
    }
  };

  const prevStep = () => {
    const currentIndex = currentStepIndexRef.current;
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      const targetStepId = journey?.steps[prevIndex]?.id || 'unknown';
      currentStepIndexRef.current = prevIndex;
      recordInteraction('prev');
      setCurrentStepIndex(prevIndex);
      setIsPlayingAudio(false);
      sendProgressUpdate(targetStepId, undefined, true);
    }
  };

  const changeLanguage = (lang: string) => {
    setSelectedLanguage(lang);
    recordInteraction(`lang_change_${lang}`);
  };

  const toggleMuted = () => {
    setIsMuted((prev) => !prev);
  };

  const toggleSubtitles = () => {
    setShowSubtitles((prev) => !prev);
  };

  const setPlayingAudio = (playing: boolean) => {
    setIsPlayingAudio(playing);
  };

  // --- K-EMP-002: Ephemeral Session Lifecycle State Machine ---

  const startSession = async (options?: {
    journeyVersionId?: string;
    versionNumber?: number;
  }): Promise<KioskSession | null> => {
    if (!journey) return null;

    // Reset session trackers
    completedStepIdsRef.current = new Set();
    sessionStartTimeRef.current = Date.now();
    lastProgressUpdateRef.current = Date.now();

    activeAnalyticsRef.current = {
      journeyId: journey._id,
      journeyVersion: journey.publishing.version || 1,
      languageUsed: selectedLanguage,
      startTime: Date.now(),
      interactions: []
    };

    const deviceId = deviceIdentityService.getHardwareGuidSync() || 'standalone-kiosk';
    const journeyVersionId = options?.journeyVersionId || (journey.publishing as any)?.activeVersionId || null;
    const versionNumber = options?.versionNumber || journey.publishing?.version || 1;

    // Frontline worker identification / anonymous check (Requirements 2 & 3)
    const employeeUser = deviceIdentityService.getEmployeeUser();
    const userId = employeeUser?.id || employeeUser?._id || null;

    try {
      const session = await kioskService.createSession({
        deviceId,
        journeyId: journey._id,
        journeyVersionId,
        versionNumber,
        userId,
        currentStepId: journey.steps[0]?.id || 's1'
      });

      activeSessionIdRef.current = session._id;
      setActiveSession(session);
      setSessionStatus(session.status);
      return session;
    } catch (err) {
      console.warn('Backend KioskSession creation failed (falling back to local memory):', err);
      setSessionStatus('active');
      return null;
    }
  };

  const recordInteraction = (elementClicked: string) => {
    if (!activeAnalyticsRef.current || !journey) return;
    const stepId = journey.steps[currentStepIndex]?.id || 'unknown';
    const newInteraction: KioskUserInteraction = {
      stepId,
      elementClicked,
      timestamp: new Date().toISOString()
    };
    activeAnalyticsRef.current.interactions.push(newInteraction);
  };

  const getLocalDateKey = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const completeSession = async (completionData?: {
    quizScore?: number;
    ppeItemsVerified?: string[];
    verificationChecksum?: string;
  }) => {
    const sessionId = activeSessionIdRef.current;
    const currentDuration = sessionStartTimeRef.current
      ? Math.max(0, Math.round((Date.now() - sessionStartTimeRef.current) / 1000))
      : 0;

    if (sessionId) {
      try {
        const updated = await kioskService.completeSession(sessionId, {
          durationSeconds: currentDuration,
          quizScore: completionData?.quizScore,
          ppeItemsVerified: completionData?.ppeItemsVerified,
          verificationChecksum: completionData?.verificationChecksum
        });
        setActiveSession(updated);
        setSessionStatus(updated.status);
      } catch (err) {
        console.warn('Failed to complete session on server:', err);
        setSessionStatus('completed');
      }
    } else {
      setSessionStatus('completed');
    }

    // Legacy analytics sync
    if (activeAnalyticsRef.current && journey) {
      const session = activeAnalyticsRef.current;
      const durationSeconds = Math.round((Date.now() - session.startTime) / 1000);
      const metrics: KioskSessionMetrics = {
        launchesCount: 1,
        completedCount: 1,
        durationSeconds
      };

      const analyticsRecord: Partial<KioskAnalytics> = {
        journeyId: session.journeyId,
        journeyVersion: session.journeyVersion,
        languageUsed: session.languageUsed,
        metrics,
        interactions: session.interactions,
        dateKey: getLocalDateKey()
      };

      try {
        await kioskService.syncAnalytics(
          [analyticsRecord],
          signedParamsState ? { ...signedParamsState, journeyId: journey._id } : undefined
        );
      } catch (err) {
        console.warn('Analytics sync failed. Queueing session offline...', err);
        saveOfflineQueue([...offlineQueue, analyticsRecord]);
      }
    }

    activeSessionIdRef.current = null;
    activeAnalyticsRef.current = null;
  };

  const abortSession = async (abortedStepId: string, reason?: string) => {
    const sessionId = activeSessionIdRef.current;
    const currentDuration = sessionStartTimeRef.current
      ? Math.max(0, Math.round((Date.now() - sessionStartTimeRef.current) / 1000))
      : 0;

    if (sessionId) {
      try {
        const updated = await kioskService.abortSession(sessionId, {
          abortedStepId,
          reason,
          durationSeconds: currentDuration
        });
        setActiveSession(updated);
        setSessionStatus('aborted');
      } catch (err) {
        console.warn('Failed to abort session on server:', err);
        setSessionStatus('aborted');
      }
    } else {
      setSessionStatus('aborted');
    }

    // Legacy analytics sync for abort
    if (activeAnalyticsRef.current && journey) {
      const session = activeAnalyticsRef.current;
      const durationSeconds = Math.round((Date.now() - session.startTime) / 1000);
      const metrics: KioskSessionMetrics = {
        launchesCount: 1,
        completedCount: 0,
        durationSeconds,
        abortedStepId
      };

      const analyticsRecord: Partial<KioskAnalytics> = {
        journeyId: session.journeyId,
        journeyVersion: session.journeyVersion,
        languageUsed: session.languageUsed,
        metrics,
        interactions: session.interactions,
        dateKey: getLocalDateKey()
      };

      try {
        await kioskService.syncAnalytics(
          [analyticsRecord],
          signedParamsState ? { ...signedParamsState, journeyId: journey._id } : undefined
        );
      } catch (err) {
        console.warn('Analytics sync failed. Queueing aborted session offline...', err);
        saveOfflineQueue([...offlineQueue, analyticsRecord]);
      }
    }

    activeSessionIdRef.current = null;
    activeAnalyticsRef.current = null;
  };

  const timeoutSession = async (abortedStepId?: string, reason?: string) => {
    const sessionId = activeSessionIdRef.current;
    const currentDuration = sessionStartTimeRef.current
      ? Math.max(0, Math.round((Date.now() - sessionStartTimeRef.current) / 1000))
      : 0;

    if (sessionId) {
      try {
        const updated = await kioskService.timeoutSession(sessionId, {
          abortedStepId: abortedStepId || journey?.steps[currentStepIndex]?.id,
          reason: reason || 'Idle timeout exceeded (privacy reset)',
          durationSeconds: currentDuration
        });
        setActiveSession(updated);
        setSessionStatus('timed_out');
      } catch (err) {
        console.warn('Failed to timeout session on server:', err);
        setSessionStatus('timed_out');
      }
    } else {
      setSessionStatus('timed_out');
    }

    activeSessionIdRef.current = null;
    activeAnalyticsRef.current = null;
  };

  const recordPpeCompliance = async (stepId: string, itemsChecked: string[]) => {
    if (!journey) return;

    const interactions: KioskUserInteraction[] = [
      ...itemsChecked.map((item) => ({
        stepId,
        elementClicked: `ppe_check_${item.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        eventType: 'PPE_ITEM_CHECKED',
        timestamp: new Date().toISOString()
      })),
      {
        stepId,
        elementClicked: 'ppe_confirm',
        eventType: 'PPE_COMPLIANCE_CONFIRMED',
        timestamp: new Date().toISOString()
      }
    ];

    const durationSeconds = activeAnalyticsRef.current 
      ? Math.max(1, Math.round((Date.now() - activeAnalyticsRef.current.startTime) / 1000))
      : 15;

    const metrics: KioskSessionMetrics = {
      launchesCount: 1,
      completedCount: 1,
      durationSeconds
    };

    const analyticsRecord: Partial<KioskAnalytics> = {
      journeyId: journey._id,
      journeyVersion: journey.publishing.version || 1,
      languageUsed: selectedLanguage,
      stepId,
      eventType: 'PPE_COMPLIANCE_CONFIRMED',
      metrics,
      interactions,
      dateKey: getLocalDateKey()
    };

    try {
      await kioskService.syncAnalytics(
        [analyticsRecord],
        signedParamsState ? { ...signedParamsState, journeyId: journey._id } : undefined
      );
    } catch (err) {
      console.warn('PPE Analytics sync failed. Queueing session offline...', err);
      saveOfflineQueue([...offlineQueue, analyticsRecord]);
    }
  };

  const syncOfflineAnalytics = async () => {
    if (offlineQueue.length === 0) return;
    try {
      await kioskService.syncAnalytics(
        offlineQueue,
        signedParamsState && journey ? { ...signedParamsState, journeyId: journey._id } : undefined
      );
      saveOfflineQueue([]);
      console.log('Successfully synchronized offline analytics queue.');
    } catch (err) {
      console.warn('Failed to sync offline queue. Retrying later.', err);
    }
  };

  // Heartbeat progress updates every 10 seconds while session is active (Requirement 4)
  useEffect(() => {
    if (!activeSessionIdRef.current || sessionStatus !== 'active' || !journey) return;

    const interval = setInterval(() => {
      const currentStepId = journey.steps[currentStepIndex]?.id || 'unknown';
      sendProgressUpdate(currentStepId, undefined, false);
    }, 10000);

    return () => clearInterval(interval);
  }, [journey, currentStepIndex, sessionStatus]);

  // Auto-retry syncing offline queue periodically when online
  useEffect(() => {
    const handleOnline = () => {
      syncOfflineAnalytics();
    };

    window.addEventListener('online', handleOnline);
    
    const interval = setInterval(() => {
      if (navigator.onLine) {
        syncOfflineAnalytics();
      }
    }, 120000);

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  }, [offlineQueue]);

  return (
    <KioskPlayerContext.Provider
      value={{
        journey,
        currentStepIndex,
        selectedLanguage,
        isPlayingAudio,
        isMuted,
        showSubtitles,
        isLoading,
        error,
        offlineQueueCount: offlineQueue.length,
        activeSession,
        sessionStatus,
        signedParams: signedParamsState,
        loadJourney,
        setStepIndex,
        nextStep,
        prevStep,
        changeLanguage,
        setPlayingAudio,
        toggleMuted,
        toggleSubtitles,
        startSession,
        recordInteraction,
        completeSession,
        abortSession,
        timeoutSession,
        recordPpeCompliance,
        syncOfflineAnalytics
      }}
    >
      {children}
    </KioskPlayerContext.Provider>
  );
};

export const useKioskPlayer = () => {
  const context = useContext(KioskPlayerContext);
  if (!context) {
    throw new Error('useKioskPlayer must be used within a KioskPlayerProvider');
  }
  return context;
};

export default KioskPlayerContext;
