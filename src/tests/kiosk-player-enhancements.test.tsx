import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { KioskPlayer } from '../features/kiosk/components/KioskPlayer';
import { KioskStepContainer } from '../features/kiosk/components/KioskStepContainer';
import { KioskJourney } from '../types/kiosk/journey.types';
import { KioskStep } from '../types/kiosk/step.types';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: any) => options?.defaultValue || _key,
    i18n: { language: 'en', changeLanguage: vi.fn() }
  })
}));

// Mock deviceIdentityService
vi.mock('../features/kiosk/services/device-identity.service', () => ({
  deviceIdentityService: {
    isRevoked: vi.fn(() => false),
    clearRevocationStatus: vi.fn(),
    getHardwareGuidSync: vi.fn(() => 'HW-GUID-TEST-100'),
    getStoredDevice: vi.fn(() => ({ location: 'Turnstile Gate' })),
    getEmployeeUser: vi.fn(() => ({
      id: 'usr-worker-01',
      fullName: 'Alex Rivera',
      firstName: 'Alex',
      lastName: 'Rivera'
    })),
    setEmployeeSession: vi.fn(),
    clearEmployeeSession: vi.fn()
  }
}));

// Mock kioskService
vi.mock('../features/kiosk/services/kiosk.service', () => ({
  kioskService: {
    verifySupervisorPin: vi.fn().mockResolvedValue({
      verified: true,
      supervisor: { id: 'sup-101', name: 'Chief Martinez' },
      witnessToken: 'jwt-witness-token-xyz'
    }),
    verifyPin: vi.fn().mockResolvedValue(true),
    identifyFrontlineWorker: vi.fn().mockResolvedValue({
      token: 'jwt-worker-token-abc',
      user: { id: 'usr-worker-01', fullName: 'Alex Rivera' },
      pendingComplianceDocsCount: 0
    }),
    startSession: vi.fn().mockResolvedValue({
      _id: 'sess-test-999',
      status: 'in_progress',
      currentStepIndex: 0
    }),
    completeSession: vi.fn().mockResolvedValue({
      _id: 'sess-test-999',
      status: 'completed'
    }),
    recordStepAnalytics: vi.fn().mockResolvedValue({ success: true }),
    getEmergencyStatus: vi.fn().mockResolvedValue(null)
  }
}));

// Mock kioskCommandExecutorService
vi.mock('../features/kiosk/services/kiosk-command-executor.service', () => ({
  kioskCommandExecutorService: {
    isInMaintenance: vi.fn(() => false),
    getMaintenanceDetails: vi.fn(() => ({ inMaintenance: false, payload: null })),
    onMaintenanceChange: vi.fn(() => () => {}),
    onManifestReload: vi.fn(() => () => {}),
    setMaintenance: vi.fn()
  }
}));

