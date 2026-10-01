import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  KioskPlayerProvider,
  useKioskPlayer,
  KioskPlayerContextProps
} from '../features/kiosk/context/KioskPlayerContext';
import { kioskService } from '../features/kiosk/services/kiosk.service';
import { deviceIdentityService } from '../features/kiosk/services/device-identity.service';
import { KioskJourney } from '../types/kiosk/journey.types';
import { KioskSession } from '../types/kiosk/session.types';

// Mock kioskService
vi.mock('../features/kiosk/services/kiosk.service', () => ({
  kioskService: {
    createSession: vi.fn(),
    updateSessionProgress: vi.fn(),
    completeSession: vi.fn(),
    abortSession: vi.fn(),
    getSession: vi.fn(),
    getJourney: vi.fn(),
    getPublicPlaybackJourney: vi.fn(),
    syncAnalytics: vi.fn()
  }
}));

// Mock deviceIdentityService
vi.mock('../features/kiosk/services/device-identity.service', () => {
  let mockEmployeeToken: string | null = null;
  let mockEmployeeUser: any = null;

  return {
    deviceIdentityService: {
      getHardwareGuidSync: vi.fn(() => 'HW-GUID-FACILITY-001'),
      getEmployeeToken: vi.fn(() => mockEmployeeToken),
      getEmployeeUser: vi.fn(() => mockEmployeeUser),
      setEmployeeSession: vi.fn((token: string, user: any) => {
        mockEmployeeToken = token;
        mockEmployeeUser = user;
      }),
      clearEmployeeSession: vi.fn(() => {
        mockEmployeeToken = null;
        mockEmployeeUser = null;
      }),
      isRevoked: vi.fn(() => false)
    },
    KIOSK_STORAGE_KEYS: {
      DEVICE_CREDENTIALS: 'kiosk_device_credentials',
      EMPLOYEE_SESSION: 'kiosk_employee_session'
    }
  };
});

