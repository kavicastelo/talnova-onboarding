/**
 * Talnova Kiosk Terminal - Runtime Crash Watchdog & Error Boundary Unit Test Suite (K-REL-001)
 *
 * Validates:
 * 1. Unhandled component rendering exception caught by KioskErrorBoundary without blank screen.
 * 2. Reassuring visual screen rendered with exact wording:
 *    "We encountered a temporary briefing issue. Automatically restarting in 5 seconds..."
 *    and animated circular progress ring.
 * 3. Diagnostic log capture in IndexedDB: stack trace, active step index, terminal ID.
 * 4. Automated 5-second soft recovery and timer countdown.
 * 5. Mid-session state checkpoint restoration from IndexedDB.
 * 6. Repeated crash loop detection (>2 within 60s), corrupted session purge, and clean return to Home Screen.
 */

import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  KioskErrorBoundary,
  KioskErrorBoundaryState
} from '../features/kiosk/components/KioskErrorBoundary';
import {
  kioskWatchdogService,
  WATCHDOG_DB_NAME
} from '../features/kiosk/services/kiosk-watchdog.service';
import { deviceIdentityService } from '../features/kiosk/services/device-identity.service';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: any) => {
      if (options?.count !== undefined) {
        return `We encountered a temporary briefing issue. Automatically restarting in ${options.count} seconds...`;
      }
      return options?.defaultValue || _key;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() }
  })
}));

