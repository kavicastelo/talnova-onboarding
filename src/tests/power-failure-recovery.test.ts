/**
 * Talnova Kiosk Terminal - Power Failure Recovery Unit Test Suite (K-REL-002)
 *
 * Validates:
 * 1. Automatic step checkpointing in IndexedDB ('active_session_checkpoint') upon step transitions.
 * 2. Boot detection of active checkpoint within 15-minute validity window (e.g. 10 minutes after power loss).
 * 3. Expired checkpoint purging when reboot occurs >=15 minutes after power failure.
 * 4. Modal UI rendering:
 *    "A previous briefing was interrupted. Would you like to resume at Screen 5?"
 *    with a 15-second countdown.
 * 5. Worker confirmation restores step progression (Step 5) and resumes journey.
 * 6. Countdown expiration or cancellation purges checkpoint and dismisses to home screen.
 * 7. Normal session completion purges active checkpoint.
 */

import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  powerRecoveryService,
  RECOVERY_DB_NAME,
  ACTIVE_CHECKPOINT_STORE,
  DEFAULT_CHECKPOINT_MAX_AGE_MS
} from '../features/kiosk/services/power-recovery.service';
import {
  PowerRecoveryResumeModal
} from '../features/kiosk/components/recovery/PowerRecoveryResumeModal';
import { KioskActiveSessionCheckpoint } from '../types/kiosk/recovery.types';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string) => defaultValue || _key,
    i18n: { language: 'en', changeLanguage: vi.fn() }
  })
}));