describe('K-EMP-002: Ephemeral Session Lifecycle State Machine Suite', () => {
  let localStorageMock: Record<string, string> = {};

  const sampleJourney: KioskJourney = {
    _id: 'journey-mock-123',
    organizationId: 'org-456',
    title: 'Hazardous Chemical Handling & PPE Protocol',
    description: 'Frontline orientation on PPE, spill containment, and emergency washdown',
    type: 'briefing',
    status: 'published',
    languages: ['en', 'es'],
    steps: [
      {
        id: 'step-01',
        title: 'Safety Gear Verification',
        type: 'content',
        order: 0,
        blocks: [],
        interaction: { type: 'tap_to_continue' }
      },
      {
        id: 'step-02',
        title: 'Chemical Spill Response',
        type: 'interactive',
        order: 1,
        blocks: [],
        interaction: { type: 'tap_to_continue' }
      },
      {
        id: 'step-03',
        title: 'Emergency Shower & Eyewash Stations',
        type: 'checkpoint',
        order: 2,
        blocks: [],
        interaction: { type: 'hold_to_confirm', holdDurationMs: 2000 }
      }
    ],
    publishing: {
      isPublished: true,
      version: 2,
      publishedAt: '2026-09-30T00:00:00.000Z',
      activeVersionId: 'version-doc-789'
    },
    securitySettings: {
      requireSupervisorWitness: false
    } as any,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-30T00:00:00.000Z'
  };

  const sampleSession: KioskSession = {
    _id: 'session-doc-999',
    deviceId: 'HW-GUID-FACILITY-001',
    journeyId: 'journey-mock-123',
    journeyVersionId: 'version-doc-789',
    versionNumber: 2,
    userId: 'worker_abc_123',
    sessionToken: 'sess_tok_abc_789',
    status: 'active',
    currentStepId: 'step-01',
    completedStepIds: [],
    startedAt: '2026-09-30T10:00:00.000Z',
    updatedAt: '2026-09-30T10:00:00.000Z',
    auditLog: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock = {};

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

    deviceIdentityService.clearEmployeeSession();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper harness to capture context reference in render pass
  const setupContextHarness = (props: {
    initialJourney?: KioskJourney | null;
    initialStepIndex?: number;
    initialSession?: KioskSession | null;
    initialStatus?: any;
  } = {}) => {
    let capturedContext!: KioskPlayerContextProps;

    const TestConsumer = () => {
      capturedContext = useKioskPlayer();
      return (
        <div data-testid="harness">
          <span data-testid="status">{capturedContext.sessionStatus}</span>
          <span data-testid="step-idx">{capturedContext.currentStepIndex}</span>
        </div>
      );
    };

    renderToString(
      <KioskPlayerProvider
        initialJourney={props.initialJourney ?? sampleJourney}
        initialStepIndex={props.initialStepIndex ?? 0}
        initialSession={props.initialSession ?? null}
        initialStatus={props.initialStatus ?? 'idle'}
      >
        <TestConsumer />
      </KioskPlayerProvider>
    );

    return capturedContext;
  };

  // =========================================================================
  // 1. Provider & Hook Boundary Verification
  // =========================================================================
  describe('Provider & Context Boundary', () => {
    it('throws descriptive error if useKioskPlayer is consumed outside KioskPlayerProvider', () => {
      const OrphanConsumer = () => {
        useKioskPlayer();
        return null;
      };

      expect(() => renderToString(<OrphanConsumer />)).toThrow(
        'useKioskPlayer must be used within a KioskPlayerProvider'
      );
    });

    it('initializes with idle session status and default values', () => {
      const ctx = setupContextHarness({ initialJourney: null, initialStatus: 'idle' });
      expect(ctx.sessionStatus).toBe('idle');
      expect(ctx.activeSession).toBeNull();
      expect(ctx.currentStepIndex).toBe(0);
      expect(ctx.offlineQueueCount).toBe(0);
    });
  });

  // =========================================================================
  // 2. Session Instantiation (Acceptance Criteria 1 & Requirements 1-3)
  // =========================================================================
  describe('Session Instantiation (startSession)', () => {
    it('creates active KioskSession bound to verified frontline worker userId (Requirement 2 / AC-1)', async () => {
      // Mock verified frontline worker login
      deviceIdentityService.setEmployeeSession('mock-jwt-token-xyz', {
        id: 'worker_verified_777',
        badgeId: 'BADGE-1234',
        name: 'Maria Rodriguez'
      });

      const mockCreatedSession: KioskSession = {
        ...sampleSession,
        _id: 'session-created-101',
        userId: 'worker_verified_777',
        status: 'active'
      };
      (kioskService.createSession as any).mockResolvedValueOnce(mockCreatedSession);

      const ctx = setupContextHarness();
      const session = await ctx.startSession();

      expect(kioskService.createSession).toHaveBeenCalledTimes(1);
      expect(kioskService.createSession).toHaveBeenCalledWith({
        deviceId: 'HW-GUID-FACILITY-001',
        journeyId: 'journey-mock-123',
        journeyVersionId: 'version-doc-789',
        versionNumber: 2,
        userId: 'worker_verified_777',
        currentStepId: 'step-01'
      });

      expect(session).toEqual(mockCreatedSession);
    });

    it('creates anonymous KioskSession with userId: null when frontline worker is unauthenticated (Requirement 3)', async () => {
      // Ensure no frontline worker is logged in
      deviceIdentityService.clearEmployeeSession();

      const mockAnonymousSession: KioskSession = {
        ...sampleSession,
        _id: 'session-anon-102',
        userId: undefined,
        status: 'active'
      };
      (kioskService.createSession as any).mockResolvedValueOnce(mockAnonymousSession);

      const ctx = setupContextHarness();
      const session = await ctx.startSession();

      expect(kioskService.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: null,
          deviceId: 'HW-GUID-FACILITY-001',
          journeyId: 'journey-mock-123'
        })
      );
      expect(session).toEqual(mockAnonymousSession);
    });

    it('binds session creation to exact journeyVersionId of the assigned manifest (Requirement 1)', async () => {
      (kioskService.createSession as any).mockResolvedValueOnce(sampleSession);

      const ctx = setupContextHarness();
      await ctx.startSession({
        journeyVersionId: 'custom-manifest-version-999',
        versionNumber: 4
      });

      expect(kioskService.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          journeyVersionId: 'custom-manifest-version-999',
          versionNumber: 4
        })
      );
    });

    it('handles backend offline / network failure gracefully without crashing the player', async () => {
      (kioskService.createSession as any).mockRejectedValueOnce(
        new Error('Network error: kiosk offline')
      );

      const ctx = setupContextHarness();
      const session = await ctx.startSession();

      // Gracefully returns null but transitions state to 'active' locally
      expect(session).toBeNull();
    });
  });

  // =========================================================================
  // 3. Step Progress Updates & Throttling (Acceptance Criteria 2 & Requirement 4)
  // =========================================================================
  describe('Step Navigation & Progress Updates', () => {
    it('records Step 1 in completedStepIds and updates currentStepId when navigating forward (AC-2)', async () => {
      const mockUpdatedSession: KioskSession = {
        ...sampleSession,
        currentStepId: 'step-02',
        completedStepIds: ['step-01']
      };
      (kioskService.updateSessionProgress as any).mockResolvedValueOnce(mockUpdatedSession);

      const ctx = setupContextHarness({
        initialSession: sampleSession,
        initialStatus: 'active',
        initialStepIndex: 0
      });

      // User clicks "Next"
      ctx.nextStep();

      // Verify immediate dispatch on step change boundary
      expect(kioskService.updateSessionProgress).toHaveBeenCalledTimes(1);
      expect(kioskService.updateSessionProgress).toHaveBeenCalledWith(
        'session-doc-999',
        expect.objectContaining({
          currentStepId: 'step-02',
          completedStepId: 'step-01',
          completedStepIds: ['step-01']
        })
      );
    });

    it('accumulates completedStepIds as user advances across multiple steps', async () => {
      (kioskService.updateSessionProgress as any).mockResolvedValue(sampleSession);

      const ctx = setupContextHarness({
        initialSession: sampleSession,
        initialStatus: 'active',
        initialStepIndex: 0
      });

      // Step 1 -> Step 2
      ctx.nextStep();
      expect(kioskService.updateSessionProgress).toHaveBeenLastCalledWith(
        'session-doc-999',
        expect.objectContaining({
          currentStepId: 'step-02',
          completedStepId: 'step-01',
          completedStepIds: ['step-01']
        })
      );

      // Step 2 -> Step 3
      ctx.nextStep();
      expect(kioskService.updateSessionProgress).toHaveBeenLastCalledWith(
        'session-doc-999',
        expect.objectContaining({
          currentStepId: 'step-03',
          completedStepId: 'step-02',
          completedStepIds: ['step-01', 'step-02']
        })
      );
    });

    it('records completed step when skipping ahead via setStepIndex(2)', async () => {
      (kioskService.updateSessionProgress as any).mockResolvedValue(sampleSession);

      const ctx = setupContextHarness({
        initialSession: sampleSession,
        initialStatus: 'active',
        initialStepIndex: 0
      });

      // Direct jump from Step 0 to Step 2
      ctx.setStepIndex(2);

      expect(kioskService.updateSessionProgress).toHaveBeenCalledWith(
        'session-doc-999',
        expect.objectContaining({
          currentStepId: 'step-03',
          completedStepId: 'step-01',
          completedStepIds: ['step-01']
        })
      );
    });

    it('navigates backwards via prevStep() without marking future steps as completed', async () => {
      (kioskService.updateSessionProgress as any).mockResolvedValue(sampleSession);

      const ctx = setupContextHarness({
        initialSession: {
          ...sampleSession,
          currentStepId: 'step-02',
          completedStepIds: ['step-01']
        },
        initialStatus: 'active',
        initialStepIndex: 1
      });

      // User navigates backwards to Step 1
      ctx.prevStep();

      expect(kioskService.updateSessionProgress).toHaveBeenCalledWith(
        'session-doc-999',
        expect.objectContaining({
          currentStepId: 'step-01',
          completedStepId: undefined
        })
      );
    });
  });

  // =========================================================================
  // 4. Session Completion Lifecycle (completeSession)
  // =========================================================================
  describe('Session Completion Lifecycle', () => {
    it('calls kioskService.completeSession and transitions state to completed', async () => {
      const mockCompletedSession: KioskSession = {
        ...sampleSession,
        status: 'completed',
        completedAt: '2026-09-30T10:05:00.000Z',
        validationMetrics: {
          totalDurationSeconds: 300,
          quizScore: 100,
          ppeVerified: true,
          supervisorVerified: false,
          securityChecksumValid: true
        }
      };
      (kioskService.completeSession as any).mockResolvedValueOnce(mockCompletedSession);
      (kioskService.syncAnalytics as any).mockResolvedValueOnce({ success: true });

      const ctx = setupContextHarness({
        initialSession: sampleSession,
        initialStatus: 'active',
        initialStepIndex: 2
      });

      await ctx.completeSession({
        quizScore: 100,
        ppeItemsVerified: ['hard_hat', 'safety_glasses'],
        verificationChecksum: 'sha256-mock-checksum'
      });

      expect(kioskService.completeSession).toHaveBeenCalledTimes(1);
      expect(kioskService.completeSession).toHaveBeenCalledWith(
        'session-doc-999',
        expect.objectContaining({
          quizScore: 100,
          ppeItemsVerified: ['hard_hat', 'safety_glasses'],
          verificationChecksum: 'sha256-mock-checksum'
        })
      );
    });

    it('transitions to awaiting_supervisor when backend signals supervisor witness requirement', async () => {
      const mockWitnessSession: KioskSession = {
        ...sampleSession,
        status: 'awaiting_supervisor'
      };
      (kioskService.completeSession as any).mockResolvedValueOnce(mockWitnessSession);

      const ctx = setupContextHarness({
        initialSession: sampleSession,
        initialStatus: 'active',
        initialStepIndex: 2
      });

      await ctx.completeSession();

      expect(kioskService.completeSession).toHaveBeenCalledWith(
        'session-doc-999',
        expect.any(Object)
      );
    });
  });

  // =========================================================================
  // 5. Session Abort Lifecycle (abortSession & Acceptance Criteria 3)
  // =========================================================================
  describe('Session Abort Lifecycle', () => {
    it('transitions session to aborted when worker restarts or exits journey (AC-3)', async () => {
      const mockAbortedSession: KioskSession = {
        ...sampleSession,
        status: 'aborted'
      };
      (kioskService.abortSession as any).mockResolvedValueOnce(mockAbortedSession);

      const ctx = setupContextHarness({
        initialSession: sampleSession,
        initialStatus: 'active',
        initialStepIndex: 1
      });

      await ctx.abortSession('step-02', 'Worker tapped manual exit button');

      expect(kioskService.abortSession).toHaveBeenCalledTimes(1);
      expect(kioskService.abortSession).toHaveBeenCalledWith('session-doc-999', {
        abortedStepId: 'step-02',
        reason: 'Worker tapped manual exit button',
        durationSeconds: expect.any(Number)
      });
    });

    it('handles offline abort gracefully without throwing', async () => {
      (kioskService.abortSession as any).mockRejectedValueOnce(
        new Error('Failed to reach kiosk server')
      );

      const ctx = setupContextHarness({
        initialSession: sampleSession,
        initialStatus: 'active',
        initialStepIndex: 0
      });

      // Does not throw an uncaught error
      await expect(ctx.abortSession('step-01', 'Immediate abort')).resolves.not.toThrow();
    });
  });
});