describe('K-REL-001: Runtime Crash Watchdog & Error Boundary Suite', () => {
  let sessionStorageMock: Record<string, string>;

  beforeEach(async () => {
    sessionStorageMock = {};
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: {
        getItem: (key: string) => sessionStorageMock[key] ?? null,
        setItem: (key: string, val: string) => {
          sessionStorageMock[key] = String(val);
        },
        removeItem: (key: string) => {
          delete sessionStorageMock[key];
        },
        clear: () => {
          sessionStorageMock = {};
        },
        get length() {
          return Object.keys(sessionStorageMock).length;
        },
        key: (idx: number) => Object.keys(sessionStorageMock)[idx] ?? null
      },
      writable: true,
      configurable: true
    });

    vi.clearAllMocks();
    await kioskWatchdogService.clearAllStorage();
    kioskWatchdogService.resetCrashHistory();
  });

  afterEach(async () => {
    await kioskWatchdogService.close();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. IndexedDB Diagnostic Storage & Schema Validation
  // =========================================================================
  describe('1. IndexedDB Diagnostic Storage & Schema Validation', () => {
    it('initializes kiosk_diagnostics_store with diagnostic_logs and session_checkpoints stores', async () => {
      const db = await kioskWatchdogService.getDb();
      expect(db.name).toBe(WATCHDOG_DB_NAME);

      const storeNames = Array.from(db.objectStoreNames);
      expect(storeNames).toContain('diagnostic_logs');
      expect(storeNames).toContain('session_checkpoints');

      const tx = db.transaction(['diagnostic_logs', 'session_checkpoints'], 'readonly');
      const logStore = tx.objectStore('diagnostic_logs');
      const checkpointStore = tx.objectStore('session_checkpoints');

      expect(Array.from(logStore.indexNames)).toContain('timestamp');
      expect(Array.from(logStore.indexNames)).toContain('terminalId');
      expect(Array.from(logStore.indexNames)).toContain('journeyId');
      expect(Array.from(checkpointStore.indexNames)).toContain('timestamp');
      await tx.done;
    });

    it('captures stack trace, active step index, and terminal ID to IndexedDB diagnostic logs', async () => {
      const testError = new Error('Simulated malformed media tag runtime exception');
      testError.stack = 'Error: Simulated malformed media tag\n    at KioskPlayer (KioskPlayer.tsx:42:15)';

      const crashRes = await kioskWatchdogService.recordCrash({
        error: testError,
        terminalId: 'KSK-FACTORY-001',
        activeStepIndex: 3,
        journeyId: 'journey-safety-101'
      });

      expect(crashRes.crashCount).toBe(1);
      expect(crashRes.isCrashLoop).toBe(false);

      const logs = await kioskWatchdogService.getDiagnosticLogs('KSK-FACTORY-001');
      expect(logs.length).toBe(1);
      expect(logs[0].terminalId).toBe('KSK-FACTORY-001');
      expect(logs[0].activeStepIndex).toBe(3);
      expect(logs[0].journeyId).toBe('journey-safety-101');
      expect(logs[0].errorMessage).toContain('Simulated malformed media tag');
      expect(logs[0].stackTrace).toContain('KioskPlayer.tsx:42:15');
    });
  });

  // =========================================================================
  // 2. Acceptance Criteria: Error Boundary Catching & Reassuring Visual Screen
  // =========================================================================
  describe('2. Error Boundary Catching & Reassuring Visual Screen (Acceptance Criteria)', () => {
    it('catches unhandled component exception and renders reassuring visual screen', () => {
      // Normal state render: renders children cleanly
      const healthyHtml = renderToString(
        <KioskErrorBoundary>
          <div data-testid="healthy-player">Active Briefing Content</div>
        </KioskErrorBoundary>
      );
      expect(healthyHtml).toContain('Active Briefing Content');
      expect(healthyHtml).not.toContain('We encountered a temporary briefing issue');

      // Error state render: instantiate boundary with simulated error state
      const boundary = new KioskErrorBoundary({
        children: <div>Child</div>,
        terminalId: 'KSK-007'
      });
      boundary.state = {
        hasError: true,
        error: new Error('Script execution failure'),
        errorInfo: { componentStack: 'at VideoPlayer' } as any,
        countdown: 5,
        isCrashLoop: false,
        restoredCheckpoint: null,
        diagnosticRecord: {
          id: 'test-uuid',
          timestamp: Date.now(),
          terminalId: 'KSK-007',
          errorName: 'Error',
          errorMessage: 'Script execution failure',
          stackTrace: 'at VideoPlayer',
          activeStepIndex: 2,
          journeyId: 'j-1'
        }
      };

      const fallbackHtml = renderToString(boundary.render() as React.ReactElement);

      // Acceptance Criteria: Friendly message without leaving screen blank
      expect(fallbackHtml).toContain('We encountered a temporary briefing issue. Automatically restarting in 5 seconds...');
      expect(fallbackHtml).toContain('data-testid="watchdog-recovery-card"');
      expect(fallbackHtml).toContain('data-testid="watchdog-progress-ring"');
      expect(fallbackHtml).toContain('data-testid="watchdog-countdown-number"');
      expect(fallbackHtml).toContain('5s');
      expect(fallbackHtml).toContain('Restart Now');
      expect(fallbackHtml).toContain('Exit to Home');
      expect(fallbackHtml).toContain('KSK-007');
    });

    it('renders animated circular progress ring with dynamic countdown values', () => {
      const boundary = new KioskErrorBoundary({
        children: <div>Child</div>,
        countdownSeconds: 5
      });

      // At countdown = 3s
      boundary.state = {
        hasError: true,
        error: new Error('Network timeout'),
        errorInfo: null,
        countdown: 3,
        isCrashLoop: false,
        restoredCheckpoint: null,
        diagnosticRecord: null
      };

      const html = renderToString(boundary.render() as React.ReactElement);
      expect(html).toContain('3s');
      expect(html).toContain('data-testid="watchdog-progress-ring"');
      expect(html).toContain('Automatically restarting in 3 seconds...');
    });
  });

  // =========================================================================
  // 3. Automated 5-Second Soft Recovery & Restart Controls
  // =========================================================================
  describe('3. Automated Soft Recovery & Manual Controls', () => {
    it('executes soft recovery and resets error boundary state', () => {
      const onRecoverSpy = vi.fn();
      const boundary = new KioskErrorBoundary({
        children: <div>Child</div>,
        onRecover: onRecoverSpy,
        countdownSeconds: 5
      });

      const mockCheckpoint = {
        journeyId: 'journey-ppe-01',
        stepIndex: 2,
        timestamp: Date.now()
      };

      boundary.state = {
        hasError: true,
        error: new Error('Crash'),
        errorInfo: null,
        countdown: 1,
        isCrashLoop: false,
        restoredCheckpoint: mockCheckpoint,
        diagnosticRecord: null
      };

      boundary.handleSoftRecovery();

      expect(boundary.state.hasError).toBe(false);
      expect(boundary.state.error).toBeNull();
      expect(boundary.state.countdown).toBe(5);
      expect(onRecoverSpy).toHaveBeenCalledWith(mockCheckpoint);
    });

    it('derives hasError state from caught exception', () => {
      const err = new Error('Test unhandled runtime fault');
      const derived = KioskErrorBoundary.getDerivedStateFromError(err);
      expect(derived.hasError).toBe(true);
      expect(derived.error).toBe(err);
    });

    it('automatically ticks down countdown and triggers soft recovery after 5 seconds', async () => {
      const onRecoverSpy = vi.fn();
      const boundary = new KioskErrorBoundary({
        children: <div>Child</div>,
        terminalId: 'KSK-AUTO-01',
        activeJourneyId: 'j-safety',
        activeStepIndex: 2,
        onRecover: onRecoverSpy,
        countdownSeconds: 5,
        autoRestart: false
      });

      const simulatedError = new Error('Unhandled exception in KioskPlayer: Failed to load media chunk');
      simulatedError.stack = 'Error at KioskPlayer.tsx:120';

      await (boundary as any).handleException(simulatedError, {
        componentStack: '\n    at KioskPlayer\n    at KioskTerminalPage'
      });

      // Verify diagnostic log was recorded in IndexedDB
      const logs = await kioskWatchdogService.getDiagnosticLogs('KSK-AUTO-01');
      expect(logs.length).toBe(1);
      expect(logs[0].activeStepIndex).toBe(2);
      expect(logs[0].terminalId).toBe('KSK-AUTO-01');
      expect(logs[0].errorMessage).toContain('Unhandled exception in KioskPlayer');

      // Now verify countdown ticking with fake timers
      vi.useFakeTimers();
      try {
        (boundary as any).startCountdown();
        expect(boundary.state.countdown).toBe(5);

        // Advance timer by 2 seconds -> countdown is 3
        vi.advanceTimersByTime(2000);
        expect(boundary.state.countdown).toBe(3);

        // Advance timer by 3 more seconds (total 5s) -> triggers automated soft recovery
        vi.advanceTimersByTime(3000);
        expect(boundary.state.hasError).toBe(false);
        expect(onRecoverSpy).toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('triggers manual exit to home cleanly', async () => {
      const onResetToHomeSpy = vi.fn();
      const boundary = new KioskErrorBoundary({
        children: <div>Child</div>,
        activeJourneyId: 'journey-001',
        onResetToHome: onResetToHomeSpy
      });

      await kioskWatchdogService.saveCheckpoint({
        journeyId: 'journey-001',
        stepIndex: 4,
        timestamp: Date.now()
      });

      boundary.state = {
        hasError: true,
        error: new Error('Fatal render error'),
        errorInfo: null,
        countdown: 3,
        isCrashLoop: false,
        restoredCheckpoint: null,
        diagnosticRecord: null
      };

      await boundary.handleManualExitToHome();

      expect(boundary.state.hasError).toBe(false);
      expect(onResetToHomeSpy).toHaveBeenCalled();
      const cp = await kioskWatchdogService.getCheckpoint('journey-001');
      expect(cp).toBeNull();
    });
  });

  // =========================================================================
  // 4. Mid-Session State Checkpointing & Restoration
  // =========================================================================
  describe('4. Mid-Session State Checkpoint Restoration', () => {
    it('persists and restores mid-session step progress from IndexedDB', async () => {
      await kioskWatchdogService.saveCheckpoint({
        journeyId: 'safety-orientation-v2',
        stepIndex: 4,
        timestamp: Date.now(),
        completedStepIds: ['step-1', 'step-2', 'step-3', 'step-4'],
        sessionToken: 'token-xyz-123',
        userId: 'usr-441'
      });

      const checkpoint = await kioskWatchdogService.getCheckpoint('safety-orientation-v2');
      expect(checkpoint).not.toBeNull();
      expect(checkpoint?.journeyId).toBe('safety-orientation-v2');
      expect(checkpoint?.stepIndex).toBe(4);
      expect(checkpoint?.completedStepIds).toEqual(['step-1', 'step-2', 'step-3', 'step-4']);
      expect(checkpoint?.sessionToken).toBe('token-xyz-123');

      // Verify boundary displays checkpoint restoration badge
      const boundary = new KioskErrorBoundary({
        children: <div>Child</div>,
        activeJourneyId: 'safety-orientation-v2'
      });
      boundary.state = {
        hasError: true,
        error: new Error('Audio decode failure'),
        errorInfo: null,
        countdown: 5,
        isCrashLoop: false,
        restoredCheckpoint: checkpoint,
        diagnosticRecord: null
      };

      const html = renderToString(boundary.render() as React.ReactElement);
      expect(html).toContain('data-testid="watchdog-checkpoint-badge"');
      expect(html).toContain('Mid-session progress saved at Step 5. Auto-restoring...');
    });
  });

  // =========================================================================
  // 5. Repeated Crash Loop Detection & Session Purge
  // =========================================================================
  describe('5. Repeated Crash Loop Detection & Clean Return to Home', () => {
    it('detects crash loop when repeated crashes occur (>2 within 60 seconds)', async () => {
      expect(kioskWatchdogService.isCrashLoop()).toBe(false);

      // Crash 1 at t=0
      const c1 = await kioskWatchdogService.recordCrash({
        error: new Error('Crash 1'),
        activeStepIndex: 1
      });
      expect(c1.crashCount).toBe(1);
      expect(c1.isCrashLoop).toBe(false);

      // Crash 2 at t=5s
      const c2 = await kioskWatchdogService.recordCrash({
        error: new Error('Crash 2'),
        activeStepIndex: 1
      });
      expect(c2.crashCount).toBe(2);
      expect(c2.isCrashLoop).toBe(false);

      // Crash 3 at t=10s (>2 crashes within 60s) -> CRASH LOOP DETECTED!
      const c3 = await kioskWatchdogService.recordCrash({
        error: new Error('Crash 3'),
        activeStepIndex: 1
      });
      expect(c3.crashCount).toBe(3);
      expect(c3.isCrashLoop).toBe(true);
      expect(kioskWatchdogService.isCrashLoop()).toBe(true);
    });

    it('does not trigger crash loop if crashes are spread beyond 60-second window', async () => {
      const now = Date.now();
      // Simulate crash 80 seconds ago
      vi.spyOn(Date, 'now').mockReturnValue(now - 80000);
      await kioskWatchdogService.recordCrash({ error: new Error('Old crash 1') });

      // Simulate crash 70 seconds ago
      vi.spyOn(Date, 'now').mockReturnValue(now - 70000);
      await kioskWatchdogService.recordCrash({ error: new Error('Old crash 2') });

      // Crash now: past crashes have aged out of the 60s window
      vi.spyOn(Date, 'now').mockReturnValue(now);
      const current = await kioskWatchdogService.recordCrash({ error: new Error('Current crash') });

      expect(current.crashCount).toBe(1);
      expect(current.isCrashLoop).toBe(false);
    });

    it('purges corrupted session state and renders clean reset screen on repeated crash loop', async () => {
      const onResetToHomeSpy = vi.fn();
      const journeyId = 'corrupted-journey-999';

      // Save mid-session state that caused the recurring crash
      await kioskWatchdogService.saveCheckpoint({
        journeyId,
        stepIndex: 5,
        timestamp: Date.now()
      });
      expect(await kioskWatchdogService.getCheckpoint(journeyId)).not.toBeNull();

      const boundary = new KioskErrorBoundary({
        children: <div>Child</div>,
        activeJourneyId: journeyId,
        onResetToHome: onResetToHomeSpy
      });

      // Simulate 3 rapid crashes
      await kioskWatchdogService.recordCrash({ error: new Error('Err 1'), journeyId });
      await kioskWatchdogService.recordCrash({ error: new Error('Err 2'), journeyId });

      // Third crash triggers component handling
      const err3 = new Error('Err 3 recurring');
      await (boundary as any).handleException(err3, { componentStack: 'stack' });

      // Expect corrupted checkpoint to be purged
      const cpAfter = await kioskWatchdogService.getCheckpoint(journeyId);
      expect(cpAfter).toBeNull();

      // Expect onResetToHome to be called cleanly
      expect(onResetToHomeSpy).toHaveBeenCalled();
      expect(boundary.state.isCrashLoop).toBe(true);

      // Verify UI renders the session purged screen with return to home button
      const html = renderToString(boundary.render() as React.ReactElement);
      expect(html).toContain('Session Purged &amp; Reset');
      expect(html).toContain('Repeated briefing issues detected. Corrupted session data has been purged.');
      expect(html).toContain('data-testid="watchdog-home-clean-btn"');
      expect(html).toContain('Return to Home Screen');
      // Progress ring should NOT be shown in permanent crash loop mode
      expect(html).not.toContain('data-testid="watchdog-progress-ring"');
    });
  });

  // =========================================================================
  // 6. Custom Fallback Render Prop Support
  // =========================================================================
  describe('6. Custom Fallback Render Prop Support', () => {
    it('supports custom fallback render prop for custom terminal layouts', () => {
      const customFallback = vi.fn(({ error, countdown }) => (
        <div data-testid="custom-fallback">
          {`Custom Error: ${error?.message} | Restarting in ${countdown}s`}
        </div>
      ));

      const boundary = new KioskErrorBoundary({
        children: <div>Child</div>,
        fallback: customFallback
      });

      boundary.state = {
        hasError: true,
        error: new Error('Custom terminal error'),
        errorInfo: null,
        countdown: 4,
        isCrashLoop: false,
        restoredCheckpoint: null,
        diagnosticRecord: null
      };

      const html = renderToString(boundary.render() as React.ReactElement);
      expect(html).toContain('Custom Error: Custom terminal error | Restarting in 4s');
      expect(customFallback).toHaveBeenCalled();
    });
  });
});