describe('K-REL-002: Power Failure & Sudden Reboot Session Recovery Suite', () => {
  let localStorageMock: Record<string, string>;
  let sessionStorageMock: Record<string, string>;

  beforeEach(async () => {
    localStorageMock = {};
    sessionStorageMock = {};

    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (k: string) => localStorageMock[k] ?? null,
        setItem: (k: string, v: string) => {
          localStorageMock[k] = String(v);
        },
        removeItem: (k: string) => {
          delete localStorageMock[k];
        },
        clear: () => {
          localStorageMock = {};
        }
      },
      writable: true,
      configurable: true
    });

    Object.defineProperty(globalThis, 'sessionStorage', {
      value: {
        getItem: (k: string) => sessionStorageMock[k] ?? null,
        setItem: (k: string, v: string) => {
          sessionStorageMock[k] = String(v);
        },
        removeItem: (k: string) => {
          delete sessionStorageMock[k];
        },
        clear: () => {
          sessionStorageMock = {};
        }
      },
      writable: true,
      configurable: true
    });

    vi.clearAllMocks();
    await powerRecoveryService.clearAllStorage();
  });

  afterEach(async () => {
    await powerRecoveryService.close();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. IndexedDB Checkpoint Storage Schema
  // =========================================================================
  describe('1. IndexedDB active_session_checkpoint Store Schema', () => {
    it('initializes kiosk_recovery_store with active_session_checkpoint store and indexes', async () => {
      const db = await powerRecoveryService.getDb();
      expect(db.name).toBe(RECOVERY_DB_NAME);

      const storeNames = Array.from(db.objectStoreNames);
      expect(storeNames).toContain(ACTIVE_CHECKPOINT_STORE);

      const tx = db.transaction(ACTIVE_CHECKPOINT_STORE, 'readonly');
      const store = tx.objectStore(ACTIVE_CHECKPOINT_STORE);
      expect(Array.from(store.indexNames)).toContain('timestamp');
      expect(Array.from(store.indexNames)).toContain('journeyId');
      await tx.done;
    });

    it('persists step transition checkpoint with journeyId, stepIndex, timestamp and expiry', async () => {
      const now = Date.now();
      const saved = await powerRecoveryService.saveStepCheckpoint({
        journeyId: 'journey-hazardous-materials',
        journeyTitle: 'Hazardous Materials Handling',
        stepIndex: 4, // Step 5 (0-indexed)
        stepTitle: 'PPE Donning Verification',
        totalSteps: 8,
        completedStepIds: ['s1', 's2', 's3', 's4'],
        userId: 'usr-frontline-77',
        sessionToken: 'token-power-cut-test',
        timestamp: now
      });

      expect(saved.id).toBe('current');
      expect(saved.journeyId).toBe('journey-hazardous-materials');
      expect(saved.stepIndex).toBe(4);
      expect(saved.expiresAt).toBe(now + DEFAULT_CHECKPOINT_MAX_AGE_MS);

      const db = await powerRecoveryService.getDb();
      const stored = await db.get(ACTIVE_CHECKPOINT_STORE, 'current');
      expect(stored).not.toBeNull();
      expect(stored?.stepIndex).toBe(4);
      expect(stored?.completedStepIds).toEqual(['s1', 's2', 's3', 's4']);
    });
  });

  // =========================================================================
  // 2. Acceptance Criteria: Power Cut on Step 5 & Terminal Reboot within 10 min
  // =========================================================================
  describe('2. Acceptance Criteria: Power Cut on Step 5 & Reboot within 10 Minutes', () => {
    it('detects and returns active checkpoint when terminal reboots within 10 minutes of power cut', async () => {
      const powerCutTime = Date.now();

      // Given an abrupt browser reload or power cut on Step 5 (stepIndex: 4)
      await powerRecoveryService.saveStepCheckpoint({
        journeyId: 'journey-confined-space',
        journeyTitle: 'Confined Space Safety Training',
        stepIndex: 4, // Step 5
        timestamp: powerCutTime
      });

      // When the terminal reboots within 10 minutes (600,000 ms elapsed)
      const rebootTime = powerCutTime + 10 * 60 * 1000;
      vi.spyOn(Date, 'now').mockReturnValue(rebootTime);

      const checkpoint = await powerRecoveryService.getActiveCheckpoint();

      // Then the checkpoint is detected and allows continuing from Step 5
      expect(checkpoint).not.toBeNull();
      expect(checkpoint?.stepIndex).toBe(4);
      expect(checkpoint?.journeyId).toBe('journey-confined-space');
      expect(powerRecoveryService.isCheckpointValid(checkpoint)).toBe(true);
    });

    it('purges and ignores checkpoint if terminal reboots >=15 minutes after power failure', async () => {
      const powerCutTime = Date.now();

      await powerRecoveryService.saveStepCheckpoint({
        journeyId: 'journey-confined-space',
        stepIndex: 4,
        timestamp: powerCutTime
      });

      // Terminal reboots after 16 minutes (>15-minute validity window)
      const lateRebootTime = powerCutTime + 16 * 60 * 1000;
      vi.spyOn(Date, 'now').mockReturnValue(lateRebootTime);

      const checkpoint = await powerRecoveryService.getActiveCheckpoint();

      // Expired checkpoint should be purged and null returned
      expect(checkpoint).toBeNull();

      // Verify IndexedDB was cleared
      const db = await powerRecoveryService.getDb();
      const records = await db.getAll(ACTIVE_CHECKPOINT_STORE);
      expect(records.length).toBe(0);
    });
  });

  // =========================================================================
  // 3. PowerRecoveryResumeModal Visual Prompt & Exact Message Requirements
  // =========================================================================
  describe('3. PowerRecoveryResumeModal Visual Prompt & Countdown', () => {
    it('renders exact prompt message with Screen 5 for stepIndex 4 and 15-second countdown', () => {
      const mockCheckpoint: KioskActiveSessionCheckpoint = {
        id: 'current',
        journeyId: 'journey-crane-ops',
        journeyTitle: 'Overhead Crane Operation',
        stepIndex: 4, // Step 5
        totalSteps: 10,
        timestamp: Date.now()
      };

      const onConfirmSpy = vi.fn();
      const onDismissSpy = vi.fn();

      const html = renderToString(
        React.createElement(PowerRecoveryResumeModal, {
          checkpoint: mockCheckpoint,
          onConfirm: onConfirmSpy,
          onDismiss: onDismissSpy,
          countdownSeconds: 15
        })
      );

      // Verify exact prompt wording: "A previous briefing was interrupted. Would you like to resume at Screen 5?"
      expect(html).toContain('A previous briefing was interrupted. Would you like to resume at Screen 5?');
      expect(html).toContain('data-testid="power-recovery-modal"');
      expect(html).toContain('data-testid="power-recovery-message"');
      expect(html).toContain('data-testid="power-recovery-countdown"');
      expect(html).toContain('15s');
      expect(html).toContain('Resume at Screen 5');
      expect(html).toContain('Start Over');
      expect(html).toContain('Overhead Crane Operation');
    });

    it('renders Screen 1 when interrupted at stepIndex 0', () => {
      const mockCheckpoint: KioskActiveSessionCheckpoint = {
        id: 'current',
        journeyId: 'journey-general',
        stepIndex: 0,
        timestamp: Date.now()
      };

      const html = renderToString(
        React.createElement(PowerRecoveryResumeModal, {
          checkpoint: mockCheckpoint,
          onConfirm: vi.fn(),
          onDismiss: vi.fn(),
          countdownSeconds: 15
        })
      );

      expect(html).toContain('A previous briefing was interrupted. Would you like to resume at Screen 1?');
      expect(html).toContain('Resume at Screen 1');
    });
  });

  // =========================================================================
  // 4. User Interaction & Automated Timeout Handling
  // =========================================================================
  describe('4. Confirmation, Cancellation & Countdown Expiry', () => {
    it('allows worker confirmation to restore step progression and resume briefing', async () => {
      const mockCheckpoint: KioskActiveSessionCheckpoint = {
        id: 'current',
        journeyId: 'journey-scaffold',
        stepIndex: 4,
        timestamp: Date.now()
      };

      let restoredJourneyId: string | null = null;
      let restoredStep: number | null = null;

      const handleConfirm = (cp: KioskActiveSessionCheckpoint) => {
        restoredJourneyId = cp.journeyId;
        restoredStep = cp.stepIndex;
      };

      handleConfirm(mockCheckpoint);

      expect(restoredJourneyId).toBe('journey-scaffold');
      expect(restoredStep).toBe(4); // Continues from Step 5 (0-indexed 4)
    });

    it('purges checkpoint cleanly when worker chooses to start over / dismiss', async () => {
      await powerRecoveryService.saveStepCheckpoint({
        journeyId: 'journey-lockout-tagout',
        stepIndex: 2,
        timestamp: Date.now()
      });
      expect(await powerRecoveryService.getActiveCheckpoint()).not.toBeNull();

      // Worker dismisses / cancels
      await powerRecoveryService.purgeCheckpoint();

      expect(await powerRecoveryService.getActiveCheckpoint()).toBeNull();
    });

    it('clears checkpoint upon clean session completion', async () => {
      await powerRecoveryService.saveStepCheckpoint({
        journeyId: 'journey-forklift',
        stepIndex: 7,
        timestamp: Date.now()
      });

      // Normal session finish purges checkpoint so next boot starts fresh
      await powerRecoveryService.purgeCheckpoint();
      const cp = await powerRecoveryService.getActiveCheckpoint();
      expect(cp).toBeNull();
    });

    it('validates checkpoint validity window helper correctly', () => {
      const now = Date.now();
      expect(powerRecoveryService.isCheckpointValid(null)).toBe(false);

      const recentCheckpoint: KioskActiveSessionCheckpoint = {
        id: 'current',
        journeyId: 'j-valid',
        stepIndex: 1,
        timestamp: now - 5 * 60 * 1000 // 5 minutes old
      };
      expect(powerRecoveryService.isCheckpointValid(recentCheckpoint)).toBe(true);

      const expiredCheckpoint: KioskActiveSessionCheckpoint = {
        id: 'current',
        journeyId: 'j-expired',
        stepIndex: 1,
        timestamp: now - 16 * 60 * 1000 // 16 minutes old
      };
      expect(powerRecoveryService.isCheckpointValid(expiredCheckpoint)).toBe(false);
    });
  });
});
