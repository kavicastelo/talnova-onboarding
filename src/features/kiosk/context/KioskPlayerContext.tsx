import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { KioskJourney } from '../../../types/kiosk/journey.types';
import { KioskAnalytics, KioskUserInteraction, KioskSessionMetrics } from '../../../types/kiosk/analytics.types';
import { kioskService } from '../services/kiosk.service';

interface KioskPlayerContextProps {
  journey: KioskJourney | null;
  currentStepIndex: number;
  selectedLanguage: string;
  isPlayingAudio: boolean;
  isMuted: boolean;
  showSubtitles: boolean;
  isLoading: boolean;
  error: string | null;
  offlineQueueCount: number;
  
  loadJourney: (journeyId: string, signedParams?: { o: string; exp: string; sig: string }) => Promise<void>;
  setStepIndex: (index: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  changeLanguage: (lang: string) => void;
  setPlayingAudio: (playing: boolean) => void;
  toggleMuted: () => void;
  toggleSubtitles: () => void;
  
  // Analytics session triggers
  startSession: () => void;
  recordInteraction: (elementClicked: string) => void;
  completeSession: () => void;
  abortSession: (abortedStepId: string) => void;
  syncOfflineAnalytics: () => Promise<void>;
}

const KioskPlayerContext = createContext<KioskPlayerContextProps | undefined>(undefined);

export const KioskPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [journey, setJourney] = useState<KioskJourney | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showSubtitles, setShowSubtitles] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);

  // Track session details using refs to avoid stale closures in event handlers
  const activeSessionRef = useRef<{
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

  const setStepIndex = (index: number) => {
    if (!journey) return;
    if (index >= 0 && index < journey.steps.length) {
      setCurrentStepIndex(index);
      setIsPlayingAudio(false); // Reset audio state for new step
    }
  };

  const nextStep = () => {
    if (!journey) return;
    if (currentStepIndex < journey.steps.length - 1) {
      recordInteraction('next');
      setStepIndex(currentStepIndex + 1);
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      recordInteraction('prev');
      setStepIndex(currentStepIndex - 1);
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

  // --- Analytics Session Management ---

  const startSession = () => {
    if (!journey) return;
    activeSessionRef.current = {
      journeyId: journey._id,
      journeyVersion: journey.publishing.version || 1,
      languageUsed: selectedLanguage,
      startTime: Date.now(),
      interactions: []
    };
  };

  const recordInteraction = (elementClicked: string) => {
    if (!activeSessionRef.current || !journey) return;
    const stepId = journey.steps[currentStepIndex]?.id || 'unknown';
    const newInteraction: KioskUserInteraction = {
      stepId,
      elementClicked,
      timestamp: new Date().toISOString()
    };
    activeSessionRef.current.interactions.push(newInteraction);
  };

  const getLocalDateKey = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const completeSession = async () => {
    if (!activeSessionRef.current || !journey) return;
    const session = activeSessionRef.current;
    activeSessionRef.current = null; // Clear active session immediately

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
      await kioskService.syncAnalytics([analyticsRecord]);
    } catch (err) {
      console.warn('Analytics sync failed. Queueing session offline...', err);
      saveOfflineQueue([...offlineQueue, analyticsRecord]);
    }
  };

  const abortSession = async (abortedStepId: string) => {
    if (!activeSessionRef.current || !journey) return;
    const session = activeSessionRef.current;
    activeSessionRef.current = null; // Clear active session immediately

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
      await kioskService.syncAnalytics([analyticsRecord]);
    } catch (err) {
      console.warn('Analytics sync failed. Queueing aborted session offline...', err);
      saveOfflineQueue([...offlineQueue, analyticsRecord]);
    }
  };

  const syncOfflineAnalytics = async () => {
    if (offlineQueue.length === 0) return;
    try {
      await kioskService.syncAnalytics(offlineQueue);
      saveOfflineQueue([]); // Success: clear local queue
      console.log('Successfully synchronized offline analytics queue.');
    } catch (err) {
      console.warn('Failed to sync offline queue. Retrying later.', err);
    }
  };

  // Auto-retry syncing offline queue periodically when online
  useEffect(() => {
    const handleOnline = () => {
      syncOfflineAnalytics();
    };

    window.addEventListener('online', handleOnline);
    
    // Interval check every 2 minutes
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
