import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { KioskJourney } from '../../../types/kiosk/journey.types';
import { KioskAnalytics, KioskUserInteraction, KioskSessionMetrics } from '../../../types/kiosk/analytics.types';
import { KioskSession, KioskSessionStatus } from '../../../types/kiosk/session.types';
import { kioskService } from '../services/kiosk.service';
import { deviceIdentityService } from '../services/device-identity.service';
import { antiTamperingService } from '../services/anti-tampering.service';
import { offlineStorageService } from '../services/offline-storage.service';
import { kioskWatchdogService } from '../services/kiosk-watchdog.service';
import { powerRecoveryService } from '../services/power-recovery.service';

export interface KioskPlayerContextProps {
  journey: KioskJourney | null;
  currentStepIndex: number;
  selectedLanguage: string;
  isPlayingAudio: boolean;
  isMuted: boolean;
  volume: number;
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
  setVolume: (volume: number) => void;
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

export function normalizeJourneyData(rawJourney: any): KioskJourney | null {
  if (!rawJourney) return null;
  const normalized = { ...rawJourney };

  // If steps are missing or empty, but slides are present, convert slides to steps
  if ((!normalized.steps || normalized.steps.length === 0) && Array.isArray(normalized.slides) && normalized.slides.length > 0) {
    normalized.steps = normalized.slides.map((slide: any, idx: number) => {
      const stepId = slide.id || `step-${idx + 1}`;
      const title = slide.title || `Step ${idx + 1}`;
      const contentText = slide.content || slide.text || slide.description || '';

      const blocks = Array.isArray(slide.blocks) && slide.blocks.length > 0
        ? slide.blocks
        : [
            {
              id: `block-${stepId}-text`,
              type: 'text' as const,
              order: 0,
              mediaReferences: {
                en: {
                  textValue: contentText
                }
              }
            }
          ];

      return {
        id: stepId,
        type: (slide.type === 'quiz' ? 'quiz_step' : 'standard_step') as any,
        title,
        order: typeof slide.order === 'number' ? slide.order : idx,
        blocks,
        interaction: slide.interaction || {
          type: 'tap_to_continue' as const
        },
        requireSupervisorWitness: Boolean(slide.requireSupervisorWitness)
      };
    });
  }

  // If steps exist, ensure each step has valid blocks with mediaReferences
  if (Array.isArray(normalized.steps)) {
    normalized.steps = normalized.steps.map((st: any, idx: number) => {
      const stepId = st.id || `step-${idx + 1}`;
      let blocks = Array.isArray(st.blocks) ? [...st.blocks] : [];
      if (blocks.length === 0 && (st.content || st.text || st.description)) {
        blocks = [
          {
            id: `block-${stepId}-text`,
            type: 'text' as const,
            order: 0,
            mediaReferences: {
              en: {
                textValue: st.content || st.text || st.description
              }
            }
          }
        ];
      }
      return {
        ...st,
        id: stepId,
        order: typeof st.order === 'number' ? st.order : idx,
        blocks,
        interaction: st.interaction || { type: 'tap_to_continue' as const }
      };
    });
  }

  return normalized as KioskJourney;
}

export const KioskPlayerProvider: React.FC<KioskPlayerProviderProps> = ({
  children,
  initialJourney = null,
  initialStepIndex = 0,
  initialSession = null,
  initialStatus = 'idle'
}) => {
  const [journey, setJourney] = useState<KioskJourney | null>(() => normalizeJourneyData(initialJourney));
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(initialStepIndex);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    initialJourney?.languages?.[0] || 'en'
  );
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolumeState] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kiosk_volume');
      return saved !== null ? Math.max(0, Math.min(1, parseFloat(saved))) : 0.8;
    }
    return 0.8;
  });
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

  // Synchronize currentStepIndexRef and checkpoint mid-session progress (K-REL-001 & K-REL-002)
  useEffect(() => {
    currentStepIndexRef.current = currentStepIndex;
    if (journey?._id && typeof currentStepIndex === 'number') {
      kioskWatchdogService.saveCheckpoint({
        journeyId: journey._id,
        stepIndex: currentStepIndex,
        timestamp: Date.now(),
        completedStepIds: Array.from(completedStepIdsRef.current),
        sessionToken: activeSession?.sessionToken,
        userId: activeSession?.userId
      }).catch((err) => {
        console.warn('[KioskPlayerContext] Checkpoint auto-save warning:', err);
      });

      // K-REL-002: Automatic step checkpointing in IndexedDB ('active_session_checkpoint') upon every step transition
      powerRecoveryService.saveStepCheckpoint({
        journeyId: journey._id,
        journeyTitle: journey.title,
        stepIndex: currentStepIndex,
        stepTitle: journey.steps?.[currentStepIndex]?.title,
        totalSteps: journey.steps?.length || 0,
        completedStepIds: Array.from(completedStepIdsRef.current),
        sessionToken: activeSession?.sessionToken,
        sessionId: activeSession?._id,
        userId: activeSession?.userId
      }).catch((err) => {
        console.warn('[KioskPlayerContext] Power recovery checkpoint auto-save warning:', err);
      });
    }
  }, [currentStepIndex, journey, activeSession?.sessionToken, activeSession?._id, activeSession?.userId]);

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

    // Fast immediate availability check: initialJourney or current journey
    let data: KioskJourney | null =
      (journey && journey._id === journeyId)
        ? journey
        : (initialJourney && initialJourney._id === journeyId)
        ? initialJourney
        : null;

    // Fast local fallback: Check IndexedDB offline storage
    if (!data) {
      try {
        const cachedVersion = await offlineStorageService.getLatestJourneyVersion(journeyId);
        if (cachedVersion && cachedVersion.snapshot) {
          data = cachedVersion.snapshot as KioskJourney;
        }
      } catch (offlineErr) {
        console.warn('[KioskPlayerContext] Offline storage inspection warning:', offlineErr);
      }
    }

    if (data) {
      const normalizedData = normalizeJourneyData(data);
      data = normalizedData;
      setJourney(normalizedData);
    }

    try {
      let serverData: KioskJourney;
      if (signedParams) {
        serverData = await kioskService.getPublicPlaybackJourney(journeyId, signedParams);
      } else {
        serverData = await kioskService.getJourney(journeyId);
      }
      const normalizedServerData = normalizeJourneyData(serverData);
      data = normalizedServerData;
      setJourney(normalizedServerData);
    } catch (err: any) {
      if (!data) {
        setError(err?.response?.data?.message || err?.message || 'Failed to load kiosk journey');
        setJourney(null);
        return;
      }
      console.info('[KioskPlayerContext] Running on local/cached journey snapshot.');
    } finally {
      setIsLoading(false);
    }

    if (data) {
      let targetStep = initialStepIndex || 0;
      if (targetStep === 0) {
        try {
          const powerCp = await powerRecoveryService.getActiveCheckpoint();
          if (powerCp && powerCp.journeyId === journeyId && typeof powerCp.stepIndex === 'number' && powerCp.stepIndex > 0) {
            targetStep = powerCp.stepIndex;
          } else {
            const checkpoint = await kioskWatchdogService.getCheckpoint(journeyId);
            if (checkpoint && typeof checkpoint.stepIndex === 'number' && checkpoint.stepIndex > 0) {
              targetStep = checkpoint.stepIndex;
            }
          }
        } catch (cpErr) {
          console.warn('[KioskPlayerContext] Checkpoint inspection error:', cpErr);
        }
      }
      setCurrentStepIndex(targetStep);
      currentStepIndexRef.current = targetStep;

      // Auto-select first available language
      if (data.languages && data.languages.length > 0) {
        setSelectedLanguage(data.languages[0]);
      } else {
        setSelectedLanguage('en');
      }
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

    // K-SEC-003: Attach HMAC payload signature verifying monotonic client timers
    const signedPayload = antiTamperingService.signStepProgressionPayload({
      sessionId,
      currentStepId: nextStepId,
      completedStepId,
      completedStepIds: Array.from(completedStepIdsRef.current),
      durationSeconds
    });

    try {
      const updated = await kioskService.updateSessionProgress(sessionId, signedPayload);
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
    setIsMuted((prev) => {
      const next = !prev;
      if (!next && volume === 0) {
        setVolumeState(0.8);
        if (typeof window !== 'undefined') {
          localStorage.setItem('kiosk_volume', '0.8');
        }
      }
      return next;
    });
  };

  const setVolume = (vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kiosk_volume', String(clamped));
    }
    if (clamped === 0) {
      setIsMuted(true);
    } else if (isMuted && clamped > 0) {
      setIsMuted(false);
    }
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
      antiTamperingService.initSessionMonotonicTimer(session._id);
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
        console.warn('Failed to complete session on server (buffering offline):', err);
        setSessionStatus('completed');
        try {
          await offlineStorageService.savePendingSession({
            sessionId,
            deviceId: deviceIdentityService.getHardwareGuidSync() || 'standalone-kiosk',
            journeyId: journey?._id || 'unknown',
            journeyVersionId: (journey?.publishing as any)?.activeVersionId,
            versionNumber: journey?.publishing?.version || 1,
            userId: deviceIdentityService.getEmployeeUser()?.id || null,
            durationSeconds: currentDuration,
            quizScore: completionData?.quizScore,
            ppeItemsVerified: completionData?.ppeItemsVerified,
            verificationChecksum: completionData?.verificationChecksum,
            completedStepIds: Array.from(completedStepIdsRef.current)
          });
        } catch (storageErr) {
          console.error('Failed to buffer completed offline session:', storageErr);
        }
      }
    } else {
      setSessionStatus('completed');
      try {
        await offlineStorageService.savePendingSession({
          deviceId: deviceIdentityService.getHardwareGuidSync() || 'standalone-kiosk',
          journeyId: journey?._id || 'unknown',
          journeyVersionId: (journey?.publishing as any)?.activeVersionId,
          versionNumber: journey?.publishing?.version || 1,
          userId: deviceIdentityService.getEmployeeUser()?.id || null,
          durationSeconds: currentDuration,
          quizScore: completionData?.quizScore,
          ppeItemsVerified: completionData?.ppeItemsVerified,
          verificationChecksum: completionData?.verificationChecksum,
          completedStepIds: Array.from(completedStepIdsRef.current)
        });
      } catch (storageErr) {
        console.error('Failed to buffer completed offline session:', storageErr);
      }
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

    if (journey?._id) {
      kioskWatchdogService.purgeCheckpoint(journey._id).catch(() => {});
      powerRecoveryService.purgeCheckpoint().catch(() => {});
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

    if (journey?._id) {
      kioskWatchdogService.purgeCheckpoint(journey._id).catch(() => {});
      powerRecoveryService.purgeCheckpoint().catch(() => {});
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

    if (journey?._id) {
      kioskWatchdogService.purgeCheckpoint(journey._id).catch(() => {});
      powerRecoveryService.purgeCheckpoint().catch(() => {});
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
        volume,
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
        setVolume,
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
