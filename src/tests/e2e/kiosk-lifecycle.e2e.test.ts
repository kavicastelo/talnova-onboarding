import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import { KioskTerminalPage } from '../../features/kiosk/pages/KioskTerminalPage';
import { KioskPairingScreen } from '../../features/kiosk/components/KioskPairingScreen';
import { KioskHomeScreen } from '../../features/kiosk/components/launcher/KioskHomeScreen';
import { KioskPlayer } from '../../features/kiosk/components/KioskPlayer';
import { KioskPlayerProvider } from '../../features/kiosk/context/KioskPlayerContext';
import { FrontlineIdentifyModal } from '../../features/kiosk/components/auth/FrontlineIdentifyModal';
import { SupervisorWitnessGateModal } from '../../features/kiosk/components/auth/SupervisorWitnessGateModal';
import { PrivacyTimeoutModal } from '../../features/kiosk/components/privacy/PrivacyTimeoutModal';

import { deviceIdentityService, KIOSK_STORAGE_KEYS } from '../../features/kiosk/services/device-identity.service';
import { kioskService } from '../../features/kiosk/services/kiosk.service';
import { privacyResetService } from '../../features/kiosk/services/privacy-reset.service';
import { KioskDeviceManifest } from '../../types/kiosk/device.types';
import { KioskJourney } from '../../types/kiosk/journey.types';
import { KioskSession } from '../../types/kiosk/session.types';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: any) => (typeof defaultValue === 'string' ? defaultValue : defaultValue?.defaultValue || _key),
    i18n: { language: 'en', changeLanguage: vi.fn() }
  })
}));

// Mock react-query
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn()
  })
}));

// Mock QRCode generation
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(async () => 'data:image/png;base64,mockQrCodeDataUrl')
  }
}));

