import { useEffect, useRef } from 'react';
import {
  antiTamperingService,
  TamperEvent
} from '../services/anti-tampering.service';

export interface UseAntiTamperingGuardProps {
  containerRef: React.RefObject<HTMLElement | null>;
  canProgress: boolean;
  onTamperDetected?: (event: TamperEvent) => void;
  onResetStepState?: () => void;
  enabled?: boolean;
}

export function useAntiTamperingGuard({
  containerRef,
  canProgress,
  onTamperDetected,
  onResetStepState,
  enabled = true
}: UseAntiTamperingGuardProps) {
  const canProgressRef = useRef(canProgress);
  canProgressRef.current = canProgress;

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const stop = antiTamperingService.startObserving(containerRef.current, {
      canProgress: () => canProgressRef.current,
      onTamperDetected,
      onResetStepState
    });

    return () => {
      stop();
    };
  }, [enabled, containerRef, onTamperDetected, onResetStepState]);

  return {
    antiTamperingService
  };
}
