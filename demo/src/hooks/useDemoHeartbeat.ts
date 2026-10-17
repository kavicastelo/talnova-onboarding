import { useEffect, useState, useRef } from 'react';
import { apiClient } from '../../../src/api/client';
import { useDemoAuth } from '../context/DemoAuthContext';

export interface DemoHeartbeatOptions {
  intervalMs?: number;
  enabled?: boolean;
  onTerminated?: (reason?: string) => void;
}

export interface DemoHeartbeatState {
  isTerminated: boolean;
  terminationReason?: string;
  command?: 'TERMINATE' | 'FREEZE' | 'CONTINUE';
}

/**
 * Lightweight 30s heartbeat hook for the demo application.
 * Verifies active session validity, detects remote admin revocation/freeze,
 * and purges tokens upon killswitch activation.
 */
export function useDemoHeartbeat(options: DemoHeartbeatOptions = {}) {
  const { intervalMs = 30000, enabled = true, onTerminated } = options;
  const { isAuthenticated, logout } = useDemoAuth();
  const [state, setState] = useState<DemoHeartbeatState>({
    isTerminated: false,
  });

  const isTerminatedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !isAuthenticated) return;

    const executeHeartbeat = async () => {
      if (isTerminatedRef.current) return;

      try {
        const res = await apiClient.post('/demo/auth/heartbeat');
        const data = res.data?.data || res.data;

        if (data && (data.active === false || data.command === 'TERMINATE' || data.command === 'FREEZE')) {
          handleTermination(data.reason || 'Session terminated by platform administrator.', data.command);
        }
      } catch (err: any) {
        const errorCode = err?.response?.data?.error || err?.response?.data?.code || err?.code;
        const errorMessage = err?.response?.data?.message || err?.message;

        if (errorCode === 'SESSION_REVOKED' || errorMessage?.includes('terminated') || errorMessage?.includes('frozen')) {
          handleTermination(errorMessage || 'Session revoked by administrator.', 'TERMINATE');
        }
      }
    };

    const handleTermination = (reason: string, command: 'TERMINATE' | 'FREEZE' = 'TERMINATE') => {
      isTerminatedRef.current = true;
      setState({
        isTerminated: true,
        terminationReason: reason,
        command,
      });

      // Purge all tokens and credentials
      try {
        localStorage.removeItem('demo_access_token');
        localStorage.removeItem('demo_active_user');
        localStorage.removeItem('demo_persona');
        sessionStorage.clear();
      } catch {
        // Safe fallback
      }

      if (logout) {
        try {
          logout();
        } catch {
          // Safe fallback
        }
      }

      if (onTerminated) {
        onTerminated(reason);
      }
    };

    const intervalId = setInterval(executeHeartbeat, intervalMs);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, isAuthenticated, intervalMs, logout, onTerminated]);

  return state;
}