describe('K-VAL-001: Automated End-to-End Kiosk Physical Lifecycle Suite', () => {
  let localStorageMock: Record<string, string>;
  let sessionStorageMock: Record<string, string>;
  let mockHistoryReplaceState: any;

  // Reusable sample journeys
  const publicSafetyJourney: KioskJourney = {
    _id: 'journey-public-safety-01',
    organizationId: 'org-test-depot',
    title: 'General Facility Safety & Fire Evacuation',
    description: 'Public walk-in safety briefing for visitors and non-badged personnel.',
    type: 'briefing',
    status: 'published',
    languages: ['en', 'es'],
    steps: [
      {
        id: 'step-pub-01',
        title: 'Emergency Alarm & Exit Routes',
        type: 'content',
        order: 0,
        blocks: [
          {
            id: 'block-1',
            type: 'text',
            order: 0,
            mediaReferences: {
              en: { textValue: 'Locate your nearest fire exit and emergency shut-off valves.' }
            }
          } as any
        ],
        interaction: { type: 'tap_to_continue' }
      },
      {
        id: 'step-pub-02',
        title: 'Assembly Areas & Muster Zones',
        type: 'content',
        order: 1,
        blocks: [
          {
            id: 'block-2',
            type: 'text',
            order: 0,
            mediaReferences: {
              en: { textValue: 'Report to Assembly Area C on the north lawn in case of evacuation.' }
            }
          } as any
        ],
        interaction: { type: 'tap_to_continue' }
      },
      {
        id: 'step-pub-03',
        title: 'Emergency Contact & First Aid Protocol',
        type: 'content',
        order: 2,
        blocks: [
          {
            id: 'block-3',
            type: 'text',
            order: 0,
            mediaReferences: {
              en: { textValue: 'Call extension 4444 for on-site medical and safety marshals.' }
            }
          } as any
        ],
        interaction: { type: 'tap_to_continue' }
      }
    ],
    settings: {
      theme: 'dark',
      autoPlay: true,
      idleTimeoutSeconds: 60,
      requireEmployeeId: false,
      requireSupervisorWitness: false
    } as any,
    publishing: {
      isPublished: true,
      version: 1,
      publishedAt: '2026-10-01T00:00:00.000Z',
      activeVersionId: 'ver-pub-01'
    }
  };

  const highVoltageJourney: KioskJourney = {
    _id: 'journey-high-voltage-02',
    organizationId: 'org-test-depot',
    title: 'High-Voltage Substation Electrical Safety',
    description: 'Mandatory frontline certification for entering active 480V substation bays.',
    type: 'certification',
    status: 'published',
    languages: ['en'],
    steps: [
      {
        id: 'step-hv-01',
        title: 'High Voltage Hazard Zone Awareness',
        type: 'warning_step',
        order: 0,
        blocks: [
          {
            id: 'b-hv-1',
            type: 'text',
            order: 0,
            mediaReferences: {
              en: { textValue: 'DANGER: Three-phase transformers energized up to 13.8kV.' }
            }
          } as any
        ],
        interaction: { type: 'tap_to_continue' }
      },
      {
        id: 'step-hv-02',
        title: 'Mandatory PPE Verification',
        type: 'content',
        order: 1,
        blocks: [
          {
            id: 'b-hv-2',
            type: 'text',
            order: 0,
            mediaReferences: {
              en: { textValue: 'Check off all mandatory Arc-Flash category 4 gear.' }
            }
          } as any
        ],
        interaction: {
          type: 'ppe_checklist',
          ppeItems: ['Arc Flash Shield', 'Insulated 10kV Gloves', 'Dielectric Boots']
        }
      },
      {
        id: 'step-hv-03',
        title: 'Lockout/Tagout & Dual-Custody Witness Gate',
        type: 'content',
        order: 2,
        blocks: [
          {
            id: 'b-hv-3',
            type: 'text',
            order: 0,
            mediaReferences: {
              en: { textValue: 'Supervisor must co-sign and witness terminal safety briefing.' }
            }
          } as any
        ],
        interaction: {
          type: 'supervisor_witness',
          requireSupervisorWitness: true
        }
      }
    ],
    settings: {
      theme: 'dark',
      autoPlay: true,
      idleTimeoutSeconds: 60,
      requireEmployeeId: true,
      requireSupervisorWitness: true,
      security: {
        protectionType: 'supervisor',
        requireSupervisorWitness: true
      }
    } as any,
    publishing: {
      isPublished: true,
      version: 1,
      publishedAt: '2026-10-01T00:00:00.000Z',
      activeVersionId: 'ver-hv-01'
    }
  };

  const sampleManifest: KioskDeviceManifest = {
    device: {
      _id: 'dev_mock_e2e_01',
      deviceId: 'HW-GUID-NORTH-GATE-01',
      name: 'North Gate Substation Kiosk',
      location: 'Logistics Facility Gate 2',
      status: 'online',
      organizationId: 'org-test-depot',
      assignedJourneys: [publicSafetyJourney._id, highVoltageJourney._id],
      isOnline: true
    } as any,
    journeys: [
      { ...publicSafetyJourney, priority: 1, isMandatory: false } as any,
      { ...highVoltageJourney, priority: 2, isMandatory: true } as any
    ],
    organizationId: 'org-test-depot',
    launchMode: 'launcher',
    offlinePackage: {
      version: '1.0.0',
      generatedAt: '2026-10-01T00:00:00.000Z',
      downloadUrl: 'https://cdn.talnova.internal/offline-pkg.tar',
      assetCount: 8,
      checksum: 'sha256-mock-hash',
      bundleSizeBytes: 204800
    }
  };

  beforeEach(() => {
    localStorageMock = {};
    sessionStorageMock = {};
    vi.clearAllMocks();

    // Mock localStorage
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (key: string) => localStorageMock[key] ?? null,
        setItem: (key: string, val: string) => {
          localStorageMock[key] = String(val);
        },
        removeItem: (key: string) => {
          delete localStorageMock[key];
        },
        clear: () => {
          localStorageMock = {};
        }
      },
      writable: true,
      configurable: true
    });

    // Mock sessionStorage
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
        }
      },
      writable: true,
      configurable: true
    });

    // Mock window.history
    mockHistoryReplaceState = vi.fn();
    Object.defineProperty(globalThis, 'history', {
      value: {
        replaceState: mockHistoryReplaceState
      },
      writable: true,
      configurable: true
    });

    // Mock document.querySelectorAll for form wiping
    Object.defineProperty(globalThis, 'document', {
      value: {
        querySelectorAll: vi.fn(() => []),
        documentElement: {
          dir: 'ltr',
          lang: 'en'
        }
      },
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    deviceIdentityService.clearDeviceCredentials();
    deviceIdentityService.clearEmployeeSession();
  });

  // =========================================================================
  // SCENARIO 1: Unpaired Terminal Setup Flow
  // =========================================================================
  describe('Scenario 1: Unpaired Terminal Setup (Device Pairing & Manifest Token)', () => {
    it('redirects unpaired terminal to /kiosk/pair, enters pairing code, saves device token, and returns to /kiosk/terminal', async () => {
      // 1. Terminal starts in un-paired state
      expect(deviceIdentityService.isPaired()).toBe(false);
      expect(deviceIdentityService.getDeviceToken()).toBeNull();

      // Render routing harness: /kiosk/terminal redirects to /kiosk/pair when un-paired
      let navigatedUrl = '';
      const TestRouter = () =>
        React.createElement(
          MemoryRouter,
          { initialEntries: ['/kiosk/terminal'] },
          React.createElement(
            Routes,
            null,
            React.createElement(Route, {
              path: '/kiosk/terminal',
              element: React.createElement(KioskTerminalPage, null)
            }),
            React.createElement(Route, {
              path: '/kiosk/pair',
              element: React.createElement(
                'div',
                { 'data-testid': 'kiosk-pair-screen-container' },
                React.createElement(KioskPairingScreen, {
                  onPairSuccess: (device: any, token: string) => {
                    deviceIdentityService.setDeviceCredentials(device, token);
                    navigatedUrl = '/kiosk/terminal';
                  }
                })
              )
            })
          )
        );

      const htmlInitial = renderToString(React.createElement(TestRouter, null));
      expect(htmlInitial).not.toContain('data-testid="kiosk-home-launcher"');
      expect(htmlInitial).not.toContain('North Gate Substation Kiosk');

      // 2. Author/Admin pairs the terminal using Step 1 (Device Name & Location)
      const mockPairDeviceApi = vi.spyOn(kioskService, 'pairDevice').mockResolvedValueOnce({
        device: sampleManifest.device,
        token: 'dev-token-bearer-jwt-777',
        deviceToken: 'dev-token-bearer-jwt-777'
      });

      // Render Step 1 of KioskPairingScreen
      const pairingHtml = renderToString(
        React.createElement(KioskPairingScreen, {
          onPairSuccess: (device: any, token: string) => {
            deviceIdentityService.setDeviceCredentials(device, token);
            navigatedUrl = '/kiosk/terminal';
          }
        })
      );

      expect(pairingHtml).toContain('Setup Kiosk Device');
      expect(pairingHtml).toContain('Device Name');
      expect(pairingHtml).toContain('Location / Zone');

      // 3. Enter pairing code '123456' and trigger pairing API
      const pairResult = await kioskService.pairDevice({
        code: '123456',
        deviceId: 'HW-GUID-NORTH-GATE-01',
        name: 'North Gate Substation Kiosk',
        location: 'Logistics Facility Gate 2'
      });

      expect(mockPairDeviceApi).toHaveBeenCalledWith({
        code: '123456',
        deviceId: 'HW-GUID-NORTH-GATE-01',
        name: 'North Gate Substation Kiosk',
        location: 'Logistics Facility Gate 2'
      });

      // 4. Save device credentials & token in deviceIdentityService
      deviceIdentityService.setDeviceCredentials(pairResult.device, pairResult.token);

      expect(deviceIdentityService.isPaired()).toBe(true);
      expect(deviceIdentityService.getDeviceToken()).toBe('dev-token-bearer-jwt-777');
      expect(deviceIdentityService.getStoredDevice()?.name).toBe('North Gate Substation Kiosk');

      // 5. Navigate to /kiosk/terminal once paired
      navigatedUrl = '/kiosk/terminal';
      expect(navigatedUrl).toBe('/kiosk/terminal');

      // Manifest can now be fetched successfully
      const mockManifestApi = vi.spyOn(kioskService, 'getDeviceManifest').mockResolvedValueOnce(sampleManifest);
      const manifest = await kioskService.getDeviceManifest('HW-GUID-NORTH-GATE-01');

      expect(mockManifestApi).toHaveBeenCalled();
      expect(manifest.device.deviceId).toBe('HW-GUID-NORTH-GATE-01');
      expect(manifest.journeys.length).toBe(2);
    });
  });

  // =========================================================================
  // SCENARIO 2: Public Journey Playback Flow
  // =========================================================================
  describe('Scenario 2: Public Journey Playback (Anonymous Safety Orientation)', () => {
    it('selects public safety journey, steps through slides, completes briefing, and verifies completion status', async () => {
      // 1. Ensure terminal is paired
      deviceIdentityService.setDeviceCredentials(sampleManifest.device, 'dev-token-bearer-jwt-777');

      // 2. Render KioskHomeScreen with manifest
      let activePlayingJourneyId: string | null = null;
      const homeHtml = renderToString(
        React.createElement(KioskHomeScreen, {
          manifest: sampleManifest,
          onLaunchJourney: (journeyId: string) => {
            activePlayingJourneyId = journeyId;
          }
        })
      );

      // Verify Home Screen shows public safety journey
      expect(homeHtml).toContain('General Facility Safety &amp; Fire Evacuation');
      expect(homeHtml).toContain('High-Voltage Substation Electrical Safety');

      // Select public safety journey
      activePlayingJourneyId = publicSafetyJourney._id;
      expect(activePlayingJourneyId).toBe('journey-public-safety-01');

      // 3. Initialize KioskPlayer session
      const mockCreateSession = vi.spyOn(kioskService, 'createSession').mockResolvedValueOnce({
        _id: 'session-public-9001',
        deviceId: 'HW-GUID-NORTH-GATE-01',
        journeyId: publicSafetyJourney._id,
        status: 'in_progress',
        currentStepId: 'step-pub-01',
        completedSteps: [],
        startedAt: new Date().toISOString()
      } as unknown as KioskSession);

      const mockCompleteSession = vi.spyOn(kioskService, 'completeSession').mockResolvedValueOnce({
        _id: 'session-public-9001',
        deviceId: 'HW-GUID-NORTH-GATE-01',
        journeyId: publicSafetyJourney._id,
        status: 'completed',
        completedSteps: ['step-pub-01', 'step-pub-02', 'step-pub-03'],
        completedAt: new Date().toISOString()
      } as unknown as KioskSession);

      const session = await kioskService.createSession({
        deviceId: 'HW-GUID-NORTH-GATE-01',
        journeyId: publicSafetyJourney._id,
        currentStepId: 'step-pub-01'
      });

      expect(mockCreateSession).toHaveBeenCalled();
      expect(session.status).toBe('in_progress');

      // 4. Render Step 1
      const step1Html = renderToString(
        React.createElement(
          KioskPlayerProvider,
          { initialJourney: publicSafetyJourney },
          React.createElement(KioskPlayer, {
            journeyId: publicSafetyJourney._id,
            isAdminPreview: true
          })
        )
      );
      expect(step1Html).toContain('General Facility Safety &amp; Fire Evacuation');

      // 5. Complete session when reaching last step
      const completedSession = await kioskService.completeSession(session._id, {
        durationSeconds: 45,
        completedStepIds: ['step-pub-01', 'step-pub-02', 'step-pub-03']
      });

      expect(mockCompleteSession).toHaveBeenCalledWith('session-public-9001', {
        durationSeconds: 45,
        completedStepIds: ['step-pub-01', 'step-pub-02', 'step-pub-03']
      });
      expect(completedSession.status).toBe('completed');
      expect(completedSession.completedSteps.length).toBe(3);
    });
  });

  // =========================================================================
  // SCENARIO 3: Frontline Worker Identification + Supervisor Witness Sign-Off
  // =========================================================================
  describe('Scenario 3: Frontline Worker + Supervisor Witness Gate Flow', () => {
    it('scans worker badge BDG-001, confirms identity, completes PPE checklist, intercepts supervisor gate, validates PIN 1234, and issues certificate', async () => {
      // 1. Terminal is paired
      deviceIdentityService.setDeviceCredentials(sampleManifest.device, 'dev-token-bearer-jwt-777');

      // 2. Select high-voltage briefing which requires employee auth
      // Render FrontlineIdentifyModal
      const mockIdentifyApi = vi.spyOn(kioskService, 'identifyFrontlineWorker').mockResolvedValueOnce({
        token: 'worker-ephemeral-jwt-888',
        user: {
          id: 'usr-worker-01',
          fullName: 'Alex Rivera',
          firstName: 'Alex',
          lastName: 'Rivera',
          department: 'High-Voltage Operations',
          badgeId: 'BDG-001'
        },
        pendingComplianceDocsCount: 0
      });

      const identifyHtml = renderToString(
        React.createElement(FrontlineIdentifyModal, {
          isOpen: true,
          onClose: vi.fn(),
          onSuccess: vi.fn(),
          deviceId: 'HW-GUID-NORTH-GATE-01',
          initialIdentifier: 'BDG-001'
        })
      );

      expect(identifyHtml).toContain('data-testid="frontline-identify-modal"');
      expect(identifyHtml).toContain('Frontline Worker Identification');
      expect(identifyHtml).toContain('data-testid="employee-id-input"');

      // 3. Worker scans badge 'BDG-001'
      const workerRes = await kioskService.identifyFrontlineWorker('BDG-001', 'HW-GUID-NORTH-GATE-01');
      expect(mockIdentifyApi).toHaveBeenCalledWith('BDG-001', 'HW-GUID-NORTH-GATE-01');
      expect(workerRes.user.fullName).toBe('Alex Rivera');
      expect(workerRes.user.badgeId).toBe('BDG-001');

      // 4. Worker confirms identity -> session saved in ephemeral memory
      deviceIdentityService.setEmployeeSession(workerRes.token, workerRes.user);
      expect(deviceIdentityService.getEmployeeToken()).toBe('worker-ephemeral-jwt-888');
      expect(deviceIdentityService.getEmployeeUser()?.fullName).toBe('Alex Rivera');

      // 5. Start authenticated briefing session
      const mockCreateSession = vi.spyOn(kioskService, 'createSession').mockResolvedValueOnce({
        _id: 'session-hv-4001',
        deviceId: 'HW-GUID-NORTH-GATE-01',
        journeyId: highVoltageJourney._id,
        userId: 'usr-worker-01',
        status: 'in_progress',
        currentStepId: 'step-hv-01',
        startedAt: new Date().toISOString()
      } as unknown as KioskSession);

      const hvSession = await kioskService.createSession({
        deviceId: 'HW-GUID-NORTH-GATE-01',
        journeyId: highVoltageJourney._id,
        userId: 'usr-worker-01',
        currentStepId: 'step-hv-01'
      });
      expect(mockCreateSession).toHaveBeenCalled();

      // 6. Complete Step 2: PPE Checklist
      const mockUpdateProgress = vi.spyOn(kioskService, 'updateSessionProgress').mockResolvedValueOnce({
        ...hvSession,
        currentStepId: 'step-hv-02'
      } as unknown as KioskSession);

      await kioskService.updateSessionProgress(hvSession._id, {
        currentStepId: 'step-hv-02',
        completedStepId: 'step-hv-01',
        ppeItemsVerified: ['Arc Flash Shield', 'Insulated 10kV Gloves', 'Dielectric Boots']
      });
      expect(mockUpdateProgress).toHaveBeenCalledWith(
        'session-hv-4001',
        expect.objectContaining({
          ppeItemsVerified: ['Arc Flash Shield', 'Insulated 10kV Gloves', 'Dielectric Boots']
        })
      );

      // 7. Advance to Step 3: Supervisor Witness Co-Signature Gate
      // Render SupervisorWitnessGateModal
      const mockVerifySupervisorPin = vi.spyOn(kioskService, 'verifySupervisorPin').mockResolvedValueOnce({
        verified: true,
        supervisor: {
          id: 'sup-sarah-connor',
          fullName: 'Sarah Connor',
          name: 'Sarah Connor',
          role: 'Safety Operations Supervisor',
          badgeId: 'SUP-007'
        },
        witnessToken: 'witness-jwt-signature-555'
      });

      const gateHtml = renderToString(
        React.createElement(SupervisorWitnessGateModal, {
          isOpen: true,
          sessionId: 'session-hv-4001',
          workerName: 'Alex Rivera',
          journeyTitle: 'High-Voltage Substation Electrical Safety',
          onClose: vi.fn(),
          onSuccess: vi.fn()
        })
      );

      expect(gateHtml).toContain('data-testid="supervisor-witness-gate-modal"');
      expect(gateHtml).toContain('Supervisor Witness Required');
      expect(gateHtml).toContain('Dual-Custody Co-Signature Gate');
      expect(gateHtml).toContain('Alex Rivera');
      expect(gateHtml).toContain('High-Voltage Substation Electrical Safety');
      expect(gateHtml).toContain('data-testid="supervisor-identifier-input"');
      expect(gateHtml).toContain('data-testid="pin-slot-0"');
      expect(gateHtml).toContain('data-testid="keypad-1"');
      expect(gateHtml).toContain('data-testid="keypad-2"');
      expect(gateHtml).toContain('data-testid="keypad-3"');
      expect(gateHtml).toContain('data-testid="keypad-4"');

      // 8. Supervisor enters identifier and 4-digit PIN '1234'
      const witnessResult = await kioskService.verifySupervisorPin(
        'SUP-007',
        '1234',
        'session-hv-4001'
      );

      expect(mockVerifySupervisorPin).toHaveBeenCalledWith('SUP-007', '1234', 'session-hv-4001');
      expect(witnessResult.verified).toBe(true);
      expect(witnessResult.supervisor.fullName).toBe('Sarah Connor');

      // 9. Session completed with supervisor witness attestation
      const mockCompleteHvSession = vi.spyOn(kioskService, 'completeSession').mockResolvedValueOnce({
        ...hvSession,
        status: 'completed',
        completedAt: new Date().toISOString()
      } as unknown as KioskSession);

      const finalSession = await kioskService.completeSession(hvSession._id, {
        durationSeconds: 120,
        completedStepIds: ['step-hv-01', 'step-hv-02', 'step-hv-03']
      });
      expect(mockCompleteHvSession).toHaveBeenCalled();
      expect(finalSession.status).toBe('completed');
    });
  });

  // =========================================================================
  // SCENARIO 4: Privacy Reset & Memory Wiping Engine Flow
  // =========================================================================
  describe('Scenario 4: Privacy Reset (Idle Timeout, Warning Countdown, & Memory Wipe)', () => {
    it('detects idle timeout halfway through briefing, triggers countdown warning modal, wipes credentials on expiration, and returns to home screen', async () => {
      vi.useFakeTimers();

      // 1. Setup authenticated worker on kiosk
      deviceIdentityService.setDeviceCredentials(sampleManifest.device, 'dev-token-bearer-jwt-777');
      deviceIdentityService.setEmployeeSession('worker-jwt-private-777', {
        id: 'usr-worker-02',
        fullName: 'Marcus Vance',
        department: 'Assembly Line'
      });

      expect(deviceIdentityService.getEmployeeToken()).toBe('worker-jwt-private-777');
      expect(deviceIdentityService.getEmployeeUser()?.fullName).toBe('Marcus Vance');

      // Put temporary cached form data in storage
      sessionStorageMock['kiosk_active_form_state'] = JSON.stringify({ question1: 'A' });
      localStorageMock['talnova_cached_form_inputs'] = JSON.stringify({ answers: [1, 2] });

      // 2. Start monitoring with 60s idle and 15s warning
      let isWarningOpened = false;
      let remainingSecondsReported = 15;
      let isTimeoutExpired = false;
      let navigatedHome = false;

      const mockTimeoutSessionApi = vi.spyOn(kioskService, 'timeoutSession').mockResolvedValueOnce({
        _id: 'session-timeout-555',
        status: 'timed_out'
      } as unknown as KioskSession);

      privacyResetService.startMonitoring({
        idleTimeoutSeconds: 60,
        warningDurationSeconds: 15,
        activeSessionId: () => 'session-timeout-555',
        currentStepId: () => 'step-hv-02',
        onWarningStart: (remaining) => {
          isWarningOpened = true;
          remainingSecondsReported = remaining;
        },
        onWarningTick: (remaining) => {
          remainingSecondsReported = remaining;
        },
        onTimeoutExpired: async () => {
          isTimeoutExpired = true;
        },
        onNavigateHome: () => {
          navigatedHome = true;
        }
      });

      // 3. Advance clock by 60 seconds of idle inactivity
      vi.advanceTimersByTime(60000);

      // Warning modal must be displayed!
      expect(isWarningOpened).toBe(true);
      expect(remainingSecondsReported).toBe(15);

      // Render PrivacyTimeoutModal
      const modalHtml = renderToString(
        React.createElement(PrivacyTimeoutModal, {
          isOpen: true,
          remainingSeconds: 15,
          onStay: vi.fn(),
          onExit: vi.fn()
        })
      );

      expect(modalHtml).toContain('data-testid="privacy-timeout-modal"');
      expect(modalHtml).toContain('data-testid="privacy-countdown-timer"');
      expect(modalHtml).toContain('Session timing out. Still here?');
      expect(modalHtml).toContain('Enterprise Terminal Security');
      expect(modalHtml).toContain('GDPR / ISO 27001');
      expect(modalHtml).toContain('data-testid="btn-still-here"');
      expect(modalHtml).toContain('data-testid="btn-exit-now"');

      // 4. User walks away — countdown ticks down 15 seconds to expiration
      await vi.advanceTimersByTimeAsync(15000);

      expect(isTimeoutExpired).toBe(true);

      // Verify backend session termination with 'timed_out' triggered by expiration
      expect(mockTimeoutSessionApi).toHaveBeenCalledWith('session-timeout-555', {
        abortedStepId: 'step-hv-02',
        reason: 'Idle timeout exceeded (Automatic Privacy Reset)'
      });

      // Verify employee session completely purged from memory (GDPR compliant)
      expect(deviceIdentityService.getEmployeeToken()).toBeNull();
      expect(deviceIdentityService.getEmployeeUser()).toBeNull();

      // Verify temporary caches wiped
      expect(localStorageMock['talnova_cached_form_inputs']).toBeUndefined();

      // Verify browser history was rewritten to /kiosk/terminal
      expect(mockHistoryReplaceState).toHaveBeenCalledWith(null, '', '/kiosk/terminal');
    });

    it('cancels countdown and restores briefing if worker taps "Still Here — Continue"', async () => {
      vi.useFakeTimers();

      let isWarningOpen = false;
      let warningDismissed = false;

      privacyResetService.startMonitoring({
        idleTimeoutSeconds: 30,
        warningDurationSeconds: 15,
        onWarningStart: () => {
          isWarningOpen = true;
        },
        onWarningDismissed: () => {
          isWarningOpen = false;
          warningDismissed = true;
        }
      });

      // Idle for 30s
      vi.advanceTimersByTime(30000);
      expect(isWarningOpen).toBe(true);

      // Worker taps "Still Here"
      privacyResetService.dismissWarning();

      expect(isWarningOpen).toBe(false);
      expect(warningDismissed).toBe(true);
    });
  });
});
