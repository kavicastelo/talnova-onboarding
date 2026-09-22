import { useState, useEffect, useCallback, useRef } from 'react';
import { useWorkspaceSettings } from './useSettings';
import { useCurrentUser } from './useAuth';
import { toast } from 'sonner';
import { apiClient } from '../api/client';

const LAST_ACTIVITY_KEY = 'talnova_last_activity';
const THROTTLE_MS = 1000;

export interface SessionTimeoutState {
  isWarningOpen: boolean;
  secondsRemaining: number;
  timeoutSeconds: number;
  stayLoggedIn: () => void;
  logoutNow: () => void;
}

export function useSessionTimeout(): SessionTimeoutState {
  const { data: user } = useCurrentUser();
  const { data: settings } = useWorkspaceSettings();

  // Configured timeout in seconds (default 3600s = 60 minutes, minimum 60s)
  const timeoutSeconds = Math.max(60, Number(settings?.security?.sessionTimeout) || 3600);
  const warningWindowSeconds = Math.min(60, Math.max(15, Math.floor(timeoutSeconds * 0.2)));

  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(warningWindowSeconds);

  const lastActivityRef = useRef<number>(Date.now());
  const lastRecordedEventRef = useRef<number>(0);
  const isLoggingOutRef = useRef<boolean>(false);

  // Initialize or read last activity from localStorage
  const getLatestActivity = useCallback((): number => {
    try {
      const stored = localStorage.getItem(LAST_ACTIVITY_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore localStorage errors
    }
    return Date.now();
  }, []);

  // Update activity timestamp both in memory and localStorage
  const recordActivity = useCallback(() => {
    const now = Date.now();
    // Throttle writing to localStorage
    if (now - lastRecordedEventRef.current < THROTTLE_MS) return;

    lastRecordedEventRef.current = now;
    lastActivityRef.current = now;
    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    } catch {
      // ignore
    }

    // If warning was previously open but user acted, close warning
    if (isWarningOpen) {
      setIsWarningOpen(false);
    }
  }, [isWarningOpen]);

  // Gracefully perform logout
  const logoutNow = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    setIsWarningOpen(false);

    try {
      await apiClient.post('/auth/logout').catch(() => {});
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_role');
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      window.location.href = '/login?reason=session_timeout';
    }
  }, []);

  // Stay logged in button handler
  const stayLoggedIn = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    lastRecordedEventRef.current = now;
    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    } catch {
      // ignore
    }
    setIsWarningOpen(false);
    setSecondsRemaining(warningWindowSeconds);
    toast.success('Session extended. You are still signed in.');
  }, [warningWindowSeconds]);

  // Listen to user interaction events across window
  useEffect(() => {
    if (!user || !localStorage.getItem('auth_token')) return;

    // Set initial activity
    const initial = getLatestActivity();
    lastActivityRef.current = initial;

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    const handleUserEvent = () => recordActivity();

    events.forEach((evt) => {
      window.addEventListener(evt, handleUserEvent, { passive: true });
    });

    // Listen to localStorage changes across browser tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LAST_ACTIVITY_KEY && e.newValue) {
        const remoteTime = parseInt(e.newValue, 10);
        if (!isNaN(remoteTime)) {
          lastActivityRef.current = remoteTime;
          if (isWarningOpen) {
            setIsWarningOpen(false);
          }
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleUserEvent);
      });
      window.removeEventListener('storage', handleStorage);
    };
  }, [user, recordActivity, getLatestActivity, isWarningOpen]);

  // 1-second heartbeat interval to verify idle status
  useEffect(() => {
    if (!user || !localStorage.getItem('auth_token')) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const latest = Math.max(lastActivityRef.current, getLatestActivity());
      const elapsedSeconds = Math.floor((now - latest) / 1000);
      const remaining = timeoutSeconds - elapsedSeconds;

      if (remaining <= 0) {
        clearInterval(interval);
        toast.error('Your session has expired due to inactivity.');
        logoutNow();
      } else if (remaining <= warningWindowSeconds) {
        setSecondsRemaining(remaining);
        setIsWarningOpen(true);
      } else {
        if (isWarningOpen) {
          setIsWarningOpen(false);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [user, timeoutSeconds, warningWindowSeconds, getLatestActivity, isWarningOpen, logoutNow]);

  return {
    isWarningOpen,
    secondsRemaining,
    timeoutSeconds,
    stayLoggedIn,
    logoutNow,
  };
}