// Mock useKioskPlayer context hook
const mockUseKioskPlayer = vi.fn();
vi.mock('../features/kiosk/context/KioskPlayerContext', () => ({
  useKioskPlayer: () => mockUseKioskPlayer(),
  KioskPlayerProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

describe('K-RUN-005: Kiosk Player Full Enhancements & Compliance Gates Suite', () => {
  const baseJourney: KioskJourney = {
    _id: 'journey-enhancements-101',
    organizationId: 'org-safety-prime',
    title: 'High Hazard Chemical Facility Protocol',
    description: 'Comprehensive SOP with witness and PIN gating',
    status: 'published',
    version: 2,
    protectionType: 'public',
    languages: ['en', 'es'],
    steps: [
      {
        id: 'step-01-intro',
        title: 'Safety Overview',
        type: 'content',
        order: 0,
        blocks: [
          {
            id: 'b-intro-text',
            type: 'text',
            order: 0,
            mediaReferences: {
              en: { textValue: 'Welcome to safety onboarding.' }
            }
          }
        ]
      },
      {
        id: 'step-02-warning',
        title: 'Corrosive Zone Hazard Notice',
        type: 'warning_step',
        order: 1,
        warningConfig: {
          hazardLevel: 'DANGER',
          oshaCategory: 'chemical',
          signalWord: 'DANGER',
          hazardStatement: 'Severe Skin Burns and Eye Damage Risk',
          precautionaryStatement: 'Wear full Level-B PPE suit before valve operation.',
          symbolCode: 'GHS05'
        },
        blocks: [
          {
            id: 'b-warn-text',
            type: 'text',
            order: 0,
            mediaReferences: {
              en: { textValue: 'Corrosive acid line pressure is monitored continuously.' }
            }
          }
        ]
      },
      {
        id: 'step-03-video',
        title: 'Valve Locking SOP Video Guide',
        type: 'video_step',
        order: 2,
        blocks: [
          {
            id: 'b-vid-yt',
            type: 'video',
            order: 0,
            mediaReferences: {
              en: { embedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
            },
            settings: {
              autoplay: false,
              loop: false,
              aspect: 'landscape',
              watchThresholdPercent: 90
            }
          }
        ]
      },
      {
        id: 'step-04-gate',
        title: 'Supervisor Witness Lockout Verification',
        type: 'supervisor_gate',
        order: 3,
        witnessConfig: {
          supervisorRole: 'Lead Operations Supervisor',
          requiredSignoffCount: 1,
          allowSelfSignoff: false
        },
        blocks: [
          {
            id: 'b-gate-text',
            type: 'text',
            order: 0,
            mediaReferences: {
              en: { textValue: 'Supervisor must visually inspect valve padlock before sign-off.' }
            }
          }
        ]
      },
      {
        id: 'step-05-emergency',
        title: 'Emergency Evacuation Protocol',
        type: 'emergency_step',
        order: 4,
        emergencyConfig: {
          musterPoint: 'Assembly Area C - North Gate',
          evacuationRoute: 'Exit through Bay 4 Fire Door, proceed north along wind indicator.',
          emergencyContact: 'Site Dispatch VHF Ch. 3 / Dial 555'
        },
        blocks: []
      }
    ],
    settings: {
      requireSupervisorWitness: false,
      enablePrivacyTimeout: false,
      complianceStandard: 'OSHA_1910'
    },
    publishedAt: new Date().toISOString()
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseKioskPlayer.mockReturnValue({
      journey: baseJourney,
      currentStepIndex: 0,
      selectedLanguage: 'en',
      isMuted: false,
      volume: 1,
      showSubtitles: false,
      isLoading: false,
      error: null,
      loadJourney: vi.fn(),
      setStepIndex: vi.fn(),
      nextStep: vi.fn(),
      prevStep: vi.fn(),
      changeLanguage: vi.fn(),
      setPlayingAudio: vi.fn(),
      toggleMuted: vi.fn(),
      toggleSubtitles: vi.fn(),
      startSession: vi.fn(),
      recordInteraction: vi.fn(),
      completeSession: vi.fn(),
      abortSession: vi.fn(),
      recordPpeCompliance: vi.fn()
    });
  });

  // =========================================================================
  // 1. Kiosk Entry / Access PIN Enforcement Gate
  // =========================================================================
  describe('Kiosk Access PIN Protection Gate', () => {
    it('renders the Entry PIN Security Gate modal when journey has protectionType: pin', () => {
      const pinProtectedJourney: KioskJourney = {
        ...baseJourney,
        protectionType: 'pin',
        pinCode: '7412'
      };

      mockUseKioskPlayer.mockReturnValue({
        journey: pinProtectedJourney,
        currentStepIndex: 0,
        selectedLanguage: 'en',
        isMuted: false,
        volume: 1,
        showSubtitles: false,
        isLoading: false,
        error: null,
        loadJourney: vi.fn(),
        setStepIndex: vi.fn(),
        nextStep: vi.fn(),
        prevStep: vi.fn(),
        changeLanguage: vi.fn(),
        setPlayingAudio: vi.fn(),
        toggleMuted: vi.fn(),
        toggleSubtitles: vi.fn(),
        startSession: vi.fn(),
        recordInteraction: vi.fn(),
        completeSession: vi.fn(),
        abortSession: vi.fn(),
        recordPpeCompliance: vi.fn()
      });

      const html = renderToString(
        <KioskPlayer
          journey={pinProtectedJourney}
          onExit={vi.fn()}
        />
      );

      // Verify Entry PIN overlay is rendered
      expect(html).toContain('data-testid="kiosk-entry-pin-overlay"');
      expect(html).toContain('Secured Kiosk Terminal');
      expect(html).toContain('Access PIN Required');
      expect(html).toContain('data-testid="kiosk-pin-keypad"');
      // The normal step canvas should not be displayed while locked
      expect(html).not.toContain('data-testid="kiosk-step-container"');
    });

    it('renders without Entry PIN modal when journey is public', () => {
      const html = renderToString(
        <KioskPlayer
          journey={baseJourney}
          onExit={vi.fn()}
        />
      );

      // Should not contain the entry PIN overlay
      expect(html).not.toContain('data-testid="kiosk-entry-pin-overlay"');
      // Should show step or worker identify modal if required
      expect(html).toContain('High Hazard Chemical Facility Protocol');
    });
  });

  // =========================================================================
  // 2. Intermediate Supervisor Witness Step & Attestation Card
  // =========================================================================
  describe('Intermediate Supervisor Gate Step On-Canvas Attestation Card', () => {
    it('renders on-canvas Supervisor Witness Attestation Card when step is supervisor_gate and unverified', () => {
      const gateStep = baseJourney.steps[3]; // supervisor_gate
      const onOpenGateMock = vi.fn();

      const html = renderToString(
        <KioskStepContainer
          step={gateStep}
          stepIndex={3}
          totalSteps={5}
          selectedLanguage="en"
          isSupervisorWitnessed={false}
          onOpenSupervisorGate={onOpenGateMock}
        />
      );

      expect(html).toContain('data-testid="supervisor-gate-card"');
      expect(html).toContain('Supervisor Witness Required');
      expect(html).toContain('Pending Supervisor Authorization');
      expect(html).toContain('data-testid="supervisor-signoff-btn"');
      expect(html).toContain('Supervisor Sign-Off');
    });

    it('renders Verified badge on Supervisor Witness Attestation Card when step is verified', () => {
      const gateStep = baseJourney.steps[3];

      const html = renderToString(
        <KioskStepContainer
          step={gateStep}
          stepIndex={3}
          totalSteps={5}
          selectedLanguage="en"
          isSupervisorWitnessed={true}
        />
      );

      expect(html).toContain('data-testid="supervisor-gate-card"');
      expect(html).toContain('Supervisor Witness Verified');
      expect(html).toContain('Attestation Authorized &amp; Logged');
      // The sign-off button should now be replaced by verified status
      expect(html).not.toContain('data-testid="supervisor-signoff-btn"');
    });
  });

  // =========================================================================
  // 3. Cloud Link Normalization & Media Streaming
  // =========================================================================
  describe('Cloud Link Normalization in KioskStepContainer', () => {
    it('renders YouTube video link inside an responsive iframe embed with nocookie domain', () => {
      const videoStep = baseJourney.steps[2]; // video_step with YouTube link

      const html = renderToString(
        <KioskStepContainer
          step={videoStep}
          stepIndex={2}
          totalSteps={5}
          selectedLanguage="en"
        />
      );

      expect(html).toContain('data-testid="sop-video-embed"');
      expect(html).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
      expect(html).toContain('allowfullscreen');
    });

    it('renders Google Drive video link inside an iframe with preview embed URL', () => {
      const driveStep: KioskStep = {
        id: 'step-drive-sop',
        title: 'Drive SOP Video Guide',
        type: 'video_step',
        order: 0,
        blocks: [
          {
            id: 'b-vid-gdrive',
            type: 'video',
            order: 0,
            mediaReferences: {
              en: { embedUrl: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OIv524DDM/view?usp=sharing' }
            }
          }
        ]
      };

      const html = renderToString(
        <KioskStepContainer
          step={driveStep}
          stepIndex={0}
          totalSteps={1}
          selectedLanguage="en"
        />
      );

      expect(html).toContain('data-testid="sop-video-embed"');
      expect(html).toContain('drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OIv524DDM/preview');
    });

    it('renders standard MP4 video stream inside HTML5 video player', () => {
      const directVideoStep: KioskStep = {
        id: 'step-direct-mp4',
        title: 'Direct Stream Video',
        type: 'video_step',
        order: 0,
        blocks: [
          {
            id: 'b-vid-direct',
            type: 'video',
            order: 0,
            mediaReferences: {
              en: { embedUrl: 'https://cdn.talnova.com/videos/safety-evac-2026.mp4' }
            }
          }
        ]
      };

      const html = renderToString(
        <KioskStepContainer
          step={directVideoStep}
          stepIndex={0}
          totalSteps={1}
          selectedLanguage="en"
        />
      );

      expect(html).toContain('data-testid="sop-video-player"');
      expect(html).toContain('https://cdn.talnova.com/videos/safety-evac-2026.mp4');
      expect(html).not.toContain('data-testid="sop-video-embed"');
    });

    it('renders interactive audio block with controls', () => {
      const audioStep: KioskStep = {
        id: 'step-audio-briefing',
        title: 'Daily Safety Briefing Audio',
        type: 'content',
        order: 0,
        blocks: [
          {
            id: 'b-audio-1',
            type: 'audio',
            order: 0,
            mediaReferences: {
              en: { embedUrl: 'https://cdn.talnova.com/audio/briefing-shift-a.mp3' }
            }
          }
        ]
      };

      const html = renderToString(
        <KioskStepContainer
          step={audioStep}
          stepIndex={0}
          totalSteps={1}
          selectedLanguage="en"
        />
      );

      expect(html).toContain('data-testid="kiosk-audio-player"');
      expect(html).toContain('https://cdn.talnova.com/audio/briefing-shift-a.mp3');
      expect(html).toContain('Audio Briefing');
    });
  });

  // =========================================================================
  // 4. OSHA Hazard Standard Presets for warning_step
  // =========================================================================
  describe('OSHA Hazard Standard Banners for warning_step', () => {
    it('renders DANGER OSHA standard banner with red badge and warning statements', () => {
      const dangerStep = baseJourney.steps[1]; // warning_step DANGER

      const html = renderToString(
        <KioskStepContainer
          step={dangerStep}
          stepIndex={1}
          totalSteps={5}
          selectedLanguage="en"
        />
      );

      expect(html).toContain('data-testid="osha-hazard-banner"');
      expect(html).toContain('DANGER');
      expect(html).toContain('Severe Skin Burns and Eye Damage Risk');
      expect(html).toContain('Wear full Level-B PPE suit before valve operation.');
      expect(html).toContain('bg-rose-600');
    });

    it('renders CAUTION OSHA standard banner with amber badge', () => {
      const cautionStep: KioskStep = {
        id: 'step-caution-trip',
        title: 'Uneven Surface Notice',
        type: 'warning_step',
        order: 0,
        warningConfig: {
          hazardLevel: 'CAUTION',
          signalWord: 'CAUTION',
          hazardStatement: 'Trip and Fall Hazard on Ramp 4'
        },
        blocks: []
      };

      const html = renderToString(
        <KioskStepContainer
          step={cautionStep}
          stepIndex={0}
          totalSteps={1}
          selectedLanguage="en"
        />
      );

      expect(html).toContain('data-testid="osha-hazard-banner"');
      expect(html).toContain('CAUTION');
      expect(html).toContain('Trip and Fall Hazard on Ramp 4');
      expect(html).toContain('bg-amber-500');
    });
  });

  // =========================================================================
  // 5. Emergency Evacuation Route & Muster Point Display
  // =========================================================================
  describe('Emergency Evacuation Step Display', () => {
    it('renders designated muster point, evacuation route, and dispatch contact', () => {
      const emergencyStep = baseJourney.steps[4]; // emergency_step

      const html = renderToString(
        <KioskStepContainer
          step={emergencyStep}
          stepIndex={4}
          totalSteps={5}
          selectedLanguage="en"
        />
      );

      expect(html).toContain('data-testid="emergency-step-container"');
      expect(html).toContain('Assembly Area C - North Gate');
      expect(html).toContain('Exit through Bay 4 Fire Door, proceed north along wind indicator.');
      expect(html).toContain('Site Dispatch VHF Ch. 3 / Dial 555');
      expect(html).toContain('Designated Muster Point');
    });
  });

  // =========================================================================
  // 6. Scrollable Canvas Top-Safe Centering & Bottom Clearance
  // =========================================================================
  describe('Scrollable Screen Canvas Architecture', () => {
    it('applies top-safe vertical centering and generous bottom clearance to prevent top-clipping and footer occlusion', () => {
      const step = baseJourney.steps[0];

      const html = renderToString(
        <KioskStepContainer
          step={step}
          stepIndex={0}
          totalSteps={5}
          selectedLanguage="en"
        />
      );

      // Verify scrollable container has bottom clearance for sticky 96px footer
      expect(html).toContain('pb-28 sm:pb-36');
      expect(html).toContain('scrollbar-thin');
      // Verify inner container uses justify-start my-auto to eliminate flex justify-center top-clipping
      expect(html).toContain('justify-start my-auto');
    });
  });

  // =========================================================================
  // 7. Dedicated Printable Safety Certificate Architecture
  // =========================================================================
  describe('Official Printable Safety Certificate Layout', () => {
    it('renders dedicated isolated printable certificate with verification credentials, QR code, and SHA-256 checksum', () => {
      const html = renderToString(
        <KioskPlayer
          journey={baseJourney}
          initialCompleted={true}
          onExit={vi.fn()}
        />
      );

      // Verify print engine target exists in DOM
      expect(html).toContain('data-testid="kiosk-printable-certificate"');
      expect(html).toContain('id="kiosk-printable-certificate"');
      expect(html).toContain('OFFICIAL ACCREDITATION');
      expect(html).toContain('OSHA Standard 1910 / ISO 45001 Regulatory Verification');
      expect(html).toContain('SHA-256 CHECKSUM');
      expect(html).toContain('data-testid="print-certificate-btn"');
    });
  });

  // =========================================================================
  // 8. Phase 3: Video Watch Threshold Progress Badge & Compliance
  // =========================================================================
  describe('Phase 3: Video Watch Threshold Progress Badge & Controls', () => {
    it('renders video watch progress badge displaying watch percentage vs requirement', () => {
      const videoStep = baseJourney.steps[2]; // video_step with watchThresholdPercent: 90

      const html = renderToString(
        <KioskStepContainer
          step={videoStep}
          stepIndex={2}
          totalSteps={5}
          selectedLanguage="en"
          videoWatchPercent={45}
        />
      );

      expect(html).toContain('data-testid="video-watch-progress"');
      expect(html).toContain('Watched: 45% / Required: 90%');
    });

    it('displays threshold satisfied status badge when threshold percentage is satisfied', () => {
      const videoStep = baseJourney.steps[2];

      const html = renderToString(
        <KioskStepContainer
          step={videoStep}
          stepIndex={2}
          totalSteps={5}
          selectedLanguage="en"
          videoWatchPercent={95}
        />
      );

      expect(html).toContain('data-testid="video-watch-progress"');
      expect(html).toContain('Threshold Met');
    });

    it('enforces WCAG touch target dimensions on video confirmation button (>= 48x48px)', () => {
      const videoStep = baseJourney.steps[2];

      const html = renderToString(
        <KioskStepContainer
          step={videoStep}
          stepIndex={2}
          totalSteps={5}
          selectedLanguage="en"
          videoCompleted={false}
          onVideoComplete={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="sop-video-complete-btn"');
      expect(html).toContain('min-h-[48px]');
      expect(html).toContain('min-w-[48px]');
    });
  });

  // =========================================================================
  // 9. Phase 3: Warning & Emergency Step Dwell Countdown & Hazard Acknowledgment
  // =========================================================================
  describe('Phase 3: Warning & Emergency Step Dwell Countdown & Hazard Acknowledgment', () => {
    it('renders active dwell timer chip and disabled acknowledge button during dwell countdown', () => {
      const dangerStep = baseJourney.steps[1]; // warning_step

      const html = renderToString(
        <KioskStepContainer
          step={dangerStep}
          stepIndex={1}
          totalSteps={5}
          selectedLanguage="en"
          dwellSeconds={3}
        />
      );

      // Verify active dwell countdown chip in OSHA banner
      expect(html).toContain('data-testid="hazard-dwell-timer"');
      expect(html).toContain('Review Hazard (3s)');

      // Verify acknowledge hazard button is locked during active dwell
      expect(html).toContain('data-testid="acknowledge-hazard-btn"');
      expect(html).toContain('disabled=""');
      expect(html).toContain('cursor-not-allowed');
    });

    it('renders cleared dwell chip and enables acknowledge hazard button when dwell is satisfied', () => {
      const dangerStep = baseJourney.steps[1];

      const html = renderToString(
        <KioskStepContainer
          step={dangerStep}
          stepIndex={1}
          totalSteps={5}
          selectedLanguage="en"
          dwellSeconds={0}
        />
      );

      // Verify dwell cleared badge is rendered
      expect(html).toContain('data-testid="hazard-dwell-cleared"');
      expect(html).toContain('Hazard Reviewed');

      // Verify acknowledge hazard button is active
      expect(html).toContain('data-testid="acknowledge-hazard-btn"');
      expect(html).not.toContain('disabled=""');
      expect(html).toContain('Acknowledge Hazard &amp; Proceed');
    });

    it('renders dwell countdown timer on emergency evacuation step', () => {
      const emergencyStep = baseJourney.steps[4]; // emergency_step

      const html = renderToString(
        <KioskStepContainer
          step={emergencyStep}
          stepIndex={4}
          totalSteps={5}
          selectedLanguage="en"
          dwellSeconds={5}
        />
      );

      expect(html).toContain('data-testid="emergency-step-container"');
      expect(html).toContain('data-testid="hazard-dwell-timer"');
      expect(html).toContain('Review Hazard (5s)');
    });

    it('disables yes/no decision buttons on warning step during active dwell', () => {
      const warningYesNoStep: KioskStep = {
        id: 'step-warn-decision',
        title: 'Chemical Siphon Valve Verification',
        type: 'warning_step',
        order: 1,
        warningConfig: {
          hazardLevel: 'DANGER',
          signalWord: 'DANGER',
          hazardStatement: 'Toxic Vapor Release Zone'
        },
        interaction: {
          type: 'yes_no'
        },
        blocks: []
      };

      const html = renderToString(
        <KioskStepContainer
          step={warningYesNoStep}
          stepIndex={1}
          totalSteps={2}
          selectedLanguage="en"
          dwellSeconds={4}
          onYesNoSelection={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="yes-btn"');
      expect(html).toContain('disabled=""');
      expect(html).toContain('cursor-not-allowed');
      expect(html).toContain('(4s)');
    });
  });

  // =========================================================================
  // 10. Phase 4: Step Type Studio Parity in Player
  // =========================================================================
  describe('Phase 4: Step Type Studio Parity in Player', () => {
    it('infers OSHA NOTICE severity preset from title prefix and renders GHS code and citation', () => {
      const noticeStep: KioskStep = {
        id: 'step-notice-hygiene',
        title: '[NOTICE] Safety Hygiene Policy',
        type: 'warning_step',
        order: 0,
        warningConfig: {
          symbolCode: 'GHS05',
          oshaCategory: 'Category 1B Corrosive',
          complianceStandard: 'OSHA 1910.145(c)(3)'
        },
        blocks: []
      };

      const html = renderToString(
        <KioskStepContainer
          step={noticeStep}
          stepIndex={0}
          totalSteps={1}
          selectedLanguage="en"
        />
      );

      expect(html).toContain('data-testid="osha-hazard-banner"');
      expect(html).toContain('data-hazard-level="notice"');
      expect(html).toContain('NOTICE: MANDATORY FACILITY POLICY');
      expect(html).toContain('bg-sky-600');
      expect(html).toContain('border-sky-500');
      expect(html).toContain('GHS05');
      expect(html).toContain('Category: Category 1B Corrosive');
      expect(html).toContain('Standard Reference: OSHA 1910.145(c)(3)');
    });

    it('infers OSHA DANGER from title prefix when warningConfig.hazardLevel is omitted', () => {
      const studioDangerStep: KioskStep = {
        id: 'step-danger-studio',
        title: '[DANGER] Extreme High Voltage Zone',
        type: 'warning_step',
        order: 0,
        blocks: []
      };

      const html = renderToString(
        <KioskStepContainer
          step={studioDangerStep}
          stepIndex={0}
          totalSteps={1}
          selectedLanguage="en"
        />
      );

      expect(html).toContain('data-testid="osha-hazard-banner"');
      expect(html).toContain('data-hazard-level="danger"');
      expect(html).toContain('DANGER: IMMEDIATE CRITICAL HAZARD');
      expect(html).toContain('bg-rose-600');
    });

    it('extracts emergency muster point and radio frequency from StepTypeStudio interaction fields', () => {
      const studioEmergencyStep: KioskStep = {
        id: 'step-emergency-studio',
        title: 'Emergency Evacuation Drill',
        type: 'emergency_step',
        order: 0,
        interaction: {
          type: 'none',
          incorrectStepId: 'Muster Point Delta - Rail Siding Gate 2',
          correctStepId: 'VHF Emergency Ch. 09 / Dial 9911'
        },
        blocks: []
      };

      const html = renderToString(
        <KioskStepContainer
          step={studioEmergencyStep}
          stepIndex={0}
          totalSteps={1}
          selectedLanguage="en"
        />
      );

      expect(html).toContain('data-testid="emergency-step-container"');
      expect(html).toContain('Muster Point Delta - Rail Siding Gate 2');
      expect(html).toContain('VHF Emergency Ch. 09 / Dial 9911');
      expect(html).toContain('Designated Muster Point');
    });

    it('renders on-canvas supervisor witness card with awaiting status, role, and sign-off button', () => {
      const supervisorStep: KioskStep = {
        id: 'step-supervisor-gate-1',
        title: 'High-Risk Electrical Lockout Verification',
        type: 'supervisor_gate',
        order: 0,
        witnessConfig: {
          supervisorRole: 'Master Electrician Supervisor'
        } as any,
        blocks: []
      };

      const onOpenGateMock = vi.fn();

      const html = renderToString(
        <KioskStepContainer
          step={supervisorStep}
          stepIndex={0}
          totalSteps={1}
          selectedLanguage="en"
          isSupervisorWitnessed={false}
          onOpenSupervisorGate={onOpenGateMock}
        />
      );

      expect(html).toContain('data-testid="supervisor-gate-card"');
      expect(html).toContain('Awaiting Supervisor Co-Signature');
      expect(html).toContain('Master Electrician Supervisor');
      expect(html).toContain('data-testid="supervisor-signoff-btn"');
      expect(html).toContain('Supervisor Sign-Off');
    });

    it('renders supervisor verified state with witness credentials and authorization timestamp', () => {
      const supervisorStep: KioskStep = {
        id: 'step-supervisor-gate-2',
        title: 'Confined Space Permit Authorization',
        type: 'supervisor_gate',
        order: 0,
        blocks: []
      };

      const witnessData = {
        fullName: 'Sarah Jenkins',
        role: 'Safety Director',
        verifiedAt: '10:45:00 AM'
      };

      const html = renderToString(
        <KioskStepContainer
          step={supervisorStep}
          stepIndex={0}
          totalSteps={1}
          selectedLanguage="en"
          isSupervisorWitnessed={true}
          supervisorWitnessData={witnessData}
        />
      );

      expect(html).toContain('data-testid="supervisor-gate-card"');
      expect(html).toContain('Supervisor Witness Verified');
      expect(html).toContain('Authorized');
      expect(html).toContain('Sarah Jenkins');
      expect(html).toContain('Safety Director');
      expect(html).toContain('Verified: 10:45:00 AM');
      expect(html).not.toContain('data-testid="supervisor-signoff-btn"');
    });

    it('aliases studio step types directly to their interaction engines without explicit interaction.type', () => {
      // 1. interactive_confirmation aliasing
      const holdStep: KioskStep = {
        id: 'step-studio-hold',
        title: 'Emergency Fuel Line Purge Confirmation',
        type: 'interactive_confirmation',
        order: 0,
        blocks: []
      };

      const holdHtml = renderToString(
        <KioskStepContainer
          step={holdStep}
          stepIndex={0}
          totalSteps={1}
          selectedLanguage="en"
        />
      );
      expect(holdHtml).toContain('data-testid="hold-to-confirm-btn"');
      expect(holdHtml).toContain('Touch &amp; Hold to Confirm');

      // 2. ppe_checklist aliasing
      const ppeStep: KioskStep = {
        id: 'step-studio-ppe',
        title: 'Chemical Bay Entry Inspection',
        type: 'ppe_checklist',
        order: 1,
        blocks: []
      };

      const ppeHtml = renderToString(
        <KioskStepContainer
          step={ppeStep}
          stepIndex={1}
          totalSteps={2}
          selectedLanguage="en"
          onSubmitPpe={vi.fn()}
        />
      );
      expect(ppeHtml).toContain('Mandatory PPE Verification Checklist');
      expect(ppeHtml).toContain('data-testid="ppe-check-hard-hat"');
      expect(ppeHtml).toContain('data-testid="ppe-confirm-btn"');

      // 3. knowledge_quiz aliasing
      const quizStep: KioskStep = {
        id: 'step-studio-quiz',
        title: 'Fall Protection Knowledge Assessment',
        type: 'knowledge_quiz',
        order: 2,
        quiz: {
          passingScore: 80,
          questions: [
            {
              id: 'q1',
              question: 'What is the required tie-off height for fall arrest systems?',
              options: ['4 feet', '6 feet', '10 feet'],
              correctOptionIndex: 1
            }
          ]
        },
        blocks: []
      };

      const quizHtml = renderToString(
        <KioskStepContainer
          step={quizStep}
          stepIndex={2}
          totalSteps={3}
          selectedLanguage="en"
        />
      );
      expect(quizHtml).toContain('What is the required tie-off height for fall arrest systems?');
      expect(quizHtml).toContain('6 feet');
    });
  });
});

