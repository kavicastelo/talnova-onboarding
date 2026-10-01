import { useEffect, useState, useCallback } from 'react';
import {
  kioskLockdownService,
  KioskLockdownOptions,
  KioskLockdownState
} from '../services/kiosk-lockdown.service';

export interface UseKioskLockdownOptions extends KioskLockdownOptions {
  enabled?: boolean;
}

export function useKioskLockdown(options: UseKioskLockdownOptions = {}) {
  const { enabled = true, ...lockdownOptions } = options;
  const [state, setState] = useState<KioskLockdownState>(() => kioskLockdownService.getState());

  useEffect(() => {
    const unsubscribe = kioskLockdownService.subscribe((nextState) => {
      setState(nextState);
    });

    if (enabled) {
      kioskLockdownService.startLockdown(lockdownOptions);
    }

    return () => {
      unsubscribe();
      if (enabled) {
        kioskLockdownService.stopLockdown();
      }
    };
  }, [enabled]);

  const requestFullscreen = useCallback(async (targetElement?: Element | null) => {
    return await kioskLockdownService.requestFullscreen(targetElement);
  }, []);

  const exitFullscreen = useCallback(async () => {
    return await kioskLockdownService.exitFullscreen();
  }, []);

  const dismissReenterPrompt = useCallback(() => {
    kioskLockdownService.dismissReenterPrompt();
  }, []);

  const showReenterPrompt = useCallback(() => {
    kioskLockdownService.showReenterPrompt();
  }, []);

  const verifyExitPin = useCallback(async (enteredPin: string, expectedPin?: string) => {
    return await kioskLockdownService.verifyExitPin(enteredPin, expectedPin);
  }, []);

  return {
    ...state,
    requestFullscreen,
    exitFullscreen,
    dismissReenterPrompt,
    showReenterPrompt,
    verifyExitPin
  };
}
